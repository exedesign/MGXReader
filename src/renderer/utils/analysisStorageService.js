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
    } catch (error) {
      console.error('Failed to initialize temp directory:', error);
      this.tempDir = 'localStorage';
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

  // Save analysis data to persistent storage
  async saveAnalysis(scriptText, fileName, analysisData, scriptMetadata = {}) {
    try {
      const analysisKey = this.generateAnalysisKey(scriptText, fileName);
      const dataToSave = {
        fileName,
        timestamp: new Date().toISOString(),
        scriptHash: this.generateAnalysisKey(scriptText, ''), // Hash without filename
        analysisData,
        scriptMetadata: {
          originalFileName: scriptMetadata.originalFileName || fileName,
          fileType: scriptMetadata.fileType || 'unknown',
          uploadDate: scriptMetadata.uploadDate || new Date().toISOString(),
          ...scriptMetadata
        },
        metadata: {
          scriptLength: scriptText.length,
          wordCount: scriptText.split(/\s+/).length,
          version: '1.1'
        }
      };

      if (this.tempDir === 'localStorage') {
        // Browser fallback
        localStorage.setItem(`mgx_analysis_${analysisKey}`, JSON.stringify(dataToSave));
      } else {
        // Electron environment
        const filePath = path.join(this.tempDir, analysisKey);
        await window.electronAPI.saveFileContent({
          filePath,
          data: JSON.stringify(dataToSave, null, 2),
          encoding: 'utf8'
        });
      }

      console.log(`Analysis saved for ${fileName} with key: ${analysisKey}`);
      return analysisKey;
    } catch (error) {
      console.error('Failed to save analysis:', error);
      throw error;
    }
  }

  // Load analysis data by analysis key (for saved analyses list)
  async loadAnalysisByKey(analysisKey) {
    try {
      if (this.tempDir === 'localStorage') {
        // Browser fallback
        const stored = localStorage.getItem(`mgx_analysis_${analysisKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log(`Analysis loaded by key from localStorage: ${analysisKey}`);
          return parsed.analysisData;
        }
      } else {
        // Electron environment
        const filePath = path.join(this.tempDir, `${analysisKey}.json`);
        if (await window.electronAPI.fileExists(filePath)) {
          const content = await window.electronAPI.readFileContent(filePath);
          const parsed = JSON.parse(content);
          console.log(`Analysis loaded by key from file: ${filePath}`);
          return parsed.analysisData;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to load analysis by key:', error);
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

  // Load analysis data from persistent storage
  async loadAnalysis(scriptText, fileName) {
    try {
      const analysisKey = this.generateAnalysisKey(scriptText, fileName);
      
      if (this.tempDir === 'localStorage') {
        // Browser fallback
        const stored = localStorage.getItem(`mgx_analysis_${analysisKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log(`Analysis loaded for ${fileName} from localStorage`);
          return parsed.analysisData;
        }
      } else {
        // Electron environment
        const filePath = path.join(this.tempDir, analysisKey);
        if (await window.electronAPI.fileExists(filePath)) {
          const content = await window.electronAPI.readFileContent(filePath);
          const parsed = JSON.parse(content);
          console.log(`Analysis loaded for ${fileName} from file: ${filePath}`);
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

  // List all saved analyses
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
              analyses.push({
                key: key.replace('mgx_analysis_', ''),
                fileName: parsed.fileName,
                timestamp: parsed.timestamp,
                metadata: parsed.metadata,
                scriptMetadata: parsed.scriptMetadata
              });
            }
          }
        }
      } else {
        // Electron environment - list files in analysis directory
        if (await window.electronAPI.directoryExists(this.tempDir)) {
          const files = await window.electronAPI.listDirectory(this.tempDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              try {
                const filePath = path.join(this.tempDir, file);
                const content = await window.electronAPI.readFileContent(filePath);
                const parsed = JSON.parse(content);
                analyses.push({
                  key: file.replace('.json', ''),
                  fileName: parsed.fileName,
                  timestamp: parsed.timestamp,
                  metadata: parsed.metadata,
                  scriptMetadata: parsed.scriptMetadata
                });
              } catch (e) {
                console.warn(`Failed to read analysis file ${file}:`, e);
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

  // Delete specific analysis
  async deleteAnalysis(analysisKey) {
    try {
      if (this.tempDir === 'localStorage') {
        localStorage.removeItem(`mgx_analysis_${analysisKey}`);
      } else {
        // Handle both with and without .json extension
        const fileName = analysisKey.endsWith('.json') ? analysisKey : `${analysisKey}.json`;
        const filePath = path.join(this.tempDir, fileName);
        if (await window.electronAPI.fileExists(filePath)) {
          await window.electronAPI.deleteFile(filePath);
          console.log(`🗑️ Deleted: ${fileName}`);
        } else {
          console.warn(`⚠️ File not found: ${filePath}`);
        }
      }
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      throw error; // Re-throw to let caller handle
    }
  }

  // Clear all analyses
  async clearAll() {
    try {
      // Ensure tempDir is initialized
      if (!this.tempDir) {
        await this.initializeTempDir();
      }

      const analyses = await this.listAnalyses();
      
      if (analyses.length === 0) {
        console.log('ℹ️ No analyses to clear');
        return { successCount: 0, errorCount: 0 };
      }

      let successCount = 0;
      let errorCount = 0;

      for (const analysis of analyses) {
        try {
          await this.deleteAnalysis(analysis.key);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete analysis ${analysis.key}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Cleared ${successCount} analyses (${errorCount} errors)`);
      
      if (errorCount > 0) {
        throw new Error(`${errorCount} analiz silinemedi`);
      }

      return { successCount, errorCount };
    } catch (error) {
      console.error('Failed to clear all analyses:', error);
      throw error;
    }
  }

  // 🔄 ARA KAYIT İÇİN: Yarım kalan analizleri bul
  async findPartialAnalyses(fileName) {
    try {
      const allAnalyses = await this.listAnalyses();
      
      // Partial analizleri filtrele
      const partialAnalyses = allAnalyses.filter(analysis => {
        try {
          // Temp_ ile başlayan veya isPartialAnalysis flag'i olan analizler
          return analysis.key.includes('temp_') || 
                 analysis.key.includes('partial') ||
                 (analysis.fileName && analysis.fileName.includes(fileName));
        } catch (e) {
          return false;
        }
      });

      // Tarihe göre sırala (en yeni önce)
      partialAnalyses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      console.log(`🔍 ${fileName} için ${partialAnalyses.length} ara kayıt bulundu`);
      return partialAnalyses;
    } catch (error) {
      console.error('findPartialAnalyses hatası:', error);
      return [];
    }
  }
}

// Singleton instance
export const analysisStorageService = new AnalysisStorageService();
export default analysisStorageService;