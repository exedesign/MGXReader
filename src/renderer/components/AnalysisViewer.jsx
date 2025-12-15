import React, { useState, useMemo } from 'react';
import DynamicDataTable from './DynamicDataTable';

/**
 * AnalysisViewer - Evrensel Adaptif JSON Görüntüleyici
 * 
 * Özellikler:
 * - Bozuk JSON'ları otomatik onarır
 * - Her veri yapısına uyum sağlar
 * - Tablo/Grid geçişli görünüm
 * - Arama ve filtreleme
 * - Karakter analizi gibi çalışır
 */

// 🔧 JSON Onarım Fonksiyonu
function repairJSON(jsonString) {
  let fixed = jsonString.trim();
  const repairs = [];

  try {
    // 1. Markdown temizliği
    fixed = fixed.replace(/^```json\s*/gi, '').replace(/^```\s*/g, '').replace(/```\s*$/g, '');
    repairs.push('Markdown temizlendi');

    // 2. İlk { veya [ ile son } veya ] arasını al
    const firstBrace = fixed.indexOf('{');
    const firstBracket = fixed.indexOf('[');
    const lastBrace = fixed.lastIndexOf('}');
    const lastBracket = fixed.lastIndexOf(']');
    
    let start = -1, end = -1;
    
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = lastBrace + 1;
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = lastBracket + 1;
    }
    
    if (start !== -1 && end !== -1 && start < end) {
      const original = fixed;
      fixed = fixed.substring(start, end);
      if (fixed !== original) repairs.push('JSON yapısı çıkarıldı');
    }

    // 3. Tek tırnak yerine çift tırnak
    const beforeQuotes = fixed;
    fixed = fixed.replace(/'([^']*)':/g, '"$1":');
    if (fixed !== beforeQuotes) repairs.push('Tırnak işaretleri düzeltildi');
    
    // 4. Sondaki virgülleri temizle
    const beforeCommas = fixed;
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    if (fixed !== beforeCommas) repairs.push('Sondaki virgüller kaldırıldı');
    
    // 5. Key'lere tırnak ekle
    const beforeKeys = fixed;
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    if (fixed !== beforeKeys) repairs.push("Key'lere tırnak eklendi");
    
    // 6. Eksik parantezleri dengele
    const openBraces = (fixed.match(/{/g) || []).length;
    const closeBraces = (fixed.match(/}/g) || []).length;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    
    if (openBraces > closeBraces) {
      fixed += '}'.repeat(openBraces - closeBraces);
      repairs.push(`${openBraces - closeBraces} adet } eklendi`);
    }
    if (openBrackets > closeBrackets) {
      fixed += ']'.repeat(openBrackets - closeBrackets);
      repairs.push(`${openBrackets - closeBrackets} adet ] eklendi`);
    }

    // 7. Test parse
    JSON.parse(fixed);
    
    if (repairs.length > 0) {
      console.log('✅ JSON onarıldı:', repairs.join(', '));
    }
    
    return { success: true, data: fixed, repairs };
    
  } catch (error) {
    console.warn('❌ JSON onarımı başarısız:', error.message);
    return { success: false, data: jsonString, error: error.message };
  }
}

export default function AnalysisViewer({ analysisType, data, outputFormat }) {
  const [viewMode, setViewMode] = useState('card');
  const [searchTerm, setSearchTerm] = useState('');
  const [repairInfo, setRepairInfo] = useState(null);

  // 📊 Akıllı Data Parser
  const parsedData = useMemo(() => {
    // Zaten object/array ise direkt kullan
    if (typeof data === 'object' && data !== null) {
      return { data, success: true };
    }

    // String ise parse et
    if (typeof data === 'string') {
      const trimmed = data.trim();
      
      // JSON benzeri mi kontrol et
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // Önce direkt dene
        try {
          const parsed = JSON.parse(trimmed);
          return { data: parsed, success: true };
        } catch (e) {
          console.warn('Direkt parse başarısız, onarım deneniyor...');
          
          // Onarım dene
          const repairResult = repairJSON(trimmed);
          if (repairResult.success) {
            try {
              const parsed = JSON.parse(repairResult.data);
              setRepairInfo(repairResult.repairs);
              return { data: parsed, success: true, repaired: true };
            } catch (parseError) {
              console.error('Onarılmış JSON parse edilemedi:', parseError);
            }
          }
        }
      }
      
      // JSON değil veya başarısız - metin olarak göster
      return { data: { _text: trimmed }, success: false, isText: true };
    }

    return { data: { _text: String(data || '') }, success: false, isText: true };
  }, [data]);

  // Metin fallback
  if (parsedData.isText) {
    return (
      <div className="p-4 bg-cinema-black rounded-lg border border-cinema-gray/30">
        <div className="flex items-center gap-2 mb-3 text-xs text-zinc-500">
          <span>📄</span>
          <span>Metin Formatı</span>
        </div>
        <pre className="text-cinema-text text-sm whitespace-pre-wrap font-mono overflow-x-auto">
          {parsedData.data._text}
        </pre>
      </div>
    );
  }

  const jsonData = parsedData.data;

  // 🎯 Akıllı Veri Çıkarımı - Herhangi bir yapıyı handle et
  const extractDisplayData = () => {
    // Array ise direkt döndür
    if (Array.isArray(jsonData)) {
      return { items: jsonData, type: 'array' };
    }

    // Object ise içinde array ara
    if (typeof jsonData === 'object') {
      // Bilinen array alanları (alfabetik sırada)
      const arrayFields = [
        'acts', 'characters', 'closeupMediumScenes', 'dialogues', 'elements',
        'exteriorScenesLED', 'heightSuitableScenes', 'locations', 'scenes',
        'shots', 'smallSpaceSolutions', 'suitable17mScenes', 'suitableScenes',
        'themes', 'traditionalSetScenes', 'unreal3DAssets', 'vehicleScenes',
        'windowScenes'
      ];

      for (const field of arrayFields) {
        if (Array.isArray(jsonData[field]) && jsonData[field].length > 0) {
          return { 
            items: jsonData[field], 
            type: 'array',
            parentKey: field,
            metadata: Object.keys(jsonData).filter(k => k !== field).reduce((obj, k) => {
              obj[k] = jsonData[k];
              return obj;
            }, {})
          };
        }
      }

      // Herhangi bir array varsa onu kullan
      for (const key in jsonData) {
        if (Array.isArray(jsonData[key]) && jsonData[key].length > 0) {
          return { 
            items: jsonData[key], 
            type: 'array',
            parentKey: key,
            metadata: Object.keys(jsonData).filter(k => k !== key).reduce((obj, k) => {
              obj[k] = jsonData[k];
              return obj;
            }, {})
          };
        }
      }

      // Array yok, tek object olarak göster
      return { items: [jsonData], type: 'single' };
    }

    // Primitive type
    return { items: [{ value: jsonData }], type: 'primitive' };
  };

  const displayData = extractDisplayData();
  const { items, metadata, parentKey } = displayData;

  // Arama filtresi
  const filteredItems = searchTerm 
    ? items.filter(item => {
        const str = JSON.stringify(item).toLowerCase();
        return str.includes(searchTerm.toLowerCase());
      })
    : items;

  return (
    <div className="space-y-4 bg-cinema-black p-6 rounded-lg border border-cinema-gray/30">
      {/* Onarım bildirimi */}
      {repairInfo && repairInfo.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs">
          <div className="flex items-center gap-2 text-yellow-400 font-semibold mb-1">
            <span>🔧</span>
            <span>JSON Otomatik Onarıldı</span>
          </div>
          <div className="text-zinc-400 space-y-0.5">
            {repairInfo.map((repair, idx) => (
              <div key={idx}>• {repair}</div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-4 border-b border-cinema-gray/40">
        <div className="flex items-center gap-3">
          <div className="bg-cinema-gray/50 w-12 h-12 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-2xl">📊</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">
              {parentKey ? parentKey.replace(/([A-Z])/g, ' $1').trim() : 'Analiz Sonuçları'}
            </h3>
            <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
              <span className="font-semibold text-cinema-accent">{filteredItems.length}</span>
              <span>kayıt görüntüleniyor</span>
              {metadata && Object.keys(metadata).length > 0 && (
                <>
                  <span className="text-zinc-700">•</span>
                  <span>{Object.keys(metadata).length} meta alan</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔍</span>
            <input
              type="text"
              placeholder="Veri içinde ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-cinema-gray border border-cinema-gray-light rounded-lg focus:ring-2 focus:ring-cinema-accent/50 focus:border-cinema-accent outline-none transition-all text-cinema-text placeholder-zinc-600 text-sm"
            />
          </div>

          {/* View toggle */}
          <div className="flex bg-cinema-gray p-1 rounded-lg border border-cinema-gray-light shadow-sm">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2.5 rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-cinema-accent text-cinema-black shadow-md'
                  : 'text-zinc-600 hover:text-cinema-text hover:bg-cinema-gray-light'
              }`}
              title="Tablo Görünümü"
            >
              <span className="text-base">📋</span>
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-2.5 rounded-md transition-all ${
                viewMode === 'card'
                  ? 'bg-cinema-accent text-cinema-black shadow-md'
                  : 'text-zinc-600 hover:text-cinema-text hover:bg-cinema-gray-light'
              }`}
              title="Kart Görünümü"
            >
              <span className="text-base">🎴</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metadata gösterimi */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div className="pb-4 border-b border-cinema-gray/40">
          <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>📦</span>
            <span>Meta Veriler</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(metadata).slice(0, 8).map(([key, value]) => (
              <div 
                key={key} 
                className="bg-cinema-gray/50 p-4 rounded-lg border border-cinema-gray-light hover:border-cinema-accent/30 transition-colors"
              >
                <div className="text-[10px] text-zinc-600 mb-2 uppercase tracking-widest font-bold">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className="text-base font-mono font-bold text-cinema-accent truncate" title={typeof value === 'object' ? JSON.stringify(value) : String(value)}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      {viewMode === 'table' ? (
        <SmartTable data={filteredItems} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item, index) => (
            <UniversalCard key={index} data={item} index={index} />
          ))}
        </div>
      )}

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <div className="text-4xl mb-2">🔍</div>
          <div>Sonuç bulunamadı</div>
        </div>
      )}
    </div>
  );
}

// 📋 Akıllı Tablo Bileşeni
function SmartTable({ data }) {
  if (!data || data.length === 0) return null;

  // İlk öğeden primitive (non-object) alanları çıkar
  const firstItem = data[0];
  const columns = Object.keys(firstItem).filter(key => {
    const val = firstItem[key];
    // Sadece string, number, boolean göster - array/object atla
    return typeof val !== 'object' || val === null;
  });

  if (columns.length === 0) {
    // Hiç primitive alan yoksa DynamicDataTable'a fallback
    return (
      <DynamicDataTable
        data={data}
        showRowNumbers={true}
        maxChipsPerCell={5}
      />
    );
  }

  return (
    <div className="bg-cinema-gray/30 rounded-xl border border-cinema-gray-light overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-cinema-black border-b border-cinema-gray-light">
            <tr>
              <th className="px-4 py-3 font-semibold text-zinc-600 uppercase text-[10px] tracking-wider">#</th>
              {columns.map((col) => (
                <th key={col} className="px-6 py-4 font-semibold text-zinc-500 uppercase text-xs tracking-wider whitespace-nowrap">
                  {col.replace(/([A-Z])/g, ' $1').trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-cinema-gray-light/50">
            {data.map((item, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-cinema-gray-light/30 transition-colors">
                <td className="px-4 py-3 text-zinc-600 text-xs font-mono">
                  {rowIdx + 1}
                </td>
                {columns.map((col, cellIdx) => {
                  const val = item[col];
                  const isFirstCol = cellIdx === 0;
                  
                  // Kısa değerleri badge yap
                  const shouldBeBadge = 
                    (typeof val === 'string' && val.length < 30) &&
                    (col.toLowerCase().includes('type') || 
                     col.toLowerCase().includes('role') || 
                     col.toLowerCase().includes('status') ||
                     col.toLowerCase().includes('int') ||
                     col.toLowerCase().includes('ext') ||
                     col.toLowerCase().includes('time'));
                  
                  return (
                    <td 
                      key={cellIdx} 
                      className={`px-6 py-4 max-w-xs ${isFirstCol ? 'font-medium text-cinema-text' : 'text-cinema-text-dim'}`}
                    >
                      {shouldBeBadge ? (
                        <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wide border font-semibold ${getBadgeColor(col, val)}`}>
                          {val}
                        </span>
                      ) : (
                        <span className={typeof val === 'number' ? 'font-mono' : ''}>
                          {val !== null && val !== undefined ? String(val) : '-'}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 🎨 Akıllı Badge Renklendirici
function getBadgeColor(key, val) {
  const s = String(val).toLowerCase();
  const k = key.toLowerCase();
  
  // Pozitif/Tamamlanmış durumlar - Yeşil
  if (s === 'main' || s === 'ana' || s === 'completed' || s === 'tamamlandı' || s === 'true' || s === 'evet') {
    return 'bg-green-500/20 text-green-400 border-green-500/40';
  }
  
  // Kısmi/Destekleyici durumlar - Sarı
  if (s === 'supporting' || s === 'destekleyici' || s === 'partial' || s === 'kısmi' || s === 'false' || s === 'hayır') {
    return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40';
  }
  
  // İç/Dış mekan - Mavi
  if (s === 'interior' || s === 'iç' || s === 'içeri' || k.includes('int')) {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
  }
  if (s === 'exterior' || s === 'dış' || s === 'dışarı' || k.includes('ext')) {
    return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
  }
  
  // Sayısal değerler - Cyan
  if (typeof val === 'number') {
    return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
  }
  
  // Zaman durumları - Turuncu
  if (s === 'day' || s === 'gündüz' || s === 'gün' || s === 'night' || s === 'gece') {
    return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
  }
  
  // Varsayılan - Gri
  return 'bg-cinema-accent/20 text-cinema-accent border-cinema-accent/40';
}

// 🎴 Evrensel Kart Bileşeni - Her veri tipini handle eder
function UniversalCard({ data, index }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!data || typeof data !== 'object') {
    return (
      <div className="bg-cinema-gray border border-cinema-gray-light rounded-lg p-4">
        <div className="text-cinema-text text-sm">{String(data)}</div>
      </div>
    );
  }

  // Tüm alanları çıkar
  const fields = Object.entries(data);
  
  // Başlık alanı bul (öncelik sırasına göre - heuristic yaklaşım)
  const titleFields = ['title', 'name', 'theme', 'location', 'scene', 'sceneTitle', 'sceneNumber', 'number', 'item'];
  const titleEntry = fields.find(([key]) => titleFields.includes(key)) || fields[0];
  const titleKey = titleEntry ? titleEntry[0] : null;
  const title = titleEntry ? titleEntry[1] : 'Öğe ' + (index + 1);

  // Badge alanları (kısa string ve number - array ve object olmayan)
  const badgeFields = fields.filter(([key, val]) => {
    if (key === titleKey) return false; // Başlığı tekrar gösterme
    if (Array.isArray(val) || (typeof val === 'object' && val !== null)) return false; // Array/Object atla
    if (val === null || val === undefined) return false;
    
    // Kısa string veya number kabul et
    if (typeof val === 'string' && val.length <= 50) return true;
    if (typeof val === 'number') return true;
    if (typeof val === 'boolean') return true;
    
    return false;
  }).slice(0, 6);

  // Açıklama alanları (orta uzunlukta text)
  const descFields = fields.filter(([key, val]) => {
    if (key === titleKey) return false;
    return typeof val === 'string' && val.length > 50 && val.length <= 500;
  }).slice(0, 2);
  
  // Çok uzun text alanları (content, description vb.)
  const longTextFields = fields.filter(([key, val]) => {
    if (key === titleKey) return false;
    return typeof val === 'string' && val.length > 500;
  }).slice(0, 1);
  
  // Alt array/object varlığını kontrol et
  const hasNestedData = fields.some(([key, val]) => Array.isArray(val) && val.length > 0);

  return (
    <div className="bg-cinema-gray border border-cinema-gray-light rounded-xl hover:border-cinema-accent/50 hover:shadow-lg hover:shadow-cinema-accent/5 transition-all flex flex-col overflow-hidden">
      {/* Kart Başlığı */}
      <div className="p-4 border-b border-cinema-gray-light bg-cinema-gray/50">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
            #{index + 1}
          </span>
          {titleKey && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cinema-black/50 text-zinc-600 uppercase tracking-wider">
              {titleKey}
            </span>
          )}
        </div>
        <h4 className="text-base font-bold text-cinema-text line-clamp-2 leading-snug">
          {String(title)}
        </h4>
      </div>

      {/* Kart İçeriği */}
      <div className="p-4 space-y-3 flex-1">
        {/* Badge Alanları */}
        {badgeFields.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badgeFields.map(([key, val]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold px-1">
                  {key}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium border ${getBadgeColor(key, val)}`}>
                  {String(val)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Orta Uzunlukta Açıklamalar */}
        {descFields.map(([key, val]) => (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
              {key}
            </span>
            <p className="text-sm text-cinema-text-dim leading-relaxed border-l-2 border-cinema-accent/30 pl-3 line-clamp-3">
              {String(val)}
            </p>
          </div>
        ))}
        
        {/* Uzun Text Alanları (collapsed) */}
        {!isExpanded && longTextFields.map(([key, val]) => (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
              {key}
            </span>
            <p className="text-sm text-cinema-text-dim leading-relaxed line-clamp-2 opacity-75">
              {String(val).substring(0, 100)}...
            </p>
          </div>
        ))}

        {/* Alt Veri Uyarısı */}
        {hasNestedData && !isExpanded && (
          <div className="mt-3 pt-3 border-t border-cinema-gray-light flex items-center gap-2 text-xs text-cinema-accent/70">
            <span className="text-base">📦</span>
            <span>Alt veriler mevcut (Tablo görünümünde detaylı inceleyin)</span>
          </div>
        )}
      </div>

      {/* Footer - Expand Button */}
      <div className="p-3 border-t border-cinema-gray-light bg-cinema-black/20">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-xs text-cinema-accent hover:text-cinema-accent/80 font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span>{isExpanded ? '▲' : '▼'}</span>
          <span>{isExpanded ? 'Kapat' : 'Tüm Detayları Göster'}</span>
        </button>
      </div>

      {/* Expanded JSON View */}
      {isExpanded && (
        <div className="p-4 border-t border-cinema-gray-light bg-cinema-black/30">
          {/* Uzun text alanlarını göster */}
          {longTextFields.map(([key, val]) => (
            <div key={key} className="mb-4">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold block mb-2">
                {key}
              </span>
              <p className="text-sm text-cinema-text-dim leading-relaxed border-l-2 border-cinema-accent/30 pl-3">
                {String(val)}
              </p>
            </div>
          ))}
          
          {/* Raw JSON */}
          <details className="mt-3">
            <summary className="text-xs text-zinc-600 cursor-pointer hover:text-cinema-accent mb-2">
              🔍 Ham JSON Görüntüle
            </summary>
            <pre className="text-xs text-cinema-text-dim whitespace-pre-wrap font-mono max-h-96 overflow-y-auto bg-cinema-black/50 p-3 rounded border border-cinema-gray-light">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
