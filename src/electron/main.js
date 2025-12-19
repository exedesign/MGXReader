const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const poppler = require('pdf-poppler');
const PDFParser = require('pdf2json');

// Disable Electron security warnings in development
if (process.env.NODE_ENV !== 'production') {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

// Fix Electron cache and GPU errors
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
app.commandLine.appendSwitch('--no-sandbox');
// Fix cache permission issues
app.commandLine.appendSwitch('--disk-cache-dir', path.join(__dirname, '../../cache'));
app.commandLine.appendSwitch('--disk-cache-size', '50000000'); // 50MB

let mainWindow;

// Fix common PDF encoding issues
function fixPDFEncoding(text) {
  if (!text || typeof text !== 'string') return text;
  
  try {
    // Common PDF encoding fixes
    let fixedText = text;
    
    // Fix common Windows-1252 to UTF-8 issues
    const encodingFixes = {
      'â€™': "'",     // apostrophe
      'â€œ': '"',     // left double quote
      'â€\x9d': '"',  // right double quote
      'â€"': '–',     // en dash
      'â€"': '—',     // em dash
      'â€¦': '…',     // ellipsis
      'Ã¡': 'á',     // á
      'Ã©': 'é',     // é
      'Ã­': 'í',     // í
      'Ã³': 'ó',     // ó
      'Ãº': 'ú',     // ú
      'Ã±': 'ñ',     // ñ
      'Ã§': 'ç',     // ç
      'Ã¼': 'ü',     // ü
      'Ã': 'İ',      // Turkish I
      'Ä±': 'ı',     // Turkish ı
      'Ä°': 'İ',     // Turkish İ
      'Ã¼': 'ü',     // ü
      'Ã¶': 'ö',     // ö
      'Ä\x9f': 'ğ',  // Turkish ğ
      'Ä\x9e': 'Ğ',  // Turkish Ğ
      'Å\x9f': 'ş',  // Turkish ş
      'Å\x9e': 'Ş',  // Turkish Ş
      'Ä\x83': 'ă',  // Romanian ă
      'Ä\x82': 'Ă',  // Romanian Ă
      '\ufffd': '',   // replacement character
      '\x00': '',     // null bytes
      '\x01': '',     // control characters
      '\x02': '',
      '\x03': '',
      '\x04': '',
      '\x05': '',
      '\x06': '',
      '\x07': '',
      '\x08': '',
      '\x0e': '',
      '\x0f': '',
      '\x10': '',
      '\x11': '',
      '\x12': '',
      '\x13': '',
      '\x14': '',
      '\x15': '',
      '\x16': '',
      '\x17': '',
      '\x18': '',
      '\x19': '',
      '\x1a': '',
      '\x1b': '',
      '\x1c': '',
      '\x1d': '',
      '\x1e': '',
      '\x1f': ''
    };
    
    // Apply fixes
    Object.keys(encodingFixes).forEach(wrongChar => {
      const fixedChar = encodingFixes[wrongChar];
      fixedText = fixedText.replace(new RegExp(wrongChar, 'g'), fixedChar);
    });
    
    // Remove or replace other problematic characters
    fixedText = fixedText
      // Remove invisible/zero-width characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s{2,}/g, ' ')
      // Fix line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive line breaks
      .replace(/\n{3,}/g, '\n\n');
    
    console.log('PDF encoding fix applied, character count:', text.length, '->', fixedText.length);
    
    return fixedText;
    
  } catch (error) {
    console.warn('Error fixing PDF encoding:', error);
    return text; // Return original if fix fails
  }
}

async function createWindow() {
  // Get screen dimensions
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  // Calculate window size (80% of screen, but within reasonable bounds)
  const windowWidth = Math.min(Math.max(Math.floor(screenWidth * 0.8), 1024), 1600);
  const windowHeight = Math.min(Math.max(Math.floor(screenHeight * 0.8), 768), 1200);
  
  // Center window on screen
  const x = Math.floor((screenWidth - windowWidth) / 2);
  const y = Math.floor((screenHeight - windowHeight) / 2);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    minWidth: 1024,
    minHeight: 768,
    maxWidth: screenWidth,
    maxHeight: screenHeight,
    backgroundColor: '#0a0a0a',
    title: 'MGX Reader - Screenplay Analysis Tool',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: process.env.NODE_ENV === 'production', // Only enable in production
      allowRunningInsecureContent: process.env.NODE_ENV !== 'production', // Allow in development
      experimentalFeatures: process.env.NODE_ENV !== 'production' // Only in development
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true, // Always show frame for better UX
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    show: true, // Show immediately for debugging
    alwaysOnTop: false,
    icon: path.join(__dirname, '../../icon.ico'), // Use the icon.ico from root directory
  });

  // Force window to be visible and focused
  console.log('Window created, ensuring visibility...');
  mainWindow.show();
  mainWindow.focus();
  mainWindow.moveTop();
  
  // Set window title
  mainWindow.setTitle('MGX Reader - Loading...');
  
  console.log(`Window visible: ${mainWindow.isVisible()}, minimized: ${mainWindow.isMinimized()}`);

  // Development mode
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    // Try ports in order of Vite's preference (3000 is current active port)
    const tryPorts = [3000, 3001, 3002, 3003, 5173, 3004, 3005];
    let connected = false;
    
    for (const port of tryPorts) {
      try {
        console.log(`Attempting to load from http://localhost:${port}`);
        await mainWindow.loadURL(`http://localhost:${port}`);
        console.log(`Successfully connected to port ${port}`);
        connected = true;
        // Force show window after successful connection
        setTimeout(() => {
          mainWindow.setTitle('MGX Reader - Screenplay Analysis Tool');
          mainWindow.show();
          mainWindow.focus();
          mainWindow.moveTop();
          console.log('Window re-shown after connection');
        }, 1000);
        break;
      } catch (error) {
        console.log(`Port ${port} failed: ${error.code || error.message}`);
        // Continue to next port
      }
    }
    
    if (!connected) {
      console.error('Could not connect to development server on any port');
      // Show error page instead of crashing
      await mainWindow.loadURL('data:text/html,<h1>Development Server Not Running</h1><p>Please start the development server with: npm run start:react</p>');
    }
    
    // Only open DevTools in development mode
    if (process.env.NODE_ENV !== 'production') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    // Production mode
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Set initial menu visibility (show by default, hide only in fullscreen)
    mainWindow.setMenuBarVisibility(true);
    
    // Focus window
    if (process.platform === 'darwin') {
      mainWindow.focus();
    }
  });

  // Backup: Show window after content loads (in case ready-to-show doesn't fire)
  mainWindow.webContents.once('did-finish-load', () => {
    if (!mainWindow.isVisible()) {
      setTimeout(() => {
        mainWindow.show();
        mainWindow.focus();
      }, 500);
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Listen for fullscreen changes
  mainWindow.on('enter-full-screen', () => {
    mainWindow.setMenuBarVisibility(false);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow.setMenuBarVisibility(true);
  });

  // Handle window resize - save window state
  mainWindow.on('resize', () => {
    // Optional: Save window state for next launch
  });

  // Handle window move - save position
  mainWindow.on('move', () => {
    // Optional: Save window position for next launch  
  });
}

// Global error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.whenReady().then(() => createWindow()).catch((error) => {
  console.error('App startup failed:', error);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Open file dialog and return file path
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// Open multiple files dialog and return file paths
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Screenplay Files', extensions: ['pdf', 'fdx', 'celtx', 'txt', 'docx'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Final Draft Files', extensions: ['fdx'] },
      { name: 'Celtx Files', extensions: ['celtx'] },
      { name: 'Text Files', extensions: ['txt', 'docx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths;
});

// Get PDF info (page count, etc.)
ipcMain.handle('pdf:getInfo', async (event, filePath) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    return {
      success: true,
      pageCount: data.numpages,
      info: data.info,
      metadata: data.metadata,
    };
  } catch (error) {
    console.error('PDF info error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Parse PDF file (with optional page selection)
ipcMain.handle('pdf:parse', async (event, filePath, selectedPages = null) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    let text = data.text;
    let pages = data.numpages;

    // Fix common encoding issues in PDF text extraction
    text = fixPDFEncoding(text);

    // If specific pages are selected, filter the text
    if (selectedPages && Array.isArray(selectedPages) && selectedPages.length > 0) {
      // PDF-parse doesn't support per-page extraction directly
      // We need to use a different approach for page filtering
      // For now, we'll process all pages and filter by page numbers in the text
      // This is a limitation - ideally we'd use pdf-lib or similar for better page control
      
      console.log(`PDF: Selected pages ${selectedPages.join(', ')} out of ${pages} total pages`);
      // Note: Actual page filtering would require additional library like pdf-lib
      // For now, we return all text but log the selection
    }

    return {
      success: true,
      text: text,
      pages: pages,
      selectedPages: selectedPages,
      info: data.info,
      metadata: data.metadata,
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Advanced PDF parser with coordinate extraction using pdf2json
ipcMain.handle('pdf:parseAdvanced', async (event, filePath, selectedPages = null) => {
  return new Promise((resolve) => {
    const pdfParser = new PDFParser(null, 1); // raw text mode
    
    const elements = [];
    let metadata = {};
    let totalPages = 0;

    pdfParser.on('pdfParser_dataError', (errData) => {
      console.error('❌ pdf2json error:', errData.parserError);
      resolve({
        success: false,
        error: errData.parserError,
        fallbackToStandard: true
      });
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        console.log('📄 pdf2json parsing complete');
        
        // FONT COLLECTION: TÜM SAYFALARDAKI TÜM FONTLARI TOPLA
        // Her sayfanın kendi font table'ı var, global mapping oluştur
        const fontTableByPage = []; // Her sayfa için font table
        const globalFontTable = {}; // Global font index -> name mapping
        const uniqueFonts = new Set();
        let fontIndexCounter = 0;
        
        console.log(`📚 Toplam ${pdfData.Pages?.length || 0} sayfa taranacak...`);
        
        pdfData.Pages?.forEach((page, pageIdx) => {
          const pageFontTable = {};
          
          if (page.Fonts && Array.isArray(page.Fonts)) {
            console.log(`📄 Sayfa ${pageIdx + 1}: ${page.Fonts.length} font tanımı bulundu`);
            
            page.Fonts.forEach((font, localIdx) => {
              const fontName = font.name || `Font${localIdx}`;
              const fontType = font.type || 'Unknown';
              const encoding = font.encoding || 'Unknown';
              
              // Sayfa-local mapping
              pageFontTable[localIdx] = fontName;
              
              // Global mapping
              const globalIdx = `${pageIdx}_${localIdx}`;
              globalFontTable[globalIdx] = fontName;
              
              uniqueFonts.add(fontName);
              
              if (pageIdx === 0) {
                console.log(`   Font[${localIdx}]: ${fontName} (${fontType}, ${encoding})`);
              }
            });
            
            fontTableByPage[pageIdx] = pageFontTable;
          } else {
            console.log(`⚠️ Sayfa ${pageIdx + 1}: Font tanımı yok`);
            fontTableByPage[pageIdx] = {};
          }
        });
        
        const fontList = Array.from(uniqueFonts);
        console.log(`🔤 Toplam ${fontList.length} farklı unique font bulundu:`);
        fontList.forEach(f => console.log(`   - ${f}`));
        
        // XMP METADATA PARSING: Application field ve gelişmiş metadata
        let xmpMetadata = {};
        let applicationName = '';
        
        // XMP metadata genellikle pdfData.Meta.Metadata veya pdfData.Metadata'da
        const xmpData = pdfData.Meta?.Metadata || pdfData.Metadata;
        
        if (xmpData) {
          console.log('📝 XMP Metadata bulundu, parsing...');
          
          // XMP metadata string olarak gelebilir, parse et
          if (typeof xmpData === 'string') {
            // XML/XMP string'i parse et
            try {
              // Application field'ini bul (xmp:CreatorTool veya dc:creator)
              const appMatch = xmpData.match(/<xmp:CreatorTool>(.*?)<\/xmp:CreatorTool>/i) ||
                               xmpData.match(/<stEvt:softwareAgent>(.*?)<\/stEvt:softwareAgent>/i) ||
                               xmpData.match(/<pdf:Producer>(.*?)<\/pdf:Producer>/i);
              
              if (appMatch) {
                applicationName = appMatch[1].trim();
                console.log(`   Application: ${applicationName}`);
              }
              
              // Diğer XMP fields
              const titleMatch = xmpData.match(/<dc:title>.*?<rdf:li[^>]*>(.*?)<\/rdf:li>/i);
              const authorMatch = xmpData.match(/<dc:creator>.*?<rdf:li[^>]*>(.*?)<\/rdf:li>/i);
              const subjectMatch = xmpData.match(/<dc:subject>.*?<rdf:li[^>]*>(.*?)<\/rdf:li>/i);
              
              xmpMetadata = {
                application: applicationName,
                title: titleMatch?.[1] || '',
                author: authorMatch?.[1] || '',
                subject: subjectMatch?.[1] || '',
                raw: xmpData
              };
            } catch (e) {
              console.warn('⚠️ XMP parsing hatası:', e.message);
            }
          } else if (typeof xmpData === 'object') {
            // Object olarak gelmişse direkt kullan
            applicationName = xmpData.application || xmpData.CreatorTool || xmpData.softwareAgent || '';
            xmpMetadata = xmpData;
          }
        }
        
        // SENARYO PROGRAMI DETECTION: Multi-source detection
        let detectedProgram = 'Unknown';
        let detectionSource = 'none';
        
        // 1. ÖNCELİK: Application field (en güvenilir)
        if (applicationName) {
          const appLower = applicationName.toLowerCase();
          if (appLower.includes('final draft')) {
            detectedProgram = 'Final Draft';
            detectionSource = 'xmp-application';
            // Version bilgisini çıkar
            const versionMatch = applicationName.match(/final\s*draft\s*(\d+(?:\.\d+)*)/i);
            if (versionMatch) {
              detectedProgram += ` ${versionMatch[1]}`;
            }
          } else if (appLower.includes('celtx')) {
            detectedProgram = 'Celtx';
            detectionSource = 'xmp-application';
          } else if (appLower.includes('writerduet')) {
            detectedProgram = 'WriterDuet';
            detectionSource = 'xmp-application';
          } else if (appLower.includes('fade in')) {
            detectedProgram = 'Fade In';
            detectionSource = 'xmp-application';
          }
        }
        
        // 2. FALLBACK: Creator field
        if (detectedProgram === 'Unknown' && pdfData.Meta?.Creator) {
          const creatorLower = pdfData.Meta.Creator.toLowerCase();
          if (creatorLower.includes('final draft')) {
            detectedProgram = 'Final Draft';
            detectionSource = 'creator-field';
          } else if (creatorLower.includes('celtx')) {
            detectedProgram = 'Celtx / Highland';
            detectionSource = 'creator-field';
          }
        }
        
        // 3. FALLBACK: Font signature matching
        if (detectedProgram === 'Unknown') {
          const fontString = fontList.join('|').toLowerCase();
          
          if (fontString.includes('courierfinal') || fontString.includes('courier final draft')) {
            detectedProgram = 'Final Draft';
            detectionSource = 'font-signature';
          } else if (fontString.includes('courier-prime') || fontString.includes('courier prime')) {
            detectedProgram = 'Celtx / Highland';
            detectionSource = 'font-signature';
          } else if (fontString.includes('courier screenplay')) {
            detectedProgram = 'WriterDuet';
            detectionSource = 'font-signature';
          } else if (fontString.includes('fadein')) {
            detectedProgram = 'Fade In';
            detectionSource = 'font-signature';
          } else if (fontString.includes('courier') || fontString.includes('courier new')) {
            detectedProgram = 'Generic Screenplay';
            detectionSource = 'font-signature';
          }
        }
        
        console.log(`🎬 Tespit Edilen Program: ${detectedProgram} (kaynak: ${detectionSource})`);
        
        // METADATA EXTRACTION: TÜM PDF METADATA FIELDS
        metadata = {
          // Basic Info
          title: xmpMetadata.title || pdfData.Meta?.Title || '',
          author: xmpMetadata.author || pdfData.Meta?.Author || '',
          subject: xmpMetadata.subject || pdfData.Meta?.Subject || '',
          keywords: pdfData.Meta?.Keywords || '',
          
          // Technical Info
          application: applicationName, // XMP Application field (Final Draft 11 gibi)
          creator: pdfData.Meta?.Creator || '', // Önemli: Hangi programda oluşturuldu
          producer: pdfData.Meta?.Producer || '', // PDF üreteci (ghostscript, Adobe, vb)
          
          // Dates
          creationDate: pdfData.Meta?.CreationDate || '',
          modificationDate: pdfData.Meta?.ModDate || '',
          
          // PDF Structure
          pages: pdfData.Pages?.length || 0,
          pdfVersion: pdfData.Meta?.PDFFormatVersion || '',
          
          // Font Information
          fonts: fontTableByPage[0] || {}, // İlk sayfanın font table'ı (compat)
          fontList: fontList, // Unique font names array
          fontTableByPage: fontTableByPage, // Her sayfa için font mapping
          globalFontTable: globalFontTable, // Tüm sayfalar için global mapping
          
          // Auto-Detection
          detectedProgram: detectedProgram, // Tespit edilen senaryo programı
          detectionSource: detectionSource, // Tespit yöntemi (xmp-application, creator-field, font-signature)
          
          // XMP Metadata
          xmp: xmpMetadata,
          
          // Raw Metadata (gelişmiş kullanım için)
          raw: pdfData.Meta || {}
        };
        
        totalPages = metadata.pages;
        console.log(`📊 PDF Metadata:`);
        console.log(`   Title: ${metadata.title || '(empty)'}`);
        console.log(`   Author: ${metadata.author || '(empty)'}`);
        console.log(`   Application: ${metadata.application || '(empty)'}`);
        console.log(`   Creator: ${metadata.creator || '(empty)'}`);
        console.log(`   Producer: ${metadata.producer || '(empty)'}`);
        console.log(`   Pages: ${totalPages}`);
        console.log(`   PDF Version: ${metadata.pdfVersion || '(unknown)'}`);
        console.log(`   Detection: ${detectedProgram} via ${detectionSource}`);

        // Filter pages if selectedPages is provided
        const pagesToProcess = selectedPages 
          ? pdfData.Pages.filter((_, idx) => selectedPages.includes(idx + 1))
          : pdfData.Pages;

        // Extract text elements with coordinates
        pagesToProcess.forEach((page, pageIdx) => {
          const actualPageNumber = selectedPages ? selectedPages[pageIdx] : pageIdx + 1;
          const originalPageIdx = actualPageNumber - 1;
          
          // pdf2json uses normalized coordinates (0-1 range multiplied by 1000)
          // Convert to points (1/72 inch)
          const pageWidth = page.Width || 612; // Default letter width
          const pageHeight = page.Height || 792; // Default letter height

          // Bu sayfa için font table'ı al
          const pageFontTable = fontTableByPage[originalPageIdx] || {};

          page.Texts?.forEach((textItem) => {
            // pdf2json splits text into runs with different fonts
            const decodedText = decodeURIComponent(textItem.R?.[0]?.T || '').trim();
            
            if (!decodedText) return; // Skip empty text

            const x = textItem.x * pageWidth / 1000; // Convert to points
            const y = textItem.y * pageHeight / 1000;
            const width = textItem.w * pageWidth / 1000;
            
            // Font index'ini font ismine çevir (sayfa-specific table kullan)
            const fontIndex = textItem.R?.[0]?.TS?.[0];
            const fontName = pageFontTable[fontIndex] || globalFontTable[`${originalPageIdx}_${fontIndex}`] || `Font${fontIndex}`;
            
            // Debug: İlk birkaç elementi logla
            if (elements.length < 3) {
              console.log(`📝 Element ${elements.length} (page ${actualPageNumber}):`);
              console.log(`   fontIndex=${fontIndex}, fontName="${fontName}"`);
              console.log(`   text="${decodedText.substring(0, 30)}..."`);
            }
            
            elements.push({
              text: decodedText,
              page: actualPageNumber,
              bbox: {
                x0: x,
                y0: y,
                x1: x + width,
                y1: y + (textItem.R?.[0]?.TS?.[1] || 12) // Font size as height
              },
              fontName: fontName, // Actual font name from font table
              fontSize: textItem.R?.[0]?.TS?.[1] || 12, // Font size
              bold: textItem.R?.[0]?.TS?.[2] === 1, // Bold flag
              italic: textItem.R?.[0]?.TS?.[3] === 1 // Italic flag
            });
          });
        });

        console.log(`✅ Extracted ${elements.length} text elements with coordinates`);

        resolve({
          success: true,
          elements,
          metadata,
          format: 'pdf2json',
          totalPages
        });
      } catch (error) {
        console.error('❌ Error processing pdf2json data:', error);
        resolve({
          success: false,
          error: error.message,
          fallbackToStandard: true
        });
      }
    });

    // Start parsing
    console.log('🔄 Starting pdf2json coordinate extraction:', filePath);
    pdfParser.loadPDF(filePath);
  });
});

// Convert PDF pages to images for OCR (with optional page selection)
ipcMain.handle('pdf:toImages', async (event, filePath, selectedPages = null) => {
  let tempPdfPath = null;
  
  try {
    const tmpDir = path.join(app.getPath('temp'), 'mgx-ocr-' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

    // Copy PDF to temp directory with ASCII-safe name to avoid Unicode issues
    const originalFileName = path.basename(filePath);
    const safePdfName = 'temp_pdf_' + Date.now() + '.pdf';
    tempPdfPath = path.join(tmpDir, safePdfName);
    
    await fs.copyFile(filePath, tempPdfPath);
    console.log('PDF copied to temp location for OCR:', tempPdfPath);

    // Convert PDF to PNG images using the safe temp path
    const options = {
      format: 'png',
      out_dir: tmpDir,
      out_prefix: 'page',
      page: null // All pages (will filter after conversion)
    };

    // If specific pages are selected, convert only those pages
    // Note: poppler page numbering is 1-based
    if (selectedPages && Array.isArray(selectedPages) && selectedPages.length > 0) {
      console.log(`PDF to images: Converting selected pages ${selectedPages.join(', ')}`);
      // Unfortunately, pdf-poppler doesn't support multiple page ranges easily
      // We'll convert all pages and filter afterwards
      // For better performance, consider using pdf-lib or similar in future
    }

    await poppler.convert(tempPdfPath, options);

    // Read all generated images
    const files = await fs.readdir(tmpDir);
    const imageFiles = files.filter(f => f.endsWith('.png')).sort();

    const images = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const pageNumber = i + 1; // 1-based page numbering
      
      // Filter by selected pages if specified
      if (selectedPages && Array.isArray(selectedPages) && selectedPages.length > 0) {
        if (!selectedPages.includes(pageNumber)) {
          continue; // Skip this page
        }
      }
      
      const imagePath = path.join(tmpDir, file);
      const imageBuffer = await fs.readFile(imagePath);
      images.push({
        data: imageBuffer.toString('base64'),
        path: imagePath,
        pageNumber: pageNumber // Include page number in result
      });
    }

    console.log(`PDF to images: Returning ${images.length} page(s) for OCR`);

    return {
      success: true,
      pages: images,
      tmpDir // Return temp dir for cleanup
    };
  } catch (error) {
    console.error('PDF to images conversion error:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Clean up temporary PDF copy
    if (tempPdfPath) {
      try {
        await fs.unlink(tempPdfPath);
      } catch (e) {
        console.error('Failed to delete temp PDF:', e);
      }
    }
  }
});

// Cleanup OCR temp directory
ipcMain.handle('ocr:cleanup', async (event, tmpDir) => {
  try {
    if (tmpDir && tmpDir.includes('mgx-ocr-')) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
    return { success: true };
  } catch (error) {
    console.error('OCR cleanup error:', error);
    return { success: false, error: error.message };
  }
});

// Read file for drag and drop
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    return {
      success: true,
      buffer: dataBuffer,
    };
  } catch (error) {
    console.error('File read error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Save data to file
ipcMain.handle('file:save', async (event, { filePath, data }) => {
  try {
    await fs.writeFile(filePath, data, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('File save error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Save dialog
ipcMain.handle('dialog:saveFile', async (event, { defaultPath, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });

  if (result.canceled) {
    return null;
  }

  return result.filePath;
});

// Get app path
ipcMain.handle('app:getPath', async (event, name) => {
  return app.getPath(name);
});

// Fullscreen controls
ipcMain.handle('window:toggleFullscreen', async () => {
  if (!mainWindow) return false;
  const isFullScreen = mainWindow.isFullScreen();
  const newFullscreenState = !isFullScreen;
  
  mainWindow.setFullScreen(newFullscreenState);
  
  // Hide/show menu bar based on fullscreen state
  mainWindow.setMenuBarVisibility(!newFullscreenState);
  
  return newFullscreenState;
});

ipcMain.handle('window:isFullscreen', async () => {
  if (!mainWindow) return false;
  return mainWindow.isFullScreen();
});

ipcMain.handle('window:exitFullscreen', async () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(false);
  
  // Show menu bar when exiting fullscreen
  mainWindow.setMenuBarVisibility(true);
});

// Window controls
ipcMain.handle('window:minimize', async () => {
  if (!mainWindow) return;
  mainWindow.minimize();
});

ipcMain.handle('window:maximize', async () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});

ipcMain.handle('window:close', async () => {
  if (!mainWindow) return;
  mainWindow.close();
});

// App controls
ipcMain.handle('app:quit', async () => {
  app.quit();
});

// Save file content
ipcMain.handle('file:saveContent', async (event, { filePath, data, encoding = 'utf-8' }) => {
  try {
    if (encoding === 'base64') {
      // For base64 encoded files (like PDFs)
      const buffer = Buffer.from(data, 'base64');
      await fs.writeFile(filePath, buffer);
    } else {
      // For text files
      await fs.writeFile(filePath, data, encoding);
    }
    return { success: true };
  } catch (error) {
    console.error('File save content error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Generate structured document
ipcMain.handle('document:generate', async (event, { content, format, filePath }) => {
  try {
    if (format === 'pdf') {
      return await generatePDFDocument(content, filePath);
    } else if (format === 'docx') {
      return await generateWordDocument(content, filePath);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    console.error('Document generation error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

async function generatePDFDocument(content, filePath) {
  // For now, generate a simplified HTML-based PDF using Electron's print functionality
  try {
    // Create temporary HTML content
    const htmlContent = generateHTMLFromAnalysis(content);
    
    // Create a hidden window for PDF generation
    const pdfWindow = new (require('electron').BrowserWindow)({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    // Generate PDF
    const pdfData = await pdfWindow.webContents.printToPDF({
      format: 'A4',
      printBackground: true,
      margin: {
        top: 1,
        bottom: 1,
        left: 1,
        right: 1
      }
    });

    // Save PDF
    await fs.writeFile(filePath, pdfData);
    
    // Clean up
    pdfWindow.close();
    
    return { success: true };
  } catch (error) {
    console.error('PDF generation error:', error);
    return { success: false, error: error.message };
  }
}

async function generateWordDocument(content, filePath) {
  // For now, generate a formatted text document
  // In a production environment, you'd use a library like officegen or docx
  try {
    const textContent = generateTextFromAnalysis(content);
    await fs.writeFile(filePath.replace('.docx', '.txt'), textContent, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Word document generation error:', error);
    return { success: false, error: error.message };
  }
}

function generateHTMLFromAnalysis(content) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>${content.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; border-bottom: 2px solid #FFB800; padding-bottom: 10px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; page-break-inside: avoid; }
        .section-title { font-size: 18px; font-weight: bold; color: #FFB800; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px; }
        .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0; }
        .metric-card { background: #f5f5f5; padding: 15px; text-align: center; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #FFB800; }
        .metric-label { font-size: 12px; color: #666; margin-top: 5px; }
        .item-list { margin: 10px 0; }
        .item { background: #f9f9f9; padding: 10px; margin: 5px 0; border-left: 3px solid #FFB800; }
        .item-title { font-weight: bold; margin-bottom: 5px; }
        .item-details { font-size: 14px; color: #666; }
        .timestamp { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${content.title}</h1>
        <p>Generated on ${content.timestamp}</p>
    </div>
    
    ${content.sections.map(section => `
        <div class="section">
            <h2 class="section-title">${section.title}</h2>
            ${generateSectionHTML(section.content)}
        </div>
    `).join('')}
    
    <div class="timestamp">
        Report generated by MGX Reader - Screenplay Analysis Tool
    </div>
</body>
</html>
  `;
}

function generateSectionHTML(sectionContent) {
  switch (sectionContent.type) {
    case 'overview':
      return `
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-value">${sectionContent.metrics.scenes}</div>
            <div class="metric-label">Scenes</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${sectionContent.metrics.characters}</div>
            <div class="metric-label">Characters</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${sectionContent.metrics.locations}</div>
            <div class="metric-label">Locations</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${sectionContent.metrics.shootDays}</div>
            <div class="metric-label">Shoot Days</div>
          </div>
        </div>
      `;
    case 'scenes':
      return `
        <div class="item-list">
          ${sectionContent.data.map(scene => `
            <div class="item">
              <div class="item-title">Scene ${scene.number}: ${scene.header}</div>
              <div class="item-details">
                <p>${scene.description}</p>
                <p><strong>${scene.intExt}</strong> - <strong>${scene.timeOfDay}</strong> - Duration: ${scene.duration} min</p>
                <p>Characters: ${scene.characters.join(', ')}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    case 'characters':
      return `
        <div class="item-list">
          ${sectionContent.data.map(char => `
            <div class="item">
              <div class="item-title">${char.name} (${char.importance})</div>
              <div class="item-details">
                <p>${char.description}</p>
                <p>Appears in ${char.sceneCount} scenes</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    default:
      return '<p>Content not available for this section.</p>';
  }
}

function generateTextFromAnalysis(content) {
  let text = `${content.title}\n`;
  text += `Generated on ${content.timestamp}\n`;
  text += '='.repeat(50) + '\n\n';
  
  content.sections.forEach(section => {
    text += `${section.title}\n`;
    text += '-'.repeat(section.title.length) + '\n';
    text += generateSectionText(section.content);
    text += '\n\n';
  });
  
  return text;
}

function generateSectionText(sectionContent) {
  switch (sectionContent.type) {
    case 'overview':
      return `
Scenes: ${sectionContent.metrics.scenes}
Characters: ${sectionContent.metrics.characters}
Locations: ${sectionContent.metrics.locations}
Estimated Shoot Days: ${sectionContent.metrics.shootDays}
      `;
    case 'scenes':
      return sectionContent.data.map(scene => 
        `Scene ${scene.number}: ${scene.header}\n${scene.description}\n${scene.intExt} - ${scene.timeOfDay} - ${scene.duration} min\nCharacters: ${scene.characters.join(', ')}\n`
      ).join('\n');
    case 'characters':
      return sectionContent.data.map(char => 
        `${char.name} (${char.importance})\n${char.description}\nAppears in ${char.sceneCount} scenes\n`
      ).join('\n');
    default:
      return 'Content not available for this section.';
  }
}

// Additional File System API handlers
ipcMain.handle('file:readContent', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return data;
  } catch (error) {
    console.error('Error reading file content:', error);
    throw error;
  }
});

ipcMain.handle('file:exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('file:directoryExists', async (event, dirPath) => {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
});

ipcMain.handle('file:ensureDir', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
});

ipcMain.handle('file:listDirectory', async (event, dirPath) => {
  try {
    const files = await fs.readdir(dirPath);
    return files;
  } catch (error) {
    console.error('Error listing directory:', error);
    throw error;
  }
});

ipcMain.handle('file:delete', async (event, filePath) => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
});

ipcMain.handle('file:getTempDir', async () => {
  try {
    const os = require('os');
    return os.tmpdir();
  } catch (error) {
    console.error('Error getting temp directory:', error);
    throw error;
  }
});

ipcMain.handle('file:getStats', async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      ctime: stats.ctime.toISOString(),
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };
  } catch (error) {
    console.error('Error getting file stats:', error);
    throw error;
  }
});
