import React, { useState } from 'react';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import { AI_PROVIDERS, AIHandler, OPENAI_MODELS, GEMINI_MODELS, MLX_MODELS } from '../utils/aiHandler';
import { CURRENCIES, getSavedCurrencyPreference, saveCurrencyPreference } from '../utils/currencyConverter';
import ProvidersTab from './ProvidersTab';
import PromptsTab from './PromptsTab';
import TokenUsageDisplay from './TokenUsageDisplay';
import { getBudgetSettings, saveBudgetSettings } from '../utils/budgetAlarm';

export default function AISettings({ onClose, initialTab = 'prompts' }) {
  const {
    provider,
    openaiApiKey,
    openaiModel,
    geminiApiKey,
    geminiModel,
    localEndpoint,
    localModel,
    localTemperature,
    mlxEndpoint,
    mlxModel,
    mlxTemperature,
    temperature,
    setProvider,
    setOpenAIConfig,
    setGeminiConfig,
    setLocalConfig,
    setMLXConfig,
    setTemperature,
    getCurrentConfig,
    isConfigured,
  } = useAIStore();

  const {
    getPromptTypes,
    getPrompt,
    getAllPrompts,
    saveCustomPrompt,
    deleteCustomPrompt,
    setActivePrompt,
    activePrompts,
    defaultPrompts,
    exportAllPrompts,
    exportCategory,
    importPrompts,
    getCategories
  } = usePromptStore();

  const [testStatus, setTestStatus] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab); // 'providers' veya 'prompts'
  const [budgetSettings, setBudgetSettings] = useState(getBudgetSettings());

  // Local state for form inputs
  const [localOpenAIKey, setLocalOpenAIKey] = useState(openaiApiKey);
  const [localOpenAIModel, setLocalOpenAIModel] = useState(openaiModel);
  const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey);
  const [localGeminiModel, setLocalGeminiModel] = useState(geminiModel);
  const [localEndpointInput, setLocalEndpointInput] = useState(localEndpoint);
  const [localModelInput, setLocalModelInput] = useState(localModel);
  const [localTempInput, setLocalTempInput] = useState(localTemperature);
  const [mlxEndpointInput, setMLXEndpointInput] = useState(mlxEndpoint);
  const [mlxModelInput, setMLXModelInput] = useState(mlxModel);
  const [mlxTempInput, setMLXTempInput] = useState(mlxTemperature);

  const handleSave = () => {
    switch (provider) {
      case AI_PROVIDERS.OPENAI:
        setOpenAIConfig(localOpenAIKey, localOpenAIModel);
        break;
      case AI_PROVIDERS.GEMINI:
        setGeminiConfig(localGeminiKey, localGeminiModel);
        break;
      case AI_PROVIDERS.LOCAL:
        setLocalConfig(localEndpointInput, localModelInput, localTempInput);
        break;
      case AI_PROVIDERS.MLX:
        setMLXConfig(mlxEndpointInput, mlxModelInput, mlxTempInput);
        break;
    }
    onClose();
  };

  // Currency Selector Component
  const CurrencySelector = () => {
    const [selectedCurrency, setSelectedCurrency] = useState(getSavedCurrencyPreference());

    const handleCurrencyChange = (currency) => {
      setSelectedCurrency(currency);
      saveCurrencyPreference(currency);
      // Force reload to update displays
      window.location.reload();
    };

    return (
      <div className="flex items-center gap-3">
        {Object.entries(CURRENCIES).map(([code, info]) => (
          <button
            key={code}
            onClick={() => handleCurrencyChange(code)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
              selectedCurrency === code
                ? 'border-cinema-accent bg-cinema-accent/10 text-cinema-accent'
                : 'border-cinema-gray hover:border-cinema-accent/50 text-cinema-text-dim hover:text-cinema-text'
            }`}
          >
            <span className="text-xl">{info.symbol}</span>
            <div className="text-left">
              <div className="font-semibold text-sm">{code}</div>
              <div className="text-[10px] opacity-70">{info.name}</div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestStatus(null);

    try {
      let testConfig;

      switch (provider) {
        case AI_PROVIDERS.OPENAI:
          testConfig = {
            provider,
            openaiApiKey: localOpenAIKey,
            model: localOpenAIModel,
            temperature
          };
          break;
        case AI_PROVIDERS.GEMINI:
          console.log('🔍 Gemini Test Debug:', {
            provider,
            localGeminiKey: localGeminiKey ? localGeminiKey.substring(0, 8) + '...' : 'none',
            localGeminiModel,
            storeGeminiModel: geminiModel,
            temperature,
            maxTokens,
          });
          testConfig = {
            provider,
            geminiApiKey: localGeminiKey,
            model: localGeminiModel,
            temperature
          };
          break;
        case AI_PROVIDERS.LOCAL:
          testConfig = {
            provider,
            localEndpoint: localEndpointInput,
            model: localModelInput,
            temperature: localTempInput
          };
          break;
        case AI_PROVIDERS.MLX:
          testConfig = {
            provider,
            mlxEndpoint: mlxEndpointInput,
            model: mlxModelInput,
            temperature: mlxTempInput
          };
          break;
        default:
          throw new Error('Unsupported provider');
      }

      const handler = new AIHandler(testConfig);
      const result = await handler.testConnection();

      setTestStatus(result);
    } catch (error) {
      setTestStatus({
        success: false,
        error: error.message,
        provider,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div 
        className="bg-cinema-dark border border-cinema-gray rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl relative z-[10000]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-cinema-accent flex items-center gap-2">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                AI Configuration
              </h2>
              <p className="text-sm text-cinema-text-dim mt-1">
                Configure AI providers and customize analysis prompts
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-cinema-text-dim hover:text-white transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-1 bg-cinema-bg rounded-lg p-1">
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'providers'
                  ? 'bg-cinema-accent text-black'
                  : 'text-cinema-text-dim hover:text-white hover:bg-cinema-gray'
              }`}
            >
              AI Providers
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'prompts'
                  ? 'bg-cinema-accent text-black'
                  : 'text-cinema-text-dim hover:text-white hover:bg-cinema-gray'
              }`}
            >
              AI Analiz Ayarları
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'usage'
                  ? 'bg-cinema-accent text-black'
                  : 'text-cinema-text-dim hover:text-white hover:bg-cinema-gray'
              }`}
            >
              Token Kullanımı
            </button>
            <button
              onClick={() => setActiveTab('budget')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'budget'
                  ? 'bg-cinema-accent text-black'
                  : 'text-cinema-text-dim hover:text-white hover:bg-cinema-gray'
              }`}
            >
              💰 Bütçe Limitleri
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'providers' && (
            <ProvidersTab 
              provider={provider}
              setProvider={setProvider}
              localOpenAIKey={localOpenAIKey}
              setLocalOpenAIKey={setLocalOpenAIKey}
              localOpenAIModel={localOpenAIModel}
              setLocalOpenAIModel={setLocalOpenAIModel}
              localGeminiKey={localGeminiKey}
              setLocalGeminiKey={setLocalGeminiKey}
              localGeminiModel={localGeminiModel}
              setLocalGeminiModel={setLocalGeminiModel}
              localEndpointInput={localEndpointInput}
              setLocalEndpointInput={setLocalEndpointInput}
              localModelInput={localModelInput}
              setLocalModelInput={setLocalModelInput}
              localTempInput={localTempInput}
              setLocalTempInput={setLocalTempInput}
              mlxEndpointInput={mlxEndpointInput}
              setMLXEndpointInput={setMLXEndpointInput}
              mlxModelInput={mlxModelInput}
              setMLXModelInput={setMLXModelInput}
              mlxTempInput={mlxTempInput}
              setMLXTempInput={setMLXTempInput}
              temperature={temperature}
              setTemperature={setTemperature}
              handleTest={handleTest}
              isTesting={isTesting}
              testStatus={testStatus}
            />
          )}
          
          {activeTab === 'prompts' && (
            <PromptsTab 
              getPromptTypes={getPromptTypes}
              getPrompt={getPrompt}
              getAllPrompts={getAllPrompts}
              saveCustomPrompt={saveCustomPrompt}
              deleteCustomPrompt={deleteCustomPrompt}
              setActivePrompt={setActivePrompt}
              activePrompts={activePrompts}
              defaultPrompts={defaultPrompts}
              exportAllPrompts={exportAllPrompts}
              exportCategory={exportCategory}
              importPrompts={importPrompts}
              getCategories={getCategories}
            />
          )}

          {activeTab === 'usage' && (
            <div className="space-y-6">
              <div className="bg-cinema-gray rounded-lg p-6">
                <h3 className="text-lg font-semibold text-cinema-accent mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Token Kullanımı ve Maliyet Takibi
                </h3>
                <p className="text-sm text-cinema-text-dim mb-6">
                  Oturum boyunca yapılan API isteklerinin token kullanımı ve maliyeti burada gösterilir. 
                  Sayaç bellekte tutulur ve uygulama kapatılıp açıldığında devam eder.
                </p>

                {/* Currency Selection */}
                <div className="mb-6 p-4 bg-cinema-dark rounded-lg border border-cinema-gray">
                  <h4 className="text-sm font-semibold text-cinema-accent mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Para Birimi Tercihi
                  </h4>
                  <p className="text-xs text-cinema-text-dim mb-3">
                    Maliyet gösteriminde kullanılacak para birimini seçin. Kurlar güncel API'den otomatik çekilir.
                  </p>
                  <CurrencySelector />
                </div>
                <div className="mt-3 text-[10px] text-cinema-text-dim flex items-center gap-1">

                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Kurlar günlük olarak güncellenir ve tarayıcıda 24 saat boyunca cache'lenir
                  </div>
                </div>

                {/* Token Usage Display */}
                <div className="mb-6">
                  {(() => {
                    const saved = localStorage.getItem('mgxreader_token_usage');
                    if (!saved) {
                      return (
                        <div className="text-center py-12 bg-cinema-dark rounded-lg border border-cinema-gray">
                          <svg className="w-12 h-12 mx-auto text-cinema-text-dim mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-cinema-text-dim">Henüz token kullanımı yok</p>
                          <p className="text-xs text-cinema-text-dim mt-2">Analiz yaptıkça burası güncellenecek</p>
                        </div>
                      );
                    }

                    const usage = JSON.parse(saved);
                    
                    return (
                      <div className="bg-cinema-dark rounded-lg p-4">
                        <TokenUsageDisplay 
                          sessionUsage={usage} 
                          showDetailed={true}
                          currency={getSavedCurrencyPreference()}
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* Reset Button */}
                <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <div>
                    <h4 className="text-sm font-semibold text-red-400 mb-1">Sayacı Sıfırla</h4>
                    <p className="text-xs text-cinema-text-dim">
                      Tüm token kullanımı ve maliyet verilerini temizle
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Token kullanım sayacını sıfırlamak istediğinize emin misiniz?\n\nBu işlem geri alınamaz.')) {
                        localStorage.removeItem('mgxreader_token_usage');
                        alert('✅ Token sayacı sıfırlandı!\n\nYeni analizlerle sayaç yeniden başlayacak.');
                        window.location.reload(); // Refresh to update display
                      }
                    }}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors border border-red-500/30 font-medium text-sm"
                  >
                    🗑️ Sıfırla
                  </button>
                </div>

                {/* Info Box */}
                <div className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Bilgilendirme
                  </h4>
                  <ul className="text-xs text-cinema-text-dim space-y-1">

                    <li>• Cache kullanımı normal fiyatın yaklaşık %10'u kadardır</li>
                    <li>• Tüm maliyetler USD cinsinden gösterilir</li>
                    <li>• Sayaç localStorage'da saklanır ve tarayıcı geçmişi temizlenene kadar kalır</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {/* Budget Limits Tab */}
          {activeTab === 'budget' && (
            <div className="space-y-6">
              <div className="bg-cinema-gray/20 rounded-lg p-6 border border-cinema-gray">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-yellow-500/10 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-cinema-text">Bütçe Limitleri & Uyarılar</h3>
                    <p className="text-sm text-cinema-text-dim">Harcama limitlerini belirleyin ve uyarı alın</p>
                  </div>
                </div>

                {/* Previous Debt Entry */}
                <div className="mb-6 p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <label className="block text-sm font-medium text-cinema-text mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Önceki API Borcunuz (USD)</span>
                    </div>
                    <div className="text-xs text-cinema-text-dim">
                      Bu programı kullanmadan önce API'de harcadığınız tutar (örn: 400.00)
                    </div>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Örn: 400.00"
                      value={budgetSettings.previousDebt || ''}
                      onChange={(e) => {
                        const newSettings = { 
                          ...budgetSettings, 
                          previousDebt: parseFloat(e.target.value) || 0,
                          debtSetDate: new Date().toISOString()
                        };
                        setBudgetSettings(newSettings);
                      }}
                      className="flex-1 px-4 py-2 bg-cinema-dark border border-cinema-gray rounded-lg text-cinema-text focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button
                      onClick={() => saveBudgetSettings(budgetSettings)}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                    >
                      Kaydet
                    </button>
                  </div>
                  {budgetSettings.debtSetDate && (
                    <div className="mt-2 text-xs text-cinema-text-dim">
                      Kayıt tarihi: {new Date(budgetSettings.debtSetDate).toLocaleString('tr-TR')}
                    </div>
                  )}
                </div>

                {/* Balance Limit (Optional) */}
                <div className="mb-6 p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <label className="block text-sm font-medium text-cinema-text mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Maksimum Harcama Limiti (USD) - Opsiyonel</span>
                    </div>
                    <div className="text-xs text-cinema-text-dim">
                      Toplam harcama bu limite ulaşınca uyarı alırsınız (boş = limitsiz)
                    </div>
                  </label>
                  <input
                    type="number"
                    step="1.00"
                    min="0"
                    placeholder="Örn: 500.00 (boş = limitsiz)"
                    value={budgetSettings.balanceLimit || ''}
                    onChange={(e) => {
                      const newSettings = { ...budgetSettings, balanceLimit: parseFloat(e.target.value) || 0 };
                      setBudgetSettings(newSettings);
                      saveBudgetSettings(newSettings);
                    }}
                    className="w-full px-4 py-2 bg-cinema-dark border border-cinema-gray rounded-lg text-cinema-text focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Enable/Disable Budget Tracking */}
                <div className="mb-6 p-4 bg-cinema-dark/50 rounded-lg border border-cinema-gray">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={budgetSettings.enabled}
                      onChange={(e) => {
                        const newSettings = { ...budgetSettings, enabled: e.target.checked };
                        setBudgetSettings(newSettings);
                        saveBudgetSettings(newSettings);
                      }}
                      className="w-5 h-5 rounded border-cinema-gray text-cinema-accent focus:ring-cinema-accent focus:ring-offset-cinema-dark"
                    />
                    <div>
                      <div className="text-cinema-text font-medium">Bütçe takibini etkinleştir</div>
                      <div className="text-xs text-cinema-text-dim">Harcama limitlerini aştığınızda uyarı alın</div>
                    </div>
                  </label>
                </div>

                {/* Budget Limits */}
                <div className={`space-y-4 ${!budgetSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  {/* Daily Limit */}
                  <div className="p-4 bg-cinema-dark/30 rounded-lg border border-cinema-gray">
                    <label className="block text-sm font-medium text-cinema-text mb-2">
                      Günlük Limit (USD)
                    </label>
                    <input
                      type="number"
                      step="0.10"
                      min="0.10"
                      value={budgetSettings.dailyLimit}
                      onChange={(e) => {
                        const newSettings = { ...budgetSettings, dailyLimit: parseFloat(e.target.value) || 0 };
                        setBudgetSettings(newSettings);
                        saveBudgetSettings(newSettings);
                      }}
                      className="w-full px-4 py-2 bg-cinema-dark border border-cinema-gray rounded-lg text-cinema-text focus:border-cinema-accent focus:outline-none"
                    />
                    <p className="text-xs text-cinema-text-dim mt-1">Günlük maksimum harcama limiti</p>
                  </div>

                  {/* Weekly Limit */}
                  <div className="p-4 bg-cinema-dark/30 rounded-lg border border-cinema-gray">
                    <label className="block text-sm font-medium text-cinema-text mb-2">
                      Haftalık Limit (USD)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0.50"
                      value={budgetSettings.weeklyLimit}
                      onChange={(e) => {
                        const newSettings = { ...budgetSettings, weeklyLimit: parseFloat(e.target.value) || 0 };
                        setBudgetSettings(newSettings);
                        saveBudgetSettings(newSettings);
                      }}
                      className="w-full px-4 py-2 bg-cinema-dark border border-cinema-gray rounded-lg text-cinema-text focus:border-cinema-accent focus:outline-none"
                    />
                    <p className="text-xs text-cinema-text-dim mt-1">Haftalık maksimum harcama limiti</p>
                  </div>

                  {/* Monthly Limit */}
                  <div className="p-4 bg-cinema-dark/30 rounded-lg border border-cinema-gray">
                    <label className="block text-sm font-medium text-cinema-text mb-2">
                      Aylık Limit (USD)
                    </label>
                    <input
                      type="number"
                      step="1.00"
                      min="1.00"
                      value={budgetSettings.monthlyLimit}
                      onChange={(e) => {
                        const newSettings = { ...budgetSettings, monthlyLimit: parseFloat(e.target.value) || 0 };
                        setBudgetSettings(newSettings);
                        saveBudgetSettings(newSettings);
                      }}
                      className="w-full px-4 py-2 bg-cinema-dark border border-cinema-gray rounded-lg text-cinema-text focus:border-cinema-accent focus:outline-none"
                    />
                    <p className="text-xs text-cinema-text-dim mt-1">Aylık maksimum harcama limiti</p>
                  </div>

                  {/* Warning Threshold */}
                  <div className="p-4 bg-cinema-dark/30 rounded-lg border border-cinema-gray">
                    <label className="block text-sm font-medium text-cinema-text mb-2">
                      Uyarı Eşiği (%)
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="50"
                        max="100"
                        step="5"
                        value={budgetSettings.warningThreshold}
                        onChange={(e) => {
                          const newSettings = { ...budgetSettings, warningThreshold: parseInt(e.target.value) };
                          setBudgetSettings(newSettings);
                          saveBudgetSettings(newSettings);
                        }}
                        className="flex-1"
                      />
                      <span className="text-cinema-accent font-bold text-lg w-16 text-right">
                        %{budgetSettings.warningThreshold}
                      </span>
                    </div>
                    <p className="text-xs text-cinema-text-dim mt-1">
                      Limite bu yüzdeye ulaşıldığında uyarı gösterilir
                    </p>
                  </div>
                </div>

                {/* Info Box */}
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-blue-300">
                      <p className="font-semibold mb-2">Bütçe takibi nasıl çalışır?</p>
                      <ul className="space-y-1 text-xs">
                        <li>• Harcamalarınız günlük, haftalık ve aylık olarak takip edilir</li>
                        <li>• Belirlediğiniz limite yaklaştığınızda uyarı alırsınız</li>
                        <li>• Limit aşıldığında işlemler otomatik olarak durdurulmaz, sadece uyarı görürsünüz</li>
                        <li>• Haftalık periyot Pazartesi gününden başlar</li>
                        <li>• Aylık periyot her ayın 1'inde sıfırlanır</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-cinema-dark border-t border-cinema-gray p-6 flex justify-between items-center">
          <div className="text-xs text-cinema-text-dim">
            {isConfigured() ? (
              <span className="flex items-center gap-2 text-green-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Configuration complete
              </span>
            ) : (
              <span className="text-yellow-400">⚠️ Please configure your AI provider</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            {activeTab === 'providers' && (
              <button onClick={handleSave} className="btn-primary">
                Save Settings
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}