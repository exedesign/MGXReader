import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../store/aiStore';
import { useScriptStore } from '../store/scriptStore';

// Custom cursor for move tool
const MOVE_CURSOR_SVG = `data:image/svg+xml;base64,${btoa(`
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <g filter="url(#shadow)">
      <path d="M12 2L12 22M12 2L8 6M12 2L16 6M12 22L8 18M12 22L16 18" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M2 12L22 12M2 12L6 8M2 12L6 16M22 12L18 8M22 12L18 16" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 2L12 22M12 2L8 6M12 2L16 6M12 22L8 18M12 22L16 18" stroke="black" stroke-width="1" stroke-linecap="round"/>
      <path d="M2 12L22 12M2 12L6 8M2 12L6 16M22 12L18 8M22 12L18 16" stroke="black" stroke-width="1" stroke-linecap="round"/>
    </g>
    <defs>
      <filter id="shadow" x="-2" y="-2" width="28" height="28">
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.5"/>
      </filter>
    </defs>
  </svg>
`)}`;

const MOVING_CURSOR_SVG = `data:image/svg+xml;base64,${btoa(`
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <g filter="url(#shadow)">
      <circle cx="12" cy="12" r="8" fill="rgba(59, 130, 246, 0.3)" stroke="white" stroke-width="2"/>
      <path d="M12 6L12 18M12 6L9 9M12 6L15 9M12 18L9 15M12 18L15 15" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M6 12L18 12M6 12L9 9M6 12L9 15M18 12L15 9M18 12L15 15" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 6L12 18M12 6L9 9M12 6L15 9M12 18L9 15M12 18L15 15" stroke="black" stroke-width="1" stroke-linecap="round"/>
      <path d="M6 12L18 12M6 12L9 9M6 12L9 15M18 12L15 9M18 12L15 15" stroke="black" stroke-width="1" stroke-linecap="round"/>
    </g>
    <defs>
      <filter id="shadow" x="-2" y="-2" width="28" height="28">
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.5"/>
      </filter>
    </defs>
  </svg>
`)}`;

// Canvas Modes
const CANVAS_MODES = {
  SKETCH_TO_IMAGE: 'sketch_to_image',
  INPAINTING: 'inpainting',
  OUTPAINTING: 'outpainting',
  STYLE_TRANSFER: 'style_transfer',
  DESCRIBE: 'describe'
};

// Style presets
const STYLE_PRESETS = [
  { id: 'photorealistic', name: 'Fotoğrafçı', icon: '📷' },
  { id: 'anime', name: 'Anime', icon: '🎭' },
  { id: 'oil_painting', name: 'Yağlı Boya', icon: '🎨' },
  { id: 'watercolor', name: 'Sulu Boya', icon: '💧' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: '🌃' },
  { id: 'fantasy', name: 'Fantastik', icon: '🧙' },
  { id: 'comic', name: 'Çizgi Roman', icon: '💥' },
  { id: 'sketch', name: 'Eskiz', icon: '✏️' }
];

export default function Canvas() {
  const { t } = useTranslation();
  const { generateImage, analyzeImage, isGeneratingImage, provider } = useAIStore();
  const { getCurrentScript } = useScriptStore();

  // Canvas refs
  const canvasRef = useRef(null);
  const maskCanvasRef = useRef(null);

  // State
  const [currentMode, setCurrentMode] = useState(CANVAS_MODES.SKETCH_TO_IMAGE);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(10);
  const [brushColor, setBrushColor] = useState('#000000');
  const [imageStrength, setImageStrength] = useState(0.5);
  const [selectedStyle, setSelectedStyle] = useState('photorealistic');
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [error, setError] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [referenceImages, setReferenceImages] = useState([]);

  // Canvas tools
  const [tool, setTool] = useState('brush'); // brush, eraser, mask, select_rect, select_circle, move
  const [canvasSize, setCanvasSize] = useState({ width: 512, height: 512 });

  // Image position state (for move tool)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isMovingImage, setIsMovingImage] = useState(false);
  const [moveStart, setMoveStart] = useState({ x: 0, y: 0 });
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Selection state
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Undo/Redo history
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Layer system
  const [layers, setLayers] = useState([]);
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [nextLayerId, setNextLayerId] = useState(1);

  // Component lifecycle
  useEffect(() => {
    return () => {
      // Cleanup on unmount
    };
  }, []);

  // Initialize canvas with white background
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const initTimer = setTimeout(() => {
      const canvas = canvasRef.current;

      if (canvas) {
        const context = canvas.getContext('2d');

        if (context) {
          // Save current canvas content before resize
          const tempCanvas = document.createElement('canvas');
          const tempContext = tempCanvas.getContext('2d');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          tempContext.drawImage(canvas, 0, 0);

          // Set white background on main canvas
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, canvas.width, canvas.height);

          // Restore previous content if it exists
          if (uploadedImage) {
            const img = new Image();
            img.onload = () => {
              context.drawImage(img, 0, 0);
            };
            img.src = uploadedImage;
          } else if (tempCanvas.width > 0 && tempCanvas.height > 0) {
            // If there was content, restore it (scaled if necessary)
            context.drawImage(tempCanvas, 0, 0);
          }

          setCanvasReady(true);
          console.log('✅ Tuval hazır:', canvas.width + 'x' + canvas.height);
        } else {
          setCanvasReady(false);
        }
      } else {
        setCanvasReady(false);
      }
      
      // Initialize mask canvas if it exists (for INPAINTING mode)
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas) {
        const maskContext = maskCanvas.getContext('2d');
        if (maskContext) {
          maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        }
      }
    }, 0);

    return () => clearTimeout(initTimer);
  }, [canvasSize]);

  // Initialize layers with a default background layer
  useEffect(() => {
    if (canvasReady && layers.length === 0) {
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const imageData = canvas.toDataURL();
          const backgroundLayer = {
            id: 1,
            name: 'Arka Plan',
            visible: true,
            data: imageData,
            order: 0
          };
          setLayers([backgroundLayer]);
          setActiveLayerId(1);
          setNextLayerId(2);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [canvasReady]);

  // Initialize history with blank canvas
  useEffect(() => {
    if (canvasReady) {
      // Save initial blank canvas state
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas && history.length === 0) {
          const imageData = canvas.toDataURL();
          setHistory([imageData]);
          setHistoryStep(0);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [canvasReady]);

  // Keyboard shortcuts for undo/redo and Ctrl key tracking
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Track Ctrl key for move tool
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true);
      }

      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
      }
    };

    const handleKeyUp = (e) => {
      // Track Ctrl key release
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [historyStep, history]);

  // Load active layer to canvas when it changes
  useEffect(() => {
    if (!activeLayerId || layers.length === 0) return;
    
    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (!activeLayer || !activeLayer.data) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Load active layer data to canvas
    const img = new Image();
    img.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0);
    };
    img.src = activeLayer.data;
  }, [activeLayerId]);

  // Mouse wheel zoom (without Ctrl)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.1, Math.min(5, prev + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Pan with middle mouse button or space + drag
  const handlePanStart = (e) => {
    if (e.button === 1 || (e.button === 0 && e.spaceKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handlePanMove = (e) => {
    if (isPanning) {
      e.preventDefault();
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  // Reset zoom and pan
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Drawing functions
  const startDrawing = (event) => {
    event.preventDefault();
    
    // Ignore middle mouse button (for pan)
    if (event.button === 1) return;

    const canvas = currentMode === CANVAS_MODES.INPAINTING && (tool === 'mask' || tool === 'select_rect' || tool === 'select_circle')
      ? maskCanvasRef.current
      : canvasRef.current;

    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // Handle move tool with Ctrl key or when move tool is active
    if ((event.ctrlKey || event.metaKey || tool === 'move') && uploadedImage) {
      setIsMovingImage(true);
      setMoveStart({ x: x - imagePosition.x, y: y - imagePosition.y });
      return;
    }

    // Handle selection tools
    if (tool === 'select_rect' || tool === 'select_circle') {
      setIsSelecting(true);
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });
      return;
    }

    // Get context directly from canvas (lazy)
    const context = canvas.getContext('2d');
    if (!context) return;

    // Drawing started
    setIsDrawing(true);
    
    // Set drawing properties
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    // Set drawing style
    if (tool === 'eraser') {
      context.globalCompositeOperation = 'destination-out';
      context.lineWidth = brushSize * 2;
      context.strokeStyle = 'rgba(0,0,0,1)';
    } else if (tool === 'mask') {
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      context.fillStyle = 'rgba(255, 0, 0, 0.5)';
      context.lineWidth = brushSize;
    } else {
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = brushColor;
      context.lineWidth = brushSize;
    }

    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y);
    context.stroke();
  };

  const draw = (event) => {
    event.preventDefault();

    const canvas = currentMode === CANVAS_MODES.INPAINTING && (tool === 'mask' || tool === 'select_rect' || tool === 'select_circle')
      ? maskCanvasRef.current
      : canvasRef.current;

    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // Handle move tool (Ctrl key or move tool active)
    if (isMovingImage) {
      const newX = x - moveStart.x;
      const newY = y - moveStart.y;
      setImagePosition({ x: newX, y: newY });
      redrawCanvasWithImage(newX, newY);
      return;
    }

    // Handle selection tools
    if (isSelecting && (tool === 'select_rect' || tool === 'select_circle')) {
      setSelectionEnd({ x, y });
      return;
    }

    if (!isDrawing) return;

    // Get context directly from canvas (lazy)
    const context = canvas.getContext('2d');
    if (!context) return;

    context.lineTo(x, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x, y);
  };

  const stopDrawing = (event) => {
    if (event) event.preventDefault();
    
    // Handle move tool (Ctrl key or move tool active)
    if (isMovingImage) {
      setIsMovingImage(false);
      updateActiveLayerData();
      saveLayersToHistory();
      return;
    }

    // Handle selection tools
    if (isSelecting && (tool === 'select_rect' || tool === 'select_circle')) {
      applySelection();
      setIsSelecting(false);
      return;
    }
    
    if (isDrawing) {
      updateActiveLayerData();
      saveLayersToHistory();
    }
    setIsDrawing(false);
  };

  // Redraw canvas with image at new position
  const redrawCanvasWithImage = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas || !uploadedImage) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Clear and redraw white background
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image at new position
    const img = new Image();
    img.onload = () => {
      context.drawImage(img, x, y);
    };
    img.src = uploadedImage;
  };

  // Apply selection to mask
  const applySelection = () => {
    if (!selectionStart || !selectionEnd) return;
    
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const context = maskCanvas.getContext('2d');
    if (!context) return;

    // Clear previous selection
    context.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

    context.fillStyle = 'rgba(255, 0, 0, 0.5)';
    context.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    context.lineWidth = 2;

    const x = Math.min(selectionStart.x, selectionEnd.x);
    const y = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    if (tool === 'select_rect') {
      // Rectangle selection
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
    } else if (tool === 'select_circle') {
      // Circle selection
      const centerX = (selectionStart.x + selectionEnd.x) / 2;
      const centerY = (selectionStart.y + selectionEnd.y) / 2;
      const radiusX = Math.abs(selectionEnd.x - selectionStart.x) / 2;
      const radiusY = Math.abs(selectionEnd.y - selectionStart.y) / 2;
      
      context.beginPath();
      context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    }

    // Clear selection
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // Save canvas state to history
  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(imageData);
    
    // Limit history to 20 steps
    if (newHistory.length > 20) {
      newHistory.shift();
    } else {
      setHistoryStep(historyStep + 1);
    }
    
    setHistory(newHistory);
  };

  // Undo
  const undo = () => {
    if (historyStep <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    const previousState = history[historyStep - 1];
    
    const img = new Image();
    img.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0);
    };
    img.src = previousState;
    
    setHistoryStep(historyStep - 1);
  };

  // Redo
  const redo = () => {
    if (historyStep >= history.length - 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    const nextState = history[historyStep + 1];
    
    const img = new Image();
    img.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0);
    };
    img.src = nextState;
    
    setHistoryStep(historyStep + 1);
  };

  // Layer Management Functions
  
  // Add new layer
  const addLayer = () => {
    const newLayer = {
      id: nextLayerId,
      name: `Layer ${nextLayerId}`,
      visible: true,
      data: createBlankLayerData(),
      order: layers.length
    };
    
    setLayers([...layers, newLayer]);
    setActiveLayerId(newLayer.id);
    setNextLayerId(nextLayerId + 1);
    saveLayersToHistory();
  };

  // Create blank layer data
  const createBlankLayerData = () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasSize.width;
    tempCanvas.height = canvasSize.height;
    const ctx = tempCanvas.getContext('2d');
    ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    return tempCanvas.toDataURL();
  };

  // Delete layer
  const deleteLayer = (layerId) => {
    if (layers.length <= 1) {
      alert('En az bir layer olmalıdır!');
      return;
    }
    
    const newLayers = layers.filter(l => l.id !== layerId);
    setLayers(newLayers);
    
    // If active layer was deleted, select another one
    if (activeLayerId === layerId) {
      setActiveLayerId(newLayers[0]?.id || null);
    }
    
    saveLayersToHistory();
    redrawAllLayers();
  };

  // Toggle layer visibility
  const toggleLayerVisibility = (layerId) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );
    setLayers(newLayers);
    redrawAllLayers();
  };

  // Reorder layers (drag and drop)
  const reorderLayers = (fromIndex, toIndex) => {
    const newLayers = [...layers];
    const [movedLayer] = newLayers.splice(fromIndex, 1);
    newLayers.splice(toIndex, 0, movedLayer);
    
    // Update order property
    newLayers.forEach((layer, index) => {
      layer.order = index;
    });
    
    setLayers(newLayers);
    saveLayersToHistory();
    redrawAllLayers();
  };

  // Set active layer
  const setActiveLayer = (layerId) => {
    if (layerId === activeLayerId) return;
    
    // Save current active layer before switching
    if (activeLayerId) {
      updateActiveLayerData();
    }
    
    // Switch to new layer
    setActiveLayerId(layerId);
  };

  // Update active layer data (without triggering re-render of activeLayerId)
  const updateActiveLayerData = () => {
    if (!activeLayerId) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const imageData = canvas.toDataURL();
    setLayers(prevLayers => 
      prevLayers.map(l => 
        l.id === activeLayerId ? { ...l, data: imageData } : l
      )
    );
  };

  // Redraw all visible layers
  const redrawAllLayers = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Clear canvas
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Sort layers by order
    const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
    
    // Draw each visible layer
    sortedLayers.forEach(layer => {
      if (layer.visible && layer.data) {
        const img = new Image();
        img.onload = () => {
          context.drawImage(img, 0, 0);
        };
        img.src = layer.data;
      }
    });
  };

  // Save layers to history
  const saveLayersToHistory = () => {
    // Update active layer first
    updateActiveLayerData();
    
    // Then save to history
    setTimeout(() => {
      saveToHistory();
    }, 50);
  };

  // Clear canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update active layer and save to history
    updateActiveLayerData();
    saveLayersToHistory();
  };

  // Clear mask
  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const maskContext = maskCanvas.getContext('2d');
    if (!maskContext) return;
    
    maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  };

  // Upload image
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.log('ℹ️ No file selected');
      return;
    }

    console.log('📁 File selected:', file.name, file.type, file.size);

    if (!file.type.startsWith('image/')) {
      setError('Lütfen geçerli bir görsel dosyası seçin (PNG, JPG, vb.)');
      console.error('❌ Invalid file type:', file.type);
      return;
    }

    setError(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Retry mechanism to wait for canvas to be ready
        let retryCount = 0;
        const maxRetries = 10;
        
        const tryDrawImage = () => {
          retryCount++;
          const canvas = canvasRef.current;
          
          if (!canvas) {
            if (retryCount < maxRetries) {
              setTimeout(tryDrawImage, 50);
              return;
            } else {
              console.error('❌ Canvas hazır değil');
              setError('Canvas hazır değil, lütfen Tuval sekmesinden çıkıp tekrar girin');
              setIsProcessing(false);
              return;
            }
          }

          const context = canvas.getContext('2d');
          
          if (!context) {
            console.error('❌ Canvas context alınamadı');
            setError('Canvas context alınamadı');
            setIsProcessing(false);
            return;
          }
          
          try {
            // Fill with white background first
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw uploaded image to canvas (fit to canvas)
          const scale = Math.min(
            canvas.width / img.width,
            canvas.height / img.height
          );
          const x = (canvas.width - img.width * scale) / 2;
          const y = (canvas.height - img.height * scale) / 2;
          
            context.drawImage(img, x, y, img.width * scale, img.height * scale);
            setUploadedImage(event.target.result);
            setImagePosition({ x, y }); // Save initial position
            setError(null);
            console.log('✅ Görsel canvas\'a yüklendi:', file.name);
          } catch (err) {
            console.error('❌ Görsel yükleme hatası:', err);
            setError('Görsel yüklenirken hata oluştu: ' + err.message);
          } finally {
            setIsProcessing(false);
          }
        };
        
        // Start trying to draw the image
        tryDrawImage();
      };
      img.onerror = () => {
        console.error('❌ Image loading error');
        setError('Görsel yüklenemedi. Lütfen başka bir dosya deneyin.');
        setIsProcessing(false);
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      console.error('❌ FileReader error');
      setError('Dosya okunamadı. Lütfen tekrar deneyin.');
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
    
    // Reset file input for re-uploading same file
    e.target.value = '';
  };

  // Compress image to reduce size
  const compressImage = (dataUrl, maxWidth = 512, quality = 0.8) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down if too large
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with compression
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.src = dataUrl;
    });
  };

  // Handle reference images upload
  const handleReferenceImagesUpload = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;
    
    // Limit to 14 images
    const filesToProcess = files.slice(0, 14 - referenceImages.length);
    
    if (filesToProcess.length === 0) {
      setError('Maksimum 14 referans görsel yükleyebilirsiniz');
      return;
    }

    const newImages = [];
    let processedCount = 0;

    filesToProcess.forEach((file, index) => {
      if (!file.type.startsWith('image/')) {
        processedCount++;
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        // Compress image before storing
        const compressed = await compressImage(event.target.result, 512, 0.7);
        
        newImages.push({
          id: Date.now() + index,
          data: compressed,
          name: file.name
        });
        
        processedCount++;
        
        if (processedCount === filesToProcess.length) {
          setReferenceImages(prev => [...prev, ...newImages].slice(0, 14));
        }
      };
      reader.onerror = () => {
        processedCount++;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  // Remove reference image
  const removeReferenceImage = (id) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
  };

  // Clear all reference images
  const clearReferenceImages = () => {
    setReferenceImages([]);
  };

  // Get canvas as base64
  const getCanvasImage = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.toDataURL('image/png') : null;
  };

  // Get mask as base64
  const getMaskImage = () => {
    const maskCanvas = maskCanvasRef.current;
    return maskCanvas ? maskCanvas.toDataURL('image/png') : null;
  };

  // Analyze image with Gemini Vision (opens file picker)
  const handleAnalyze = () => {
    // Create a hidden file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      console.log('📁 File selected for analysis:', file.name);

      setIsAnalyzing(true);
      setError(null);
      setAnalysisResult('');

      try {
        console.log('🔍 Starting image analysis...');
        
        // Read file as base64
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const imageData = event.target.result;
            
            // Prompt for generating image generation prompt
            const analysisPrompt = "Bu görseli detaylı bir şekilde analiz et ve bu görseli yeniden oluşturmak için kullanılabilecek ayrıntılı bir görsel üretim promptu oluştur. Görseldeki tüm önemli detayları, renkleri, ışıklandırmayı, kompozisyonu, stilleri ve atmosferi dahil et. Prompt, AI görsel üretim modeli tarafından benzer bir görsel oluşturmak için kullanılacak.";
            
            // Call Gemini Vision API
            const result = await analyzeImage(imageData, analysisPrompt);
            
            if (result && result.analysis) {
              // Set the generated prompt to the prompt field
              const generatedPrompt = result.analysis;
              console.log('✅ Analysis completed, setting prompt:', generatedPrompt.substring(0, 100) + '...');
              setPrompt(generatedPrompt);
              setAnalysisResult(''); // Clear analysis result - prompt is now in textarea
              console.log('✅ Prompt set to textarea');
            } else {
              throw new Error('Analiz sonucu alınamadı');
            }
          } catch (error) {
            console.error('❌ Analysis error:', error);
            setError(error.message || 'Görsel analizi başarısız oldu');
          } finally {
            setIsAnalyzing(false);
          }
        };
        
        reader.onerror = () => {
          setError('Görsel okunamadı');
          setIsAnalyzing(false);
        };
        
        reader.readAsDataURL(file);
        
      } catch (error) {
        console.error('❌ File reading error:', error);
        setError(error.message || 'Görsel yüklenemedi');
        setIsAnalyzing(false);
      }
    };
    
    // Trigger file picker
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  };

  // Generate image based on mode
  const handleGenerate = async () => {
    if (!prompt.trim() && currentMode !== CANVAS_MODES.DESCRIBE) {
      setError('Lütfen bir açıklama girin');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const initImage = getCanvasImage();
      let systemPrompt = '';
      let imageOptions = {};

      // Helper to extract base64 from data URL
      const extractBase64 = (dataUrl) => {
        if (!dataUrl) return null;
        const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
        return match ? match[1] : dataUrl;
      };

      switch (currentMode) {
        case CANVAS_MODES.SKETCH_TO_IMAGE:
          systemPrompt = `Bu referans görseldeki (eskiz) kompozisyonu ve ana hatları koru. Ancak görselliği "${prompt}" tanımına uygun olarak yüksek kaliteye getir. 4K, detailed, professional quality.`;
          
          // Build reference images array
          const refs = [{
            data: extractBase64(initImage),
            mimeType: 'image/png',
            instruction: 'Use this sketch as composition reference'
          }];
          
          // Add user uploaded reference images
          referenceImages.forEach((refImg, index) => {
            refs.push({
              data: extractBase64(refImg.data),
              mimeType: 'image/png',
              instruction: `Style and composition reference ${index + 1}`
            });
          });
          
          imageOptions = {
            referenceImages: refs,
            imageStrength: imageStrength,
            style: 'professional',
            aspectRatio: '1:1',
            imageSize: '1K', // Reduced to 1K for faster generation
            thinkingLevel: 'medium' // Medium for faster processing
          };
          break;

        case CANVAS_MODES.INPAINTING:
          const maskImage = getMaskImage();
          systemPrompt = `Görselin maskelenmiş (seçili) alanını, orijinal görselin ışık, gölge ve perspektifine uygun olacak şekilde "${prompt}" ile doldur. Maskelenmemiş alanları aynen koru.`;
          imageOptions = {
            referenceImages: [{
              data: initImage,
              mimeType: 'image/png',
              instruction: 'Base image'
            }],
            maskImage: maskImage,
            mode: 'inpainting'
          };
          break;

        case CANVAS_MODES.OUTPAINTING:
          systemPrompt = `Mevcut görselin kenarlarındaki pikselleri analiz et ve görseli dışa doğru, bağlamı bozmadan "${prompt}" içeriğiyle genişlet. Seamless, natural extension.`;
          imageOptions = {
            referenceImages: [{
              data: initImage,
              mimeType: 'image/png',
              instruction: 'Extend this image outward'
            }],
            mode: 'outpainting'
          };
          break;

        case CANVAS_MODES.STYLE_TRANSFER:
          const stylePrompt = STYLE_PRESETS.find(s => s.id === selectedStyle)?.name || 'photorealistic';
          systemPrompt = `Görselin içeriğini (nesneleri ve konumlarını) değiştirmeden, sanatsal stilini ${stylePrompt} tarzına dönüştür. ${prompt || 'High quality, detailed.'}`;
          imageOptions = {
            referenceImages: [{
              data: initImage,
              mimeType: 'image/png',
              instruction: 'Keep content, change style only'
            }],
            style: selectedStyle
          };
          break;

        case CANVAS_MODES.DESCRIBE:
          // This mode is now handled by handleAnalyze function
          console.log('⚠️ DESCRIBE mode should use Görsel Analizi button instead');
          setError('Lütfen "Görsel Analizi" butonunu kullanın');
          setIsProcessing(false);
          return;
      }

      console.log('🎨 Generating image with mode:', currentMode);
      console.log('📋 System prompt:', systemPrompt);
      console.log('🖼️ Image options:', imageOptions);
      
      const result = await generateImage(prompt, {
        ...imageOptions,
        systemPrompt: systemPrompt,
        timeout: 300000 // 5 minutes timeout
      });

      if (result && result.imageData) {
        const imageUrl = `data:${result.mimeType || 'image/png'};base64,${result.imageData}`;
        setGeneratedImage(imageUrl);
        
        // Auto-apply to canvas
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const context = canvas.getContext('2d');
          if (!context) return;
          
          // Clear canvas with white background
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw generated image (fit to canvas)
          const scale = Math.min(
            canvas.width / img.width,
            canvas.height / img.height
          );
          const x = (canvas.width - img.width * scale) / 2;
          const y = (canvas.height - img.height * scale) / 2;
          
          context.drawImage(img, x, y, img.width * scale, img.height * scale);
          setImagePosition({ x, y });
          saveToHistory();
          console.log('✅ Üretilen görsel otomatik olarak tuvale eklendi');
        };
        img.src = imageUrl;
        
        console.log('✅ Image generated successfully');
      }
    } catch (err) {
      console.error('❌ Generation error:', err);
      setError(err.message || 'Görsel oluşturma hatası. Lütfen tekrar deneyin.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply generated image to canvas
  const applyGeneratedImage = () => {
    if (!generatedImage) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const context = canvas.getContext('2d');
      if (!context) return;
      
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      setGeneratedImage(null);
      console.log('✅ Üretilen görsel tuvale uygulandı');
    };
    img.src = generatedImage;
  };

  return (
    <div className="canvas-container h-full flex flex-col bg-cinema-black text-cinema-text">
      {/* Header */}
      <div className="p-4 border-b border-cinema-gray">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              🎨 Tuval
            </h1>
            <p className="text-sm text-cinema-text-dim">AI destekli görsel oluşturma ve düzenleme</p>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCurrentMode(CANVAS_MODES.SKETCH_TO_IMAGE)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              currentMode === CANVAS_MODES.SKETCH_TO_IMAGE
                ? 'bg-cinema-accent text-cinema-black'
                : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70'
            }`}
          >
            ✏️ Eskizden Üretime
          </button>
          <button
            onClick={() => setCurrentMode(CANVAS_MODES.INPAINTING)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              currentMode === CANVAS_MODES.INPAINTING
                ? 'bg-cinema-accent text-cinema-black'
                : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70'
            }`}
          >
            🖌️ Bölgesel Değiştirme
          </button>
          <button
            onClick={() => setCurrentMode(CANVAS_MODES.OUTPAINTING)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              currentMode === CANVAS_MODES.OUTPAINTING
                ? 'bg-cinema-accent text-cinema-black'
                : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70'
            }`}
          >
            📐 Görsel Genişletme
          </button>
          <button
            onClick={() => setCurrentMode(CANVAS_MODES.STYLE_TRANSFER)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              currentMode === CANVAS_MODES.STYLE_TRANSFER
                ? 'bg-cinema-accent text-cinema-black'
                : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70'
            }`}
          >
            🎭 Stil Transferi
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Tools */}
        <div className="w-64 border-r border-cinema-gray p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-cinema-accent mb-3">Araçlar</h3>

          {/* Mode Info */}
          <div className="mb-4 p-3 bg-cinema-accent/10 border border-cinema-accent/30 rounded text-xs text-cinema-text">
            {currentMode === CANVAS_MODES.SKETCH_TO_IMAGE && '✏️ Eskiz çizin, AI yüksek kaliteli görsele dönüştürsün'}
            {currentMode === CANVAS_MODES.INPAINTING && '🖌️ Maske aracıyla değiştirmek istediğiniz alanı işaretleyin'}
            {currentMode === CANVAS_MODES.OUTPAINTING && '📐 Görsel yükleyin, AI kenarları genişletsin'}
            {currentMode === CANVAS_MODES.STYLE_TRANSFER && '🎭 Görsel yükleyin, stil seçin'}
          </div>

          {/* Tools */}
          <div className="space-y-2 mb-4">
            <button
              onClick={() => setTool('brush')}
              className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                tool === 'brush' ? 'bg-cinema-accent text-cinema-black' : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70'
              }`}
              title="Fırça ile çizim yapın"
            >
              🖌️ Fırça
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                tool === 'eraser' ? 'bg-cinema-accent text-cinema-black' : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70'
              }`}
              title="Çizimi silin"
            >
              🧹 Silgi
            </button>
            {uploadedImage && (
              <button
                onClick={() => setTool('move')}
                className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                  tool === 'move' ? 'bg-cinema-accent text-cinema-black' : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70'
                }`}
                title="Yüklenen görseli taşıyın"
              >
                ✋ Taşı
              </button>
            )}
            {currentMode === CANVAS_MODES.INPAINTING && (
              <>
                <button
                  onClick={() => setTool('mask')}
                  className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                    tool === 'mask' ? 'bg-cinema-accent text-cinema-black' : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70'
                  }`}
                  title="Fırça ile maske çizin"
                >
                  🎯 Maske Fırçası
                </button>
                <button
                  onClick={() => setTool('select_rect')}
                  className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                    tool === 'select_rect' ? 'bg-cinema-accent text-cinema-black' : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70'
                  }`}
                  title="Dikdörtgen seçim aracı"
                >
                  ▭ Dikdörtgen Seçim
                </button>
                <button
                  onClick={() => setTool('select_circle')}
                  className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                    tool === 'select_circle' ? 'bg-cinema-accent text-cinema-black' : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70'
                  }`}
                  title="Dairesel seçim aracı"
                >
                  ⬭ Dairesel Seçim
                </button>
              </>
            )}
          </div>

          {/* Current Tool Info */}
          <div className="mb-4 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300">
            <strong>Aktif Araç:</strong> {
              tool === 'brush' ? '🖌️ Fırça' : 
              tool === 'eraser' ? '🧹 Silgi' : 
              tool === 'move' ? '✋ Taşı' :
              tool === 'select_rect' ? '▭ Dikdörtgen Seçim' :
              tool === 'select_circle' ? '⬭ Dairesel Seçim' :
              '🎯 Maske'
            }
          </div>

          {/* Canvas Size Presets */}
          <div className="mb-4">
            <label className="text-xs text-cinema-text-dim mb-2 block">Tuval Boyutu</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setCanvasReady(false);
                  setCanvasSize({ width: 512, height: 512 });
                }}
                className={`px-2 py-1 rounded text-xs ${
                  canvasSize.width === 512 && canvasSize.height === 512
                    ? 'bg-cinema-accent text-cinema-black'
                    : 'bg-cinema-gray text-cinema-text'
                }`}
              >
                512×512
              </button>
              <button
                onClick={() => {
                  setCanvasReady(false);
                  setCanvasSize({ width: 768, height: 768 });
                }}
                className={`px-2 py-1 rounded text-xs ${
                  canvasSize.width === 768 && canvasSize.height === 768
                    ? 'bg-cinema-accent text-cinema-black'
                    : 'bg-cinema-gray text-cinema-text'
                }`}
              >
                768×768
              </button>
              <button
                onClick={() => {
                  setCanvasReady(false);
                  setCanvasSize({ width: 1024, height: 1024 });
                }}
                className={`px-2 py-1 rounded text-xs ${
                  canvasSize.width === 1024 && canvasSize.height === 1024
                    ? 'bg-cinema-accent text-cinema-black'
                    : 'bg-cinema-gray text-cinema-text'
                }`}
              >
                1024×1024
              </button>
              <button
                onClick={() => {
                  setCanvasReady(false);
                  setCanvasSize({ width: 1024, height: 576 });
                }}
                className={`px-2 py-1 rounded text-xs ${
                  canvasSize.width === 1024 && canvasSize.height === 576
                    ? 'bg-cinema-accent text-cinema-black'
                    : 'bg-cinema-gray text-cinema-text'
                }`}
              >
                16:9
              </button>
              <button
                onClick={() => {
                  setCanvasReady(false);
                  setCanvasSize({ width: 2048, height: 2048 });
                }}
                className={`px-2 py-1 rounded text-xs ${
                  canvasSize.width === 2048 && canvasSize.height === 2048
                    ? 'bg-cinema-accent text-cinema-black'
                    : 'bg-cinema-gray text-cinema-text'
                }`}
              >
                2K (2048)
              </button>
              <button
                onClick={() => {
                  setCanvasReady(false);
                  setCanvasSize({ width: 3840, height: 2160 });
                }}
                className={`px-2 py-1 rounded text-xs ${
                  canvasSize.width === 3840 && canvasSize.height === 2160
                    ? 'bg-cinema-accent text-cinema-black'
                    : 'bg-cinema-gray text-cinema-text'
                }`}
              >
                4K (3840×2160)
              </button>
            </div>
          </div>

          {/* Brush Size */}
          <div className="mb-4">
            <label className="text-xs text-cinema-text-dim mb-1 block">Fırça Boyutu</label>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-cinema-text-dim text-center">{brushSize}px</div>
          </div>

          {/* Brush Color */}
          {tool === 'brush' && (
            <div className="mb-4">
              <label className="text-xs text-cinema-text-dim mb-1 block">Renk</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer border border-cinema-gray"
                />
                <div 
                  className="flex-1 h-10 rounded border-2 border-cinema-gray"
                  style={{ backgroundColor: brushColor }}
                />
              </div>
              <div className="text-xs text-cinema-text-dim mt-1 text-center">{brushColor}</div>
            </div>
          )}

          {/* Image Strength (Sketch to Image mode) */}
          {currentMode === CANVAS_MODES.SKETCH_TO_IMAGE && (
            <div className="mb-4">
              <label className="text-xs text-cinema-text-dim mb-1 block">
                Benzerlik: {(imageStrength * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={imageStrength}
                onChange={(e) => setImageStrength(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-cinema-text-dim mt-1">
                {imageStrength < 0.3 ? 'Serbest yorumlama' : imageStrength < 0.7 ? 'Dengeli' : 'Eskize sadık'}
              </div>
            </div>
          )}

          {/* Style Selection (Style Transfer mode) */}
          {currentMode === CANVAS_MODES.STYLE_TRANSFER && (
            <div className="mb-4">
              <label className="text-xs text-cinema-text-dim mb-2 block">Stil Seç</label>
              <div className="grid grid-cols-2 gap-2">
                {STYLE_PRESETS.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`px-2 py-2 rounded text-xs ${
                      selectedStyle === style.id
                        ? 'bg-cinema-accent text-cinema-black'
                        : 'bg-cinema-gray text-cinema-text'
                    }`}
                  >
                    {style.icon} {style.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {/* Zoom Controls */}
            <div className="mb-4 p-3 bg-cinema-accent/10 border border-cinema-accent/30 rounded">
              <label className="text-xs text-cinema-text-dim mb-2 block">
                Zoom: {Math.round(zoom * 100)}%
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setZoom(prev => Math.max(0.1, prev - 0.25))}
                  className="flex-1 px-2 py-1 rounded text-sm bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70"
                  title="Uzaklaş"
                >
                  🔍−
                </button>
                <button
                  onClick={resetView}
                  className="flex-1 px-2 py-1 rounded text-sm bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70"
                  title="Sıfırla"
                >
                  100%
                </button>
                <button
                  onClick={() => setZoom(prev => Math.min(5, prev + 0.25))}
                  className="flex-1 px-2 py-1 rounded text-sm bg-cinema-gray text-cinema-text hover:bg-cinema-gray/70"
                  title="Yakınlaş"
                >
                  🔍+
                </button>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-cinema-text-dim mt-1">
                💡 Mouse tekerleği ile zoom | Ctrl tuşu ile görseli taşı
              </div>
            </div>

            {/* Undo/Redo buttons */}
            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={historyStep <= 0}
                className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                  historyStep <= 0
                    ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                }`}
                title="Geri Al (Ctrl+Z)"
              >
                ↶ Geri
              </button>
              <button
                onClick={redo}
                disabled={historyStep >= history.length - 1}
                className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                  historyStep >= history.length - 1
                    ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                }`}
                title="İleri Al (Ctrl+Y)"
              >
                İleri ↷
              </button>
            </div>

            <button
              onClick={clearCanvas}
              className="w-full px-3 py-2 rounded text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
            >
              🗑️ Tuvali Temizle
            </button>
            {currentMode === CANVAS_MODES.INPAINTING && (
              <button
                onClick={clearMask}
                className="w-full px-3 py-2 rounded text-sm bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
              >
                🎯 Maskeyi Temizle
              </button>
            )}
            <label className={`w-full px-3 py-2 rounded text-sm block text-center transition-colors ${
              canvasReady 
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 cursor-pointer' 
                : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
            }`}>
              {canvasReady ? '📤 Görsel Yükle' : '⏳ Canvas Hazırlanıyor...'}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={!canvasReady}
              />
            </label>
          </div>
        </div>

        {/* Center Panel - Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 flex flex-col items-center justify-center p-4 bg-cinema-dark overflow-auto"
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          style={{ cursor: isPanning ? 'grabbing' : 'default' }}
        >
          <div 
            className="relative inline-block"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: 'center',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="border-2 border-cinema-gray rounded bg-white block"
              style={{ 
                width: `${canvasSize.width}px`, 
                height: `${canvasSize.height}px`,
                imageRendering: 'auto',
                touchAction: 'none',
                cursor: (tool === 'move' || (isCtrlPressed && uploadedImage)) 
                  ? (isMovingImage 
                      ? `url(${MOVING_CURSOR_SVG}) 12 12, grabbing` 
                      : `url(${MOVE_CURSOR_SVG}) 12 12, grab`) 
                  : 'crosshair'
              }}
            />
            {currentMode === CANVAS_MODES.INPAINTING && (tool === 'mask' || tool === 'select_rect' || tool === 'select_circle') && (
              <canvas
                ref={maskCanvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="absolute top-0 left-0 border-2 border-cinema-gray rounded cursor-crosshair"
                style={{ 
                  width: `${canvasSize.width}px`, 
                  height: `${canvasSize.height}px`,
                  opacity: 0.6,
                  pointerEvents: 'auto',
                  touchAction: 'none'
                }}
              />
            )}
            {/* Selection preview overlay */}
            {isSelecting && selectionStart && selectionEnd && (
              <svg
                className="absolute top-0 left-0 pointer-events-none"
                style={{ 
                  width: `${canvasSize.width}px`, 
                  height: `${canvasSize.height}px`
                }}
              >
                {tool === 'select_rect' && (
                  <rect
                    x={Math.min(selectionStart.x, selectionEnd.x)}
                    y={Math.min(selectionStart.y, selectionEnd.y)}
                    width={Math.abs(selectionEnd.x - selectionStart.x)}
                    height={Math.abs(selectionEnd.y - selectionStart.y)}
                    fill="rgba(255, 0, 0, 0.2)"
                    stroke="rgba(255, 0, 0, 0.8)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                )}
                {tool === 'select_circle' && (
                  <ellipse
                    cx={(selectionStart.x + selectionEnd.x) / 2}
                    cy={(selectionStart.y + selectionEnd.y) / 2}
                    rx={Math.abs(selectionEnd.x - selectionStart.x) / 2}
                    ry={Math.abs(selectionEnd.y - selectionStart.y) / 2}
                    fill="rgba(255, 0, 0, 0.2)"
                    stroke="rgba(255, 0, 0, 0.8)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                )}
              </svg>
            )}
          </div>
        </div>

        {/* Right Panel - Prompt & Results */}
        <div className="w-80 border-l border-cinema-gray p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-cinema-accent mb-3">Prompt</h3>
          
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Oluşturmak istediğiniz görseli tanımlayın..."
            className="w-full h-32 px-3 py-2 bg-cinema-gray text-cinema-text rounded resize-none mb-4"
          />

          {/* Reference Images Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-cinema-text-dim">
                Referans Görseller ({referenceImages.length}/14)
              </label>
              {referenceImages.length > 0 && (
                <button
                  onClick={clearReferenceImages}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Tümünü Temizle
                </button>
              )}
            </div>

            <label className="w-full px-3 py-2 rounded text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 cursor-pointer border-2 border-dashed border-blue-500/50 flex items-center justify-center gap-2 mb-3">
              <span>📎</span>
              <span>Referans Yükle</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleReferenceImagesUpload}
                className="hidden"
                disabled={referenceImages.length >= 14}
              />
            </label>

            {referenceImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {referenceImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.data}
                      alt={img.name}
                      className="w-full h-20 object-cover rounded border border-cinema-gray"
                    />
                    <button
                      onClick={() => removeReferenceImage(img.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {referenceImages.length > 0 && (
              <div className="text-xs text-cinema-text-dim p-2 bg-blue-500/10 rounded border border-blue-500/30">
                💡 AI bu referans görselleri kullanarak stil ve kompozisyon oluşturacak
              </div>
            )}
          </div>

          <div className="space-y-2 mb-4">
            <button
              onClick={handleGenerate}
              disabled={isProcessing || isGeneratingImage}
              className="w-full px-4 py-3 rounded bg-cinema-accent text-cinema-black font-medium hover:bg-cinema-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? '🔄 Üretiliyor...' : '✨ Görsel Üret'}
            </button>
            
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isProcessing}
              className="w-full px-4 py-3 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Canvas'taki görseli AI ile analiz et"
            >
              {isAnalyzing ? '🔍 Analiz...' : '🔍 Görsel Analizi'}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {analysisResult && (
            <div className="mb-4">
              <h4 className="text-xs text-cinema-text-dim mb-2">📝 Analiz Sonucu</h4>
              <div className="p-3 bg-cinema-gray/50 rounded border border-cinema-gray text-sm text-cinema-text whitespace-pre-wrap max-h-64 overflow-y-auto">
                {analysisResult}
              </div>
            </div>
          )}

          {generatedImage && (
            <div className="mb-4">
              <h4 className="text-xs text-cinema-text-dim mb-2">Üretilen Görsel</h4>
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full rounded border border-cinema-gray mb-2"
              />
              <button
                onClick={applyGeneratedImage}
                className="w-full px-3 py-2 rounded text-sm bg-green-500/20 text-green-400 hover:bg-green-500/30"
              >
                ✓ Tuvale Uygula
              </button>
            </div>
          )}

          {/* Layers Panel */}
          <div className="mt-6 border-t border-cinema-gray pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-cinema-accent">Layers</h3>
              <button
                onClick={addLayer}
                className="px-2 py-1 rounded text-xs bg-cinema-accent/20 text-cinema-accent hover:bg-cinema-accent/30"
                title="Yeni Layer Ekle"
              >
                + Layer
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...layers].sort((a, b) => b.order - a.order).map((layer, index) => (
                <div
                  key={layer.id}
                  className={`p-2 rounded border transition-colors ${
                    layer.id === activeLayerId
                      ? 'border-cinema-accent bg-cinema-accent/10'
                      : 'border-cinema-gray bg-cinema-gray/30 hover:border-cinema-accent/50'
                  }`}
                  onClick={() => setActiveLayer(layer.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex items-center gap-2">
                    {/* Layer Thumbnail */}
                    <div className="w-12 h-12 rounded overflow-hidden border border-cinema-gray/50 flex-shrink-0">
                      <img
                        src={layer.data || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='}
                        alt={layer.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Layer Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-cinema-text truncate">
                        {layer.name}
                      </div>
                      <div className="text-xs text-cinema-text-dim">
                        Order: {layer.order}
                      </div>
                    </div>

                    {/* Layer Controls */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Visibility Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerVisibility(layer.id);
                        }}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          layer.visible
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-gray-500/20 text-gray-500 hover:bg-gray-500/30'
                        }`}
                        title={layer.visible ? 'Gizle' : 'Göster'}
                      >
                        {layer.visible ? '👁️' : '👁️‍🗨️'}
                      </button>

                      {/* Move Up */}
                      {index > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const fromIndex = layers.findIndex(l => l.id === layer.id);
                            const toIndex = fromIndex - 1;
                            reorderLayers(fromIndex, toIndex);
                          }}
                          className="px-1 py-1 rounded text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                          title="Yukarı Taşı"
                        >
                          ↑
                        </button>
                      )}

                      {/* Move Down */}
                      {index < layers.length - 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const fromIndex = layers.findIndex(l => l.id === layer.id);
                            const toIndex = fromIndex + 1;
                            reorderLayers(fromIndex, toIndex);
                          }}
                          className="px-1 py-1 rounded text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                          title="Aşağı Taşı"
                        >
                          ↓
                        </button>
                      )}

                      {/* Delete Layer */}
                      {layers.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`"${layer.name}" layer'ını silmek istediğinizden emin misiniz?`)) {
                              deleteLayer(layer.id);
                            }
                          }}
                          className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          title="Sil"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 text-xs text-cinema-text-dim p-2 bg-cinema-accent/10 rounded border border-cinema-accent/30">
              💡 Aktif layer: <span className="text-cinema-accent font-semibold">
                {layers.find(l => l.id === activeLayerId)?.name || 'Yok'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
