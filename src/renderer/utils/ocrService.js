/**
 * OCR Service using Tesseract.js
 * Provides text extraction from images with Turkish and English support
 */

import Tesseract from 'tesseract.js/dist/tesseract.esm.min.js';

/**
 * Perform OCR on PDF by converting pages to images
 * @param {string} filePath - Path to PDF file
 * @param {string} language - OCR language (tur+eng, tur, eng)
 * @param {string} psm - Page Segmentation Mode (1-13, default 3)
 * @param {Function} onProgress - Progress callback
 * @param {number} pageNumber - Specific page number to process (1-based, 0 = all pages) - DEPRECATED, use selectedPages instead
 * @param {Array<number>} selectedPages - Array of page numbers to process (1-based, null = all pages)
 * @returns {Promise<Object>} - Extracted text and metadata
 */
export async function performPDFOCR(filePath, language = 'tur+eng', psm = '3', onProgress = () => {}, pageNumber = 0, selectedPages = null) {
  let worker = null;
  
  try {
    onProgress({ status: 'converting', progress: 0, message: 'Converting PDF to images...' });
    
    // Convert PDF pages to images (with page selection)
    const imageResult = await window.electronAPI.pdfToImages(filePath, selectedPages);
    
    if (!imageResult.success) {
      throw new Error(imageResult.error || 'Failed to convert PDF to images');
    }

    const { pages, tmpDir } = imageResult;
    
    // Handle legacy pageNumber parameter
    if (pageNumber > 0 && !selectedPages) {
      selectedPages = [pageNumber];
    }
    
    const totalPages = pages.length;
    const pagesToProcess = Array.from({ length: totalPages }, (_, i) => i);
    let fullText = '';
    
    onProgress({ 
      status: 'initializing', 
      progress: 10, 
      message: pageNumber > 0 ? `Initializing OCR engine (Page ${pageNumber} of ${totalPages})...` : 'Initializing OCR engine...',
      totalPages 
    });

    // Create worker with all local paths for full offline support
    worker = await Tesseract.createWorker(language, 1, {
      workerPath: '/tesseract/worker.min.js',
      langPath: '/tesseract/traineddata',
      corePath: '/tesseract',
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
    for (let idx = 0; idx < pagesToProcess.length; idx++) {
      const i = pagesToProcess[idx];
      // Get actual page number from the image metadata (if available)
      const currentPageNumber = pages[i].pageNumber || (i + 1);
      
      onProgress({
        status: 'recognizing',
        progress: 10 + Math.round((idx / pagesToProcess.length) * 80),
        message: selectedPages ? `Processing page ${currentPageNumber} (${idx + 1}/${totalPages})...` : `Processing page ${currentPageNumber}/${totalPages}...`,
        page: currentPageNumber,
        totalPages
      });

      try {
        // Convert base64 to image data URL
        const imageDataUrl = `data:image/png;base64,${pages[i].data}`;
        
        // Perform OCR on this page with enhanced parameters
        const result = await worker.recognize(imageDataUrl, {
          rotateAuto: true,
          // Page Segmentation Mode (PSM) - user selectable
          // PSM 3: Fully automatic page segmentation (best for mixed layout)
          // PSM 1: Auto with OSD (Orientation and Script Detection)
          // PSM 6: Assume uniform block of text
          // PSM 4: Single column of text
          tessedit_pageseg_mode: psm,
          
          // OEM 1: Neural nets LSTM engine only (most accurate for modern docs)
          tessedit_ocr_engine_mode: '1',
          
          // Preprocessing parameters for better recognition
          tessedit_do_invert: '0',
          
          // Preserve interword spaces
          preserve_interword_spaces: '1',
          
          // Character blacklist (remove common OCR errors)
          tessedit_char_blacklist: '|[]{}',
          
          // Better whitespace handling
          tessedit_make_boxes_from_boxes: '0'
        });

        // Add page text
        if (result && result.data && result.data.text) {
          fullText += result.data.text + '\n\n';
          console.log(`Page ${currentPageNumber} OCR successful, extracted ${result.data.text.length} characters`);
        } else {
          console.warn(`Page ${currentPageNumber} returned no text`);
          fullText += `[No text detected on page ${currentPageNumber}]\n\n`;
        }
        
      } catch (pageError) {
        console.error(`OCR failed for page ${currentPageNumber}:`, pageError);
        console.error('Error details:', pageError.message, pageError.stack);
        fullText += `[OCR Error on page ${currentPageNumber}: ${pageError.message}]\n\n`;
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
      totalPages: totalPages,
      processedPages: selectedPages || 'all',
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
    return typeof Tesseract !== 'undefined' && typeof Tesseract.createWorker === 'function';
  } catch {
    return false;
  }
}

export default {
  performPDFOCR,
  isOCRAvailable
};
