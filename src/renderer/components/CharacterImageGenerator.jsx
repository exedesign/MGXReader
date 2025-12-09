import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../store/aiStore';
import { useScriptStore } from '../store/scriptStore';

export default function CharacterImageGenerator({ character, onImageGenerated }) {
    const { t } = useTranslation();
    const { getAIHandler, provider, isGeneratingImage, setGeneratingImage, generateImage } = useAIStore();
    const { getCurrentScript } = useScriptStore();

    const [generatedImage, setGeneratedImage] = useState(null);
    const [referenceImages, setReferenceImages] = useState([]); // Changed to array for multiple images
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [prompt, setPrompt] = useState('Professional character portrait');
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [fileInputKey, setFileInputKey] = useState(Date.now()); // Key to force input reset
    const fileInputRef = useRef(null);

    // Auto-generate prompt from character data
    useEffect(() => {
        if (character && character.name) {
            generatePromptFromCharacter();
        }
    }, [character]);

    const generatePromptFromCharacter = () => {
        if (!character) {
            setPrompt('Professional character portrait');
            return;
        }

        let characterPrompt = `Professional character portrait of ${character.name || 'character'}`;

        // Add physical description if available
        if (character.physicalDescription || character.physical) {
            const physicalDesc = character.physicalDescription || character.physical;
            if (typeof physicalDesc === 'string' && physicalDesc.trim()) {
                characterPrompt += `, ${physicalDesc}`;
            }
        } else if (character.description) {
            if (typeof character.description === 'string' && character.description.trim()) {
                characterPrompt += `, ${character.description}`;
            }
        }

        // Add personality traits for visual style
        if (character.personality && typeof character.personality === 'string') {
            const personalityVisuals = {
                'confident': 'confident posture, strong gaze',
                'mysterious': 'enigmatic expression, dramatic lighting',
                'friendly': 'warm smile, approachable demeanor',
                'aggressive': 'intense expression, strong jaw',
                'gentle': 'soft features, kind eyes',
                'intelligent': 'thoughtful expression, sharp eyes'
            };

            Object.keys(personalityVisuals).forEach(trait => {
                if (character.personality.toLowerCase().includes(trait)) {
                    characterPrompt += `, ${personalityVisuals[trait]}`;
                }
            });
        }

        // Add age/role context if available
        if (character.age && typeof character.age === 'string' && character.age.trim()) {
            characterPrompt += `, ${character.age} years old`;
        }

        if (character.role || character.occupation) {
            const role = character.role || character.occupation;
            if (typeof role === 'string' && role.trim()) {
                characterPrompt += `, ${role}`;
            }
        }

        // Add style if available
        if (character.style && typeof character.style === 'string' && character.style.trim()) {
            characterPrompt += `, ${character.style}`;
        }

        // Add cinematic style
        characterPrompt += ', cinematic portrait, professional lighting, 4K quality, detailed facial features';

        // Add reference image context if available
        if (referenceImages.length > 0) {
            characterPrompt += ', similar to reference image style and composition';
        }

        // Ensure prompt is a valid string before setting
        const finalPrompt = characterPrompt || 'Professional character portrait';
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
                    const newImage = {
                        id: Date.now() + Math.random(), // Unique ID
                        data: e.target.result,
                        name: file.name,
                        type: file.type,
                        size: file.size
                    };

                    setReferenceImages(prev => [...prev, newImage]);
                    // Regenerate prompt with reference context
                    setTimeout(generatePromptFromCharacter, 100);
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
        setReferenceImages(prev => prev.filter(img => img.id !== imageId));
        // Clear file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        // Regenerate prompt without removed reference
        setTimeout(generatePromptFromCharacter, 100);
    };

    const clearAllReferenceImages = () => {
        setReferenceImages([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setTimeout(generatePromptFromCharacter, 100);
    };

    const generateCharacterImage = async () => {
        // Validate prompt
        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            setError('Karakter açıklaması bulunamadı');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            console.log('🎨 Generating character image for:', character?.name || 'Unknown');
            console.log('📝 Prompt:', prompt);

            let imageOptions = {
                character: character?.name || 'character',
                style: 'cinematic character portrait'
            };

            // Add reference images if available (max 14 for Gemini)
            if (referenceImages.length > 0) {
                imageOptions.referenceImages = referenceImages.slice(0, 14).map(refImage => ({
                    data: refImage.data,
                    mimeType: refImage.type || 'image/png',
                    instruction: 'Create a character similar to this reference image'
                }));
                console.log('🖼️ Including reference images:', imageOptions.referenceImages.length, 'images');
            }

            // Use the store's generateImage method which handles provider fallback
            const result = await generateImage(prompt.trim(), imageOptions);

            if (result && result.imageData) {
                const imageUrl = `data:${result.mimeType || 'image/png'};base64,${result.imageData}`;
                const imageData = {
                    url: imageUrl,
                    prompt: prompt,
                    character: character.name,
                    timestamp: new Date().toISOString()
                };

                setGeneratedImage(imageData);

                // Callback to parent component
                if (onImageGenerated) {
                    onImageGenerated(character.name, {
                        url: imageUrl,
                        prompt: prompt,
                        mimeType: result.mimeType
                    });
                }

                console.log('✅ Character image generated successfully');
            } else {
                throw new Error('Görsel oluşturulamadı');
            }
        } catch (err) {
            console.error('❌ Character image generation error:', err);
            setError(err.message || 'Görsel oluşturma hatası');
        } finally {
            setIsGenerating(false);
        }
    };

    const regenerateImage = () => {
        setGeneratedImage(null);
        generateCharacterImage();
    };

    const downloadImage = () => {
        if (generatedImage?.url) {
            const link = document.createElement('a');
            link.href = generatedImage.url;
            link.download = `${character.name}_character.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (!character) {
        return (
            <div className="text-center text-cinema-text-dim p-8">
                <div className="text-4xl mb-4">🎭</div>
                <p>Karakter seçin</p>
            </div>
        );
    }

    return (
        <div className="bg-cinema-dark rounded-lg border border-cinema-gray p-6 mb-6">
            {/* Character Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-cinema-gray">
                <div className="text-2xl">🎨</div>
                <div>
                    <h3 className="text-lg font-semibold text-cinema-accent">{character.name}</h3>
                    <p className="text-sm text-cinema-text-dim">Karakter Görsel Oluşturucu</p>
                </div>
            </div>

            {/* Reference Image Upload */}
            <div className="mb-6">
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
                        <input
                            key={fileInputKey}
                            type="file"
                            ref={fileInputRef}
                            onChange={handleReferenceUpload}
                            accept="image/*"
                            multiple
                            className="hidden"
                        />
                        <div className="text-4xl mb-3 text-cinema-text-dim">📷</div>
                        <p className="text-sm text-cinema-text mb-2">
                            Karakterinize benzer referans görseller yükleyin
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
                    placeholder="Karakterin görsel açıklamasını yazın..."
                />
                <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-cinema-text-dim">
                        Karakter bilgilerinden otomatik oluşturuldu
                    </span>
                    <button
                        onClick={generatePromptFromCharacter}
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
                            🎨 Oluşturulan Görsel
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
                            alt={`${character.name} karakter görseli`}
                            className="w-full h-auto rounded-lg border border-cinema-gray shadow-lg max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setIsImageModalOpen(true)}
                            title="Tam ekran için tıklayın"
                        />
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            {character.name}
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
                            <div className="text-4xl mb-3 animate-spin">🎨</div>
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
                                onClick={generateCharacterImage}
                                className="btn-primary"
                                disabled={!prompt.trim()}
                            >
                                🎨 Karakter Görseli Oluştur
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
                            alt={`${character.name} tam ekran`}
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
                            <h4 className="font-semibold text-lg">{character.name}</h4>
                            <p className="text-sm text-gray-300 mt-1">{new Date(generatedImage.timestamp).toLocaleString('tr-TR')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}