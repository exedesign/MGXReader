import React, { useState, useCallback } from 'react';
import { useScriptStore } from '../store/scriptStore';
import { cleanScreenplayText, parseScenes } from '../utils/textProcessing';

export default function PDFUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setScriptText, setOriginalFileName, setPageCount, setError } = useScriptStore();

  const processPDFFile = async (filePath) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Parse PDF using Electron API
      const result = await window.electronAPI.parsePDF(filePath);

      if (!result.success) {
        throw new Error(result.error || 'Failed to parse PDF');
      }

      // Set the script data
      const fileName = filePath.split('/').pop();
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
    } catch (error) {
      console.error('PDF processing error:', error);
      setError(error.message || 'Failed to process PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async () => {
    try {
      const filePath = await window.electronAPI.openFile();
      if (filePath) {
        await processPDFFile(filePath);
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
    const pdfFile = files.find((file) => file.name.toLowerCase().endsWith('.pdf'));

    if (pdfFile) {
      await processPDFFile(pdfFile.path);
    } else {
      setError('Please drop a PDF file');
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
            {isProcessing ? 'Processing PDF...' : 'Drop your screenplay here'}
          </h2>
          <p className="text-cinema-text-dim mb-6">
            {isProcessing
              ? 'Extracting and cleaning text...'
              : 'Drag and drop a PDF file, or click to browse'}
          </p>

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
              Select PDF File
            </button>
          )}

          {/* Loading indicator */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-cinema-accent border-t-transparent"></div>
              <span className="text-cinema-text">Processing...</span>
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
