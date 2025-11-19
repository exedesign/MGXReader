import { jsPDF } from 'jspdf';

export class PDFExportService {
  constructor() {
    this.doc = null;
    this.currentY = 20;
    this.pageHeight = 280;
    this.leftMargin = 20;
    this.rightMargin = 20;
    this.pageWidth = 210;
    this.contentWidth = this.pageWidth - this.leftMargin - this.rightMargin;
  }

  createDocument() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.currentY = 20;
  }

  addHeader(title) {
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.leftMargin, this.currentY);
    this.currentY += 15;
    
    // Add line under header
    this.doc.setLineWidth(0.5);
    this.doc.line(this.leftMargin, this.currentY, this.pageWidth - this.rightMargin, this.currentY);
    this.currentY += 10;
  }

  addSection(title, content) {
    this.checkPageBreak(30);
    
    // Section title
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.leftMargin, this.currentY);
    this.currentY += 8;
    
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
    
    this.currentY += 5;
  }

  addText(text) {
    const lines = this.doc.splitTextToSize(text, this.contentWidth);
    lines.forEach(line => {
      this.checkPageBreak(6);
      this.doc.text(line, this.leftMargin, this.currentY);
      this.currentY += 6;
    });
  }

  addBulletPoint(text) {
    this.checkPageBreak(8);
    this.doc.text('•', this.leftMargin, this.currentY);
    
    const lines = this.doc.splitTextToSize(text, this.contentWidth - 10);
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
    this.doc.text(key + ':', this.leftMargin + 5, this.currentY);
    
    this.doc.setFont('helvetica', 'normal');
    if (typeof value === 'string') {
      const valueLines = this.doc.splitTextToSize(value, this.contentWidth - 50);
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
    if (this.currentY + requiredSpace > this.pageHeight) {
      this.doc.addPage();
      this.currentY = 20;
    }
  }

  addFooter() {
    const pageCount = this.doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      
      // Date
      const date = new Date().toLocaleDateString('tr-TR');
      this.doc.text(`Oluşturulma: ${date}`, this.leftMargin, this.pageHeight + 10);
      
      // Page number
      this.doc.text(`Sayfa ${i}/${pageCount}`, this.pageWidth - this.rightMargin - 30, this.pageHeight + 10);
    }
  }

  exportAnalysis(analysisData) {
    console.log('PDFExportService - analysisData:', analysisData);
    
    if (!analysisData) {
      console.error('analysisData boş!');
      throw new Error('Analiz verisi bulunamadı');
    }
    
    this.createDocument();
    
    // Header
    this.addHeader('Senaryo Analiz Raporu');
    
    // Test content to ensure PDF is not empty
    this.addSection('Test Bölümü', 'Bu bir test bölümüdür. Analiz verileri işlenecek...');
    
    // General Info
    if (analysisData.metadata) {
      const generalInfo = {
        'Analiz Türü': analysisData.metadata.analysisType || 'Standart Analiz',
        'AI Provider': analysisData.metadata.provider || 'Bilinmiyor',
        'Model': analysisData.metadata.model || 'Bilinmiyor',
        'Tarih': new Date(analysisData.metadata.timestamp || Date.now()).toLocaleString('tr-TR')
      };
      
      this.addSection('Genel Bilgiler', generalInfo);
    }
    
    // Main Analysis
    if (analysisData.analysis) {
      if (analysisData.analysis.summary) {
        this.addSection('Özet', analysisData.analysis.summary);
      }
      
      if (analysisData.analysis.characters && analysisData.analysis.characters.length > 0) {
        this.addSection('Karakterler', analysisData.analysis.characters.map(char => ({
          title: char.name || 'İsimsiz Karakter',
          description: char.description || char.analysis || 'Açıklama yok'
        })));
      }
      
      if (analysisData.analysis.scenes && analysisData.analysis.scenes.length > 0) {
        this.addSection('Sahneler', analysisData.analysis.scenes.map(scene => ({
          title: scene.title || `Sahne ${scene.id || ''}`,
          description: scene.description || scene.summary || 'Açıklama yok'
        })));
      }
      
      if (analysisData.analysis.themes && analysisData.analysis.themes.length > 0) {
        this.addSection('Temalar', analysisData.analysis.themes.map(theme => 
          typeof theme === 'string' ? theme : theme.name || theme.description || 'Tema'
        ));
      }
      
      if (analysisData.analysis.structure) {
        this.addSection('Yapı Analizi', analysisData.analysis.structure);
      }
      
      if (analysisData.analysis.recommendations) {
        this.addSection('Öneriler', analysisData.analysis.recommendations);
      }
      
      // Additional sections for specific analysis types
      if (analysisData.analysis.dialogue) {
        this.addSection('Diyalog Analizi', analysisData.analysis.dialogue);
      }
      
      if (analysisData.analysis.marketability) {
        this.addSection('Pazarlanabilirlik', analysisData.analysis.marketability);
      }
      
      if (analysisData.analysis.production) {
        this.addSection('Prodüksiyon Notları', analysisData.analysis.production);
      }
    }
    
    // Special Analysis sections
    if (analysisData.specialAnalysis) {
      Object.entries(analysisData.specialAnalysis).forEach(([key, value]) => {
        if (value && typeof value === 'object' && Object.keys(value).length > 0) {
          const sectionTitle = this.formatSectionTitle(key);
          this.addSection(sectionTitle, value);
        } else if (value && typeof value === 'string') {
          const sectionTitle = this.formatSectionTitle(key);
          this.addSection(sectionTitle, value);
        }
      });
    }
    
    this.addFooter();
    
    return this.doc;
  }

  formatSectionTitle(key) {
    const titleMap = {
      'marketAnalysis': 'Pazar Analizi',
      'competitorAnalysis': 'Rakip Analizi',
      'audienceAnalysis': 'Hedef Kitle Analizi',
      'productionAnalysis': 'Prodüksiyon Analizi',
      'budgetAnalysis': 'Bütçe Analizi',
      'riskAnalysis': 'Risk Analizi',
      'dialogueAnalysis': 'Diyalog Analizi',
      'characterDevelopment': 'Karakter Gelişimi',
      'plotStructure': 'Olay Örgüsü',
      'themeAnalysis': 'Tema Analizi'
    };
    
    return titleMap[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
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
}

export default PDFExportService;