import React from 'react';
import PropTypes from 'prop-types';

/**
 * 🎯 DYNAMIC DATA TABLE - Generic Analiz Raporu Bileşeni
 * 
 * Özellikler:
 * - JSON verisinden otomatik sütun oluşturma
 * - Tip bazlı akıllı hücre renderlama
 * - Dark mode tasarım dili
 * - Yüksek kontrast, okunabilir
 * - Tamamen generic - herhangi bir veri tipini destekler
 */

const DynamicDataTable = ({ 
  data = [], 
  columnMapping = {},
  maxChipsPerCell = 5,
  className = '',
  showRowNumbers = true,
  compactMode = false
}) => {
  
  // Veri yoksa boş state göster
  if (!data || data.length === 0) {
    return (
      <div className="bg-cinema-black/50 rounded-lg p-8 text-center border border-cinema-gray/30">
        <div className="text-cinema-text-dim text-sm">📊 Görüntülenecek veri yok</div>
      </div>
    );
  }

  // Dinamik sütunları belirle (ilk elemandan)
  const columns = Object.keys(data[0] || {});

  /**
   * 🎨 Sütun başlığını güzelleştir
   * 1. Önce columnMapping'e bak
   * 2. Yoksa key'i human-readable yap
   */
  const getColumnLabel = (key) => {
    if (columnMapping[key]) return columnMapping[key];
    
    // snake_case -> Title Case
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  /**
   * 🧠 Veri tipini akıllıca belirle
   */
  const detectType = (value) => {
    if (value === null || value === undefined) return 'empty';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string') {
      // Kısa string (INT, EXT, GÜNDÜZ gibi) vs uzun text
      if (value.length <= 30 && !value.includes('\n')) return 'short-string';
      return 'long-string';
    }
    return 'unknown';
  };

  /**
   * 🎨 Array -> Chip/Badge Renderer
   */
  const renderArrayCell = (items) => {
    if (!items || items.length === 0) return <span className="text-cinema-text-dim text-xs">-</span>;
    
    const displayItems = items.slice(0, maxChipsPerCell);
    const remaining = items.length - maxChipsPerCell;

    return (
      <div className="flex flex-wrap gap-1.5">
        {displayItems.map((item, idx) => (
          <span 
            key={idx}
            className="inline-flex items-center px-2.5 py-1 bg-cinema-accent/20 text-cinema-accent rounded-full text-xs font-medium border border-cinema-accent/30 hover:bg-cinema-accent/30 transition-colors"
          >
            {typeof item === 'object' ? item.name || JSON.stringify(item) : String(item)}
          </span>
        ))}
        {remaining > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 bg-cinema-gray/30 text-cinema-text-dim rounded-full text-xs font-medium">
            +{remaining}
          </span>
        )}
      </div>
    );
  };

  /**
   * 🎨 Short String -> Status Label Renderer
   */
  const renderShortString = (value) => {
    // Durum bazlı renkler (akıllı renklendirme)
    let colorClass = 'bg-cinema-gray/30 text-cinema-text border-cinema-gray';
    
    const upperValue = String(value).toUpperCase();
    
    // İÇ/DIŞ için özel renkler
    if (upperValue === 'İÇ' || upperValue === 'INT' || upperValue === 'INTERIOR') {
      colorClass = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    } else if (upperValue === 'DIŞ' || upperValue === 'EXT' || upperValue === 'EXTERIOR') {
      colorClass = 'bg-green-500/20 text-green-400 border-green-500/30';
    }
    // Zaman için özel renkler
    else if (['GÜNDÜZ', 'DAY', 'SABAH', 'MORNING'].includes(upperValue)) {
      colorClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    } else if (['GECE', 'NIGHT', 'AKŞAM', 'EVENING'].includes(upperValue)) {
      colorClass = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    }
    // Süre için özel renkler
    else if (['KISA', 'SHORT', 'ORTA', 'MEDIUM', 'UZUN', 'LONG'].includes(upperValue)) {
      colorClass = 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    }

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold border ${colorClass}`}>
        {value}
      </span>
    );
  };

  /**
   * 🎨 Number -> Progress Bar Renderer (opsiyonel)
   */
  const renderNumber = (value, key) => {
    // Eğer key'de "progress", "percent", "score" gibi kelimeler varsa progress bar göster
    const showProgress = /progress|percent|score|rating/i.test(key);
    
    if (showProgress && value >= 0 && value <= 100) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-cinema-gray/30 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-cinema-accent h-full rounded-full transition-all duration-300"
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="text-cinema-text text-xs font-mono min-w-[3rem] text-right">{value}%</span>
        </div>
      );
    }

    return <span className="text-cinema-text text-sm font-mono">{value}</span>;
  };

  /**
   * 🎨 Long String -> Paragraph Renderer
   */
  const renderLongString = (value) => {
    return (
      <div className="text-cinema-text text-sm leading-relaxed whitespace-pre-wrap">
        {value.length > 200 ? (
          <details className="cursor-pointer">
            <summary className="text-cinema-accent hover:text-cinema-accent-light">
              {value.substring(0, 200)}... <span className="text-xs">(devamını göster)</span>
            </summary>
            <div className="mt-2 pt-2 border-t border-cinema-gray/30">
              {value}
            </div>
          </details>
        ) : (
          value
        )}
      </div>
    );
  };

  /**
   * 🎨 Boolean -> Icon Renderer
   */
  const renderBoolean = (value) => {
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
        value 
          ? 'bg-green-500/20 text-green-400' 
          : 'bg-red-500/20 text-red-400'
      }`}>
        {value ? '✓' : '✗'}
      </span>
    );
  };

  /**
   * 🎨 Object -> JSON Viewer
   */
  const renderObject = (value) => {
    return (
      <details className="cursor-pointer">
        <summary className="text-cinema-accent text-xs hover:text-cinema-accent-light">
          📦 Object ({Object.keys(value).length} keys)
        </summary>
        <pre className="mt-2 p-2 bg-cinema-black/50 rounded text-xs overflow-auto max-h-32">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    );
  };

  /**
   * 🎯 Ana Hücre Renderer - Tip bazlı akıllı renderlama
   */
  const renderCell = (value, columnKey) => {
    const type = detectType(value);

    switch (type) {
      case 'empty':
        return <span className="text-cinema-text-dim text-xs">-</span>;
      
      case 'array':
        return renderArrayCell(value);
      
      case 'boolean':
        return renderBoolean(value);
      
      case 'number':
        return renderNumber(value, columnKey);
      
      case 'short-string':
        return renderShortString(value);
      
      case 'long-string':
        return renderLongString(value);
      
      case 'object':
        return renderObject(value);
      
      default:
        return <span className="text-cinema-text text-sm">{String(value)}</span>;
    }
  };

  return (
    <div className={`bg-cinema-black rounded-lg overflow-hidden border border-cinema-gray/30 ${className}`}>
      {/* 📊 Tablo Container - Yatay scroll */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* 📋 HEADER */}
          <thead>
            <tr className="bg-cinema-gray/50 border-b-2 border-cinema-accent">
              {showRowNumbers && (
                <th className="px-4 py-3 text-left text-cinema-accent font-semibold text-xs uppercase tracking-wider border-r border-cinema-gray sticky left-0 bg-cinema-gray/50 z-10">
                  #
                </th>
              )}
              {columns.map((col) => (
                <th 
                  key={col}
                  className="px-4 py-3 text-left text-cinema-accent font-semibold text-xs uppercase tracking-wider border-r border-cinema-gray last:border-r-0"
                >
                  {getColumnLabel(col)}
                </th>
              ))}
            </tr>
          </thead>

          {/* 📊 BODY */}
          <tbody>
            {data.map((row, rowIdx) => (
              <tr 
                key={rowIdx}
                className="border-b border-cinema-gray/30 hover:bg-cinema-gray/10 transition-colors group"
              >
                {showRowNumbers && (
                  <td className="px-4 py-3 text-cinema-accent/70 font-mono text-xs border-r border-cinema-gray sticky left-0 bg-cinema-black group-hover:bg-cinema-gray/10 z-10">
                    {rowIdx + 1}
                  </td>
                )}
                {columns.map((col) => (
                  <td 
                    key={col}
                    className={`px-4 border-r border-cinema-gray/20 last:border-r-0 ${
                      compactMode ? 'py-2' : 'py-3'
                    }`}
                  >
                    {renderCell(row[col], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 📊 Footer - Row Count */}
      <div className="bg-cinema-gray/30 px-4 py-2 border-t border-cinema-accent/30 flex items-center justify-between">
        <div className="text-xs text-cinema-text-dim">
          <span className="font-semibold text-cinema-text">{data.length}</span> satır
        </div>
        <div className="text-xs text-cinema-text-dim">
          <span className="font-semibold text-cinema-text">{columns.length}</span> sütun
        </div>
      </div>
    </div>
  );
};

DynamicDataTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  columnMapping: PropTypes.object,
  maxChipsPerCell: PropTypes.number,
  className: PropTypes.string,
  showRowNumbers: PropTypes.bool,
  compactMode: PropTypes.bool
};

export default DynamicDataTable;
