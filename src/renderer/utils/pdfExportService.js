import { jsPDF } from 'jspdf';

export class PDFExportService {
  constructor() {
    this.doc = null;
    this.currentY = 25;
    this.pageHeight = 297; // A4 yükseklik (297mm)
    this.leftMargin = 25;
    this.rightMargin = 25;
    this.pageWidth = 210; // A4 genişlik (210mm)
    this.contentWidth = this.pageWidth - this.leftMargin - this.rightMargin; // 160mm
    this.bottomMargin = 25;
    this.usableHeight = this.pageHeight - this.currentY - this.bottomMargin; // ~247mm
  }

  // 🔧 GLOBAL KARAKTER TEMİZLEME FONKSİYONU
  cleanTurkishText(text) {
    if (!text) return '';
    
    let cleanText = String(text);
    
    // Yaygın UTF-8 encoding hataları
    cleanText = cleanText
      .replace(/Ä±/g, 'ı')
      .replace(/Ä°/g, 'İ')
      .replace(/Ã§/g, 'ç')
      .replace(/Ã‡/g, 'Ç')
      .replace(/Ä\u009f/g, 'ğ')
      .replace(/Ä\u009e/g, 'Ğ')
      .replace(/Ã¶/g, 'ö')
      .replace(/Ã–/g, 'Ö')
      .replace(/Ã¼/g, 'ü')
      .replace(/Ãœ/g, 'Ü')
      .replace(/Ã\u0178/g, 'ş')
      .replace(/Å\u009f/g, 'ş')
      .replace(/Å\u009e/g, 'Ş')
      
      // Double encoding hatalarını düzelt
      .replace(/&Ä±&/g, 'ı')
      .replace(/&Ä&/g, 'ı')
      .replace(/&A&/g, 'A')
      .replace(/&n&/g, 'n')
      .replace(/&a&/g, 'a')
      .replace(/&l&/g, 'l')
      .replace(/&i&/g, 'i')
      .replace(/&z&/g, 'z')
      
      // Hexadecimal encoding düzeltmeleri
      .replace(/&\u0026&\u00c4&\u00b1&/g, 'ı')
      .replace(/&\u0026&A&\u0026&n&\u0026&a&\u0026&l&\u0026&i&\u0026&z&\u0026&i&/g, 'Analizi')
      
      // Eski encoding hatalarını düzelt
      .replace(/Ã\u0096/g, 'Ö').replace(/Ã\u00b6/g, 'ö')
      .replace(/Ã\u009e/g, 'Ş').replace(/Ã\u009f/g, 'ş')
      .replace(/Ã\u0087/g, 'Ç').replace(/Ã\u00a7/g, 'ç')
      .replace(/Ã\u009f/g, 'Ğ').replace(/Ä\u009f/g, 'ğ')
      .replace(/Ã\u009c/g, 'Ü').replace(/Ã\u00bc/g, 'ü')
      .replace(/Ä\u00b1/g, 'ı').replace(/Ä\u00b0/g, 'İ')
      
      // Diğer encoding hataları
      .replace(/â\u20ac\u2122/g, "'")
      .replace(/â\u20ac\u009d/g, '"')
      .replace(/â\u20ac\u009c/g, '"')
      
      // HTML entities
      .replace(/&quot;/g, '\u0022')
      .replace(/&apos;/g, '\u0027')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      
      // Unicode normalize
      .normalize('NFC')
      .trim();
      
    return cleanText;
  }

  createDocument() {
    // A4 format: 210x297mm
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
      floatPrecision: 16 // 16 digits behind decimal
    });
    
    this.currentY = 25;
    
    // Gelişmiş Türkçe karakter desteği
    try {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setLanguage('tr-TR');
      this.doc.setCharSpace(0);
      
      // PDF metadata
      this.doc.setProperties({
        title: 'MGX Reader - Senaryo Analiz Raporu',
        subject: 'Senaryo Analizi',
        author: 'MGX Reader',
        creator: 'MGX Reader v1.0',
        producer: 'jsPDF'
      });
    } catch (error) {
      console.warn('PDF ayarları başarısız, varsayılan kullanılıyor:', error);
    }
  }

  addHeader(title) {
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    
    // Global temizleme fonksiyonu kullan
    const cleanTitle = this.cleanTurkishText(title || 'MGX Reader - Senaryo Analiz Raporu');
      
    this.doc.text(cleanTitle, this.leftMargin, this.currentY);
    this.currentY += 15;
    
    // Başlık altına çizgi
    this.doc.setLineWidth(0.5);
    this.doc.line(this.leftMargin, this.currentY, this.pageWidth - this.rightMargin, this.currentY);
    this.currentY += 10;
  }

  addSection(title, content) {
    this.checkPageBreak(35);
    
    // Add visual separator line before section
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.2);
    this.doc.line(this.leftMargin, this.currentY, this.pageWidth - this.rightMargin, this.currentY);
    this.currentY += 6;
    
    // Section title with background box for better readability
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    const cleanTitle = title ? String(title).normalize('NFC') : '';
    
    // Add subtle background for section title
    this.doc.setFillColor(245, 245, 245);
    this.doc.rect(this.leftMargin - 2, this.currentY - 5, this.contentWidth + 4, 10, 'F');
    
    this.doc.text(cleanTitle, this.leftMargin, this.currentY);
    this.currentY += 10;
    
    // Section content
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    if (typeof content === 'string') {
      this.addText(content);
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        if (typeof item === 'string') {
          this.addBulletPoint(item);
        } else if (item.title && item.description) {
          this.addSubSection(item.title, item.description);
        }
      });
    } else if (typeof content === 'object') {
      Object.entries(content).forEach(([key, value]) => {
        this.addKeyValue(key, value);
      });
    }
    
    this.currentY += 8;
  }

  addText(text) {
    // Global temizleme fonksiyonu kullan
    const cleanText = this.cleanTurkishText(text);
      
    const lines = this.doc.splitTextToSize(cleanText, this.contentWidth);
    lines.forEach(line => {
      this.checkPageBreak(6);
      this.doc.text(line, this.leftMargin, this.currentY);
      this.currentY += 6;
    });
  }

  addBulletPoint(text) {
    this.checkPageBreak(8);
    this.doc.text('•', this.leftMargin, this.currentY);
    
    // Global temizleme fonksiyonu kullan
    const cleanText = this.cleanTurkishText(text);
      
    const lines = this.doc.splitTextToSize(cleanText, this.contentWidth - 10);
    lines.forEach((line, index) => {
      if (index > 0) this.checkPageBreak(6);
      this.doc.text(line, this.leftMargin + 10, this.currentY);
      if (index < lines.length - 1) this.currentY += 6;
    });
    this.currentY += 8;
  }

  addSubSection(title, description) {
    this.checkPageBreak(15);
    
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title + ':', this.leftMargin + 5, this.currentY);
    this.currentY += 6;
    
    this.doc.setFont('helvetica', 'normal');
    const lines = this.doc.splitTextToSize(description, this.contentWidth - 10);
    lines.forEach(line => {
      this.checkPageBreak(6);
      this.doc.text(line, this.leftMargin + 5, this.currentY);
      this.currentY += 6;
    });
    this.currentY += 3;
  }

  addKeyValue(key, value) {
    this.checkPageBreak(8);
    
    this.doc.setFont('helvetica', 'bold');
    const cleanKey = key ? String(key).normalize('NFC') : '';
    this.doc.text(cleanKey + ':', this.leftMargin + 5, this.currentY);
    
    this.doc.setFont('helvetica', 'normal');
    if (typeof value === 'string') {
      const cleanValue = value ? String(value).normalize('NFC') : '';
      const valueLines = this.doc.splitTextToSize(cleanValue, this.contentWidth - 50);
      valueLines.forEach((line, index) => {
        if (index === 0) {
          this.doc.text(line, this.leftMargin + 50, this.currentY);
        } else {
          this.checkPageBreak(6);
          this.currentY += 6;
          this.doc.text(line, this.leftMargin + 50, this.currentY);
        }
      });
    } else {
      this.doc.text(String(value), this.leftMargin + 50, this.currentY);
    }
    this.currentY += 8;
  }

  checkPageBreak(requiredSpace) {
    // A4 boyutuna göre sayfa kontrolü (297mm yükseklik, 25mm alt margin)
    if (this.currentY + requiredSpace > (this.pageHeight - this.bottomMargin)) {
      this.doc.addPage();
      this.currentY = 25; // Üst margin
    }
  }

  addFooter() {
    const pageCount = this.doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      
      // Footer pozisyonu: A4 alt kısmı (297-10 = 287mm)
      const footerY = this.pageHeight - 10;
      
      // Tarih (sol alt)
      const date = new Date().toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      this.doc.text(`Oluşturma Tarihi: ${date}`, this.leftMargin, footerY);
      
      // Sayfa numarası (sağ alt)
      this.doc.text(`Sayfa ${i}/${pageCount}`, this.pageWidth - this.rightMargin - 30, footerY);
    }
  }

  exportAnalysis(analysisData) {
    console.log('PDFExportService - analysisData:', JSON.stringify(analysisData, null, 2));
    
    if (!analysisData) {
      console.error('analysisData boş!');
      throw new Error('Analiz verisi bulunamadı');
    }
    
    this.createDocument();
    
    // Header with enhanced title
    this.addHeader('MGX Reader - Kapsamlı Senaryo Analiz Raporu');
    
    // Add table of contents page
    this.addTableOfContents(analysisData);
    
    // Executive Summary
    this.addExecutiveSummary(analysisData);
    
    // Date info
    this.addSection('📅 Rapor Bilgileri', `Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`);
    
    // Analysis summary - always add this section first
    this.addAnalysisSummary(analysisData);
    
    // Process main analysis data with organized structure
    this.processOrganizedAnalysisData(analysisData);
    
    this.addFooter();
    
    return this.doc;
  }

  processOrganizedAnalysisData(analysisData) {
    // Priority sections for organized reporting
    const prioritySections = [
      { key: 'summary', title: '📋 Genel Özet' },
      { key: 'budgetAndSchedule', title: '💰 Bütçe & Zaman', handler: 'handleBudgetAndSchedule' },
      { key: 'productionScope', title: '🛠️ Prodüksiyon Kapsamı', handler: 'handleProductionScope' },
      { key: 'customResults', title: '🎯 Özelleştirilmiş Analiz Sonuçları' },
      { key: 'scenes', title: '🎬 Sahne Detayları' },
      { key: 'characters', title: '👥 Karakter Analizi' },
      { key: 'locations', title: '📍 Mekan Analizi' },
      { key: 'equipment', title: '🛠️ Ekipman Gereksinimleri' },
      { key: 'evaluation', title: '📊 Performans Değerlendirmesi' },
      { key: 'competitiveAnalysis', title: '🏆 Rekabet Analizi' },
      { key: 'audienceAnalysis', title: '🎯 Hedef Kitle Analizi' },
      { key: 'vfxRequirements', title: '✨ VFX Gereksinimleri' },
      { key: 'sfxRequirements', title: '🔊 SFX Gereksinimleri' },
      { key: 'virtualProductionSuitability', title: '🎮 Sanal Prodüksiyon Uygunluğu' }
    ];
    
    const processedKeys = new Set();
    
    // Process priority sections first
    prioritySections.forEach(({ key, title, handler }) => {
      if (handler) {
        // Use special handler for synthetic sections
        this[handler](analysisData, title);
        processedKeys.add(key);
      } else if (analysisData[key] !== undefined && analysisData[key] !== null) {
        this.processPrioritySection(key, analysisData[key], title);
        processedKeys.add(key);
      }
    });
    
    // Process remaining sections
    Object.entries(analysisData).forEach(([key, value]) => {
      if (!processedKeys.has(key) && value !== null && value !== undefined) {
        this.processAnalysisSection(key, value);
      }
    });
  }

  processPrioritySection(key, value, customTitle) {
    if (key === 'customResults' && typeof value === 'object') {
      this.addSection(customTitle, '');
      
      const resultCount = Object.keys(value).length;
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'italic');
      this.doc.text(`Toplam ${resultCount} analiz sonucu`, this.leftMargin + 5, this.currentY);
      this.currentY += 10;
      this.doc.setFont('helvetica', 'normal');
      
      Object.entries(value).forEach(([resultKey, resultData], index) => {
        // Add page break before each analysis if needed
        this.checkPageBreak(40);
        
        const name = resultData?.name || resultKey;
        
        // Add analysis number and name as a prominent subsection
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        
        // Add a visual separator
        this.doc.setDrawColor(180, 180, 180);
        this.doc.setLineWidth(0.1);
        this.doc.line(this.leftMargin + 5, this.currentY, this.pageWidth - this.rightMargin - 5, this.currentY);
        this.currentY += 5;
        
        // Add analysis title with number
        const analysisTitle = `${index + 1}. ${name}`;
        this.doc.text(analysisTitle, this.leftMargin + 5, this.currentY);
        this.currentY += 8;
        
        // Process and add the result content
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'normal');
        
        const processedResult = this.processJSONContent(resultData);
        const lines = this.doc.splitTextToSize(processedResult, this.contentWidth - 15);
        lines.forEach(line => {
          this.checkPageBreak(6);
          this.doc.text(line, this.leftMargin + 10, this.currentY);
          this.currentY += 6;
        });
        
        this.currentY += 5;
      });
    } else {
      const formattedContent = this.formatSectionContent(value);
      this.addSection(customTitle, formattedContent);
    }
  }

  processAnalysisSection(key, value) {
    const sectionTitle = this.formatSectionTitle(key);
    const formattedContent = this.formatSectionContent(value);
    this.addSection(sectionTitle, formattedContent);
  }

  formatSectionContent(value) {
    if (Array.isArray(value) && value.length > 0) {
      return value.map((item, index) => {
        if (typeof item === 'string') {
          return `${index + 1}. ${item}`;
        } else if (typeof item === 'object' && item !== null) {
          return `${index + 1}. ${this.formatJSONObject(item)}`;
        }
        return `${index + 1}. ${String(item)}`;
      });
    } else if (typeof value === 'object' && value !== null) {
      return this.formatJSONObject(value);
    } else if (typeof value === 'string' && value.trim()) {
      return this.cleanJSONString(value);
    } else if (typeof value === 'number') {
      return String(value);
    } else {
      return 'Veri mevcut değil';
    }
  }

  formatJSONObject(obj) {
    try {
      // Eğer bu bir analiz sonucu ise özel formatlama uygula
      if (this.isAnalysisResult(obj)) {
        return this.formatAnalysisResult(obj);
      }
      
      // Eğer nested JSON string ise parse et
      if (typeof obj === 'string') {
        try {
          const parsed = JSON.parse(obj);
          return this.formatJSONObject(parsed);
        } catch {
          return this.cleanJSONString(obj);
        }
      }
      
      const entries = Object.entries(obj);
      if (entries.length === 0) return 'Boş veri';
      
      return entries.map(([key, value]) => {
        const formattedKey = this.formatJSONKey(key);
        const formattedValue = this.formatJSONValue(value);
        return `${formattedKey}: ${formattedValue}`;
      }).join('\n');
    } catch (error) {
      console.warn('JSON object formatting hatası:', error);
      return String(obj);
    }
  }

  isAnalysisResult(obj) {
    // Analiz sonucu karakteristik alanları kontrol et
    const analysisFields = ['name', 'result', 'status', 'timestamp', 'type', 'wordCount'];
    const objectKeys = Object.keys(obj || {});
    return analysisFields.some(field => objectKeys.includes(field));
  }

  formatAnalysisResult(result) {
    const parts = [];
    
    if (result.name) {
      parts.push(`Analiz Adı: ${result.name}`);
    }
    
    if (result.type) {
      parts.push(`Tür: ${this.formatSectionTitle(result.type)}`);
    }
    
    if (result.status) {
      const statusText = result.status === 'completed' ? 'Tamamlandı' : 
                        result.status === 'failed' ? 'Başarısız' : result.status;
      parts.push(`Durum: ${statusText}`);
    }
    
    if (result.wordCount) {
      parts.push(`Kelime Sayısı: ${result.wordCount}`);
    }
    
    if (result.timestamp) {
      try {
        const date = new Date(result.timestamp);
        parts.push(`Tarih: ${date.toLocaleString('tr-TR')}`);
      } catch {
        parts.push(`Tarih: ${result.timestamp}`);
      }
    }
    
    if (result.result) {
      parts.push('\nSonuç:');
      const resultText = this.cleanJSONString(result.result);
      parts.push(resultText);
    }
    
    return parts.join('\n');
  }

  formatJSONKey(key) {
    // JSON key'lerini Türkçe'ye çevir
    const keyMap = {
      'name': 'Ad',
      'result': 'Sonuç',
      'status': 'Durum',
      'timestamp': 'Zaman',
      'type': 'Tür',
      'wordCount': 'Kelime Sayısı',
      'description': 'Açıklama',
      'analysis': 'Analiz',
      'summary': 'Özet',
      'scenes': 'Sahneler',
      'characters': 'Karakterler',
      'locations': 'Mekanlar',
      'equipment': 'Ekipmanlar',
      'themes': 'Temalar',
      'genre': 'Tür',
      'duration': 'Süre',
      'complexity': 'Karmaşıklık',
      'marketability': 'Pazarlanabilirlik',
      'budget': 'Bütçe',
      'risk': 'Risk',
      'provider': 'Sağlayıcı',
      'language': 'Dil',
      'selectedTypes': 'Seçili Tür',
      'totalAnalysisCount': 'Toplam Analiz',
      'completedAnalysisCount': 'Tamamlanan Analiz',
      'failedAnalysisCount': 'Başarısız Analiz',
      'totalWordCount': 'Toplam Kelime'
    };
    
    return keyMap[key] || this.formatSectionTitle(key);
  }

  formatJSONValue(value) {
    if (typeof value === 'string') {
      return this.cleanJSONString(value);
    } else if (typeof value === 'number') {
      return String(value);
    } else if (typeof value === 'boolean') {
      return value ? 'Evet' : 'Hayır';
    } else if (Array.isArray(value)) {
      if (value.length === 0) return 'Boş liste';
      if (value.length <= 5) {
        return value.join(', ');
      } else {
        return `${value.slice(0, 3).join(', ')} ve ${value.length - 3} tane daha`;
      }
    } else if (typeof value === 'object' && value !== null) {
      return this.formatJSONObject(value);
    } else if (value === null || value === undefined) {
      return 'Belirtilmemiş';
    }
    return String(value);
  }

  cleanJSONString(text) {
    if (!text || typeof text !== 'string') return String(text || '');
    
    // JSON escape karakterlerini temizle
    let cleaned = text
      .replace(/\\n/g, '\n')        // \n -> gerçek satır sonu
      .replace(/\\r/g, '')         // \r kaldır
      .replace(/\\t/g, ' ')        // \t -> boşluk
      .replace(/\\"/g, '"')       // \" -> "
      .replace(/\\\\/g, '/')      // \\ -> /
      .replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
        // Unicode karakterleri çevir
        try {
          return String.fromCharCode(parseInt(code, 16));
        } catch {
          return match;
        }
      });
    
    // Enhanced Turkish character encoding fix for PDF
    cleaned = cleaned
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .normalize('NFC')
      // Problematic character combinations
      .replace(/Ø=UA&/g, 'Ö')
      .replace(/Ã\u2013/g, 'Ö')
      .replace(/Ã\u2020/g, 'Ğ')
      .replace(/&R&a&p&o&r&/g, 'Rapor')
      .replace(/&([a-zA-Z0-9]+)&/g, '$1')
      .replace(/&([a-zA-Z]+);/g, '')
      // Fix specific garbled patterns from screenshot
      .replace(/Ã-UÄ&/g, 'Ö')
      .replace(/&R&a&p&o&r&/g, 'Rapor')
      .replace(/&B&i&l&g&i&/g, 'Bilgi')
      .replace(/&([A-Z])&([a-z])&/g, '$1$2')
      // Clean up remaining artifacts
      .replace(/&{2,}/g, ' ')
      .replace(/[&]{1}(?![a-zA-Z0-9])/g, ' ');
    
    // Çok uzun metinleri kısalt (PDF için)
    if (cleaned.length > 2000) {
      cleaned = cleaned.substring(0, 1950) + '...\n\n[Metin uzunluk sınırı nedeniyle kısaltıldı]';
    }
    
    // Çok fazla satır sonu varsa düzenle
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  }

  // JSON formatını otomatik algılayıp işlemek için yardımcı metot
  processJSONContent(content) {
    try {
      // Eğer string ise JSON parse etmeyi dene
      if (typeof content === 'string') {
        // JSON string mi kontrol et
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(content);
            return this.formatJSONObject(parsed);
          } catch {
            return this.cleanJSONString(content);
          }
        }
        return this.cleanJSONString(content);
      }
      
      // Eğer object ise direkt formatla
      if (typeof content === 'object' && content !== null) {
        return this.formatJSONObject(content);
      }
      
      return String(content);
    } catch (error) {
      console.warn('JSON content işleme hatası:', error);
      return String(content);
    }
  }

  // Analiz sonuçları için özel JSON export formatı
  exportAnalysisAsJSON(analysisData) {
    const cleanedData = this.cleanAnalysisDataForExport(analysisData);
    return JSON.stringify(cleanedData, null, 2);
  }

  cleanAnalysisDataForExport(data) {
    if (Array.isArray(data)) {
      return data.map(item => this.cleanAnalysisDataForExport(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const cleaned = {};
      Object.entries(data).forEach(([key, value]) => {
        // Gereğinden fazla teknik detayları kaldır
        if (!this.shouldExcludeFromExport(key)) {
          cleaned[key] = this.cleanAnalysisDataForExport(value);
        }
      });
      return cleaned;
    }
    
    return data;
  }

  shouldExcludeFromExport(key) {
    // PDF export için gereksiz alanlar
    const excludeKeys = [
      'isCustomAnalysis', 'isMultiAnalysis', 
      '__proto__', 'constructor',
      'error', 'stackTrace'
    ];
    return excludeKeys.includes(key);
  }

  processAnalysisData(data, prefix = '') {
    // This method is kept for backward compatibility but now uses the new organized structure
    this.processOrganizedAnalysisData(data);
  }

  processLegacyAnalysisData(data, prefix = '') {
    if (!data || typeof data !== 'object') {
      return;
    }

    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      
      const sectionTitle = prefix ? `${prefix} - ${this.formatSectionTitle(key)}` : this.formatSectionTitle(key);
      
      if (Array.isArray(value) && value.length > 0) {
        // Handle arrays
        const formattedContent = value.map((item, index) => {
          if (typeof item === 'string') {
            return `${index + 1}. ${item}`;
          } else if (typeof item === 'object') {
            return `${index + 1}. ${JSON.stringify(item, null, 2)}`;
          }
          return `${index + 1}. ${String(item)}`;
        });
        this.addSection(sectionTitle, formattedContent);
      } else if (typeof value === 'object') {
        // Handle nested objects
        this.addSection(sectionTitle, '');
        this.processLegacyAnalysisData(value, sectionTitle);
      } else if (typeof value === 'string' && value.trim()) {
        // Handle strings
        this.addSection(sectionTitle, value);
      } else if (typeof value === 'number') {
        // Handle numbers
        this.addSection(sectionTitle, String(value));
      }
    });
  }

  formatSectionTitle(key) {
    const titleMap = {
      'marketAnalysis': 'Pazar Analizi',
      'competitorAnalysis': 'Rakip Analizi',
      'audienceAnalysis': 'Hedef Kitle Analizi',
      'productionAnalysis': 'Prodüksiyon Analizi',
      'budgetAnalysis': 'Bütçe Analizi',
      'riskAnalysis': 'Risk Analizi',
      'technicalAnalysis': 'Teknik Analiz',
      'analysis': 'Analiz Sonuçları',
      'scenes': 'Sahne Analizi',
      'characters': 'Karakter Analizi',
      'locations': 'Mekan Analizi',
      'equipment': 'Ekipman Gereksinimleri',
      'themes': 'Tematik Analiz',
      'structure': 'Yapısal Analiz',
      'dialogue': 'Diyalog Analizi',
      'marketability': 'Pazarlanabilirlik Değerlendirmesi',
      'production': 'Prodüksiyon Değerlendirmesi',
      'recommendations': 'Öneriler ve Tavsiyeler',
      'summary': 'Analiz Özeti',
      'overview': 'Genel Değerlendirme',
      'evaluation': 'Performans Değerlendirmesi',
      'metadata': 'Proje Meta Verileri',
      'specialAnalysis': 'Özel Analiz Sonuçları',
      'customResults': 'Özelleştirilmiş Analiz Sonuçları',
      'isCustomAnalysis': 'Analiz Türü',
      'isMultiAnalysis': 'Çoklu Analiz',
      'selectedTypes': 'Seçili Analiz Türleri',
      'competitiveAnalysis': 'Rekabet Analizi',
      'geographicAnalysis': 'Coğrafi Pazar Analizi',
      'trendAnalysis': 'Trend Analizi',
      'riskOpportunityAnalysis': 'Risk ve Fırsat Analizi',
      'vfxRequirements': 'Görsel Efekt Gereksinimleri',
      'sfxRequirements': 'Ses Efekti Gereksinimleri',
      'virtualProductionSuitability': 'Sanal Prodüksiyon Uygunluğu',
      'shootingTechniques': 'Çekim Teknikleri',
      'estimatedDuration': 'Tahmini Süre',
      'complexity': 'Karmaşıklık Düzeyi',
      'genre': 'Tür',
      'risk': 'Risk Değerlendirmesi',
      'name': 'Analiz Adı',
      'result': 'Sonuç'
    };
    
    return titleMap[key] || this.formatCamelCaseTitle(key);
  }

  formatCamelCaseTitle(text) {
    return text
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Add table of contents page
   * Lists all sections that will appear in the report
   */
  addTableOfContents(analysisData) {
    this.checkPageBreak(80);
    
    // Section title
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('📑 İçindekiler', this.leftMargin, this.currentY);
    this.currentY += 12;
    
    // Horizontal line
    this.doc.setLineWidth(0.3);
    this.doc.line(this.leftMargin, this.currentY, this.pageWidth - this.rightMargin, this.currentY);
    this.currentY += 10;
    
    // Table of contents items
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    const tocItems = [
      '📅 Rapor Bilgileri',
      '📊 Analiz Özeti',
      '📋 Genel Özet',
      '💰 Bütçe & Zaman',
      '🛠️ Prodüksiyon Kapsamı'
    ];
    
    // Add sections from analysis data
    const prioritySections = [
      { key: 'customResults', title: '🎯 Özelleştirilmiş Analiz Sonuçları' },
      { key: 'scenes', title: '🎬 Sahne Detayları' },
      { key: 'characters', title: '👥 Karakter Analizi' },
      { key: 'locations', title: '📍 Mekan Analizi' },
      { key: 'equipment', title: '🛠️ Ekipman Gereksinimleri' },
      { key: 'evaluation', title: '📊 Performans Değerlendirmesi' },
      { key: 'competitiveAnalysis', title: '🏆 Rekabet Analizi' },
      { key: 'audienceAnalysis', title: '🎯 Hedef Kitle Analizi' },
      { key: 'vfxRequirements', title: '✨ VFX Gereksinimleri' },
      { key: 'sfxRequirements', title: '🔊 SFX Gereksinimleri' },
      { key: 'virtualProductionSuitability', title: '🎮 Sanal Prodüksiyon Uygunluğu' }
    ];
    
    prioritySections.forEach(({ key, title }) => {
      if (analysisData[key] !== undefined && analysisData[key] !== null) {
        tocItems.push(title);
      }
    });
    
    // Render TOC items
    tocItems.forEach((item, index) => {
      this.checkPageBreak(8);
      
      // Item number and title
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`${index + 1}. ${item}`, this.leftMargin + 5, this.currentY);
      this.currentY += 7;
    });
    
    this.currentY += 10;
    
    // Add page break after TOC
    this.doc.addPage();
    this.currentY = 25;
  }

  /**
   * Add executive summary
   * Provides high-level overview of the entire analysis
   */
  addExecutiveSummary(analysisData) {
    this.checkPageBreak(60);
    
    // Section title
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('📋 Yönetici Özeti', this.leftMargin, this.currentY);
    this.currentY += 10;
    
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    // Build executive summary text
    let summaryText = 'Bu rapor, senaryo analizinin kapsamlı sonuçlarını içermektedir. ';
    
    // Add analysis count
    if (analysisData.customResults && Object.keys(analysisData.customResults).length > 0) {
      const count = Object.keys(analysisData.customResults).length;
      summaryText += `Toplam ${count} farklı analiz türü gerçekleştirilmiştir. `;
    }
    
    // Add production insights
    if (analysisData.scenes && analysisData.scenes.length > 0) {
      summaryText += `Senaryo ${analysisData.scenes.length} sahneden oluşmaktadır. `;
    }
    
    if (analysisData.characters && analysisData.characters.length > 0) {
      summaryText += `Toplam ${analysisData.characters.length} karakter tespit edilmiştir. `;
    }
    
    if (analysisData.locations && analysisData.locations.length > 0) {
      summaryText += `${analysisData.locations.length} farklı mekan kullanılmaktadır. `;
    }
    
    // Add budget and time estimates
    if (analysisData.summary) {
      if (analysisData.summary.estimatedShootingDays) {
        summaryText += `Tahmini çekim süresi ${analysisData.summary.estimatedShootingDays} gündür. `;
      }
      if (analysisData.summary.budgetEstimate) {
        summaryText += `Bütçe tahmini: ${analysisData.summary.budgetEstimate}. `;
      }
    }
    
    // Add production complexity insights
    const equipmentCount = analysisData.equipment ? analysisData.equipment.length : 0;
    const vfxCount = analysisData.vfxRequirements ? 
      (Array.isArray(analysisData.vfxRequirements) ? analysisData.vfxRequirements.length : 
       analysisData.vfxRequirements.sequences ? analysisData.vfxRequirements.sequences.length : 0) : 0;
    const sfxCount = analysisData.sfxRequirements ? 
      (Array.isArray(analysisData.sfxRequirements) ? analysisData.sfxRequirements.length :
       analysisData.sfxRequirements.effects ? analysisData.sfxRequirements.effects.length : 0) : 0;
    
    if (equipmentCount > 0 || vfxCount > 0 || sfxCount > 0) {
      summaryText += '\n\nProdüksiyon gereksinimleri: ';
      const requirements = [];
      if (equipmentCount > 0) requirements.push(`${equipmentCount} ekipman öğesi`);
      if (vfxCount > 0) requirements.push(`${vfxCount} VFX sekansı`);
      if (sfxCount > 0) requirements.push(`${sfxCount} SFX ihtiyacı`);
      summaryText += requirements.join(', ') + '.';
    }
    
    // Add conclusion
    summaryText += '\n\nBu rapor, detaylı analiz sonuçlarını, prodüksiyon önerilerini ve değerlendirmeleri içermektedir. Her bölüm, projenin farklı yönlerini kapsamlı bir şekilde ele almaktadır.';
    
    // Clean and add text
    const cleanedSummary = this.cleanTurkishText(summaryText);
    this.addText(cleanedSummary);
    
    this.currentY += 10;
    
    // Add page break after executive summary
    this.doc.addPage();
    this.currentY = 25;
  }

  addAnalysisSummary(analysisData) {
    this.addSection('📊 Analiz Özeti', '');
    
    // Analiz türü
    if (analysisData.isCustomAnalysis) {
      this.addKeyValue('Analiz Türü', 'Özelleştirilmiş Analiz');
      
      if (analysisData.isMultiAnalysis) {
        this.addKeyValue('Analiz Modu', 'Çoklu Analiz');
        
        if (analysisData.selectedTypes && analysisData.selectedTypes.length > 0) {
          this.addKeyValue('Seçili Analiz Türleri', analysisData.selectedTypes.join(', '));
        }
      }
    } else {
      this.addKeyValue('Analiz Türü', 'Standart Senaryo Analizi');
    }
    
    // Temel istatistikler
    if (analysisData.summary) {
      if (analysisData.summary.totalScenes) {
        this.addKeyValue('Toplam Sahne Sayısı', String(analysisData.summary.totalScenes));
      }
      if (analysisData.summary.estimatedShootingDays) {
        this.addKeyValue('Tahmini Çekim Günü', String(analysisData.summary.estimatedShootingDays));
      } else {
        this.addKeyValue('Tahmini Çekim Günü', 'Belirlenmedi');
      }
      if (analysisData.summary.budgetEstimate) {
        this.addKeyValue('Bütçe Tahmini', String(analysisData.summary.budgetEstimate));
      } else {
        this.addKeyValue('Bütçe Tahmini', 'N/A');
      }
    } else {
      this.addKeyValue('Tahmini Çekim Günü', 'Belirlenmedi');
      this.addKeyValue('Bütçe Tahmini', 'N/A');
    }
    
    // Eleman sayıları
    if (analysisData.scenes && analysisData.scenes.length > 0) {
      this.addKeyValue('Sahne Sayısı', String(analysisData.scenes.length));
    }
    if (analysisData.characters && analysisData.characters.length > 0) {
      this.addKeyValue('Karakter Sayısı', String(analysisData.characters.length));
    }
    if (analysisData.locations && analysisData.locations.length > 0) {
      this.addKeyValue('Mekan Sayısı', String(analysisData.locations.length));
    }
    
    // Prodüksiyon kapsamı
    const equipmentCount = analysisData.equipment ? analysisData.equipment.length : 0;
    this.addKeyValue('Ekipman Öğeleri', String(equipmentCount));
    
    const vfxCount = analysisData.vfxRequirements ? 
      (Array.isArray(analysisData.vfxRequirements) ? analysisData.vfxRequirements.length : 
       analysisData.vfxRequirements.sequences ? analysisData.vfxRequirements.sequences.length : 0) : 0;
    this.addKeyValue('VFX Sekansları', String(vfxCount));
    
    const sfxCount = analysisData.sfxRequirements ? 
      (Array.isArray(analysisData.sfxRequirements) ? analysisData.sfxRequirements.length :
       analysisData.sfxRequirements.effects ? analysisData.sfxRequirements.effects.length : 0) : 0;
    this.addKeyValue('SFX İhtiyaçları', String(sfxCount));
    
    const virtualProdSuitability = analysisData.virtualProductionSuitability ? 
      (analysisData.virtualProductionSuitability.suitability || 
       analysisData.virtualProductionSuitability.recommendation || 'Değerlendirildi') : 'Değerlendirilmedi';
    this.addKeyValue('Sanal Prodüksiyon', virtualProdSuitability);
    
    // Özelleştirilmiş analiz sonuç sayısı
    if (analysisData.customResults) {
      this.addKeyValue('Analiz Sonuç Sayısı', String(Object.keys(analysisData.customResults).length));
    }
    
    this.currentY += 10;
  }

  async save(filename = 'scenario-analysis-report.pdf') {
    if (!this.doc) {
      throw new Error('PDF belgesi oluşturulmamış');
    }
    
    try {
      if (window.electronAPI && window.electronAPI.saveFile) {
        // Electron environment
        const filePath = await window.electronAPI.saveFile({
          defaultPath: filename,
          filters: [
            { name: 'PDF Files', extensions: ['pdf'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        
        if (filePath) {
          const pdfData = this.doc.output('dataurlstring');
          const base64Data = pdfData.split(',')[1];
          
          await window.electronAPI.saveFileContent({
            filePath,
            data: base64Data,
            encoding: 'base64'
          });
          
          return true;
        }
        return false;
      } else {
        // Browser environment
        this.doc.save(filename);
        return true;
      }
    } catch (error) {
      console.error('PDF kaydetme hatası:', error);
      throw error;
    }
  }

  // Special handlers for synthetic sections
  handleBudgetAndSchedule(analysisData, title) {
    this.addSection(title, '');
    
    const estimatedDays = analysisData.summary?.estimatedShootingDays || 
                         analysisData.estimatedShootingDays || 0;
    this.addKeyValue('Çekim Günleri', estimatedDays > 0 ? String(estimatedDays) : 'Belirlenmedi');
    
    const budgetEstimate = analysisData.summary?.budgetEstimate || 
                          analysisData.budgetEstimate || 
                          analysisData.budget?.estimate;
    this.addKeyValue('Bütçe Tahmini', budgetEstimate || 'N/A');
    
    this.currentY += 5;
  }

  handleProductionScope(analysisData, title) {
    this.addSection(title, '');
    
    const equipmentCount = analysisData.equipment ? analysisData.equipment.length : 0;
    this.addKeyValue('Ekipman Öğeleri', String(equipmentCount));
    
    const vfxCount = analysisData.vfxRequirements ? 
      (Array.isArray(analysisData.vfxRequirements) ? analysisData.vfxRequirements.length : 
       analysisData.vfxRequirements.sequences ? analysisData.vfxRequirements.sequences.length : 0) : 0;
    this.addKeyValue('VFX Sekansları', String(vfxCount));
    
    const sfxCount = analysisData.sfxRequirements ? 
      (Array.isArray(analysisData.sfxRequirements) ? analysisData.sfxRequirements.length :
       analysisData.sfxRequirements.effects ? analysisData.sfxRequirements.effects.length : 0) : 0;
    this.addKeyValue('SFX İhtiyaçları', String(sfxCount));
    
    const virtualProdSuitability = analysisData.virtualProductionSuitability ? 
      (analysisData.virtualProductionSuitability.suitability || 
       analysisData.virtualProductionSuitability.recommendation || 'Değerlendirildi') : 'Değerlendirilmedi';
    this.addKeyValue('Sanal Prodüksiyon', virtualProdSuitability);
    
    this.currentY += 5;
  }

  /**
   * Export analysis data as JSON with error handling and repair
   * @param {Object} analysisData - Analysis results
   * @param {string} projectTitle - Project name
   * @returns {Promise<Object>} - Result with success status
   */
  async exportAnalysisAsJSON(analysisData, projectTitle = 'MGXReader Analysis') {
    try {
      console.log('📤 Exporting analysis as JSON...');
      
      // STEP 1: Sanitize and validate data
      const sanitizedData = this.sanitizeForJSON(analysisData);
      
      // STEP 2: Create structured JSON output
      const jsonOutput = {
        metadata: {
          projectTitle: this.cleanTurkishText(projectTitle),
          exportDate: new Date().toISOString(),
          exporter: 'MGXReader v2.0',
          dataVersion: '3.0'
        },
        analysisResults: sanitizedData.customResults || {},
        summary: {
          totalAnalyses: Object.keys(sanitizedData.customResults || {}).length,
          completedAnalyses: Object.values(sanitizedData.customResults || {})
            .filter(a => a.status === 'completed').length,
          failedAnalyses: Object.values(sanitizedData.customResults || {})
            .filter(a => a.status === 'error').length,
          totalWordCount: Object.values(sanitizedData.customResults || {})
            .reduce((sum, a) => sum + (a.wordCount || 0), 0)
        },
        sceneBreakdown: sanitizedData.scenes || [],
        characters: sanitizedData.characters || [],
        locations: sanitizedData.locations || [],
        equipment: sanitizedData.equipment || []
      };
      
      // STEP 3: Validate JSON structure
      try {
        const testString = JSON.stringify(jsonOutput);
        JSON.parse(testString); // Verify it's valid JSON
      } catch (jsonError) {
        console.error('❌ JSON validation failed:', jsonError);
        throw new Error('JSON yapısı geçersiz. Lütfen analiz sonuçlarını kontrol edin.');
      }
      
      // STEP 4: Create download with pretty formatting
      const jsonString = JSON.stringify(jsonOutput, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `${projectTitle.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, '_')}_analysis_${timestamp}.json`;
      
      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('✅ JSON export completed:', fileName);
      return { success: true, fileName: fileName, size: blob.size };
      
    } catch (error) {
      console.error('❌ JSON export error:', error);
      
      // STEP 5: Attempt emergency fallback export
      try {
        console.log('🔄 Attempting emergency JSON export...');
        const emergencyData = {
          error: 'Primary export failed',
          errorMessage: error.message,
          timestamp: new Date().toISOString(),
          rawData: String(analysisData).substring(0, 10000) // Truncate to prevent issues
        };
        
        const emergencyJSON = JSON.stringify(emergencyData, null, 2);
        const blob = new Blob([emergencyJSON], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `emergency_backup_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('⚠️ Emergency JSON export completed');
      } catch (emergencyError) {
        console.error('❌ Emergency export also failed:', emergencyError);
      }
      
      throw new Error(`JSON export failed: ${error.message}`);
    }
  }

  /**
   * Sanitize data for JSON serialization
   * Handles circular references, undefined values, and encoding issues
   * @param {*} data - Data to sanitize
   * @returns {*} - Sanitized data
   */
  sanitizeForJSON(data) {
    if (!data) return {};
    
    // Use a WeakSet to track visited objects (prevent circular references)
    const visited = new WeakSet();
    
    const sanitize = (obj) => {
      if (obj === null || obj === undefined) {
        return null;
      }
      
      // Primitive types
      if (typeof obj !== 'object') {
        if (typeof obj === 'string') {
          return this.cleanTurkishText(obj); // Fix Turkish characters
        }
        return obj;
      }
      
      // Circular reference detection
      if (visited.has(obj)) {
        return '[Circular Reference]';
      }
      visited.add(obj);
      
      // Arrays
      if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
      }
      
      // Objects
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip functions and symbols
        if (typeof value === 'function' || typeof value === 'symbol') {
          continue;
        }
        
        try {
          sanitized[key] = sanitize(value);
        } catch (error) {
          console.warn(`Failed to sanitize key "${key}":`, error.message);
          sanitized[key] = `[Sanitization Error: ${error.message}]`;
        }
      }
      
      return sanitized;
    };
    
    return sanitize(data);
  }
}

export default PDFExportService;