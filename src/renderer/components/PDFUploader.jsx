import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { cleanScreenplayText, parseScenes } from '../utils/textProcessing';
import { parseScreenplayFile } from '../utils/screenplayParser';

export default function PDFUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setScriptText, setOriginalFileName, setPageCount, setError } = useScriptStore();
  const { t } = useTranslation();

  // Process files based on extension
  const processFile = async (filePath, fileBuffer = null) => {
    setIsProcessing(true);
    setError(null);

    try {
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
      const extension = fileName.toLowerCase().split('.').pop();

      let result;

      if (extension === 'pdf') {
        // Handle PDF files with existing logic
        result = await window.electronAPI.parsePDF(filePath);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to parse PDF');
        }

        setOriginalFileName(fileName);
        setPageCount(result.pages);
        setScriptText(result.text, result.metadata);

        // Clean the text automatically
        const cleaned = cleanScreenplayText(result.text);
        useScriptStore.getState().setCleanedText(cleaned);

        console.log('PDF loaded successfully:', {
          pages: result.pages,
          textLength: result.text.length,
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
        
        setOriginalFileName(fileName);
        setPageCount(screenplay.scenes?.length || 1); // Use scene count as page estimate
        
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
        await processFile(filePath);
      }
    } catch (error) {
      console.error('File selection error:', error);
      setError('Failed to open file');
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t('uploader.selectFile', 'Select Screenplay File')}
            </button>
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
            📋 What happens next?
          </h3>
          <ul className="space-y-2 text-cinema-text-dim text-sm">
            <li className="flex items-start gap-2">
              <span className="text-cinema-accent mt-1">1.</span>
              <span>
                Your PDF will be parsed and the text will be automatically cleaned
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cinema-accent mt-1">2.</span>
              <span>You can review and further edit the extracted text</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cinema-accent mt-1">3.</span>
              <span>Run AI analysis for production breakdown</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cinema-accent mt-1">4.</span>
              <span>Use the speed reader for rapid script review</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
