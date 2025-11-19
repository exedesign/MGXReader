const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const poppler = require('pdf-poppler');

let mainWindow;

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
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true, // Always show frame for better UX
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    show: true, // Show immediately for debugging
    alwaysOnTop: false,
    // icon: process.platform === 'win32' ? path.join(__dirname, '../../assets/icon.ico') : undefined,
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
    // Directly try to connect to common development ports
    const tryPorts = [3000, 3001, 3002, 5173, 3003, 3004, 3005];
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
    
    mainWindow.webContents.openDevTools();
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

// Parse PDF file
ipcMain.handle('pdf:parse', async (event, filePath) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    return {
      success: true,
      text: data.text,
      pages: data.numpages,
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

// Convert PDF pages to images for OCR
ipcMain.handle('pdf:toImages', async (event, filePath) => {
  try {
    const tmpDir = path.join(app.getPath('temp'), 'mgx-ocr-' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

    // Convert PDF to PNG images
    const options = {
      format: 'png',
      out_dir: tmpDir,
      out_prefix: 'page',
      page: null // All pages
    };

    await poppler.convert(filePath, options);

    // Read all generated images
    const files = await fs.readdir(tmpDir);
    const imageFiles = files.filter(f => f.endsWith('.png')).sort();

    const images = [];
    for (const file of imageFiles) {
      const imagePath = path.join(tmpDir, file);
      const imageBuffer = await fs.readFile(imagePath);
      images.push({
        data: imageBuffer.toString('base64'),
        path: imagePath
      });
    }

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
ipcMain.handle('file:saveContent', async (event, { filePath, data }) => {
  try {
    await fs.writeFile(filePath, data, 'utf-8');
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
