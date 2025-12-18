import React, { useState, useEffect } from 'react';
import { 
  CURRENCIES, 
  formatCurrency, 
  convertFromUSD, 
  getSavedCurrencyPreference 
} from '../utils/currencyConverter';

/**
 * Cost Preview Modal Component
 * Shows estimated token usage and cost before starting analysis
 * Helps users understand what they're about to spend
 */
export default function CostPreviewModal({ 
  costEstimates, 
  onConfirm, 
  onCancel,
  useCache = false
}) {
  const [selectedCurrency, setSelectedCurrency] = useState(getSavedCurrencyPreference());
  const [convertedCosts, setConvertedCosts] = useState({});
  const [isConverting, setIsConverting] = useState(false);

  // Calculate totals with NaN safety
  const totalInputTokens = costEstimates.reduce((sum, est) => sum + (est.inputTokens || 0), 0);
  const totalOutputTokens = costEstimates.reduce((sum, est) => sum + (est.outputTokens || 0), 0);
  const totalCachedTokens = costEstimates.reduce((sum, est) => sum + (est.cachedTokens || 0), 0);
  const totalCost = costEstimates.reduce((sum, est) => {
    const cost = est.cost || 0;
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);
  const totalCostWithoutCache = costEstimates.reduce((sum, est) => {
    const cost = est.costWithoutCache || est.cost || 0;
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);
  const cacheSavings = totalCostWithoutCache - totalCost;
  const cacheSavingsPercent = totalCostWithoutCache > 0 
    ? ((cacheSavings / totalCostWithoutCache) * 100).toFixed(0)
    : 0;

  // Convert costs to selected currency
  useEffect(() => {
    const convertCosts = async () => {
      if (selectedCurrency === 'USD') {
        setConvertedCosts({
          total: totalCost,
          savings: cacheSavings,
          perAnalysis: costEstimates.map(est => est.cost)
        });
        return;
      }

      setIsConverting(true);
      try {
        const convertedTotal = await convertFromUSD(totalCost, selectedCurrency);
        const convertedSavings = await convertFromUSD(cacheSavings, selectedCurrency);
        const convertedPerAnalysis = await Promise.all(
          costEstimates.map(est => convertFromUSD(est.cost || 0, selectedCurrency))
        );

        setConvertedCosts({
          total: isNaN(convertedTotal) ? totalCost : convertedTotal,
          savings: isNaN(convertedSavings) ? cacheSavings : convertedSavings,
          perAnalysis: convertedPerAnalysis.map((cost, i) => 
            isNaN(cost) ? costEstimates[i].cost : cost
          )
        });
      } catch (error) {
        console.error('Currency conversion failed:', error);
        setConvertedCosts({
          total: totalCost,
          savings: cacheSavings,
          perAnalysis: costEstimates.map(est => est.cost || 0)
        });
      } finally {
        setIsConverting(false);
      }
    };

    convertCosts();
  }, [selectedCurrency, totalCost, cacheSavings, costEstimates]);

  // Get cost level (for color coding)
  const getCostLevel = (cost) => {
    if (cost < 0.10) return 'low';
    if (cost < 1.00) return 'medium';
    return 'high';
  };

  const costLevel = getCostLevel(totalCost);

  // Get friendly analysis name
  const getAnalysisName = (type) => {
    const names = {
      'character_analysis': 'Karakter Analizi',
      'structure_analysis': 'Yapı Analizi',
      'dialogue_analysis': 'Diyalog Analizi',
      'scene_analysis': 'Sahne Analizi',
      'theme_analysis': 'Tema Analizi',
      'pacing_analysis': 'Tempo Analizi',
      'visual_analysis': 'Görsel Analiz',
      'conflict_analysis': 'Çatışma Analizi',
      'emotional_arc_analysis': 'Duygusal Yay Analizi',
      'world_building_analysis': 'Dünya Kurgusu Analizi'
    };
    return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-cinema-dark border-2 border-cinema-accent rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                costLevel === 'high' ? 'bg-red-500/20' :
                costLevel === 'medium' ? 'bg-yellow-500/20' :
                'bg-green-500/20'
              }`}>
                <svg className={`w-6 h-6 ${
                  costLevel === 'high' ? 'text-red-400' :
                  costLevel === 'medium' ? 'text-yellow-400' :
                  'text-green-400'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-cinema-accent">Maliyet Önizlemesi</h2>
                <p className="text-xs text-cinema-text-dim">Analiz göndermeden önce tahmini maliyet</p>
              </div>
            </div>
            
            {/* Currency Selector */}
            <div className="flex items-center gap-2">
              {Object.entries(CURRENCIES).map(([code, info]) => (
                <button
                  key={code}
                  onClick={() => setSelectedCurrency(code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedCurrency === code
                      ? 'bg-cinema-accent text-cinema-black'
                      : 'bg-cinema-gray/50 text-cinema-text-dim hover:bg-cinema-gray'
                  }`}
                  title={info.name}
                >
                  {info.symbol} {code}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Cost */}
            <div className="bg-cinema-gray/50 rounded-lg p-4 border border-cinema-gray">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-cinema-text-dim">Toplam Maliyet</span>
              </div>
              <div className="text-2xl font-bold text-green-400">
                {isConverting ? '...' : formatCurrency(convertedCosts.total || totalCost, selectedCurrency)}
              </div>
            </div>

            {/* Analysis Count */}
            <div className="bg-cinema-gray/50 rounded-lg p-4 border border-cinema-gray">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span className="text-xs text-cinema-text-dim">Seçili Analiz</span>
              </div>
              <div className="text-2xl font-bold text-cinema-accent">
                {costEstimates.length}
              </div>
            </div>

            {/* Input Tokens */}
            <div className="bg-cinema-gray/50 rounded-lg p-4 border border-cinema-gray">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span className="text-xs text-cinema-text-dim">Giriş Token</span>
              </div>
              <div className="text-xl font-bold text-blue-400">
                {totalInputTokens.toLocaleString('tr-TR')}
              </div>
            </div>

            {/* Output Tokens */}
            <div className="bg-cinema-gray/50 rounded-lg p-4 border border-cinema-gray">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span className="text-xs text-cinema-text-dim">Çıkış Token (tahmin)</span>
              </div>
              <div className="text-xl font-bold text-purple-400">
                {totalOutputTokens.toLocaleString('tr-TR')}
              </div>
            </div>
          </div>

          {/* Cache Savings */}
          {useCache && cacheSavings > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-green-400">Cache Tasarrufu Aktif!</div>
                  <div className="text-xs text-cinema-text-dim">
                    {totalCachedTokens.toLocaleString('tr-TR')} token cache'den okunacak
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-400">
                    {isConverting ? '...' : formatCurrency(convertedCosts.savings || cacheSavings, selectedCurrency)}
                  </div>
                  <div className="text-xs text-green-400/70">~%{cacheSavingsPercent} tasarruf</div>
                </div>
              </div>
            </div>
          )}

          {/* Per-Analysis Breakdown */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-cinema-text flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Analiz Detayları
            </h3>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {costEstimates.map((estimate, index) => (
                <div 
                  key={estimate.type}
                  className="bg-cinema-gray/30 rounded-lg p-3 border border-cinema-gray hover:border-cinema-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-cinema-text">
                        {getAnalysisName(estimate.type)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-cinema-text-dim">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                          </svg>
                          {estimate.inputTokens.toLocaleString('tr-TR')} giriş
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                          {estimate.outputTokens.toLocaleString('tr-TR')} çıkış
                        </span>
                        {estimate.cachedTokens > 0 && (
                          <span className="flex items-center gap-1 text-green-400">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                              <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                              <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
                            </svg>
                            {estimate.cachedTokens.toLocaleString('tr-TR')} cache
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-bold text-green-400">
                        {isConverting ? '...' : formatCurrency(
                          convertedCosts.perAnalysis?.[index] || estimate.cost,
                          selectedCurrency
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-xs text-cinema-text-dim space-y-1">
                <p><strong className="text-blue-400">Not:</strong> Bu tahmindir, gerçek maliyet ±%10-15 farklılık gösterebilir.</p>
                <p>Çıkış token sayısı konservatif tahmin edilmiştir. Uzun analizler daha fazla maliyet oluşturabilir.</p>

              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-cinema-dark border-t border-cinema-gray px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg border border-cinema-gray text-cinema-text hover:bg-cinema-gray/30 transition-colors font-medium"
          >
            İptal
          </button>
          
          <div className="flex items-center gap-4">
            {/* Cost Warning */}
            {costLevel === 'high' && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-semibold">Yüksek maliyet!</span>
              </div>
            )}
            
            <button
              onClick={onConfirm}
              className={`px-8 py-2.5 rounded-lg font-semibold transition-all shadow-lg ${
                costLevel === 'high' 
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : costLevel === 'medium'
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-cinema-black'
                  : 'bg-cinema-accent hover:bg-cinema-accent/90 text-cinema-black'
              }`}
            >
              ✓ Analizi Başlat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
