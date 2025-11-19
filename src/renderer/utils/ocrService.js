/**
 * OCR Service using Tesseract.js
 * Provides text extraction from images with Turkish and English support
 */

import Tesseract from 'tesseract.js';

/**
 * Perform OCR on PDF by converting pages to images
 * @param {string} filePath - Path to PDF file
 * @param {string} language - OCR language (tur+eng, tur, eng)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Extracted text and metadata
 */
export async function performPDFOCR(filePath, language = 'tur+eng', onProgress = () => {}) {
  try {
    onProgress({ status: 'converting', progress: 0, message: 'Converting PDF to images...' });
    
    // Convert PDF pages to images
    const imageResult = await window.electronAPI.pdfToImages(filePath);
    
    if (!imageResult.success) {
      throw new Error(imageResult.error || 'Failed to convert PDF to images');
    }

    const { pages, tmpDir } = imageResult;
    const totalPages = pages.length;
    let fullText = '';
    
    onProgress({ 
      status: 'initializing', 
      progress: 10, 
      message: 'Initializing OCR engine...',
      totalPages 
    });

    // Process each page
    for (let i = 0; i < totalPages; i++) {
      const pageNumber = i + 1;
      
      onProgress({
        status: 'recognizing',
        progress: 10 + Math.round((i / totalPages) * 80),
        message: `Processing page ${pageNumber}/${totalPages}...`,
        page: pageNumber,
        totalPages
      });

      try {
        // Convert base64 to image data URL
        const imageDataUrl = `data:image/png;base64,${pages[i].data}`;
        
        // Perform OCR on this page
        const result = await Tesseract.recognize(
          imageDataUrl,
          language,
          {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                const pageProgress = Math.round(m.progress * 100);
                onProgress({
                  status: 'recognizing',
                  progress: 10 + Math.round((i / totalPages) * 80) + Math.round((m.progress / totalPages) * 80),
                  message: `Page ${pageNumber}/${totalPages} - ${pageProgress}%`,
                  page: pageNumber,
                  totalPages,
                  pageProgress
                });
              }
            }
          }
        );

        // Add page text
        fullText += result.data.text + '\n\n';
        
      } catch (pageError) {
        console.error(`OCR failed for page ${pageNumber}:`, pageError);
        fullText += `[OCR Error on page ${pageNumber}]\n\n`;
      }
    }

    // Cleanup temp files
    onProgress({ status: 'cleanup', progress: 95, message: 'Cleaning up temporary files...' });
    await window.electronAPI.ocrCleanup(tmpDir);

    onProgress({ status: 'complete', progress: 100, message: 'OCR completed successfully!' });

    return {
      success: true,
      text: fullText.trim(),
      pages: totalPages,
      language
    };

  } catch (error) {
    console.error('OCR process failed:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Check if OCR is available (Tesseract.js loaded)
 * @returns {boolean}
 */
export function isOCRAvailable() {
  try {
    return typeof Tesseract !== 'undefined';
  } catch {
    return false;
  }
}

export default {
  performPDFOCR,
  isOCRAvailable
};
