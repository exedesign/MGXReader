import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { cleanScreenplayText, parseScenes } from '../utils/textProcessing';
import { parseScreenplayFile } from '../utils/screenplayParser';
import { performPDFOCR, isOCRAvailable } from '../utils/ocrService';

export default function MultiScriptImporter() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSettings, setImportSettings] = useState({
    useOCR: false,
    ocrLanguage: 'tur+eng',
    ocrPSM: '3',
    autoDetectStructure: true,
    groupBySeries: true
  });
  const [showSettings, setShowSettings] = useState(false);
  
  const { 
    addScript, 
    isImporting, 
    importProgress, 
    startBulkImport, 
    updateImportProgress, 
    finishBulkImport,
    scripts
  } = useScriptStore();
  const { t } = useTranslation();

  // Detect script structure (movie, series episode, etc.)
  const detectScriptStructure = (text, fileName) => {
    const cleanName = fileName.toLowerCase();
    
    // Series episode detection patterns
    const episodePatterns = [
      /(?:episode|bölüm|ep|s\d+e\d+)\s*(\d+)/i,
      /(\d+)\s*(?:episode|bölüm|ep)/i,
      /season\s*(\d+)\s*episode\s*(\d+)/i,
      /sezon\s*(\d+)\s*bölüm\s*(\d+)/i
    ];

    // Movie patterns
    const moviePatterns = [
      /(?:film|movie|cinema|sinema)/i,
      /(?:screenplay|senaryo)/i
    ];

    let structure = {
      type: 'single',
      title: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
      episodes: [],
      chapters: [],
      scenes: []
    };

    // Check for series episodes
    for (const pattern of episodePatterns) {
      const match = cleanName.match(pattern);
      if (match) {
        structure.type = 'series';
        structure.episodeNumber = parseInt(match[1]);
        
        // Extract series name (remove episode info)
        const seriesName = fileName
          .replace(pattern, '')
          .replace(/[_\-\.]/g, ' ')
          .trim()
          .replace(/\.[^/.]+$/, '');
        
        structure.seriesTitle = seriesName || `Series ${structure.episodeNumber}`;
        structure.title = `Episode ${structure.episodeNumber}`;
        break;
      }
    }

    // Parse scenes from text
    const scenes = parseScenes(text);
    structure.scenes = scenes.map((scene, index) => ({
      id: `scene_${index + 1}`,
      number: index + 1,
      title: scene.title || `Scene ${index + 1}`,
      content: scene.content,
      characters: scene.characters || [],
      locations: scene.locations || [],
      timeOfDay: scene.timeOfDay,
      intExt: scene.intExt
    }));

    return structure;
  };

  // Group scripts by series for better organization
  const groupScriptsBySeries = (scriptsToGroup) => {
    const series = {};
    const standalone = [];

    scriptsToGroup.forEach(script => {
      if (script.structure?.type === 'series' && script.structure.seriesTitle) {
        const seriesTitle = script.structure.seriesTitle;
        if (!series[seriesTitle]) {
          series[seriesTitle] = [];
        }
        series[seriesTitle].push(script);
      } else {
        standalone.push(script);
      }
    });

    // Sort episodes within each series
    Object.keys(series).forEach(seriesTitle => {
      series[seriesTitle].sort((a, b) => {
        const episodeA = a.structure?.episodeNumber || 0;
        const episodeB = b.structure?.episodeNumber || 0;
        return episodeA - episodeB;
      });
    });

    return { series, standalone };
  };

  // Process multiple files (or single file)
  const processMultipleFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    
    // If only one file, use legacy single script mode
    if (selectedFiles.length === 1) {
      try {
        await processSingleFile(selectedFiles[0]);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Multiple files - batch processing
    try {
      startBulkImport();
      updateImportProgress({
        total: selectedFiles.length,
        completed: 0,
        current: null,
        errors: []
      });

      const importedScripts = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        updateImportProgress({
          current: file.name,
          completed: i
        });

        try {
          const result = await processFile(file);
          if (result.success) {
            const structure = importSettings.autoDetectStructure 
              ? detectScriptStructure(result.text, file.name)
              : { type: 'single', title: file.name.replace(/\.[^/.]+$/, ''), scenes: [] };

            const scriptData = {
              title: structure.title,
              fileName: file.name,
              scriptText: result.text,
              cleanedText: cleanScreenplayText(result.text),
              pageCount: result.pages || 1,
              metadata: {
                ...result.metadata,
                importedAt: new Date().toISOString(),
                originalFileSize: file.size,
                fileType: file.name.split('.').pop()?.toLowerCase()
              },
              structure
            };

            const scriptId = addScript(scriptData);
            importedScripts.push({ ...scriptData, id: scriptId });
          }
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error);
          updateImportProgress({
            errors: [...(importProgress?.errors || []), {
              fileName: file.name,
              error: error.message
            }]
          });
        }
      }

      updateImportProgress({
        completed: selectedFiles.length,
        current: null
      });

      // Group by series if enabled
      if (importSettings.groupBySeries && importedScripts.length > 1) {
        const grouped = groupScriptsBySeries(importedScripts);
        console.log('Grouped scripts:', grouped);
      }

      // Clear selected files
      setSelectedFiles([]);

    } catch (error) {
      console.error('Bulk import failed:', error);
    } finally {
      finishBulkImport();
      setIsProcessing(false);
    }
  };

  // Process single file (legacy mode)
  const processSingleFile = async (file) => {
    setIsProcessing(true);
    try {
      const result = await processFile(file);
      if (result.success) {
        // Use legacy scriptStore methods for single file
        const { setScriptText, setOriginalFileName, setPageCount } = useScriptStore.getState();
        
        setOriginalFileName(file.name);
        setPageCount(result.pages || 1);
        setScriptText(result.text, result.metadata);

        // Clean the text automatically
        const cleaned = cleanScreenplayText(result.text);
        useScriptStore.getState().setCleanedText(cleaned);

        console.log('Single file loaded successfully:', {
          pages: result.pages,
          textLength: result.text.length
        });
      }
    } catch (error) {
      console.error('Single file processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process individual file
  const processFile = async (file) => {
    const fileName = file.name;
    const extension = fileName.toLowerCase().split('.').pop();

    if (extension === 'pdf') {
      // PDF processing
      const filePath = file.path || file.webkitRelativePath || fileName;
      
      if (importSettings.useOCR) {
        try {
          const ocrResult = await performPDFOCR(
            filePath, 
            importSettings.ocrLanguage, 
            importSettings.ocrPSM,
            (progress) => {
              // Update progress for current file
              updateImportProgress({
                current: `${fileName} (OCR: ${progress.progress}%)`
              });
            }
          );
          
          return {
            success: true,
            text: ocrResult.text,
            pages: ocrResult.pages,
            metadata: { 
              extractedViaOCR: true, 
              ocrLanguage: importSettings.ocrLanguage 
            }
          };
        } catch (error) {
          throw new Error(`OCR processing failed: ${error.message}`);
        }
      } else {
        // Standard PDF extraction
        const result = await window.electronAPI.parsePDF(filePath);
        if (!result.success) {
          throw new Error(result.error || 'Failed to parse PDF');
        }
        return result;
      }
    } else if (['fdx', 'celtx', 'txt', 'docx'].includes(extension)) {
      // Screenplay format processing
      const buffer = await file.arrayBuffer();
      const screenplay = await parseScreenplayFile(Buffer.from(buffer), fileName);
      
      return {
        success: true,
        text: screenplay.text,
        pages: screenplay.scenes?.length || 1,
        metadata: {
          format: screenplay.metadata?.format,
          title: screenplay.title,
          author: screenplay.author,
          scenes: screenplay.scenes?.length || 0,
          characters: screenplay.characters?.length || 0,
          locations: screenplay.locations?.length || 0
        }
      };
    } else {
      throw new Error(`Unsupported file format: ${extension}`);
    }
  };

  // File selection handlers
  const handleFileSelect = async () => {
    try {
      const filePaths = await window.electronAPI.openFiles(); // Need to implement multi-file selection
      if (filePaths && filePaths.length > 0) {
        // Convert to File-like objects
        const files = await Promise.all(
          filePaths.map(async (filePath) => {
            const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
            return {
              name: fileName,
              path: filePath,
              size: 0 // Will be set when processing
            };
          })
        );
        setSelectedFiles(files);
      }
    } catch (error) {
      console.error('File selection error:', error);
    }
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const supportedExtensions = ['pdf', 'fdx', 'celtx', 'txt', 'docx'];
    
    const supportedFiles = files.filter((file) => {
      const extension = file.name.toLowerCase().split('.').pop();
      return supportedExtensions.includes(extension);
    });

    if (supportedFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...supportedFiles]);
    }
  }, []);

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileTypeIcon = (fileName) => {
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
      case 'pdf': return '📄';
      case 'fdx': return '🎬';
      case 'celtx': return '🎭';
      case 'txt': return '📝';
      case 'docx': return '📘';
      default: return '📁';
    }
  };

  return (
    <div className="flex items-center justify-center h-full bg-cinema-black p-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-cinema-text mb-3">
            🎬 {t('multiImporter.title', 'Senaryo İçe Aktarma')}
          </h1>
          <p className="text-cinema-text-dim">
            {t('multiImporter.subtitle', 'Senaryo dosyalarınızı sürükleyip bırakın veya seçin')}
          </p>
        </div>

        {/* Import Progress */}
        {isImporting && importProgress && (
          <div className="mb-6 p-4 bg-cinema-dark rounded-lg border border-cinema-accent">
            <div className="flex items-center gap-3 mb-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-cinema-accent border-t-transparent"></div>
              <span className="text-sm font-medium text-cinema-text">
                {importProgress.current || t('multiImporter.processing', 'İşleniyor...')}
              </span>
            </div>
            <div className="w-full bg-cinema-gray rounded-full h-2">
              <div 
                className="bg-cinema-accent rounded-full h-2 transition-all duration-300"
                style={{ width: `${(importProgress.completed / importProgress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-cinema-text-dim mt-2">
              {importProgress.completed} / {importProgress.total} dosya tamamlandı
            </p>
            
            {importProgress.errors.length > 0 && (
              <div className="mt-3 p-2 bg-red-900/20 border border-red-500/50 rounded">
                <p className="text-xs font-medium text-red-400 mb-1">Hatalar:</p>
                {importProgress.errors.map((error, index) => (
                  <p key={index} className="text-xs text-red-400">
                    {error.fileName}: {error.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-4 border-dashed rounded-2xl p-8 text-center transition-all ${
            isDragging
              ? 'border-cinema-accent bg-cinema-accent/10'
              : 'border-cinema-gray hover:border-cinema-gray-light bg-cinema-dark/50'
          } ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {/* Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-cinema-gray">
              <svg
                className="w-12 h-12 text-cinema-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
          </div>

          {/* Text */}
          <h2 className="text-2xl font-bold text-cinema-text mb-3">
            {isProcessing ? t('uploader.processing', 'Processing file...') : (
              selectedFiles.length > 0 
                ? t('multiImporter.filesSelected', '{{count}} dosya seçildi', { count: selectedFiles.length })
                : t('multiImporter.dropHere', 'Senaryo dosyalarınızı buraya bırakın')
            )}
          </h2>
          <p className="text-cinema-text-dim mb-6">
            {isProcessing
              ? t('uploader.extracting', 'Extracting and cleaning text...')
              : (selectedFiles.length > 0
                ? t('multiImporter.readyToProcess', 'İşlemeye hazır')
                : t('multiImporter.dragOrClick', 'Dosyaları sürükleyip bırakın veya seçmek için tıklayın')
              )
            }
          </p>
          
          {/* Supported formats */}
          <div className="mb-6">
            <p className="text-xs text-cinema-text-dim mb-2">{t('uploader.supportedFormats', 'Desteklenen formatlar')}:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['PDF', 'Final Draft (.fdx)', 'Celtx (.celtx)', 'Text (.txt)', 'Word (.docx)'].map((format) => (
                <span key={format} className="px-2 py-1 bg-cinema-gray rounded text-xs text-cinema-text">
                  {format}
                </span>
              ))}
            </div>
          </div>

          {/* Buttons */}
          {!isImporting && (
            <div className="flex justify-center gap-4">
              <button
                onClick={handleFileSelect}
                className="btn-primary inline-flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                {t('multiImporter.selectFiles', 'Dosyaları Seç')}
              </button>
              
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light border border-cinema-gray-light rounded text-cinema-text transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('multiImporter.settings', 'Ayarlar')}
              </button>
            </div>
          )}
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && !isImporting && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-cinema-text">
                {t('multiImporter.selectedFiles', 'Seçilen Dosyalar')} ({selectedFiles.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFiles([])}
                  className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/30 border border-red-500/50 rounded text-sm text-red-400 transition-colors"
                >
                  {t('multiImporter.clearAll', 'Tümünü Temizle')}
                </button>
                <button
                  onClick={processMultipleFiles}
                  className="btn-primary text-sm"
                >
                  {t('multiImporter.startImport', 'İçe Aktarmayı Başlat')}
                </button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-cinema-dark rounded-lg border border-cinema-gray">
                  <span className="text-2xl">{getFileTypeIcon(file.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cinema-text truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-cinema-text-dim">
                      {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 text-cinema-text-dim hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Scripts Overview */}
        {scripts.length > 0 && (
          <div className="mt-8 p-6 bg-cinema-dark rounded-lg border border-cinema-gray">
            <h3 className="text-lg font-semibold text-cinema-text mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {t('multiImporter.importedScripts', 'İçe Aktarılan Senaryolar')} ({scripts.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scripts.slice(-6).map((script) => (
                <div key={script.id} className="p-4 bg-cinema-gray/30 rounded border border-cinema-gray-light">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-lg">
                      {script.structure?.type === 'series' ? '📺' : '🎬'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-cinema-text text-sm truncate">
                        {script.title}
                      </h4>
                      {script.structure?.seriesTitle && script.structure.seriesTitle !== script.title && (
                        <p className="text-xs text-cinema-text-dim truncate">
                          {script.structure.seriesTitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-cinema-text-dim space-y-1">
                    <div className="flex justify-between">
                      <span>{t('multiImporter.scenes', 'Sahne')}</span>
                      <span>{script.structure?.scenes?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('multiImporter.characters', 'Karakter')}</span>
                      <span>{script.characters?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('multiImporter.pages', 'Sayfa')}</span>
                      <span>{script.pageCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-cinema-dark border border-cinema-gray rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray p-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-cinema-text">
                  {t('multiImporter.importSettings', 'İçe Aktarma Ayarları')}
                </h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-cinema-text-dim hover:text-cinema-text transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* OCR Settings */}
                <div>
                  <h3 className="text-lg font-semibold text-cinema-text mb-3">
                    {t('multiImporter.ocrSettings', 'OCR Ayarları')}
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={importSettings.useOCR}
                        onChange={(e) => setImportSettings(prev => ({ ...prev, useOCR: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-cinema-text">
                        {t('uploader.enableOCR', 'OCR kullan (Taranmış PDF\'ler için)')}
                      </span>
                    </label>

                    {importSettings.useOCR && (
                      <div className="ml-6 space-y-3">
                        <div>
                          <label className="block text-sm text-cinema-text mb-1">
                            {t('uploader.ocrLanguage', 'Dil')}
                          </label>
                          <select
                            value={importSettings.ocrLanguage}
                            onChange={(e) => setImportSettings(prev => ({ ...prev, ocrLanguage: e.target.value }))}
                            className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text"
                          >
                            <option value="tur+eng">Türkçe + İngilizce</option>
                            <option value="tur">Türkçe</option>
                            <option value="eng">English</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm text-cinema-text mb-1">
                            {t('uploader.psmMode', 'Sayfa Düzeni Modu')}
                          </label>
                          <select
                            value={importSettings.ocrPSM}
                            onChange={(e) => setImportSettings(prev => ({ ...prev, ocrPSM: e.target.value }))}
                            className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text"
                          >
                            <option value="3">Otomatik (Karma Düzen)</option>
                            <option value="1">Otomatik + Yönlendirme</option>
                            <option value="6">Tek Metin Bloğu</option>
                            <option value="4">Tek Sütun</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Structure Detection */}
                <div>
                  <h3 className="text-lg font-semibold text-cinema-text mb-3">
                    {t('multiImporter.structureSettings', 'Yapı Ayarları')}
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={importSettings.autoDetectStructure}
                        onChange={(e) => setImportSettings(prev => ({ ...prev, autoDetectStructure: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-cinema-text">
                        {t('multiImporter.autoDetectStructure', 'Otomatik yapı tespiti (Episode/Film/Sahne)')}
                      </span>
                    </label>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={importSettings.groupBySeries}
                        onChange={(e) => setImportSettings(prev => ({ ...prev, groupBySeries: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-cinema-text">
                        {t('multiImporter.groupBySeries', 'Dizi bölümlerini grupla')}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-cinema-dark border-t border-cinema-gray p-4 flex justify-end">
                <button
                  onClick={() => setShowSettings(false)}
                  className="btn-primary"
                >
                  {t('multiImporter.saveSettings', 'Ayarları Kaydet')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}