/**
 * OCR Service using Tesseract.js
 * Provides text extraction from images with Turkish and English support
 */

import { createWorker } from 'tesseract.js';

/**
 * Perform OCR on PDF by converting pages to images
 * @param {string} filePath - Path to PDF file
 * @param {string} language - OCR language (tur+eng, tur, eng)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Extracted text and metadata
 */
export async function performPDFOCR(filePath, language = 'tur+eng', onProgress = () => {}) {
  let worker = null;
  
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

    // Create worker with local paths
    worker = await createWorker(language, 1, {
      logger: (m) => {
        console.log('OCR Worker:', m);
        if (m.status === 'loading tesseract core') {
          onProgress({
            status: 'loading',
            progress: 5,
            message: 'Loading OCR engine...',
            totalPages
          });
        } else if (m.status === 'initializing tesseract') {
          onProgress({
            status: 'initializing',
            progress: 8,
            message: 'Initializing OCR...',
            totalPages
          });
        }
      },
      errorHandler: (err) => {
        console.error('Worker error:', err);
      }
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
        const result = await worker.recognize(imageDataUrl, {
          rotateAuto: true
        });

        // Add page text
        if (result && result.data && result.data.text) {
          fullText += result.data.text + '\n\n';
          console.log(`Page ${pageNumber} OCR successful, extracted ${result.data.text.length} characters`);
        } else {
          console.warn(`Page ${pageNumber} returned no text`);
          fullText += `[No text detected on page ${pageNumber}]\n\n`;
        }
        
      } catch (pageError) {
        console.error(`OCR failed for page ${pageNumber}:`, pageError);
        console.error('Error details:', pageError.message, pageError.stack);
        fullText += `[OCR Error on page ${pageNumber}: ${pageError.message}]\n\n`;
      }
    }

    // Cleanup
    onProgress({ status: 'cleanup', progress: 95, message: 'Cleaning up...' });
    
    // Terminate worker
    if (worker) {
      await worker.terminate();
    }
    
    // Cleanup temp files
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
    
    // Cleanup worker on error
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.error('Failed to terminate worker:', e);
      }
    }
    
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Check if OCR is available (Tesseract.js loaded)
 * @returns {boolean}
 */
export function isOCRAvailable() {
  try {
    return typeof createWorker !== 'undefined';
  } catch {
    return false;
  }
}

export default {
  performPDFOCR,
  isOCRAvailable
};
