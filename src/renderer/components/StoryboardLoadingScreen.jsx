import React, { useEffect, useState } from 'react';

export default function StoryboardLoadingScreen({ message = 'AI Karakterleri ve Mekanları Sizin İçin Hazırlıyor...', step = 1, totalSteps = 4 }) {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const stepMessages = {
    1: 'Senaryoyu analiz ediyor...',
    2: 'Karakterleri ve mekanları tanımlıyor...',
    3: 'Görsel stili belirleniyor...',
    4: 'Storyboard oluşturuluyor...'
  };

  return (
    <div className="bg-cinema-surface border border-cinema-accent/20 rounded-lg p-4 mb-4 mx-auto max-w-md">
      <div className="flex items-center gap-3">
        {/* Compact animated icon */}
        <div className="relative w-8 h-8 flex-shrink-0">
          <div className="absolute inset-0 border-2 border-cinema-accent/20 rounded-full animate-spin" 
               style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-lg animate-pulse">🎬</div>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">
            {message}{dots}
          </h3>
          <p className="text-xs text-cinema-text-dim">
            Adım {step} / {totalSteps} - {stepMessages[step] || 'İşleniyor...'}
          </p>
        </div>
      </div>
      
      {/* Basit Progress Bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-cinema-text font-medium">İlerleme</span>
          <span className="text-cinema-accent font-bold text-xs">
            {Math.round((step / totalSteps) * 100)}%
          </span>
        </div>
        
        {/* Progress Bar Kutusu */}
        <div className="w-full h-4 bg-cinema-gray/30 border border-cinema-gray rounded-md overflow-hidden relative">
          {/* Dolum Çubuğu */}
          <div 
            className="h-full transition-all duration-1000 ease-out relative"
            style={{ 
              width: `${(step / totalSteps) * 100}%`,
              background: (step / totalSteps) > 0.8 ? 'linear-gradient(90deg, #10b981, #22c55e)' :
                        (step / totalSteps) > 0.6 ? 'linear-gradient(90deg, #eab308, #f59e0b)' :
                        (step / totalSteps) > 0.3 ? 'linear-gradient(90deg, #f97316, #fb923c)' :
                        'linear-gradient(90deg, #ef4444, #f87171)'
            }}
          >
            {/* Animasyon */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
          </div>
          
          {/* Yüzde Text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white text-xs font-bold drop-shadow-md">
              {Math.round((step / totalSteps) * 100)}%
            </span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
      `}} />
    </div>
  );
}
