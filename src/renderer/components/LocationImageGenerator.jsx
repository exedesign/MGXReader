import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../store/aiStore';
import { useScriptStore } from '../store/scriptStore';

export default function LocationImageGenerator({ location, onImageGenerated, characterReferences = [] }) {
    const { t } = useTranslation();
    const { getAIHandler, provider, isGeneratingImage, setGeneratingImage, generateImage } = useAIStore();
    const { getCurrentScript } = useScriptStore();

    const [generatedImage, setGeneratedImage] = useState(null);
    const [referenceImages, setReferenceImages] = useState([]); // Changed to array for multiple images
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [prompt, setPrompt] = useState('Professional location environment');
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [fileInputKey, setFileInputKey] = useState(Date.now()); // Key to force input reset
    const fileInputRef = useRef(null);

    // 💾 Referans görselleri localStorage'dan yükle VE resize et
    useEffect(() => {
        if (location?.name) {
            const storageKey = `location_reference_${location.name}`;
            try {
                const savedReferences = localStorage.getItem(storageKey);
                if (savedReferences) {
                    const parsed = JSON.parse(savedReferences);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        // Check if images need resizing (old format check)
                        const needsResize = parsed.some(img => {
                            const dataLength = img.data?.length || 0;
                            return dataLength > 100000; // If >100KB, needs resize
                        });
                        
                        if (needsResize) {
                            console.log(`🔄 Eski format mekan görselleri algılandı, resize ediliyor...`);
                            // Resize old images
                            Promise.all(parsed.map(oldImg => {
                                return new Promise((resolve) => {
                                    const img = new Image();
                                    img.onload = () => {
                                        const canvas = document.createElement('canvas');
                                        let width = img.width;
                                        let height = img.height;
                                        
                                        const maxSize = 1024;
                                        if (width > maxSize || height > maxSize) {
                                            if (width > height) {
                                                height = Math.round((height * maxSize) / width);
                                                width = maxSize;
                                            } else {
                                                width = Math.round((width * maxSize) / height);
                                                height = maxSize;
                                            }
                                        }
                                        
                                        canvas.width = width;
                                        canvas.height = height;
                                        const ctx = canvas.getContext('2d');
                                        ctx.drawImage(img, 0, 0, width, height);
                                        
                                        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                        resolve({
                                            ...oldImg,
                                            data: resizedDataUrl,
                                            type: 'image/jpeg',
                                            size: resizedDataUrl.length
                                        });
                                    };
                                    img.onerror = () => resolve(oldImg); // Keep original if error
                                    img.src = oldImg.data;
                                });
                            })).then(resizedImages => {
                                setReferenceImages(resizedImages);
                                // Save resized versions
                                localStorage.setItem(storageKey, JSON.stringify(resizedImages));
                                console.log(`✅ ${resizedImages.length} mekan referans görseli resize edildi ve kaydedildi`);
                            });
                        } else {
                            setReferenceImages(parsed);
                            console.log(`📥 ${parsed.length} referans görsel yüklendi (Mekan):`, location.name);
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Referans görseller yüklenemedi (Mekan):', error);
            }
        }
    }, [location?.name]);

    // 💾 Referans görselleri localStorage'a kaydet
    useEffect(() => {
        if (location?.name && referenceImages.length > 0) {
            const storageKey = `location_reference_${location.name}`;
            try {
                localStorage.setItem(storageKey, JSON.stringify(referenceImages));
                console.log(`💾 ${referenceImages.length} referans görsel kaydedildi (Mekan):`, location.name);
            } catch (error) {
                console.error('❌ Referans görseller kaydedilemedi (Mekan):', error);
            }
        }
    }, [location?.name, referenceImages]);

    // Auto-generate prompt from location data
    useEffect(() => {
        if (location && location.name) {
            generatePromptFromLocation();
        }
    }, [location]);

    const generatePromptFromLocation = () => {
        if (!location) {
            setPrompt('Professional location environment');
            return;
        }

        let locationPrompt = `Professional cinematic environment: ${location.name || 'location'}`;

        // Add type/setting if available
        if (location.type) {
            if (typeof location.type === 'string' && location.type.trim()) {
                locationPrompt += `, ${location.type}`;
            }
        }

        // Add description if available
        if (location.description) {
            if (typeof location.description === 'string' && location.description.trim()) {
                locationPrompt += `, ${location.description}`;
            }
        }

        // Add atmosphere/mood
        if (location.atmosphere || location.mood) {
            const atmos = location.atmosphere || location.mood;
            if (typeof atmos === 'string' && atmos.trim()) {
                locationPrompt += `, ${atmos} atmosphere`;
            }
        }

        // Add lighting if available
        if (location.lighting) {
            if (typeof location.lighting === 'string' && location.lighting.trim()) {
                locationPrompt += `, ${location.lighting} lighting`;
            }
        }

        // Add time of day context
        if (location.timeOfDay || location.time) {
            const timeOfDay = location.timeOfDay || location.time;
            if (typeof timeOfDay === 'string' && timeOfDay.trim()) {
                locationPrompt += `, ${timeOfDay}`;
            }
        }

        // Add INT/EXT context
        if (location.setting) {
            if (typeof location.setting === 'string' && location.setting.trim()) {
                locationPrompt += `, ${location.setting}`;
            }
        }

        // Add style if available
        if (location.style && typeof location.style === 'string' && location.style.trim()) {
            locationPrompt += `, ${location.style}`;
        }

        // Add cinematic style for locations
        locationPrompt += ', cinematic wide shot, professional lighting, 4K quality, detailed environment, establishing shot';

        // Add reference image context if available
        if (referenceImages.length > 0) {
            locationPrompt += ', similar to reference image style, composition and atmosphere';
        }

        // Ensure prompt is a valid string before setting
        const finalPrompt = locationPrompt || 'Professional location environment';
        setPrompt(finalPrompt);
    };

    const handleReferenceUpload = (event) => {
        const files = Array.from(event.target.files || []); // Handle multiple files

        files.forEach(file => {
            if (file && file.type.startsWith('image/')) {
                // Check if we're at the 14 image limit
                if (referenceImages.length >= 14) {
                    setError('En fazla 14 referans görsel yükleyebilirsiniz (Gemini 3 Pro sınırı)');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    // Resize image to reduce base64 size (max 1024px)
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        
                        // Calculate new dimensions (max 1024px on longest side)
                        const maxSize = 1024;
                        if (width > maxSize || height > maxSize) {
                            if (width > height) {
                                height = Math.round((height * maxSize) / width);
                                width = maxSize;
                            } else {
                                width = Math.round((width * maxSize) / height);
                                height = maxSize;
                            }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Convert to data URL with compression
                        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                        
                        const newImage = {
                            id: Date.now() + Math.random(), // Unique ID
                            data: resizedDataUrl,
                            name: file.name,
                            type: 'image/jpeg', // Force JPEG for better compression
                            size: resizedDataUrl.length,
                            originalSize: file.size
                        };

                        setReferenceImages(prev => [...prev, newImage]);
                        // Regenerate prompt with reference context
                        setTimeout(generatePromptFromLocation, 100);
                        
                        console.log(`📸 Resized: ${file.name} (${(file.size/1024).toFixed(1)}KB → ${(resizedDataUrl.length/1024).toFixed(1)}KB)`);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                setError('Lütfen geçerli görsel dosyaları seçin (JPG, PNG, etc.)');
            }
        });
        
        // CRITICAL: Reset input to allow selecting same/new files again
        event.target.value = '';
        setFileInputKey(Date.now()); // Force input re-render
    };

    const removeReferenceImage = (imageId) => {
        setReferenceImages(prev => {
            const newImages = prev.filter(img => img.id !== imageId);
            
            // 💾 Eğer tüm görseller silinirse localStorage'dan da sil
            if (newImages.length === 0 && location?.name) {
                const storageKey = `location_reference_${location.name}`;
                localStorage.removeItem(storageKey);
                console.log('🗑️ Tüm referans görseller silindi (Mekan):', location.name);
            }
            
            return newImages;
        });
        // Clear file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        // Regenerate prompt without removed reference
        setTimeout(generatePromptFromLocation, 100);
    };

    const clearAllReferenceImages = () => {
        setReferenceImages([]);
        
        // 💾 localStorage'dan da temizle
        if (location?.name) {
            const storageKey = `location_reference_${location.name}`;
            localStorage.removeItem(storageKey);
            console.log('🗑️ Tüm referans görseller temizlendi (Mekan):', location.name);
        }
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setTimeout(generatePromptFromLocation, 100);
    };

    const generateLocationImage = async () => {
        // Validate prompt
        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            setError('Mekan açıklaması bulunamadı');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            console.log('🏞️ Generating location image for:', location?.name || 'Unknown');
            console.log('📝 Prompt:', prompt);

            // Build image generation options
            let imageOptions = {
                location: location?.name || 'location',
                style: 'cinematic environment establishing shot',
                imageSize: '2K' // High quality
            };

            // Add reference images if available (user uploaded)
            const allReferenceImages = [];
            
            if (referenceImages.length > 0) {
                allReferenceImages.push(...referenceImages.map(refImage => {
                    // Extract base64 data without data URL prefix
                    let base64Data = refImage.data;
                    if (base64Data.includes('base64,')) {
                        base64Data = base64Data.split('base64,')[1];
                    }
                    
                    return {
                        data: base64Data, // Pure base64 without data URL prefix
                        mimeType: refImage.type || 'image/png',
                        instruction: 'Create a location environment similar to this reference image'
                    };
                }));
            }
            
            // Add approved character images as references for consistency
            if (characterReferences && characterReferences.length > 0) {
                console.log('👥 Including character references for consistency:', characterReferences.length);
                characterReferences.forEach(charRef => {
                    if (charRef.image?.url) {
                        // Convert data URL to base64
                        const base64Data = charRef.image.url.split(',')[1];
                        const mimeType = charRef.image.url.match(/data:([^;]+);/)?.[1] || 'image/png';
                        
                        allReferenceImages.push({
                            data: base64Data, // Pure base64 without data URL prefix
                            mimeType: mimeType,
                            instruction: `Maintain visual consistency with character ${charRef.name} shown in this reference`
                        });
                    }
                });
            }
            
            if (allReferenceImages.length > 0) {
                // Limit to 14 images (Gemini 3 Pro limit)
                imageOptions.referenceImages = allReferenceImages.slice(0, 14);
                console.log('🖼️ Total reference images:', imageOptions.referenceImages.length);
            }

            // Use the store's generateImage method which handles provider fallback
            const result = await generateImage(prompt.trim(), imageOptions);

            if (result && result.imageData) {
                const imageUrl = `data:${result.mimeType || 'image/png'};base64,${result.imageData}`;
                const imageData = {
                    url: imageUrl,
                    prompt: prompt,
                    location: location.name,
                    timestamp: new Date().toISOString()
                };

                setGeneratedImage(imageData);

                // Callback to parent component
                if (onImageGenerated) {
                    onImageGenerated(location.name, {
                        url: imageUrl,
                        prompt: prompt,
                        mimeType: result.mimeType
                    });
                }

                console.log('✅ Location image generated successfully');
            } else {
                throw new Error('Görsel oluşturulamadı');
            }
        } catch (err) {
            console.error('❌ Location image generation error:', err);
            setError(err.message || 'Görsel oluşturma hatası');
        } finally {
            setIsGenerating(false);
        }
    };

    const regenerateImage = () => {
        setGeneratedImage(null);
        generateLocationImage();
    };

    const downloadImage = () => {
        if (generatedImage?.url) {
            const link = document.createElement('a');
            link.href = generatedImage.url;
            link.download = `${location.name}_location.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (!location) {
        return (
            <div className="text-center text-cinema-text-dim p-8">
                <div className="text-4xl mb-4">🏞️</div>
                <p>Mekan seçin</p>
            </div>
        );
    }

    return (
        <div className="bg-cinema-dark rounded-lg border border-cinema-gray p-6 mb-6">
            {/* Location Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-cinema-gray">
                <div className="text-2xl">🏞️</div>
                <div>
                    <h3 className="text-lg font-semibold text-cinema-accent">{location.name}</h3>
                    <p className="text-sm text-cinema-text-dim">Mekan Görsel Oluşturucu</p>
                </div>
            </div>

            {/* Reference Image Upload */}
            <div className="mb-6">
                {/* Hidden file input - her zaman DOM'da olmalı */}
                <input
                    key={fileInputKey}
                    type="file"
                    ref={fileInputRef}
                    onChange={handleReferenceUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                />
                
                <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-cinema-text">
                        📸 Referans Görseller (Opsiyonel - Max 14)
                    </label>
                    <span className="text-xs text-cinema-text-dim">
                        {referenceImages.length}/14 görsel
                    </span>
                </div>

                {referenceImages.length > 0 ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {referenceImages.map((refImage) => (
                                <div key={refImage.id} className="relative group">
                                    <div className="bg-cinema-gray rounded-lg p-2 border border-cinema-gray-light">
                                        <img
                                            src={refImage.data}
                                            alt={`Referans ${refImage.name}`}
                                            className="w-full h-24 object-cover rounded border border-cinema-gray"
                                        />
                                        <p className="text-xs text-cinema-text-dim mt-1 truncate" title={refImage.name}>
                                            {refImage.name}
                                        </p>
                                        <button
                                            onClick={() => removeReferenceImage(refImage.id)}
                                            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Bu görseli kaldır"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            {referenceImages.length < 14 && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="btn-secondary text-sm flex-1"
                                >
                                    + Daha Fazla Görsel Ekle
                                </button>
                            )}
                            <button
                                onClick={clearAllReferenceImages}
                                className="text-sm px-3 py-2 text-red-400 hover:text-red-300 border border-red-400/30 rounded transition-colors"
                            >
                                🗑️ Hepsini Temizle
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="border-2 border-dashed border-cinema-gray rounded-lg p-6 text-center">
                        <div className="text-4xl mb-3 text-cinema-text-dim">📷</div>
                        <p className="text-sm text-cinema-text mb-2">
                            Mekanınıza benzer referans görseller yükleyin
                        </p>
                        <p className="text-xs text-cinema-text-dim mb-4">
                            Gemini 3 Pro Image ile en fazla 14 görsel kullanabilirsiniz
                        </p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="btn-secondary text-sm"
                        >
                            Görsel(ler) Seç
                        </button>
                    </div>
                )}
            </div>

            {/* Prompt Editor */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-cinema-text mb-2">
                    ✏️ Görsel Açıklaması (Prompt)
                </label>
                <textarea
                    value={prompt || ''}
                    onChange={(e) => {
                        const value = e.target?.value || '';
                        if (typeof value === 'string') {
                            setPrompt(value);
                        }
                    }}
                    className="w-full h-24 bg-cinema-gray border border-cinema-gray-light rounded px-3 py-2 text-cinema-text text-sm resize-none focus:border-cinema-accent focus:outline-none"
                    placeholder="Mekanın görsel açıklamasını yazın..."
                />
                <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-cinema-text-dim">
                        Mekan bilgilerinden otomatik oluşturuldu
                    </span>
                    <button
                        onClick={generatePromptFromLocation}
                        className="text-xs text-cinema-accent hover:text-cinema-accent-light"
                    >
                        🔄 Yeniden Oluştur
                    </button>
                </div>
            </div>

            {/* Generated Image Display */}
            {generatedImage ? (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-cinema-accent">
                            🏞️ Oluşturulan Görsel
                        </h4>
                        <div className="flex gap-2">
                            <button
                                onClick={downloadImage}
                                className="text-xs btn-secondary"
                                title="Görseli indir"
                            >
                                💾 İndir
                            </button>
                            <button
                                onClick={regenerateImage}
                                className="text-xs btn-secondary"
                                title="Yeniden oluştur"
                                disabled={isGenerating}
                            >
                                🔄 Yeniden
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <img
                            src={generatedImage.url}
                            alt={`${location.name} mekan görseli`}
                            className="w-full h-auto rounded-lg border border-cinema-gray shadow-lg max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setIsImageModalOpen(true)}
                            title="Tam ekran için tıklayın"
                        />
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            {location.name}
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-cinema-text-dim">
                        🕐 Oluşturulma: {new Date(generatedImage.timestamp).toLocaleString('tr-TR')}
                    </div>
                </div>
            ) : (
                <div className="mb-6 border-2 border-dashed border-cinema-gray rounded-lg p-8 text-center">
                    {isGenerating ? (
                        <div>
                            <div className="text-4xl mb-3 animate-spin">🏞️</div>
                            <p className="text-cinema-accent font-medium mb-2">Görsel Oluşturuluyor...</p>
                            <p className="text-sm text-cinema-text-dim">Bu işlem 30-60 saniye sürebilir</p>
                            <div className="mt-4 w-full bg-cinema-gray rounded-full h-2">
                                <div className="bg-cinema-accent h-2 rounded-full w-1/3 animate-pulse"></div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="text-4xl mb-3 text-cinema-text-dim">🖼️</div>
                            <p className="text-cinema-text-dim mb-4">Henüz görsel oluşturulmamış</p>
                            <button
                                onClick={generateLocationImage}
                                className="btn-primary"
                                disabled={!prompt.trim()}
                            >
                                🏞️ Mekan Görseli Oluştur
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-red-400">⚠️</span>
                        <p className="text-red-400 text-sm font-medium">{error}</p>
                    </div>
                </div>
            )}

            {/* Full Screen Image Modal */}
            {isImageModalOpen && generatedImage && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4" 
                    onClick={() => setIsImageModalOpen(false)}
                >
                    <div className="relative max-w-7xl max-h-full">
                        <button
                            onClick={() => setIsImageModalOpen(false)}
                            className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition-opacity z-10 text-xl"
                            title="Kapat (ESC)"
                        >
                            ✕
                        </button>
                        <img
                            src={generatedImage.url}
                            alt={`${location.name} tam ekran`}
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
                            <h4 className="font-semibold text-lg">{location.name}</h4>
                            <p className="text-sm text-gray-300 mt-1">{new Date(generatedImage.timestamp).toLocaleString('tr-TR')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
