import path from 'path';

export class AnalysisStorageService {
  constructor() {
    this.tempDir = null;
    this.initializeTempDir();
  }

  async initializeTempDir() {
    try {
      if (window.electronAPI && window.electronAPI.getTempDir) {
        this.tempDir = await window.electronAPI.getTempDir();
        // Create MGXReader analysis directory
        const analysisDir = path.join(this.tempDir, 'MGXReader', 'analysis');
        await this.ensureDirectoryExists(analysisDir);
        this.tempDir = analysisDir;
      } else {
        // Browser fallback - use localStorage
        this.tempDir = 'localStorage';
      }
      
      // Run startup cleanup after initialization
      await this.cleanupOnStartup();
    } catch (error) {
      console.error('Failed to initialize temp directory:', error);
      this.tempDir = 'localStorage';
    }
  }

  // Cleanup orphaned analysis files on startup
  async cleanupOnStartup() {
    try {
      console.log('🧹 AnalysisStorageService: Başlangıç temizliği başlatılıyor...');
      
      // Get list of all analysis files
      if (this.tempDir === 'localStorage') {
        // Clean up old format and temp files from localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('mgx_analysis_')) {
            // Check if it's a temp file or old format
            if (key.includes('temp_')) {
              keysToRemove.push(key);
              continue;
            }
            
            try {
              const content = localStorage.getItem(key);
              if (content) {
                const parsed = JSON.parse(content);
                // Remove old format files (no projectName)
                if (!parsed.projectName) {
                  keysToRemove.push(key);
                  console.log('🗑️ Eski format dosya temizlenecek:', key);
                }
              }
            } catch (e) {
              // Invalid JSON, remove it
              keysToRemove.push(key);
            }
          }
        }
        
        // Remove all identified keys
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log('✅ Temizlendi:', key);
        });
        
        if (keysToRemove.length > 0) {
          console.log(`✅ localStorage temizliği: ${keysToRemove.length} eski/temp dosya silindi`);
        }
        return;
      }
      
      // FileSystem cleanup - check for files older than 7 days
      if (window.electronAPI && window.electronAPI.listFiles) {
        const files = await window.electronAPI.listFiles(this.tempDir);
        let cleanedCount = 0;
        
        for (const file of files) {
          try {
            const filePath = path.join(this.tempDir, file);
            const stats = await window.electronAPI.getFileStats(filePath);
            
            // Delete files older than 7 days
            const fileAge = Date.now() - new Date(stats.mtime).getTime();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            
            if (fileAge > sevenDays) {
              await window.electronAPI.deleteFile(filePath);
              cleanedCount++;
              console.log(`  ❌ Eski dosya silindi: ${file} (${Math.floor(fileAge / (24 * 60 * 60 * 1000))} gün önce)`);
            }
          } catch (err) {
            console.warn(`  ⚠️ Dosya temizlenemedi: ${file}`, err);
          }
        }
        
        if (cleanedCount > 0) {
          console.log(`✅ FileSystem temizliği: ${cleanedCount} eski analiz dosyası silindi`);
        } else {
          console.log('✅ FileSystem temizliği: Temizlenecek eski dosya bulunamadı');
        }
      }
    } catch (error) {
      console.warn('⚠️ Başlangıç temizliği hatası:', error);
    }
  }

  async ensureDirectoryExists(dirPath) {
    if (window.electronAPI && window.electronAPI.ensureDir) {
      await window.electronAPI.ensureDir(dirPath);
    }
  }

  // Generate analysis file key based on script content hash
  generateAnalysisKey(scriptText, fileName) {
    // Simple hash function for consistent key generation
    let hash = 0;
    const content = scriptText + fileName;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `analysis_${Math.abs(hash).toString(36)}.json`;
  }

  // Generate analysis filename by type (NO TIMESTAMP - each type overwrites previous)
  generateAnalysisFileName(projectName, analysisType) {
    // Clean project name: remove special chars, limit length
    const cleanName = (projectName || 'Unnamed_Project')
      .replace(/[^a-zA-Z0-9\u00C0-\u017F_-]/g, '_') // Keep alphanumeric, Turkish chars, underscore, hyphen
      .replace(/_+/g, '_') // Remove duplicate underscores
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 50); // Limit to 50 chars
    
    // Clean analysis type
    const cleanType = analysisType.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    // Format: projectname_analysistype.json (NO VERSION, NO TIMESTAMP!)
    // Examples: script_character.json, script_location.json
    return `${cleanName}_${cleanType}.json`;
  }

  // Save analysis data by type (each type = separate file, overwrites previous)
  async saveAnalysisByType(projectName, analysisType, analysisResult, scriptMetadata = {}) {
    try {
      const fileName = this.generateAnalysisFileName(projectName, analysisType);
      
      const dataToSave = {
        projectName,
        analysisType,
        timestamp: new Date().toISOString(),
        result: analysisResult,
        metadata: {
          ...scriptMetadata,
          version: '1.2' // New version for per-type system
        }
      };

      if (this.tempDir === 'localStorage') {
        localStorage.setItem(`mgx_analysis_${fileName}`, JSON.stringify(dataToSave));
      } else {
        const filePath = path.join(this.tempDir, fileName);
        await window.electronAPI.saveFileContent({
          filePath,
          data: JSON.stringify(dataToSave, null, 2),
          encoding: 'utf8'
        });
      }

      console.log(`✅ ${analysisType} analizi kaydedildi: ${fileName}`);
      return fileName;
    } catch (error) {
      console.error(`Failed to save ${analysisType} analysis:`, error);
      throw error;
    }
  }

  // Load specific analysis type
  async loadAnalysisByType(projectName, analysisType) {
    try {
      const fileName = this.generateAnalysisFileName(projectName, analysisType);
      
      if (this.tempDir === 'localStorage') {
        const stored = localStorage.getItem(`mgx_analysis_${fileName}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log(`✅ ${analysisType} yüklendi (localStorage)`);
          return parsed.result;
        }
      } else {
        const filePath = path.join(this.tempDir, fileName);
        if (await window.electronAPI.fileExists(filePath)) {
          const content = await window.electronAPI.readFileContent(filePath);
          const parsed = JSON.parse(content);
          console.log(`✅ ${analysisType} yüklendi: ${fileName}`);
          return parsed.result;
        }
      }

      return null;
    } catch (error) {
      console.error(`Failed to load ${analysisType}:`, error);
      return null;
    }
  }

  // Load ALL analysis types for a project
  async loadAllAnalyses(projectName) {
    try {
      console.log(`📥 ${projectName} için tüm analizler yükleniyor...`);
      
      const analyses = await this.listAnalyses();
      const projectAnalyses = analyses.filter(a => a.projectName === projectName);
      
      if (projectAnalyses.length === 0) {
        console.warn(`⚠️ ${projectName} için analiz bulunamadı`);
        return null;
      }
      
      const customResults = {};
      let loadedCount = 0;
      
      for (const analysis of projectAnalyses) {
        if (analysis.analysisType) {
          const result = await this.loadAnalysisByType(projectName, analysis.analysisType);
          if (result) {
            customResults[analysis.analysisType] = result;
            loadedCount++;
          } else {
            console.warn(`⚠️ ${analysis.analysisType} analizi yüklenemedi`);
          }
        }
      }
      
      if (loadedCount === 0) {
        console.error(`❌ ${projectName} için hiçbir analiz yüklenemedi`);
        return null;
      }
      
      console.log(`✅ ${Object.keys(customResults).length}/${projectAnalyses.length} analiz türü yüklendi`);
      return { customResults };
    } catch (error) {
      console.error('Failed to load all analyses:', error);
      return null;
    }
  }

  // LEGACY: Keep old saveAnalysis for backward compatibility
  async saveAnalysis(scriptText, fileName, analysisData, scriptMetadata = {}) {
    try {
      const projectName = scriptMetadata.projectName || 
                          scriptMetadata.originalFileName || 
                          fileName.replace(/\.(pdf|txt|fountain)$/i, '');
      
      // If analysisData has customResults, save each type separately
      if (analysisData.customResults) {
        const results = [];
        for (const [type, result] of Object.entries(analysisData.customResults)) {
          await this.saveAnalysisByType(projectName, type, result, scriptMetadata);
          results.push(type);
        }
        console.log(`✅ ${results.length} analiz türü kaydedildi: ${results.join(', ')}`);
        return projectName;
      }
      
      // Otherwise save as single analysis
      const analysisType = scriptMetadata.analysisType || 'full';
      return await this.saveAnalysisByType(projectName, analysisType, analysisData, scriptMetadata);
    } catch (error) {
      console.error('Failed to save analysis:', error);
      throw error;
    }
  }

  // Load analysis data by analysis key (for saved analyses list)
  async loadAnalysisByKey(analysisKey) {
    try {
      // Support both old hash-based keys and new readable filenames
      const keyVariants = [
        analysisKey,
        `${analysisKey}.json`,
        analysisKey.replace('.json', '')
      ];
      
      if (this.tempDir === 'localStorage') {
        // Browser fallback
        for (const variant of keyVariants) {
          const stored = localStorage.getItem(`mgx_analysis_${variant}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            console.log(`✅ Analiz yüklendi (localStorage): ${parsed.readableFileName || variant}`);
            return parsed.analysisData;
          }
        }
      } else {
        // Electron environment - try all variants
        for (const variant of keyVariants) {
          const filePath = path.join(this.tempDir, variant.endsWith('.json') ? variant : `${variant}.json`);
          if (await window.electronAPI.fileExists(filePath)) {
            const content = await window.electronAPI.readFileContent(filePath);
            const parsed = JSON.parse(content);
            console.log(`✅ Analiz yüklendi: ${parsed.readableFileName || variant}`);
            return parsed.analysisData;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Analiz yükleme hatası:', error);
      return null;
    }
  }

  // Find analysis by PDF file name similarity
  async findAnalysisByFileName(pdfFileName, threshold = 0.7) {
    try {
      const analyses = await this.listAnalyses();
      
      // Simple string similarity for PDF matching
      const calculateSimilarity = (str1, str2) => {
        const a = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
        const b = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (a === b) return 1.0;
        if (a.includes(b) || b.includes(a)) return 0.9;
        
        let matches = 0;
        const minLength = Math.min(a.length, b.length);
        for (let i = 0; i < minLength; i++) {
          if (a[i] === b[i]) matches++;
        }
        return matches / Math.max(a.length, b.length);
      };

      const matches = analyses
        .map(analysis => ({
          ...analysis,
          similarity: Math.max(
            calculateSimilarity(pdfFileName, analysis.fileName),
            calculateSimilarity(pdfFileName, analysis.scriptMetadata?.originalFileName || '')
          )
        }))
        .filter(match => match.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);

      console.log(`📁 PDF Match Search for "${pdfFileName}":`, matches);
      return matches.length > 0 ? matches[0] : null;
    } catch (error) {
      console.error('Failed to find analysis by filename:', error);
      return null;
    }
  }

  // LEGACY: Load analysis (tries new system first, falls back to old)
  async loadAnalysis(scriptText, fileName) {
    try {
      const projectName = fileName.replace(/\.(pdf|txt|fountain)$/i, '');
      
      // Try new system first
      const newResults = await this.loadAllAnalyses(projectName);
      if (newResults && Object.keys(newResults.customResults || {}).length > 0) {
        console.log(`✅ Yeni sistemden ${Object.keys(newResults.customResults).length} analiz yüklendi`);
        return newResults;
      }
      
      // Fallback to old system
      const analysisKey = this.generateAnalysisKey(scriptText, fileName);
      
      if (this.tempDir === 'localStorage') {
        const stored = localStorage.getItem(`mgx_analysis_${analysisKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log(`⚠️ Eski sistemden analiz yüklendi (localStorage)`);
          return parsed.analysisData;
        }
      } else {
        const filePath = path.join(this.tempDir, analysisKey);
        if (await window.electronAPI.fileExists(filePath)) {
          const content = await window.electronAPI.readFileContent(filePath);
          const parsed = JSON.parse(content);
          console.log(`⚠️ Eski sistemden analiz yüklendi: ${filePath}`);
          return parsed.analysisData;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to load analysis:', error);
      return null;
    }
  }

  // Check if analysis exists for given script
  async hasAnalysis(scriptText, fileName) {
    try {
      const analysisKey = this.generateAnalysisKey(scriptText, fileName);
      
      if (this.tempDir === 'localStorage') {
        return localStorage.getItem(`mgx_analysis_${analysisKey}`) !== null;
      } else {
        const filePath = path.join(this.tempDir, analysisKey);
        return await window.electronAPI.fileExists(filePath);
      }
    } catch (error) {
      console.error('Failed to check analysis existence:', error);
      return false;
    }
  }

  // List all saved analyses (NEW: groups by project)
  async listAnalyses() {
    try {
      const analyses = [];
      
      if (this.tempDir === 'localStorage') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('mgx_analysis_')) {
            const content = localStorage.getItem(key);
            if (content) {
              const parsed = JSON.parse(content);
              
              // Skip temp files and old format files
              if (key.includes('temp_')) {
                console.log('🗑️ Geçici dosya atlandı:', key);
                continue;
              }
              if (!parsed.projectName) {
                console.log('⚠️ Eski format dosya atlandı (projectName yok):', key);
                continue;
              }
              
              analyses.push({
                key: key.replace('mgx_analysis_', '').replace('.json', ''),
                fileName: parsed.fileName || key,
                projectName: parsed.projectName,
                analysisType: parsed.analysisType,
                timestamp: parsed.timestamp,
                metadata: parsed.metadata
              });
            }
          }
        }
      } else {
        // Electron environment
        if (await window.electronAPI.directoryExists(this.tempDir)) {
          const files = await window.electronAPI.listDirectory(this.tempDir);
          for (const file of files) {
            if (file.endsWith('.json') && !file.includes('temp_')) {
              try {
                const filePath = path.join(this.tempDir, file);
                const content = await window.electronAPI.readFileContent(filePath);
                const parsed = JSON.parse(content);
                
                // Skip old format files
                if (!parsed.projectName) continue;
                
                analyses.push({
                  key: file.replace('.json', ''),
                  fileName: file,
                  projectName: parsed.projectName,
                  analysisType: parsed.analysisType,
                  timestamp: parsed.timestamp,
                  metadata: parsed.metadata
                });
              } catch (e) {
                console.warn(`⚠️ Analiz dosyası okunamadı (${file}):`, e);
              }
            }
          }
        }
      }

      return analyses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Failed to list analyses:', error);
      return [];
    }
  }

  // List analyses grouped by project
  async listProjectAnalyses() {
    try {
      const analyses = await this.listAnalyses();
      const projects = new Map();
      
      for (const analysis of analyses) {
        if (!projects.has(analysis.projectName)) {
          projects.set(analysis.projectName, {
            projectName: analysis.projectName,
            analyses: [],
            lastUpdate: analysis.timestamp
          });
        }
        
        const project = projects.get(analysis.projectName);
        project.analyses.push(analysis);
        
        // Update last update time
        if (new Date(analysis.timestamp) > new Date(project.lastUpdate)) {
          project.lastUpdate = analysis.timestamp;
        }
      }
      
      // Convert to array and sort by last update
      return Array.from(projects.values())
        .sort((a, b) => new Date(b.lastUpdate) - new Date(a.lastUpdate));
    } catch (error) {
      console.error('Failed to list project analyses:', error);
      return [];
    }
  }

  // Clear old analyses (older than 30 days by default)
  async clearOldAnalyses(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days in ms
    try {
      const cutoffDate = new Date(Date.now() - maxAge);
      const analyses = await this.listAnalyses();
      
      for (const analysis of analyses) {
        if (new Date(analysis.timestamp) < cutoffDate) {
          await this.deleteAnalysis(analysis.key);
          console.log(`Deleted old analysis: ${analysis.fileName}`);
        }
      }
    } catch (error) {
      console.error('Failed to clear old analyses:', error);
    }
  }

  // Delete specific analysis - KAPSAMLI TEMİZLEME
  async deleteAnalysis(analysisKey) {
    try {
      console.log('🗑️ Analiz siliniyor:', analysisKey);
      let deletedCount = 0;
      
      // 1. FileSystem'den sil
      if (this.tempDir === 'localStorage') {
        // LocalStorage'dan sil
        const mainKey = `mgx_analysis_${analysisKey}`;
        if (localStorage.getItem(mainKey)) {
          localStorage.removeItem(mainKey);
          deletedCount++;
          console.log(`🗑️ LocalStorage key silindi: ${mainKey}`);
        }
      } else {
        // FileSystem'den sil
        const fileName = analysisKey.endsWith('.json') ? analysisKey : `${analysisKey}.json`;
        const filePath = path.join(this.tempDir, fileName);
        if (await window.electronAPI.fileExists(filePath)) {
          await window.electronAPI.deleteFile(filePath);
          deletedCount++;
          console.log(`🗑️ Dosya silindi: ${fileName}`);
        } else {
          console.warn(`⚠️ Dosya bulunamadı: ${filePath}`);
        }
      }
      
      // 2. LocalStorage'daki ilgili tüm anahtarları temizle
      const baseKey = analysisKey.replace('.json', '').replace('analysis_', '');
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes(baseKey) ||
          key.includes(analysisKey) ||
          (key.startsWith('mgx_analysis_') && key.includes(baseKey)) ||
          (key.startsWith('analysis_checkpoint_') && key.includes(baseKey)) ||
          (key.startsWith('temp_') && key.includes(baseKey))
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        deletedCount++;
        console.log(`🗑️ İlişkili key silindi: ${key}`);
      });
      
      console.log(`✅ Toplam ${deletedCount} kayıt silindi`);
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      throw error; // Re-throw to let caller handle
    }
  }

  // Delete all analyses for a specific project
  async deleteProject(projectName) {
    try {
      console.log('🗑️ Proje analizleri siliniyor:', projectName);
      
      const analyses = await this.listAnalyses();
      const projectAnalyses = analyses.filter(a => a.projectName === projectName);
      
      let deletedCount = 0;
      for (const analysis of projectAnalyses) {
        await this.deleteAnalysis(analysis.key);
        deletedCount++;
      }
      
      // Also clean up localStorage keys with scriptId
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Try to match keys that might belong to this project
        if (key && (
          key.includes(projectName) ||
          key.startsWith('character_image_') ||
          key.startsWith('location_image_') ||
          key.startsWith('character_reference_') ||
          key.startsWith('location_reference_') ||
          key.startsWith('mgx_storyboard_')
        )) {
          // For image keys, we can't easily determine which project they belong to
          // So we'll be conservative and only remove if they contain the project name
          if (key.includes(projectName)) {
            keysToRemove.push(key);
          }
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Proje key silindi: ${key}`);
      });
      
      console.log(`✅ ${projectName}: ${deletedCount} analiz + ${keysToRemove.length} localStorage key silindi`);
      return { deletedCount, localStorageKeys: keysToRemove.length };
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  }

  // Clear all analyses - KAPSAMLI TEMİZLEME
  async clearAll() {
    try {
      console.log('🧹 KAPSAMLI ANALİZ TEMİZLEME BAŞLIYOR...');
      
      // Ensure tempDir is initialized
      if (!this.tempDir) {
        await this.initializeTempDir();
      }

      let successCount = 0;
      let errorCount = 0;

      // 1. FileSystem'den analizleri sil
      const analyses = await this.listAnalyses();
      console.log(`📁 ${analyses.length} dosya bulundu`);
      
      for (const analysis of analyses) {
        try {
          await this.deleteAnalysis(analysis.key);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete analysis ${analysis.key}:`, error);
          errorCount++;
        }
      }

      // 2. LocalStorage'dan TÜM analiz anahtarlarını temizle
      const lsKeysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('mgx_analysis_') || 
          key.startsWith('mgx_storyboard_') ||
          key.startsWith('analysis_checkpoint_') ||
          key.startsWith('temp_') ||
          key.startsWith('character_image_') ||       // Karakter görselleri
          key.startsWith('location_image_') ||        // Mekan görselleri
          key.startsWith('character_reference_') ||   // Karakter referans görselleri
          key.startsWith('location_reference_')       // Mekan referans görselleri
        )) {
          lsKeysToRemove.push(key);
        }
      }
      
      lsKeysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          successCount++;
          console.log(`🗑️ LocalStorage key silindi: ${key}`);
        } catch (error) {
          console.error(`LocalStorage key silinemedi: ${key}`, error);
          errorCount++;
        }
      });

      console.log(`✅ Temizlik tamamlandı: ${successCount} başarılı, ${errorCount} hata`);
      console.log(`📁 ${analyses.length} dosya + ${lsKeysToRemove.length} localStorage kaydı`);
      
      if (errorCount > 0 && successCount === 0) {
        throw new Error(`Tüm analizler silinemedi (${errorCount} hata)`);
      }

      return { 
        successCount, 
        errorCount,
        fileCount: analyses.length,
        localStorageCount: lsKeysToRemove.length
      };
    } catch (error) {
      console.error('Failed to clear all analyses:', error);
      throw error;
    }
  }

  // 🧹 MIGRATION: Clean up old temp/timestamp files
  async migrateOldAnalyses() {
    try {
      console.log('🔄 Eski analiz dosyaları temizleniyor...');
      
      let deletedCount = 0;
      let migratedCount = 0;
      
      if (this.tempDir === 'localStorage') {
        const keysToDelete = [];
        const keysToMigrate = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('mgx_analysis_')) {
            const content = localStorage.getItem(key);
            if (content) {
              try {
                const parsed = JSON.parse(content);
                
                // Delete temp files
                if (key.includes('temp_') || key.includes('partial')) {
                  keysToDelete.push(key);
                  continue;
                }
                
                // Migrate old format (has readableFileName with timestamp)
                if (parsed.readableFileName && parsed.readableFileName.match(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}/)) {
                  keysToMigrate.push({ key, parsed });
                }
              } catch (e) {
                keysToDelete.push(key);
              }
            }
          }
        }
        
        // Delete temp files
        for (const key of keysToDelete) {
          localStorage.removeItem(key);
          deletedCount++;
        }
        
        // Migrate old files (keep only latest for each project/type)
        const projectTypes = new Map();
        for (const { key, parsed } of keysToMigrate) {
          const projectKey = `${parsed.projectName}_${parsed.analysisType}`;
          
          if (!projectTypes.has(projectKey) || 
              new Date(parsed.timestamp) > new Date(projectTypes.get(projectKey).timestamp)) {
            projectTypes.set(projectKey, { key, parsed });
          }
        }
        
        // Save migrated files with new naming, delete old ones
        for (const { key, parsed } of keysToMigrate) {
          const projectKey = `${parsed.projectName}_${parsed.analysisType}`;
          const latest = projectTypes.get(projectKey);
          
          if (latest.key === key) {
            // This is the latest, migrate it
            await this.saveAnalysisByType(
              parsed.projectName,
              parsed.analysisType,
              parsed.analysisData,
              parsed.scriptMetadata
            );
            migratedCount++;
          }
          
          // Delete old file
          localStorage.removeItem(key);
          deletedCount++;
        }
        
      } else {
        // Electron environment
        if (await window.electronAPI.directoryExists(this.tempDir)) {
          const files = await window.electronAPI.listDirectory(this.tempDir);
          
          const filesToDelete = [];
          const filesToMigrate = [];
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              // Delete temp files
              if (file.includes('temp_') || file.includes('partial')) {
                filesToDelete.push(file);
                continue;
              }
              
              // Check if old format (has timestamp in name)
              if (file.match(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}/)) {
                try {
                  const filePath = path.join(this.tempDir, file);
                  const content = await window.electronAPI.readFileContent(filePath);
                  const parsed = JSON.parse(content);
                  filesToMigrate.push({ file, parsed });
                } catch (e) {
                  filesToDelete.push(file);
                }
              }
            }
          }
          
          // Delete temp files
          for (const file of filesToDelete) {
            const filePath = path.join(this.tempDir, file);
            await window.electronAPI.deleteFile(filePath);
            deletedCount++;
          }
          
          // Migrate old files (keep only latest for each project/type)
          const projectTypes = new Map();
          for (const { file, parsed } of filesToMigrate) {
            const projectKey = `${parsed.projectName}_${parsed.analysisType}`;
            
            if (!projectTypes.has(projectKey) || 
                new Date(parsed.timestamp) > new Date(projectTypes.get(projectKey).timestamp)) {
              projectTypes.set(projectKey, { file, parsed });
            }
          }
          
          // Save migrated files with new naming, delete old ones
          for (const { file, parsed } of filesToMigrate) {
            const projectKey = `${parsed.projectName}_${parsed.analysisType}`;
            const latest = projectTypes.get(projectKey);
            
            if (latest.file === file) {
              // This is the latest, migrate it
              await this.saveAnalysisByType(
                parsed.projectName,
                parsed.analysisType,
                parsed.analysisData,
                parsed.scriptMetadata
              );
              migratedCount++;
            }
            
            // Delete old file
            const filePath = path.join(this.tempDir, file);
            await window.electronAPI.deleteFile(filePath);
            deletedCount++;
          }
        }
      }
      
      console.log(`✅ Migration tamamlandı: ${migratedCount} dosya migrate edildi, ${deletedCount} dosya silindi`);
      return { migratedCount, deletedCount };
    } catch (error) {
      console.error('❌ Migration hatası:', error);
      return { migratedCount: 0, deletedCount: 0 };
    }
  }

  // ========================================
  // STORYBOARD DATA PERSISTENCE
  // ========================================

  // Generate storyboard storage key based on script
  generateStoryboardKey(scriptText, fileName) {
    const analysisKey = this.generateAnalysisKey(scriptText, fileName);
    return analysisKey.replace('analysis_', 'storyboard_');
  }

  // Save storyboard data (character images, location images, storyboard frames)
  async saveStoryboard(scriptText, fileName, storyboardData) {
    try {
      const storyboardKey = this.generateStoryboardKey(scriptText, fileName);
      const dataToSave = {
        fileName,
        timestamp: new Date().toISOString(),
        scriptHash: this.generateAnalysisKey(scriptText, ''),
        storyboardData: {
          characterApprovals: storyboardData.characterApprovals || {},
          locationApprovals: storyboardData.locationApprovals || {},
          storyboardFrames: storyboardData.storyboardFrames || [],
          phaseCompletion: storyboardData.phaseCompletion || {},
          currentPhase: storyboardData.currentPhase || null
        },
        metadata: {
          version: '1.0',
          characterCount: Object.keys(storyboardData.characterApprovals || {}).length,
          locationCount: Object.keys(storyboardData.locationApprovals || {}).length,
          frameCount: (storyboardData.storyboardFrames || []).length
        }
      };

      if (this.tempDir === 'localStorage') {
        localStorage.setItem(`mgx_storyboard_${storyboardKey}`, JSON.stringify(dataToSave));
      } else {
        const filePath = path.join(this.tempDir, storyboardKey);
        await window.electronAPI.saveFileContent({
          filePath,
          data: JSON.stringify(dataToSave, null, 2),
          encoding: 'utf8'
        });
      }

      console.log(`✅ Storyboard saved for ${fileName} with key: ${storyboardKey}`);
      return storyboardKey;
    } catch (error) {
      console.error('❌ Failed to save storyboard:', error);
      throw error;
    }
  }

  // Load storyboard data
  async loadStoryboard(scriptText, fileName) {
    try {
      const storyboardKey = this.generateStoryboardKey(scriptText, fileName);
      
      if (this.tempDir === 'localStorage') {
        const stored = localStorage.getItem(`mgx_storyboard_${storyboardKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log(`✅ Storyboard loaded from localStorage: ${storyboardKey}`);
          return parsed.storyboardData;
        }
      } else {
        const filePath = path.join(this.tempDir, storyboardKey);
        if (window.electronAPI && window.electronAPI.readFileContent) {
          try {
            const content = await window.electronAPI.readFileContent(filePath);
            const parsed = JSON.parse(content);
            console.log(`✅ Storyboard loaded from file: ${storyboardKey}`);
            return parsed.storyboardData;
          } catch (readError) {
            if (!readError.message.includes('ENOENT')) {
              throw readError;
            }
          }
        }
      }
      
      console.log(`ℹ️ No storyboard found for ${fileName}`);
      return null;
    } catch (error) {
      console.error('❌ Failed to load storyboard:', error);
      return null;
    }
  }

  // Delete storyboard data
  async deleteStoryboard(scriptText, fileName) {
    try {
      const storyboardKey = this.generateStoryboardKey(scriptText, fileName);
      
      if (this.tempDir === 'localStorage') {
        localStorage.removeItem(`mgx_storyboard_${storyboardKey}`);
      } else {
        const filePath = path.join(this.tempDir, storyboardKey);
        if (window.electronAPI && window.electronAPI.deleteFile) {
          await window.electronAPI.deleteFile(filePath);
        }
      }
      
      console.log(`✅ Storyboard deleted: ${storyboardKey}`);
    } catch (error) {
      console.error('❌ Failed to delete storyboard:', error);
      throw error;
    }
  }

  // 🆕 GRUP BAZLI YÖNETİM: Aynı session'da yapılan analizleri gruplandır
  /**
   * Aynı dosya için yapılan analizleri grup ID'sine göre gruplandır
   * @param {string} fileName - Dosya adı
   * @returns {Map} - groupId -> analyses array mapping
   */
  async groupAnalysesBySession(fileName) {
    try {
      const allAnalyses = await this.listAnalyses();
      
      // Aynı dosya için yapılan analizleri filtrele
      const fileAnalyses = allAnalyses.filter(a => 
        a.fileName === fileName || 
        a.scriptMetadata?.originalFileName === fileName ||
        a.projectName === fileName.replace(/\.(pdf|txt|fountain)$/i, '')
      );
      
      // Timestamp'e göre grupla (5 dakika içinde yapılanlar aynı grup)
      const groups = new Map();
      const SESSION_THRESHOLD = 5 * 60 * 1000; // 5 dakika
      
      fileAnalyses.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      let currentGroupId = 1;
      let lastTimestamp = null;
      
      for (const analysis of fileAnalyses) {
        const analysisTime = new Date(analysis.timestamp).getTime();
        
        // Yeni grup başlat (ilk analiz veya 5 dakikadan uzun ara)
        if (!lastTimestamp || (analysisTime - lastTimestamp) > SESSION_THRESHOLD) {
          currentGroupId++;
        }
        
        const groupKey = `session_${currentGroupId}`;
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            groupId: groupKey,
            sessionNumber: currentGroupId,
            analyses: [],
            startTime: analysis.timestamp,
            endTime: analysis.timestamp,
            totalAnalyses: 0
          });
        }
        
        const group = groups.get(groupKey);
        group.analyses.push(analysis);
        group.endTime = analysis.timestamp;
        group.totalAnalyses = group.analyses.length;
        
        lastTimestamp = analysisTime;
      }
      
      console.log(`📊 ${fileName} için ${groups.size} analiz grubu bulundu`);
      return groups;
    } catch (error) {
      console.error('❌ Analiz gruplama hatası:', error);
      return new Map();
    }
  }

  /**
   * Bir analiz grubunu tek seferde yükle
   * @param {string} groupId - Grup ID
   * @param {Array} analyses - Analizler listesi
   * @returns {Object} Birleştirilmiş analiz verisi
   */
  async loadAnalysisGroup(groupId, analyses) {
    try {
      console.log(`📂 Grup yükleniyor: ${groupId} (${analyses.length} analiz)`);
      
      const groupData = {
        groupId,
        customResults: {},
        metadata: {
          loadedAt: new Date().toISOString(),
          totalAnalyses: analyses.length,
          analysisKeys: []
        }
      };
      
      // Tüm analizleri yükle ve birleştir
      for (const analysis of analyses) {
        const data = await this.loadAnalysisByKey(analysis.key);
        
        if (data && data.customResults) {
          // Analiz sonuçlarını birleştir
          Object.assign(groupData.customResults, data.customResults);
          groupData.metadata.analysisKeys.push(analysis.key);
          
          console.log(`  ✅ ${analysis.key}: ${Object.keys(data.customResults).length} analiz tipi yüklendi`);
        }
      }
      
      console.log(`✅ Grup toplam ${Object.keys(groupData.customResults).length} farklı analiz tipi içeriyor`);
      return groupData;
    } catch (error) {
      console.error('❌ Grup yükleme hatası:', error);
      return null;
    }
  }

  /**
   * En son analiz grubunu otomatik yükle
   * @param {string} fileName - Dosya adı
   * @returns {Object} En son grup verisi
   */
  async loadLatestAnalysisGroup(fileName) {
    try {
      const groups = await this.groupAnalysesBySession(fileName);
      
      if (groups.size === 0) {
        console.log('ℹ️ Hiç analiz grubu bulunamadı');
        return null;
      }
      
      // En son grubu al (en yüksek session numarası)
      const latestGroup = Array.from(groups.values()).sort((a, b) => b.sessionNumber - a.sessionNumber)[0];
      
      console.log(`📥 En son grup yükleniyor: ${latestGroup.groupId} (${latestGroup.totalAnalyses} analiz)`);
      
      return await this.loadAnalysisGroup(latestGroup.groupId, latestGroup.analyses);
    } catch (error) {
      console.error('❌ En son grup yükleme hatası:', error);
      return null;
    }
  }
}

// Singleton instance
export const analysisStorageService = new AnalysisStorageService();
export default analysisStorageService;