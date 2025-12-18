import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CURRENCIES, 
  convertFromUSD, 
  formatCurrency, 
  getSavedCurrencyPreference,
  getExchangeRates
} from '../utils/currencyConverter';
import { exportTokenUsage, importTokenUsage, resetTokenUsage } from '../utils/tokenTracker';
import { getBudgetSettings, getTotalAccumulatedCost } from '../utils/budgetAlarm';

/**
 * Token Usage and Cost Display Component - Compact Horizontal Badge
 * Shows real-time token consumption and cost breakdown in minimal space
 * Supports USD, TRY, EUR currencies with real-time exchange rates
 */
export default function TokenUsageDisplay({ sessionUsage, showDetailed = false, onReset, currency }) {
  const { t } = useTranslation();
  const [selectedCurrency, setSelectedCurrency] = useState(currency || getSavedCurrencyPreference());
  const [convertedCosts, setConvertedCosts] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [budgetSettings, setBudgetSettings] = useState(getBudgetSettings());

  // Show empty state if no usage yet
  const hasUsage = sessionUsage && sessionUsage.requestCount > 0;
  const { totalTokens = 0, totalCost = 0, estimatedTokens = 0, byModel = {}, byAnalysisType = {}, requestCount = 0, accuracy = [] } = sessionUsage || {};
  
  // Calculate accuracy percentage
  const accuracyPercent = accuracy.length > 0 
    ? (accuracy.reduce((sum, item) => sum + (item.actual / item.estimated * 100), 0) / accuracy.length).toFixed(1)
    : 100;

  // Update selected currency when prop changes
  useEffect(() => {
    if (currency) {
      setSelectedCurrency(currency);
    }
  }, [currency]);

  // Fetch exchange rates and convert costs
  useEffect(() => {
    // Only convert if we have usage data
    if (!sessionUsage || totalCost === 0) {
      return;
    }

    const convertCosts = async () => {
      if (selectedCurrency === 'USD') {
        setConvertedCosts({
          total: totalCost,
          totalWithDebt: budgetSettings.previousDebt + totalCost,
          byModel: Object.fromEntries(
            Object.entries(byModel).map(([model, data]) => [model, data.cost])
          ),
          byAnalysisType: Object.fromEntries(
            Object.entries(byAnalysisType).map(([type, data]) => [type, data.cost])
          ),
        });
        return;
      }

      setIsConverting(true);
      try {
        const rates = await getExchangeRates();
        setExchangeRates(rates);

        const convertedTotal = await convertFromUSD(totalCost, selectedCurrency);
        const convertedPreviousDebt = await convertFromUSD(budgetSettings.previousDebt, selectedCurrency);
        const convertedByModel = {};
        const convertedByAnalysisType = {};

        for (const [model, data] of Object.entries(byModel)) {
          convertedByModel[model] = await convertFromUSD(data.cost, selectedCurrency);
        }

        for (const [type, data] of Object.entries(byAnalysisType)) {
          convertedByAnalysisType[type] = await convertFromUSD(data.cost, selectedCurrency);
        }

        setConvertedCosts({
          total: convertedTotal,
          totalWithDebt: convertedPreviousDebt + convertedTotal,
          byModel: convertedByModel,
          byAnalysisType: convertedByAnalysisType,
        });
      } catch (error) {
        console.error('Currency conversion failed:', error);
        // Fallback to USD
        setConvertedCosts({
          total: totalCost,
          totalWithDebt: budgetSettings.previousDebt + totalCost,
          byModel: Object.fromEntries(
            Object.entries(byModel).map(([model, data]) => [model, data.cost])
          ),
          byAnalysisType: Object.fromEntries(
            Object.entries(byAnalysisType).map(([type, data]) => [type, data.cost])
          ),
        });
      } finally {
        setIsConverting(false);
      }
    };

    convertCosts();
  }, [selectedCurrency, totalCost, requestCount]);

  // Update budget settings when storage changes
  useEffect(() => {
    const handleSettingsUpdate = () => {
      setBudgetSettings(getBudgetSettings());
    };
    
    window.addEventListener('storage', handleSettingsUpdate);
    return () => window.removeEventListener('storage', handleSettingsUpdate);
  }, []);

  // Format cost with appropriate precision and currency symbol
  const formatCost = (costUSD) => {
    // Safety checks for NaN
    if (!costUSD || isNaN(costUSD) || costUSD === 0) {
      return formatCurrency(0, selectedCurrency);
    }
    
    // If conversion is available and valid
    if (convertedCosts.total !== undefined && !isNaN(convertedCosts.total) && totalCost > 0) {
      const ratio = costUSD / totalCost;
      const cost = ratio * convertedCosts.total;
      return isNaN(cost) ? formatCurrency(costUSD, selectedCurrency) : formatCurrency(cost, selectedCurrency);
    }
    
    // Fallback to USD value
    return formatCurrency(costUSD, selectedCurrency);
  };

  // Format tokens with thousands separator
  const formatTokens = (tokens) => {
    return tokens.toLocaleString('tr-TR');
  };

  // Compact horizontal badge version for header
  if (!showDetailed) {
    if (!hasUsage) {
      return null; // Don't show anything if no usage
    }
    
    // Get primary model and analysis type
    const primaryModel = Object.keys(byModel)[0] || 'unknown';
    const primaryAnalysis = Object.keys(byAnalysisType)[0] || 'unknown';
    
    // Calculate total accumulated cost
    const totalAccumulatedCost = budgetSettings.previousDebt + totalCost;
    
    // Check if approaching or exceeded balance limit
    const hasBalanceLimit = budgetSettings.balanceLimit && budgetSettings.balanceLimit > 0;
    const balancePercent = hasBalanceLimit ? (totalAccumulatedCost / budgetSettings.balanceLimit) * 100 : 0;
    const isApproachingLimit = balancePercent >= 80;
    const isExceededLimit = balancePercent >= 100;
    
    return (
      <div className="inline-flex items-center gap-2 px-2 py-1 text-[11px] whitespace-nowrap">
        {/* Token Count */}
        <span className="text-cinema-text-dim">Token:</span>
        <span className="font-bold text-cinema-accent">
          {formatTokens(totalTokens)}
        </span>
        
        {/* Cost */}
        <span className="text-cinema-text-dim ml-1">Maliyet:</span>
        <span className="font-bold text-green-400">
          {isConverting ? '...' : formatCost(totalCost)}
        </span>
        
        {/* Total Cost with previousDebt */}
        <span className="text-cinema-text-dim ml-1">Toplam:</span>
        <span className={`font-bold ${isExceededLimit ? 'text-red-500' : isApproachingLimit ? 'text-yellow-400' : 'text-orange-400'}`}>
          {isConverting ? '...' : formatCurrency(convertedCosts.totalWithDebt || totalAccumulatedCost, selectedCurrency)}
        </span>
        
        {/* Balance Limit Warning */}
        {hasBalanceLimit && (
          <>
            <span className="text-cinema-text-dim ml-1">/</span>
            <span className="text-cinema-text-dim">
              {formatCurrency(budgetSettings.balanceLimit, selectedCurrency)}
            </span>
            <span className={`font-semibold ml-1 ${isExceededLimit ? 'text-red-500' : isApproachingLimit ? 'text-yellow-400' : 'text-gray-400'}`}>
              ({balancePercent.toFixed(0)}%)
            </span>
            {isExceededLimit && (
              <span className="text-red-500 font-bold ml-1">⚠️ LİMİT AŞILDI!</span>
            )}
            {isApproachingLimit && !isExceededLimit && (
              <span className="text-yellow-400 font-bold ml-1">⚠️ YAKLAŞIYOR</span>
            )}
          </>
        )}
        
        {/* Request count */}
        <span className="text-cinema-text-dim ml-1">
          ({requestCount} istek)
        </span>
        
        {/* Model */}
        <span className="text-cinema-text-dim ml-2 pl-2">Model:</span>
        <span className="text-cinema-text font-mono">
          {primaryModel}
        </span>
        <span className="text-cinema-text-dim">
          ({formatTokens(byModel[primaryModel]?.tokens || 0)})
        </span>
        <span className="text-green-400 font-semibold">
          {isConverting ? '...' : formatCurrency(convertedCosts.byModel?.[primaryModel] || byModel[primaryModel]?.cost || 0, selectedCurrency)}
        </span>
        
        {/* Analysis Type */}
        <span className="text-cinema-text-dim ml-2 pl-2">Analiz:</span>
        <span className="text-cinema-text capitalize">
          {primaryAnalysis.replace(/_/g, ' ')}
        </span>
        <span className="text-cinema-text-dim">
          ({formatTokens(byAnalysisType[primaryAnalysis]?.tokens || 0)})
        </span>
        <span className="text-green-400 font-semibold">
          {isConverting ? '...' : formatCurrency(convertedCosts.byAnalysisType?.[primaryAnalysis] || byAnalysisType[primaryAnalysis]?.cost || 0, selectedCurrency)}
        </span>
      </div>
    );
  }

  // Detailed horizontal card version - Show empty state if no usage
  if (!hasUsage) {
    return (
      <div className="bg-gray-500/10 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-300/30 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Token Sayacı: Henüz analiz yapılmadı
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <>
    <div className="px-3 py-1.5 w-full">
      {/* Single Line Layout */}
      <div className="flex items-center gap-3">
        {/* Icon & Title */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs font-semibold text-cinema-text whitespace-nowrap">
            Token {estimatedTokens > 0 ? `(%${accuracyPercent} doğruluk)` : ''}:
          </span>
        </div>

        {/* Token Count */}
        <div className="flex items-center gap-1 px-2 py-0.5">
          <span className="text-xs font-bold text-cinema-accent">
            {formatTokens(totalTokens)}
          </span>
          {estimatedTokens > 0 && (
            <span className="text-[9px] text-cinema-text-dim">
              / ~{formatTokens(estimatedTokens)}
            </span>
          )}
        </div>

        {/* Cost */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-cinema-text-dim">Maliyet:</span>
          <span className="text-xs font-bold text-green-400">
            {isConverting ? '...' : formatCost(totalCost)}
          </span>
        </div>

        {/* Total Accumulated Cost */}
        {budgetSettings.previousDebt > 0 && (
          <div className="flex items-center gap-1.5 pl-3">
            <span className="text-[10px] text-cinema-text-dim">Toplam Maliyet:</span>
            <span className="text-xs font-bold text-orange-400">
              {isConverting ? '...' : formatCurrency(convertedCosts.totalWithDebt || budgetSettings.previousDebt, selectedCurrency)}
            </span>
          </div>
        )}

        {/* Request Count */}
        <div className="flex items-center gap-1 text-[10px] text-cinema-text-dim">
          <span>({requestCount} istek)</span>
        </div>

        {/* Model Breakdown - Inline */}
        {Object.keys(byModel).length > 0 && (
          <div className="flex items-center gap-1.5 pl-3 ml-auto">
            <span className="text-[10px] text-cinema-text-dim">Model:</span>
            {Object.entries(byModel).map(([model, data]) => (
              <div
                key={model}
                className="inline-flex items-center gap-1 text-[10px] bg-cinema-gray/30 rounded px-1.5 py-0.5 border border-cinema-gray"
              >
                <span className="font-mono text-cinema-text">
                  {model.split('-').slice(0, 2).join('-')}
                </span>
                <span className="text-cinema-text-dim">({formatTokens(data.tokens)})</span>
                <span className="text-green-400 font-semibold">
                  {isConverting ? '...' : formatCurrency(convertedCosts.byModel?.[model] || data.cost, selectedCurrency)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Analysis Type Breakdown - Inline */}
        {Object.keys(byAnalysisType).length > 0 && (
          <div className="flex items-center gap-1.5 pl-3">
            <span className="text-[10px] text-cinema-text-dim">Analiz:</span>
            {Object.entries(byAnalysisType)
              .sort((a, b) => b[1].cost - a[1].cost)
              .slice(0, 3)
              .map(([type, data]) => (
                <div
                  key={type}
                  className="inline-flex items-center gap-1 text-[10px] bg-cinema-gray/30 px-1.5 py-0.5"
                  title={type.replace(/_/g, ' ')}
                >
                  <span className="text-cinema-text capitalize truncate max-w-[60px]">
                    {type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-cinema-text-dim">({formatTokens(data.tokens)})</span>
                  <span className="text-green-400 font-semibold">
                    {isConverting ? '...' : formatCurrency(convertedCosts.byAnalysisType?.[type] || data.cost, selectedCurrency)}
                  </span>
                </div>
              ))}
            {Object.keys(byAnalysisType).length > 3 && (
              <span className="text-[9px] text-cinema-text-dim">+{Object.keys(byAnalysisType).length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
    
    {/* Breakdown Modal */}
    {showBreakdownModal && (
      <BreakdownModal
        sessionUsage={sessionUsage}
        convertedCosts={convertedCosts}
        selectedCurrency={selectedCurrency}
        isConverting={isConverting}
        onClose={() => setShowBreakdownModal(false)}
        budgetSettings={budgetSettings}
      />
    )}
    </>
  );
  
  // Export handler
  function handleExport() {
    try {
      const jsonData = exportTokenUsage();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `token-usage-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('✅ Token usage exported successfully');
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert('Dışa aktarma başarısız: ' + error.message);
    }
  }
  
  // Import handler
  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        
        const text = await file.text();
        const success = importTokenUsage(text);
        
        if (success) {
          alert('✅ Token kullanım verileri başarıyla içe aktarıldı!');
          window.location.reload(); // Refresh to show imported data
        } else {
          alert('❌ İçe aktarma başarısız. Geçersiz dosya formatı.');
        }
      } catch (error) {
        console.error('❌ Import failed:', error);
        alert('İçe aktarma başarısız: ' + error.message);
      }
    };
    input.click();
  }
  
  // Reset handler
  function handleReset() {
    if (confirm('⚠️ Tüm token kullanım istatistiklerini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!')) {
      resetTokenUsage();
      if (onReset) {
        onReset();
      }
      alert('✅ Token kullanım istatistikleri sıfırlandı.');
      window.location.reload();
    }
  }
}

// Breakdown Modal Component
function BreakdownModal({ sessionUsage, convertedCosts, selectedCurrency, isConverting, onClose, budgetSettings }) {
  const { totalTokens, estimatedTokens, byModel, byAnalysisType, requestCount, accuracy = [] } = sessionUsage;
  
  // Calculate accuracy percentage
  const accuracyPercent = accuracy.length > 0 
    ? (accuracy.reduce((sum, item) => sum + (item.actual / item.estimated * 100), 0) / accuracy.length).toFixed(1)
    : 100;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-cinema-dark border border-cinema-gray rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-cinema-accent/20 to-blue-500/20 border-b border-cinema-gray px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-cinema-text flex items-center gap-2">
              <svg className="w-6 h-6 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Token Kullanım Detayları
            </h3>
            <button
              onClick={onClose}
              className="text-cinema-text-dim hover:text-cinema-text transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-cinema-gray/30 rounded-lg p-4 border border-cinema-gray">
              <div className="text-cinema-text-dim text-sm mb-1">Toplam Token</div>
              <div className="text-2xl font-bold text-cinema-accent">{totalTokens.toLocaleString('tr-TR')}</div>
              {estimatedTokens > 0 && (
                <div className="text-xs text-purple-400 mt-1">
                  Tahmini: {estimatedTokens.toLocaleString('tr-TR')} (%{accuracyPercent} doğruluk)
                </div>
              )}
            </div>
            <div className="bg-cinema-gray/30 rounded-lg p-4 border border-cinema-gray">
              <div className="text-cinema-text-dim text-sm mb-1">Program Harcaması</div>
              <div className="text-2xl font-bold text-blue-400">
                {isConverting ? '...' : formatCurrency(convertedCosts?.total || 0, selectedCurrency)}
              </div>
            </div>
            <div className="bg-cinema-gray/30 rounded-lg p-4 border border-red-500/30">
              <div className="text-cinema-text-dim text-sm mb-1">
                Toplam Kullanım Ücreti
              </div>
              <div className="text-2xl font-bold text-red-400">
                {isConverting ? '...' : formatCurrency(
                  budgetSettings.previousDebt + (convertedCosts?.total || 0), 
                  selectedCurrency
                )}
              </div>
            </div>
            {budgetSettings.balanceLimit > 0 && (
              <div className="bg-cinema-gray/30 rounded-lg p-4 border border-cinema-gray">
                <div className="text-cinema-text-dim text-sm mb-1">Kalan Limit</div>
                <div className={`text-2xl font-bold ${
                  (budgetSettings.balanceLimit - budgetSettings.previousDebt - totalCost) < 1 ? 'text-red-400' : 
                  (budgetSettings.balanceLimit - budgetSettings.previousDebt - totalCost) < 10 ? 'text-yellow-400' : 
                  'text-green-400'
                }`}>
                  ${Math.max(0, budgetSettings.balanceLimit - budgetSettings.previousDebt - totalCost).toFixed(2)}
                </div>
              </div>
            )}
            <div className="bg-cinema-gray/30 rounded-lg p-4 border border-cinema-gray">
              <div className="text-cinema-text-dim text-sm mb-1">Toplam İstek</div>
              <div className="text-2xl font-bold text-blue-400">{requestCount}</div>
            </div>
          </div>
          
          {/* Model Breakdown */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-cinema-text mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              Model Bazlı Kullanım
            </h4>
            <div className="space-y-2">
              {Object.entries(byModel).map(([model, data]) => (
                <div key={model} className="bg-cinema-gray/20 rounded p-3 border border-cinema-gray flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-cinema-text font-semibold">{model}</span>
                    <span className="text-xs text-cinema-text-dim">{data.requests} istek</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-cinema-accent">{data.tokens.toLocaleString('tr-TR')} token</span>
                    <span className="text-sm font-bold text-green-400">
                      {isConverting ? '...' : formatCurrency(convertedCosts.byModel?.[model] || data.cost, selectedCurrency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Analysis Type Breakdown */}
          <div>
            <h4 className="text-lg font-semibold text-cinema-text mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Analiz Türü Bazlı Kullanım
            </h4>
            <div className="space-y-2">
              {Object.entries(byAnalysisType)
                .sort((a, b) => b[1].cost - a[1].cost)
                .map(([type, data]) => (
                  <div key={type} className="bg-cinema-gray/20 rounded p-3 border border-cinema-gray flex items-center justify-between">
                    <span className="text-sm text-cinema-text capitalize">{type.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-cinema-accent">{data.tokens.toLocaleString('tr-TR')} token</span>
                      <span className="text-sm font-bold text-green-400">
                        {isConverting ? '...' : formatCurrency(convertedCosts.byAnalysisType?.[type] || data.cost, selectedCurrency)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
