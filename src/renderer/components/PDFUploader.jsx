import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { cleanScreenplayText, parseScenes } from '../utils/textProcessing';
import { parseScreenplayFile } from '../utils/screenplayParser';
import { performPDFOCR, isOCRAvailable } from '../utils/ocrService';
import { extractBestTitle } from '../utils/titleExtractor';

export default function PDFUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useOCR, setUseOCR] = useState(false);
  const [ocrLanguage, setOcrLanguage] = useState('tur+eng');
  const [ocrPSM, setOcrPSM] = useState('3'); // Page Segmentation Mode
  const [ocrProgress, setOcrProgress] = useState(null);
  const [showOCRSettings, setShowOCRSettings] = useState(false);
  const [ocrPreviewMode, setOcrPreviewMode] = useState(false);
  const [ocrPreviewText, setOcrPreviewText] = useState('');
  const [ocrPreviewPages, setOcrPreviewPages] = useState(1);
  const [currentPdfPath, setCurrentPdfPath] = useState(null);
  const [showPageSelection, setShowPageSelection] = useState(false);
  const [pageSelectionMode, setPageSelectionMode] = useState('all'); // 'all', 'range', 'specific', 'from'
  const [pageRangeStart, setPageRangeStart] = useState('1');
  const [pageRangeEnd, setPageRangeEnd] = useState('');
  const [specificPages, setSpecificPages] = useState('');
  const [totalPdfPages, setTotalPdfPages] = useState(null);
  const { setScriptText, setOriginalFileName, setPageCount, setError } = useScriptStore();
  const { t } = useTranslation();

  // OCR Preview - Process only first page(s)
  const previewOCR = async (filePath = null) => {
    const pdfPath = filePath || currentPdfPath;
    if (!pdfPath) {
      console.error('No PDF path provided for preview');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setOcrPreviewText('');
    setShowOCRSettings(true); // Open settings modal to show preview

    try {
      setOcrProgress({ status: 'starting', progress: 0, message: 'Generating preview...' });
      
      // Use selected single page for preview
      const selectedPage = Math.max(1, parseInt(ocrPreviewPages) || 1);
      const previewPageNumbers = [selectedPage];
      
      console.log(`Starting OCR preview for page ${selectedPage}`);
      
      const ocrResult = await performPDFOCR(
        pdfPath, 
        ocrLanguage, 
        ocrPSM, 
        (progress) => {
          setOcrProgress(progress);
        },
        0, // Legacy pageNumber parameter (deprecated)
        previewPageNumbers // selectedPages: [selectedPage] for preview
      );
      
      if (ocrResult.success && ocrResult.text) {
        setOcrPreviewText(ocrResult.text);
        setOcrPreviewMode(true);
        console.log('OCR preview generated:', {
          pages: ocrResult.pages,
          textLength: ocrResult.text.length,
          previewPage: selectedPage
        });
      }
      
      setOcrProgress(null);
    } catch (error) {
      console.error('OCR preview failed:', error);
      setError(`OCR preview failed: ${error.message}`);
      setOcrProgress(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process files based on extension
  const processFile = async (filePath, fileBuffer = null, selectedPages = null) => {
    setIsProcessing(true);
    setError(null);

    try {
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
      const extension = fileName.toLowerCase().split('.').pop();

      let result;

      if (extension === 'pdf') {
        // If OCR is enabled, use OCR directly without trying standard PDF extraction
        if (useOCR) {
          console.log('OCR enabled, processing PDF with OCR...', selectedPages ? `Pages: ${selectedPages.join(', ')}` : 'All pages');
          
          try {
            setOcrProgress({ status: 'starting', progress: 0, message: 'Starting OCR...' });
            
            const ocrResult = await performPDFOCR(filePath, ocrLanguage, ocrPSM, (progress) => {
              setOcrProgress(progress);
            }, 0, selectedPages); // Pass selectedPages to OCR
            
            if (ocrResult.success && ocrResult.text) {
              result = {
                success: true,
                text: ocrResult.text,
                pages: ocrResult.pages,
                metadata: { 
                  extractedViaOCR: true, 
                  ocrLanguage: ocrResult.language,
                  selectedPages: selectedPages ? selectedPages.length : null
                }
              };
              console.log('OCR extraction successful:', {
                pages: ocrResult.pages,
                textLength: ocrResult.text.length,
                selectedPages: selectedPages?.length
              });
            } else {
              throw new Error('OCR processing failed to extract text');
            }
            
            setOcrProgress(null);
          } catch (ocrError) {
            console.error('OCR failed:', ocrError);
            setOcrProgress(null);
            throw new Error(`OCR processing failed: ${ocrError.message}`);
          }
        } else {
          // Standard PDF text extraction when OCR is disabled
          result = await window.electronAPI.parsePDF(filePath, selectedPages);
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to parse PDF');
          }
          
          if (selectedPages) {
            result.metadata = { ...result.metadata, selectedPages: selectedPages.length };
          }
        }

        const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
        
        // 🎯 Basit sistem: Tekil dosya her zaman 1. Bölüm
        const titleWithChapter = extractBestTitle(result.text, result.metadata, fileName, 0);
        
        console.log('📋 Tekil PDF yükleme:', {
          fileName: fileName,
          titleWithChapter: titleWithChapter,
          method: 'single-file-first-chapter'
        });
        
        // Proje adını çıkar (bölüm bilgisi olmadan)
        const projectTitle = fileName
          .replace(/\.[^.]+$/, '') // uzantıyı kaldır
          .replace(/[-_\s]*(?:bölüm|bolum|chapter|part|episode|ep)[-_\s]*\d+/gi, '') // bölüm numarasını temizle
          .replace(/[-_\s]*\d+[-_\s]*(?:bölüm|bolum|chapter|part|episode|ep)/gi, '')
          .replace(/[-_\s]*\d+$/gi, '')
          .replace(/[-_\s]+$/, '')
          .trim();
        
        // Final display title = proje adı (header'da gösterilecek)
        const finalDisplayTitle = projectTitle || 'Bilinmeyen Proje';
        setOriginalFileName(finalDisplayTitle);
        setPageCount(result.pages);
        setScriptText(result.text, result.metadata);

        // Clean the text automatically
        const cleaned = cleanScreenplayText(result.text);
        useScriptStore.getState().setCleanedText(cleaned);

        console.log('PDF loaded successfully:', {
          pages: result.pages,
          textLength: result.text.length,
          extractedViaOCR: result.metadata?.extractedViaOCR
        });

      } else if (['fdx', 'celtx', 'txt', 'docx'].includes(extension)) {
        // Handle professional screenplay formats
        let buffer = fileBuffer;
        
        if (!buffer) {
          // Read file content through Electron API
          const fileContent = await window.electronAPI.readFile(filePath);
          buffer = Buffer.from(fileContent, 'binary');
        }

        const screenplay = await parseScreenplayFile(buffer, fileName);
        
        // 🎯 Basit sistem: Tekil dosya her zaman 1. Bölüm
        const titleWithChapter = extractBestTitle(screenplay.text, screenplay.metadata, fileName, 0);
        
        // Proje adını çıkar (bölüm bilgisi olmadan)
        const projectTitle = fileName
          .replace(/\.[^.]+$/, '') // uzantıyı kaldır
          .replace(/[-_\s]*(?:bölüm|bolum|chapter|part|episode|ep)[-_\s]*\d+/gi, '') // bölüm numarasını temizle
          .replace(/[-_\s]*\d+[-_\s]*(?:bölüm|bolum|chapter|part|episode|ep)/gi, '')
          .replace(/[-_\s]*\d+$/gi, '')
          .replace(/[-_\s]+$/, '')
          .trim() || 'Bilinmeyen Proje';
        
        setOriginalFileName(projectTitle);
        setPageCount(screenplay.scenes?.length || 1);
        
        // Script store'a ekle
        const scriptData = {
          title: titleWithChapter,
          fileName: titleWithChapter,
          scriptText: screenplay.text,
          cleanedText: screenplay.text,
          pageCount: screenplay.scenes?.length || 1,
          metadata: screenplay.metadata,
          projectGroup: projectTitle, // 🎯 Gruplandırma için
          chapterNumber: 1,
          chapterTitle: '1. Bölüm',
          displayTitle: projectTitle,
          structure: {
            type: 'series',
            projectTitle: projectTitle,
            title: titleWithChapter,
            chapterNumber: 1,
            chapterTitle: '1. Bölüm',
            scenes: screenplay.scenes || []
          }
        };
        
        // Multi-script store'a ekle
        const { addScript } = useScriptStore.getState();
        addScript(scriptData);
        
        // Set both original and cleaned text
        setScriptText(screenplay.text, screenplay.metadata);
        const cleaned = cleanScreenplayText(screenplay.text);
        useScriptStore.getState().setCleanedText(cleaned);

        // Store additional metadata
        useScriptStore.getState().setAnalysisData({
          basicInfo: {
            title: screenplay.title,
            author: screenplay.author,
            format: screenplay.metadata.format,
            scenes: screenplay.scenes.length,
            characters: screenplay.characters.length,
            locations: screenplay.locations.length
          },
          scenes: screenplay.scenes.map(scene => ({
            number: scene.number,
            header: scene.header,
            intExt: scene.intExt,
            location: scene.location,
            timeOfDay: scene.timeOfDay,
            characters: scene.characters,
            dialogueCount: scene.dialogue.length,
            actionCount: scene.action.length
          })),
          characters: screenplay.characters.map(name => ({ name, importance: 'unknown' })),
          locations: screenplay.locations.map(name => ({ name, type: 'unknown' }))
        });

        console.log(`${extension.toUpperCase()} loaded successfully:`, {
          title: screenplay.title,
          scenes: screenplay.scenes.length,
          characters: screenplay.characters.length,
          locations: screenplay.locations.length
        });

      } else {
        throw new Error(`Unsupported file format: ${extension}. Supported formats: PDF, Final Draft (.fdx), Celtx (.celtx), Text (.txt), Word (.docx)`);
      }

    } catch (error) {
      console.error('File processing error:', error);
      setError(error.message || 'Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  };

  // Legacy PDF processing function (kept for compatibility)
  const processPDFFile = async (filePath) => {
    return processFile(filePath);
  };

  const handleFileSelect = async () => {
    try {
      const filePath = await window.electronAPI.openFile();
      if (filePath) {
        // Store PDF path
        setCurrentPdfPath(filePath);
        
        // Check if it's a PDF to get page count
        const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
        const extension = fileName.toLowerCase().split('.').pop();
        
        if (extension === 'pdf') {
          // Get PDF page count
          try {
            const pdfInfo = await window.electronAPI.getPDFInfo(filePath);
            if (pdfInfo && pdfInfo.success && pdfInfo.pageCount) {
              setTotalPdfPages(pdfInfo.pageCount);
              setPageRangeEnd(pdfInfo.pageCount.toString());
            }
          } catch (err) {
            console.error('Failed to get PDF info:', err);
            // Fallback: Try to get info from a basic parse
            try {
              const basicInfo = await window.electronAPI.parsePDF(filePath);
              if (basicInfo && basicInfo.success && basicInfo.pages) {
                setTotalPdfPages(basicInfo.pages);
                setPageRangeEnd(basicInfo.pages.toString());
              }
            } catch (fallbackErr) {
              console.error('Fallback PDF info failed too:', fallbackErr);
            }
          }
          
          // Show page selection modal
          setShowPageSelection(true);
        } else {
          // Non-PDF files, process directly
          await processFile(filePath);
        }
      }
    } catch (error) {
      console.error('File selection error:', error);
      setError('Failed to open file');
    }
  };

  // Parse page selection and return array of page numbers
  const parsePageSelection = () => {
    const pages = [];
    
    switch (pageSelectionMode) {
      case 'all':
        // Return null to indicate all pages
        return null;
        
      case 'range':
        const start = parseInt(pageRangeStart) || 1;
        const end = parseInt(pageRangeEnd) || (totalPdfPages || 1);
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
        break;
        
      case 'specific':
        // Parse "2,5,10-15,20" format
        const parts = specificPages.split(',').map(p => p.trim()).filter(p => p);
        for (const part of parts) {
          if (part.includes('-')) {
            // Range like "10-15"
            const [rangeStart, rangeEnd] = part.split('-').map(n => parseInt(n.trim()));
            if (!isNaN(rangeStart) && !isNaN(rangeEnd)) {
              for (let i = rangeStart; i <= rangeEnd; i++) {
                if (!pages.includes(i)) pages.push(i);
              }
            }
          } else {
            // Single page
            const pageNum = parseInt(part);
            if (!isNaN(pageNum) && !pages.includes(pageNum)) {
              pages.push(pageNum);
            }
          }
        }
        break;
        
      case 'from':
        const fromPage = parseInt(pageRangeStart) || 1;
        const maxPage = totalPdfPages || 1000;
        for (let i = fromPage; i <= maxPage; i++) {
          pages.push(i);
        }
        break;
    }
    
    // Sort pages
    return pages.sort((a, b) => a - b);
  };

  const processFileWithPages = async () => {
    const selectedPages = parsePageSelection();
    
    if (selectedPages && selectedPages.length === 0) {
      setError(t('uploader.noPages Selection', 'Lütfen en az bir sayfa seçin'));
      return;
    }
    
    // Close page selection modal
    setShowPageSelection(false);
    
    // Process with page selection
    await processFile(currentPdfPath, null, selectedPages);
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
    
    const supportedFile = files.find((file) => {
      const extension = file.name.toLowerCase().split('.').pop();
      return supportedExtensions.includes(extension);
    });

    if (supportedFile) {
      // For drag & drop, we can access file content directly
      const fileBuffer = await supportedFile.arrayBuffer();
      await processFile(supportedFile.path || supportedFile.name, Buffer.from(fileBuffer));
    } else {
      setError(`Please drop a supported file. Supported formats: ${supportedExtensions.map(ext => ext.toUpperCase()).join(', ')}`);
    }
  }, []);

  return (
    <div className="flex items-center justify-center h-full bg-cinema-black p-8">
      <div className="max-w-2xl w-full">
        {/* OCR Progress Indicator */}
        {ocrProgress && (
          <div className="mb-6 p-4 bg-cinema-dark rounded-lg border border-cinema-accent">
            <div className="flex items-center gap-3 mb-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-cinema-accent border-t-transparent"></div>
              <span className="text-sm font-medium text-cinema-text">{ocrProgress.message}</span>
            </div>
            <div className="w-full bg-cinema-gray rounded-full h-2">
              <div 
                className="bg-cinema-accent rounded-full h-2 transition-all duration-300"
                style={{ width: `${ocrProgress.progress}%` }}
              ></div>
            </div>
            {ocrProgress.totalPages && (
              <p className="text-xs text-cinema-text-dim mt-2">
                {t('uploader.ocrPageProgress', 'Page {{current}} of {{total}}', { 
                  current: ocrProgress.page || 0, 
                  total: ocrProgress.totalPages 
                })}
              </p>
            )}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-4 border-dashed rounded-2xl p-12 text-center transition-all ${
            isDragging
              ? 'border-cinema-accent bg-cinema-accent/10'
              : 'border-cinema-gray hover:border-cinema-gray-light bg-cinema-dark/50'
          } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
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
            {isProcessing ? t('uploader.processing', 'Processing file...') : t('uploader.dropHere', 'Drop your screenplay here')}
          </h2>
          <p className="text-cinema-text-dim mb-6">
            {isProcessing
              ? t('uploader.extracting', 'Extracting and cleaning text...')
              : t('uploader.dragOrClick', 'Drag and drop a screenplay file, or click to browse')}
          </p>
          
          {/* Supported formats */}
          <div className="mb-6">
            <p className="text-xs text-cinema-text-dim mb-2">{t('uploader.supportedFormats', 'Supported formats')}:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['PDF', 'Final Draft (.fdx)', 'Celtx (.celtx)', 'Text (.txt)', 'Word (.docx)'].map((format) => (
                <span key={format} className="px-2 py-1 bg-cinema-gray rounded text-xs text-cinema-text">
                  {format}
                </span>
              ))}
            </div>
          </div>

          {/* Button */}
          {!isProcessing && (
            <button
              onClick={handleFileSelect}
              className="btn-primary inline-flex items-center gap-2 mb-6"
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t('uploader.selectFile', 'Select Screenplay File')}
            </button>
          )}

          {/* OCR Settings - Compact version inside drop zone */}
          {!isProcessing && (
            <div className="max-w-lg mx-auto">
              <div className="flex items-center justify-center gap-4 p-3 bg-cinema-gray/30 rounded-lg border border-cinema-gray/50 flex-wrap">
                <div className="flex items-center gap-3">
                  <label htmlFor="enableOCR" className="text-xs text-cinema-text whitespace-nowrap">
                    {t('uploader.enableOCR', 'Enable OCR (Optical Character Recognition)')}
                  </label>
                  
                  {/* Toggle Switch */}
                  <button
                    id="enableOCR"
                    role="switch"
                    aria-checked={useOCR}
                    onClick={() => setUseOCR(!useOCR)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cinema-accent focus:ring-offset-2 focus:ring-offset-cinema-dark ${
                      useOCR ? 'bg-cinema-accent' : 'bg-cinema-gray'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useOCR ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {useOCR && (
                  <>
                    <select
                      id="ocrLanguage"
                      value={ocrLanguage}
                      onChange={(e) => setOcrLanguage(e.target.value)}
                      className="px-3 py-1.5 bg-cinema-gray border border-cinema-gray-light rounded text-xs text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                    >
                      <option value="tur+eng">{t('uploader.turkishEnglish', 'Türkçe + İngilizce')}</option>
                      <option value="tur">{t('uploader.turkish', 'Türkçe')}</option>
                      <option value="eng">{t('uploader.english', 'English')}</option>
                    </select>
                    
                    <button
                      onClick={() => setShowOCRSettings(!showOCRSettings)}
                      className="p-2 bg-cinema-gray hover:bg-cinema-gray-light border border-cinema-gray-light rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cinema-accent"
                      title={t('uploader.ocrSettings', 'OCR Ayarları')}
                    >
                      <svg className="w-4 h-4 text-cinema-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              {useOCR && (
                <p className="text-xs text-cinema-text-dim mt-2 text-center px-4">
                  {t('uploader.ocrHint', 'Taranmış PDF\'ler veya metin çıkarılamayan görüntüler için OCR kullanın. İşlem daha uzun sürebilir.')}
                </p>
              )}
            </div>
          )}

          {/* Loading indicator */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-cinema-accent border-t-transparent"></div>
              <span className="text-cinema-text">{t('uploader.processing', 'Processing...')}</span>
            </div>
          )}
        </div>

        {/* Error message */}
        {useScriptStore.getState().error && (
          <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400">{useScriptStore.getState().error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-6 bg-cinema-dark rounded-lg border border-cinema-gray">
          <h3 className="text-lg font-semibold text-cinema-text mb-3">
            {t('uploader.whatIsThis', '🎬 ScriptMaster AI Nedir?')}
          </h3>
          <ul className="space-y-2 text-cinema-text-dim text-sm">
            <li className="flex items-start gap-2">
              <span className="text-cinema-accent mt-1">•</span>
              <span>
                {t('uploader.feature1', 'Senaryo metinlerini otomatik olarak temizler ve düzenler')}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cinema-accent mt-1">•</span>
              <span>{t('uploader.feature2', 'Yapay zeka ile karakter, olay örgüsü, tema, diyalog ve yapı analizi yapar')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cinema-accent mt-1">•</span>
              <span>{t('uploader.feature3', 'Hızlı okuma özelliği ile senaryoları dakikalar içinde gözden geçirin')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cinema-accent mt-1">•</span>
              <span>{t('uploader.feature4', 'Prodüksiyon planlaması için sahne, karakter ve lokasyon detaylarını çıkarır')}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Page Selection Modal */}
      {showPageSelection && currentPdfPath && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-cinema-dark border border-cinema-gray rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <h2 className="text-xl font-bold text-cinema-text">
                    {t('uploader.pageSelection', 'Sayfa Seçimi')}
                  </h2>
                  {totalPdfPages && (
                    <p className="text-xs text-cinema-text-dim">
                      {t('uploader.totalPages', 'Toplam {{count}} sayfa', { count: totalPdfPages })}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPageSelection(false);
                  setPageSelectionMode('all');
                }}
                className="text-cinema-text-dim hover:text-cinema-text transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                {/* All Pages Option */}
                <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  pageSelectionMode === 'all'
                    ? 'border-cinema-accent bg-cinema-accent/10'
                    : 'border-cinema-gray-light hover:border-cinema-accent/50'
                }`}>
                  <input
                    type="radio"
                    name="pageMode"
                    value="all"
                    checked={pageSelectionMode === 'all'}
                    onChange={(e) => setPageSelectionMode(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-cinema-text mb-1">
                      📄 {t('uploader.allPages', 'Tüm Sayfalar')}
                    </div>
                    <p className="text-xs text-cinema-text-dim">
                      {t('uploader.allPagesDesc', 'Belgenin tüm sayfalarını içe aktar')}
                    </p>
                  </div>
                </label>

                {/* Page Range Option */}
                <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  pageSelectionMode === 'range'
                    ? 'border-cinema-accent bg-cinema-accent/10'
                    : 'border-cinema-gray-light hover:border-cinema-accent/50'
                }`}>
                  <input
                    type="radio"
                    name="pageMode"
                    value="range"
                    checked={pageSelectionMode === 'range'}
                    onChange={(e) => setPageSelectionMode(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-cinema-text mb-2">
                      📑 {t('uploader.pageRange', 'Sayfa Aralığı')}
                    </div>
                    <p className="text-xs text-cinema-text-dim mb-3">
                      {t('uploader.pageRangeDesc', 'Belirli bir sayfa aralığını seçin (örn: 5-50)')}
                    </p>
                    {pageSelectionMode === 'range' && (
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max={totalPdfPages || 1000}
                          value={pageRangeStart}
                          onChange={(e) => setPageRangeStart(e.target.value)}
                          placeholder="1"
                          className="flex-1 px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                        />
                        <span className="text-cinema-text-dim">—</span>
                        <input
                          type="number"
                          min="1"
                          max={totalPdfPages || 1000}
                          value={pageRangeEnd}
                          onChange={(e) => setPageRangeEnd(e.target.value)}
                          placeholder={totalPdfPages?.toString() || "100"}
                          className="flex-1 px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </label>

                {/* Specific Pages Option */}
                <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  pageSelectionMode === 'specific'
                    ? 'border-cinema-accent bg-cinema-accent/10'
                    : 'border-cinema-gray-light hover:border-cinema-accent/50'
                }`}>
                  <input
                    type="radio"
                    name="pageMode"
                    value="specific"
                    checked={pageSelectionMode === 'specific'}
                    onChange={(e) => setPageSelectionMode(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-cinema-text mb-2">
                      🎯 {t('uploader.specificPages', 'Belirli Sayfalar')}
                    </div>
                    <p className="text-xs text-cinema-text-dim mb-3">
                      {t('uploader.specificPagesDesc', 'Virgül ve tire ile sayfa numaralarını belirtin (örn: 2,5,10-15,20)')}
                    </p>
                    {pageSelectionMode === 'specific' && (
                      <input
                        type="text"
                        value={specificPages}
                        onChange={(e) => setSpecificPages(e.target.value)}
                        placeholder="2,5-10,15,20"
                        className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                      />
                    )}
                  </div>
                </label>

                {/* From Page Option */}
                <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  pageSelectionMode === 'from'
                    ? 'border-cinema-accent bg-cinema-accent/10'
                    : 'border-cinema-gray-light hover:border-cinema-accent/50'
                }`}>
                  <input
                    type="radio"
                    name="pageMode"
                    value="from"
                    checked={pageSelectionMode === 'from'}
                    onChange={(e) => setPageSelectionMode(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-cinema-text mb-2">
                      ▶️ {t('uploader.fromPage', 'Belirli Sayfadan İtibaren')}
                    </div>
                    <p className="text-xs text-cinema-text-dim mb-3">
                      {t('uploader.fromPageDesc', 'Belirtilen sayfadan sonuna kadar tüm sayfalar (örn: 10\'dan sonraki tümü)')}
                    </p>
                    {pageSelectionMode === 'from' && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-cinema-text-dim whitespace-nowrap">
                          {t('uploader.startingFrom', 'Başlangıç:')}
                        </span>
                        <input
                          type="number"
                          min="1"
                          max={totalPdfPages || 1000}
                          value={pageRangeStart}
                          onChange={(e) => setPageRangeStart(e.target.value)}
                          placeholder="1"
                          className="flex-1 px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Info Box */}
              <div className="bg-cinema-gray/50 border border-cinema-gray-light rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-cinema-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-cinema-text-dim">
                    <p className="font-medium text-cinema-text mb-1">
                      {t('uploader.pageSelectionTips', 'Sayfa Seçimi İpuçları')}
                    </p>
                    <ul className="space-y-1 text-xs">
                      <li>• {t('uploader.pageSelectionTip1', 'Büyük belgeler için sadece gerekli sayfaları seçin')}</li>
                      <li>• {t('uploader.pageSelectionTip2', 'Aralıklar ve tekli sayfaları birlikte kullanabilirsiniz: "1-5,10,15-20"')}</li>
                      <li>• {t('uploader.pageSelectionTip3', 'Sayfa numaraları PDF\'deki fiziksel sayfa sırasıdır')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-cinema-dark border-t border-cinema-gray p-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowPageSelection(false);
                  setPageSelectionMode('all');
                }}
                className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light border border-cinema-gray-light rounded text-sm text-cinema-text transition-colors"
              >
                {t('uploader.cancel', 'İptal')}
              </button>
              <div className="flex items-center gap-3">
                {useOCR && (
                  <button
                    onClick={() => {
                      setShowPageSelection(false);
                      setShowOCRSettings(true);
                    }}
                    className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light border border-cinema-gray-light rounded text-sm text-cinema-text transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t('uploader.ocrSettings', 'OCR Ayarları')}
                  </button>
                )}
                <button
                  onClick={processFileWithPages}
                  disabled={isProcessing}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('uploader.processFile', 'Dosyayı İşle')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OCR Settings Modal */}
      {showOCRSettings && useOCR && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-cinema-dark border border-cinema-gray rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h2 className="text-xl font-bold text-cinema-text">
                  {t('uploader.ocrSettingsTitle', 'OCR Ayarları ve Önizleme')}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowOCRSettings(false);
                  setOcrPreviewMode(false);
                  setOcrPreviewText('');
                }}
                className="text-cinema-text-dim hover:text-cinema-text transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Settings Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cinema-text flex items-center gap-2">
                  <svg className="w-5 h-5 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  {t('uploader.ocrAdvancedSettings', 'Gelişmiş OCR Ayarları')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Language */}
                  <div>
                    <label className="block text-sm font-medium text-cinema-text mb-2">
                      {t('uploader.ocrLanguage', 'OCR Dili')}
                    </label>
                    <select
                      value={ocrLanguage}
                      onChange={(e) => setOcrLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                    >
                      <option value="tur+eng">{t('uploader.turkishEnglish', 'Türkçe + İngilizce')}</option>
                      <option value="tur">{t('uploader.turkish', 'Türkçe')}</option>
                      <option value="eng">{t('uploader.english', 'English')}</option>
                    </select>
                    <p className="text-xs text-cinema-text-dim mt-1">
                      {t('uploader.languageHelp', 'Belgedeki dilleri seçin. Karma metinler için her ikisini seçin.')}
                    </p>
                  </div>

                  {/* PSM Mode */}
                  <div>
                    <label className="block text-sm font-medium text-cinema-text mb-2">
                      {t('uploader.psmMode', 'Sayfa Düzeni Modu (PSM)')}
                    </label>
                    <select
                      value={ocrPSM}
                      onChange={(e) => setOcrPSM(e.target.value)}
                      className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                    >
                      <option value="3">{t('uploader.psmAuto', 'Otomatik (Karma Düzen)')}</option>
                      <option value="1">{t('uploader.psmAutoOSD', 'Otomatik + Yönlendirme')}</option>
                      <option value="6">{t('uploader.psmBlock', 'Tek Metin Bloğu')}</option>
                      <option value="4">{t('uploader.psmColumn', 'Tek Sütun')}</option>
                    </select>
                    <p className="text-xs text-cinema-text-dim mt-1">
                      {t('uploader.psmHelp', 'Sayfa düzenine göre en uygun modu seçin.')}
                    </p>
                  </div>

                  {/* Preview Page Selection */}
                  <div>
                    <label className="block text-sm font-medium text-cinema-text mb-2">
                      {t('uploader.previewPageNumber', 'Önizlenecek Sayfa')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={ocrPreviewPages}
                      onChange={(e) => setOcrPreviewPages(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                      placeholder="1"
                    />
                    <p className="text-xs text-cinema-text-dim mt-1">
                      {t('uploader.previewPageNumberHelp', 'Hangi sayfayı önizlemek istiyorsunuz? (1, 2, 3...)')}
                    </p>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-cinema-gray/50 border border-cinema-gray-light rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-cinema-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-cinema-text-dim">
                      <p className="font-medium text-cinema-text mb-1">
                        {t('uploader.ocrTips', 'OCR İpuçları')}
                      </p>
                      <ul className="space-y-1 text-xs">
                        <li>• {t('uploader.tip1', 'Karma metinler için "Türkçe + İngilizce" seçin')}</li>
                        <li>• {t('uploader.tip2', 'Çoğu belge için "Otomatik" PSM modu idealdir')}</li>
                        <li>• {t('uploader.tip3', 'Önizleme ile ayarları test edin, sonra tam işleme geçin')}</li>
                        <li>• {t('uploader.tip4', 'Düşük kaliteli taramalar daha uzun sürebilir')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-cinema-text flex items-center gap-2">
                    <svg className="w-5 h-5 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {t('uploader.ocrPreview', 'OCR Önizleme Sonucu')}
                  </h3>
                  
                  <button
                    onClick={async () => {
                      try {
                        // Eğer zaten bir PDF seçilmişse, onu kullan
                        if (currentPdfPath) {
                          await previewOCR(currentPdfPath);
                        } else {
                          // İlk seferinde PDF seç
                          const filePath = await window.electronAPI.openFile();
                          if (filePath) {
                            setCurrentPdfPath(filePath);
                            await previewOCR(filePath);
                          }
                        }
                      } catch (error) {
                        console.error('Preview error:', error);
                        setError(`Failed to select file: ${error.message}`);
                      }
                    }}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-cinema-accent hover:bg-cinema-accent-light border border-cinema-accent rounded text-xs text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cinema-accent disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {currentPdfPath ? t('uploader.rePreview', 'Yeniden Önizle') : t('uploader.preview', 'Önizleme')}
                  </button>
                </div>

                  {/* OCR Progress */}
                  {ocrProgress && (
                    <div className="bg-cinema-gray/50 border border-cinema-gray-light rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-cinema-text">{ocrProgress.message}</span>
                        <span className="text-sm font-medium text-cinema-accent">{ocrProgress.progress}%</span>
                      </div>
                      <div className="w-full bg-cinema-gray rounded-full h-2">
                        <div
                          className="bg-cinema-accent h-2 rounded-full transition-all duration-300"
                          style={{ width: `${ocrProgress.progress}%` }}
                        />
                      </div>
                      {ocrProgress.page && ocrProgress.totalPages && (
                        <p className="text-xs text-cinema-text-dim mt-2">
                          {t('uploader.ocrPageProgress', 'Sayfa {{current}} / {{total}}', {
                            current: ocrProgress.page,
                            total: ocrProgress.totalPages
                          })}
                        </p>
                      )}
                    </div>
                  )}

                {!ocrPreviewText && !ocrProgress && (
                  <div className="text-center py-12 text-cinema-text-dim">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <p className="text-sm mb-3">
                      {currentPdfPath 
                        ? t('uploader.noPreviewYet', 'Henüz önizleme yapılmadı')
                        : t('uploader.selectPdfFirst', 'Önce PDF seçin')}
                    </p>
                    {currentPdfPath && (
                      <button
                        onClick={async () => {
                          try {
                            const filePath = await window.electronAPI.openFile();
                            if (filePath) {
                              setCurrentPdfPath(filePath);
                              setOcrPreviewText(''); // Önceki önizlemeyi temizle
                            }
                          } catch (error) {
                            console.error('File selection error:', error);
                          }
                        }}
                        className="px-3 py-1.5 bg-cinema-gray hover:bg-cinema-gray-light border border-cinema-gray-light rounded text-xs text-cinema-text transition-colors inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t('uploader.changePdf', 'Farklı PDF Seç')}
                      </button>
                    )}
                  </div>
                )}

                {/* Preview Text */}
                {ocrPreviewText && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-cinema-text">
                        {t('uploader.previewResult', 'Önizleme Sonucu')}
                      </label>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(ocrPreviewText);
                        }}
                        className="text-xs text-cinema-accent hover:text-cinema-accent-light transition-colors flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t('uploader.copyToClipboard', 'Kopyala')}
                      </button>
                    </div>
                    <div className="bg-cinema-gray/50 border border-cinema-gray-light rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-sm text-cinema-text whitespace-pre-wrap font-mono">
                        {ocrPreviewText}
                      </pre>
                    </div>
                    <p className="text-xs text-cinema-text-dim">
                      {t('uploader.previewNote', 'Bu önizleme {{page}}. sayfayı içerir. Sonuçlar tatmin ediciyse, aşağıdaki butonu kullanarak tüm belgeyi işleyebilirsiniz.', { page: ocrPreviewPages })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-cinema-dark border-t border-cinema-gray p-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowOCRSettings(false);
                  setOcrPreviewMode(false);
                }}
                className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light border border-cinema-gray-light rounded text-sm text-cinema-text transition-colors"
              >
                {t('uploader.cancel', 'İptal')}
              </button>
              <button
                onClick={() => {
                  // Ayarları kaydet ve kapat
                  setShowOCRSettings(false);
                  setOcrPreviewMode(false);
                }}
                disabled={isProcessing}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('uploader.saveSettings', 'Kaydet')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
