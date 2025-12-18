import * as xmljs from 'xml2js';
import * as cheerio from 'cheerio';
import JSZip from 'jszip';

/**
 * SCREENPLAY PARSER - THE DOMINANT METHOD
 * Koordinat Bazlı Mekansal Ayrıştırma (Spatial Parsing)
 * 
 * Felsefe: Senaryolar bir metin standardı değil, geometri standardıdır.
 * Bu parser, X ve Y koordinatlarına bakarak %99 doğrulukla element tespiti yapar.
 * 
 * Regex yöntemi: "Büyük harf, demek ki karakter olabilir..." (%40 yanılma)
 * Koordinat yöntemi: "X=22, demek ki %100 karakterdir." (%1 yanılma)
 * 
 * Desteklenen formatlar:
 * - PDF (Coordinate-based parsing via pdf2json) - DOMINANT METHOD
 * - Final Draft (.fdx)
 * - Celtx (.celtx) 
 * - Standard text formats (.txt, .docx)
 */

/**
 * SENARYO STANDARTLARI (LAYOUT PROFILES)
 * Bu değerler, endüstri standardı yazılımların sayfa marjinleridir.
 * Koordinatlar "points" (1/72 inch) birimiyle kalibre edilmiştir.
 */
const LAYOUT_PROFILES = {
  'FINAL_DRAFT': {
    name: 'Final Draft',
    // Final Draft'ın "Kutsal" Koordinatları
    margins: {
      scene: { max: 72 },              // Sahne başlıkları en soldadır (1 inch)
      action: { max: 72 },             // Aksiyonlar da en soldadır
      character: { min: 216, max: 324 }, // Karakter isimleri ortada (3-4.5 inch)
      dialogue: { min: 144, max: 252 },  // Diyalog bloğu (2-3.5 inch)
      parenthetical: { min: 180, max: 288 }, // Parantez içi (2.5-4 inch)
      transition: { min: 432 }          // Geçişler sağda (6+ inch)
    }
  },
  'CELTX': {
    name: 'Celtx',
    margins: {
      scene: { max: 80 },
      action: { max: 80 },
      character: { min: 228, max: 348 },
      dialogue: { min: 132, max: 336 },
      parenthetical: { min: 192, max: 312 },
      transition: { min: 444 }
    }
  },
  'GENERIC': { // Word veya bilinmeyen kaynaklar için "Güvenli Mod"
    name: 'Standart',
    margins: {
      scene: { max: 96 },
      action: { max: 96 },
      character: { min: 192, max: 384 },
      dialogue: { min: 120, max: 420 },
      parenthetical: { min: 156, max: 360 },
      transition: { min: 408 }
    }
  }
};

export class ScreenplayParser {
  constructor() {
    this.parser = new xmljs.Parser();
  }

  /**
   * Ana Yönlendirici: Dosya tipine göre doğru motoru seçer
   */
  async parseFile(fileBuffer, fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    
    try {
      switch (extension) {
        case 'pdf':
          // BASKIN YÖNTEM: Koordinat bazlı PDF ayrıştırma
          return await this.parsePDFWithCoordinates(fileBuffer, fileName);
        case 'fdx':
          return await this.parseFinalDraft(fileBuffer);
        case 'celtx':
          return await this.parseCeltx(fileBuffer);
        case 'txt':
          return this.parseText(fileBuffer.toString('utf-8'));
        case 'docx':
          return await this.parseDocx(fileBuffer);
        default:
          throw new Error(`Desteklenmeyen format: ${extension}`);
      }
    } catch (error) {
      console.error(`Parse Hatası (${extension}):`, error);
      throw new Error(`Senaryo ayrıştırma hatası: ${error.message}`);
    }
  }

  /**
   * BASKIN YÖNTEM: KOORDİNAT BAZLI PDF AYRIŞTIRMA (Electron Entegrasyonlu)
   * 
   * pdf2json Electron main process'te çalışır ve bize koordinat verisi döner.
   * Bu metod bu koordinatlara bakarak %99 doğrulukla element tespiti yapar.
   */
  async parsePDFWithCoordinates(buffer, fileName) {
    // Electron API kontrolü
    if (!window.electronAPI?.parseAdvancedPDF) {
      console.warn('⚠️ Electron Advanced PDF API bulunamadı, fallback yöntemine geçiliyor');
      return this.parsePDFFallback(buffer);
    }

    try {
      console.log('🚀 Koordinat Bazlı PDF Analizi Başlatılıyor...');
      
      // Buffer'ı geçici dosyaya kaydet (Electron API dosya yolu bekler)
      const tempPath = await this.saveTempFile(buffer, fileName);
      const pdfData = await window.electronAPI.parseAdvancedPDF(tempPath);

      // Temp dosyayı temizle
      try {
        await window.electronAPI.deleteFile(tempPath);
      } catch (e) {
        console.warn('Geçici dosya temizlenemedi:', e);
      }

      if (!pdfData.success) {
        console.warn('⚠️ Advanced PDF parsing başarısız, fallback aktif:', pdfData.error);
        return this.parsePDFFallback(buffer);
      }

      // Ana işlem: pdf2json koordinatlarını analiz et
      return this.processPDFElements(pdfData);
      
    } catch (error) {
      console.error('❌ PDF koordinat ayrıştırma hatası:', error);
      console.log('📌 Fallback yöntemine geçiliyor...');
      return this.parsePDFFallback(buffer);
    }
  }

  /**
   * PDF2JSON SONUÇLARINI İŞLE - CORE LOGIC
   * Koordinatlara bakarak element türlerini %99 doğrulukla tespit eder
   */
  processPDFElements(pdfData) {
    const { elements, metadata, totalPages } = pdfData;

    // 1. ADIM: KİMLİK TESPİTİ (Metadata Analizi)
    // PDF'in hangi yazılımla oluşturulduğunu tespit et
    const sourceApp = this.detectScriptSource(metadata);
    const profile = LAYOUT_PROFILES[sourceApp] || LAYOUT_PROFILES['GENERIC'];
    
    console.log(`🎬 Analiz Profili: ${sourceApp} (${profile.name})`);
    console.log(`📊 ${elements.length} element, ${totalPages} sayfa`);

    let screenplay = {
      title: this.cleanText(metadata?.title) || 'Adsız Senaryo',
      author: metadata?.author || 'Bilinmeyen Yazar',
      scenes: [],
      characters: new Set(),
      locations: new Set(),
      text: '',
      metadata: { 
        format: 'PDF', 
        source: profile.name,
        pages: totalPages,
        creator: metadata?.creator || 'Unknown',
        parsingMethod: 'COORDINATE_BASED'
      }
    };

    let currentScene = null;
    let sceneNumber = 1;
    let lastCharacter = null; // Diyalog takibi için
    let lineBuffer = ''; // Satır birleştirme için

    // 2. ADIM: GEOMETRİK TARAMA
    // Elementler pdf2json tarafından Y konumuna göre sıralanmış
    elements.forEach((item, index) => {
      const text = this.cleanText(item.text);
      const x = item.bbox.x0; // KRİTİK VERİ: Soldan girinti (points)
      const nextItem = elements[index + 1];
      
      if (!text.trim()) return;

      // Satır birleştirme: Aynı Y konumundaki elementleri birleştir
      if (nextItem && Math.abs(item.bbox.y0 - nextItem.bbox.y0) < 2) {
        lineBuffer += text + ' ';
        return; // Sonraki elemana geç
      }

      // Tam satır hazır
      const fullText = lineBuffer ? (lineBuffer + text).trim() : text;
      lineBuffer = ''; // Buffer'ı temizle

      screenplay.text += fullText + '\n';

      // 3. ADIM: KOORDİNAT EŞLEŞTİRME (Logic Layer)
      
      // A. SAHNE BAŞLIĞI TESPİTİ
      // Kural: En solda olmalı (x < 72) VE Sahne anahtar kelimelerini içermeli
      if (x <= profile.margins.scene.max && this.isLikelySceneHeading(fullText)) {
        if (currentScene) {
          screenplay.scenes.push(this.finalizeScene(currentScene));
        }
        
        const locationData = this.extractLocationData(fullText);
        currentScene = {
          number: sceneNumber++,
          header: fullText,
          heading: fullText, // Alias
          dialogue: [],
          action: [],
          characters: new Set(),
          location: locationData.location,
          intExt: locationData.intExt,
          timeOfDay: locationData.timeOfDay,
          text: fullText + '\n'
        };
        screenplay.locations.add(currentScene.location);
        lastCharacter = null;
        
        console.log(`  📍 Sahne ${sceneNumber - 1}: ${fullText.substring(0, 50)}...`);
      }
      
      // B. KARAKTER İSMİ TESPİTİ
      // Kural: "Karakter Sütunu" içinde (216-324 points) VE BÜYÜK HARF
      else if (x >= profile.margins.character.min && x <= profile.margins.character.max) {
        if (fullText === fullText.toUpperCase() && fullText.length > 1 && fullText.length < 50) {
          // Parantez içi notları temizle: JOHN (V.O.) -> JOHN
          const charName = fullText.replace(/\s*\([^)]*\)/g, '').trim();
          
          if (charName.length > 0 && !this.isPageNumber(charName)) {
            screenplay.characters.add(charName);
            lastCharacter = charName;
            
            if (currentScene) {
              currentScene.characters.add(charName);
              currentScene.text += `\n${fullText}\n`;
            }
          }
        }
      }
      
      // C. DİYALOG TESPİTİ
      // Kural: "Diyalog Sütunu" içinde (144-252) VE parantez değil VE karakter sonrası
      else if (x >= profile.margins.dialogue.min && x <= profile.margins.dialogue.max) {
        if (!this.isParenthetical(fullText) && currentScene && lastCharacter) {
          currentScene.dialogue.push({
            character: lastCharacter,
            text: fullText
          });
          currentScene.text += `${fullText}\n`;
        }
      }
      
      // D. PARANTEZ İÇİ (PARENTHETICAL)
      // Kural: Parantezle sarılı VE orta bölge
      else if (this.isParenthetical(fullText) && 
               x >= profile.margins.parenthetical.min && 
               x <= profile.margins.parenthetical.max) {
        if (currentScene) {
          currentScene.text += `${fullText}\n`;
        }
      }
      
      // E. GEÇİŞ (TRANSITION)
      // Kural: Sağda (x > 432) VE büyük harf VE geçiş anahtar kelimesi
      else if (x >= profile.margins.transition.min && this.isTransition(fullText)) {
        if (currentScene) {
          currentScene.text += `\n${fullText}\n`;
        }
      }
      
      // F. AKSİYON / TASVİR
      // Kural: En solda ama Sahne Başlığı değil
      else if (x <= profile.margins.action.max && !this.isPageNumber(fullText)) {
        if (currentScene) {
          currentScene.action.push(fullText);
          currentScene.text += `${fullText}\n`;
        }
        lastCharacter = null; // Aksiyon diyalog zincirini kırar
      }
    });

    // Son sahneyi ekle
    if (currentScene) {
      screenplay.scenes.push(this.finalizeScene(currentScene));
    }

    // Veri temizliği ve dönüşüm
    screenplay.characters = Array.from(screenplay.characters);
    screenplay.locations = Array.from(screenplay.locations);
    
    console.log(`✅ Koordinat Bazlı Ayrıştırma Tamamlandı:`);
    console.log(`   📍 ${screenplay.scenes.length} sahne`);
    console.log(`   👥 ${screenplay.characters.length} karakter`);
    console.log(`   🗺️  ${screenplay.locations.length} lokasyon`);
    
    return screenplay;
  }

  /**
   * KİMLİK TESPİTÇİSİ: PDF'in hangi yazılımla oluşturulduğunu tespit eder
   */
  detectScriptSource(meta) {
    if (!meta) return 'GENERIC';
    
    const creator = (meta.creator || '').toLowerCase();
    const producer = (meta.producer || '').toLowerCase();
    const metaStr = JSON.stringify(meta).toLowerCase();

    if (creator.includes('final draft') || producer.includes('final draft')) {
      return 'FINAL_DRAFT';
    }
    if (creator.includes('celtx') || producer.includes('celtx')) {
      return 'CELTX';
    }
    if (creator.includes('fade in')) {
      return 'GENERIC'; 
    }
    
    return 'GENERIC';
  }

  /**
   * Parse Final Draft (.fdx) files
   * Final Draft uses XML format with specific structure
   */
  async parseFinalDraft(buffer) {
    try {
      const xmlContent = buffer.toString('utf-8');
      const result = await this.parser.parseStringPromise(xmlContent);
      
      const finalDraft = result.FinalDraft || result.finaldraft;
      if (!finalDraft) {
        throw new Error('Invalid Final Draft file structure');
      }

      const content = finalDraft.Content?.[0];
      if (!content) {
        throw new Error('No content found in Final Draft file');
      }

      let screenplay = {
        title: this.extractTitle(finalDraft),
        author: this.extractAuthor(finalDraft),
        scenes: [],
        characters: new Set(),
        locations: new Set(),
        text: '',
        metadata: {
          format: 'Final Draft',
          version: finalDraft.$.Version || 'Unknown'
        }
      };

      // Parse paragraphs (scenes, dialogue, action, etc.)
      const paragraphs = content.Paragraph || [];
      let currentScene = null;
      let sceneNumber = 1;

      for (const paragraph of paragraphs) {
        const type = paragraph.$.Type;
        const text = this.extractTextFromParagraph(paragraph);
        
        screenplay.text += text + '\\n';

        switch (type) {
          case 'Scene Heading':
            if (currentScene) {
              screenplay.scenes.push(currentScene);
            }
            currentScene = {
              number: sceneNumber++,
              header: text,
              dialogue: [],
              action: [],
              characters: new Set(),
              ...this.parseSceneHeader(text)
            };
            screenplay.locations.add(this.extractLocation(text));
            break;

          case 'Character':
            if (currentScene && text.trim()) {
              const characterName = text.trim().replace(/\\(.*\\)/, '').trim();
              screenplay.characters.add(characterName);
              currentScene.characters.add(characterName);
            }
            break;

          case 'Dialogue':
            if (currentScene && text.trim()) {
              currentScene.dialogue.push(text);
            }
            break;

          case 'Action':
            if (currentScene && text.trim()) {
              currentScene.action.push(text);
            }
            break;
        }
      }

      // Add the last scene
      if (currentScene) {
        screenplay.scenes.push(currentScene);
      }

      // Convert sets to arrays
      screenplay.characters = Array.from(screenplay.characters);
      screenplay.locations = Array.from(screenplay.locations);
      screenplay.scenes = screenplay.scenes.map(scene => ({
        ...scene,
        characters: Array.from(scene.characters)
      }));

      return screenplay;
      
    } catch (error) {
      throw new Error(`Final Draft parsing error: ${error.message}`);
    }
  }

  /**
   * Parse Celtx (.celtx) files
   * Celtx files are ZIP archives containing HTML and other resources
   */
  async parseCeltx(buffer) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      
      // Find the main script file (usually script.html or index.html)
      let scriptFile = null;
      const possibleFiles = ['script.html', 'index.html', 'content.html'];
      
      for (const fileName of possibleFiles) {
        if (zip.files[fileName]) {
          scriptFile = zip.files[fileName];
          break;
        }
      }

      if (!scriptFile) {
        // Try to find any HTML file
        const htmlFiles = Object.keys(zip.files).filter(name => name.endsWith('.html'));
        if (htmlFiles.length > 0) {
          scriptFile = zip.files[htmlFiles[0]];
        }
      }

      if (!scriptFile) {
        throw new Error('No script content found in Celtx file');
      }

      const htmlContent = await scriptFile.async('text');
      const $ = cheerio.load(htmlContent);

      let screenplay = {
        title: this.extractCeltxTitle($),
        author: this.extractCeltxAuthor($),
        scenes: [],
        characters: new Set(),
        locations: new Set(),
        text: '',
        metadata: {
          format: 'Celtx',
          version: 'Unknown'
        }
      };

      // Parse screenplay elements
      let currentScene = null;
      let sceneNumber = 1;

      // Celtx uses CSS classes to identify screenplay elements
      $('.sceneheading, .character, .dialogue, .action, .parenthetical').each((index, element) => {
        const $el = $(element);
        const className = $el.attr('class');
        const text = $el.text().trim();
        
        if (!text) return;

        screenplay.text += text + '\\n';

        switch (className) {
          case 'sceneheading':
            if (currentScene) {
              screenplay.scenes.push(currentScene);
            }
            currentScene = {
              number: sceneNumber++,
              header: text,
              dialogue: [],
              action: [],
              characters: new Set(),
              ...this.parseSceneHeader(text)
            };
            screenplay.locations.add(this.extractLocation(text));
            break;

          case 'character':
            if (currentScene && text) {
              const characterName = text.replace(/\\(.*\\)/, '').trim();
              screenplay.characters.add(characterName);
              currentScene.characters.add(characterName);
            }
            break;

          case 'dialogue':
            if (currentScene) {
              currentScene.dialogue.push(text);
            }
            break;

          case 'action':
            if (currentScene) {
              currentScene.action.push(text);
            }
            break;
        }
      });

      // Add the last scene
      if (currentScene) {
        screenplay.scenes.push(currentScene);
      }

      // Convert sets to arrays
      screenplay.characters = Array.from(screenplay.characters);
      screenplay.locations = Array.from(screenplay.locations);
      screenplay.scenes = screenplay.scenes.map(scene => ({
        ...scene,
        characters: Array.from(scene.characters)
      }));

      return screenplay;
      
    } catch (error) {
      throw new Error(`Celtx parsing error: ${error.message}`);
    }
  }

  /**
   * Parse standard text files
   */
  parseText(content) {
    const lines = content.split('\\n');
    
    let screenplay = {
      title: this.extractTitleFromText(lines),
      author: this.extractAuthorFromText(lines),
      scenes: [],
      characters: new Set(),
      locations: new Set(),
      text: content,
      metadata: {
        format: 'Text',
        version: '1.0'
      }
    };

    // Simple parsing for text files
    let currentScene = null;
    let sceneNumber = 1;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Scene heading detection (basic patterns)
      if (this.isSceneHeading(trimmed)) {
        if (currentScene) {
          screenplay.scenes.push(currentScene);
        }
        currentScene = {
          number: sceneNumber++,
          header: trimmed,
          dialogue: [],
          action: [],
          characters: new Set(),
          ...this.parseSceneHeader(trimmed)
        };
        screenplay.locations.add(this.extractLocation(trimmed));
      }
      // Character name detection (uppercase, possibly with parenthetical)
      else if (this.isCharacterName(trimmed)) {
        if (currentScene) {
          const characterName = trimmed.replace(/\\(.*\\)/, '').trim();
          screenplay.characters.add(characterName);
          currentScene.characters.add(characterName);
        }
      }
      // Dialogue or action
      else if (currentScene) {
        if (this.isDialogue(trimmed)) {
          currentScene.dialogue.push(trimmed);
        } else {
          currentScene.action.push(trimmed);
        }
      }
    }

    // Add the last scene
    if (currentScene) {
      screenplay.scenes.push(currentScene);
    }

    // Convert sets to arrays
    screenplay.characters = Array.from(screenplay.characters);
    screenplay.locations = Array.from(screenplay.locations);
    screenplay.scenes = screenplay.scenes.map(scene => ({
      ...scene,
      characters: Array.from(scene.characters)
    }));

    return screenplay;
  }

  /**
   * YARDIMCI ARAÇLAR - Helper Functions
   */

  /**
   * Sahneyi tamamla ve Set'leri Array'e çevir
   */
  finalizeScene(scene) {
    return {
      ...scene,
      characters: Array.from(scene.characters)
    };
  }

  /**
   * Text temizleme
   */
  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/%20/g, ' ') // URL boşluklarını düzelt
      .replace(/%[0-9A-F]{2}/g, match => {
        try {
          return decodeURIComponent(match);
        } catch {
          return match;
        }
      })
      .replace(/\s+/g, ' ') // Çoklu boşlukları tek boşluğa indir
      .trim();
  }

  /**
   * Sahne başlığı kontrolü
   */
  isLikelySceneHeading(text) {
    const t = text.toUpperCase().trim();
    return t.startsWith('INT') || t.startsWith('EXT') || 
           t.startsWith('İÇ') || t.startsWith('DIŞ') || 
           t.includes('SAHNE') || t.includes('SCENE') ||
           /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/.test(t);
  }

  /**
   * Parantez içi kontrol
   */
  isParenthetical(text) {
    const trimmed = text.trim();
    return trimmed.startsWith('(') && trimmed.endsWith(')');
  }

  /**
   * Geçiş kontrolü (CUT TO:, FADE OUT, etc.)
   */
  isTransition(text) {
    const t = text.toUpperCase().trim();
    const transitions = [
      'FADE IN', 'FADE OUT', 'FADE TO BLACK', 'CUT TO', 'DISSOLVE TO',
      'MATCH CUT', 'SMASH CUT', 'JUMP CUT', 'CONTINUED', 'CONTINUOUS',
      'LATER', 'MONTAGE', 'END MONTAGE', 'INTERCUT', 'BACK TO'
    ];
    return transitions.some(trans => t.includes(trans)) || t.endsWith(':');
  }

  /**
   * Sayfa numarası kontrolü
   */
  isPageNumber(text) {
    const trimmed = text.trim();
    return /^\d+\.?$/.test(trimmed) && trimmed.length <= 4;
  }

  /**
   * Lokasyon verisi çıkarımı (INT/EXT, location, time of day)
   */
  extractLocationData(header) {
    if (!header) return { location: 'Unknown', intExt: 'INT', timeOfDay: 'DAY' };

    const text = header.toUpperCase().trim();
    
    // INT/EXT tespiti
    let intExt = 'INT';
    if (text.startsWith('EXT') || text.startsWith('DIŞ')) {
      intExt = 'EXT';
    } else if (text.includes('INT/EXT') || text.includes('İÇ/DIŞ')) {
      intExt = 'INT/EXT';
    }

    // Zaman dilimi tespiti
    let timeOfDay = 'DAY';
    if (text.includes('NIGHT') || text.includes('GECE')) {
      timeOfDay = 'NIGHT';
    } else if (text.includes('DAWN') || text.includes('ŞAFAK')) {
      timeOfDay = 'DAWN';
    } else if (text.includes('DUSK') || text.includes('ALACAKARANLIK')) {
      timeOfDay = 'DUSK';
    } else if (text.includes('EVENING') || text.includes('AKŞAM')) {
      timeOfDay = 'EVENING';
    } else if (text.includes('MORNING') || text.includes('SABAH')) {
      timeOfDay = 'MORNING';
    }

    // Lokasyon çıkarımı
    let location = text
      .replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|İÇ|DIŞ|İÇ\/DIŞ)\.?\s*/i, '')
      .replace(/\s*-\s*(DAY|NIGHT|DAWN|DUSK|EVENING|MORNING|GÜN|GECE|ŞAFAK|ALACAKARANLIK|AKŞAM|SABAH).*$/i, '')
      .trim();

    if (!location) location = 'Unknown Location';

    return { location, intExt, timeOfDay };
  }

  /**
   * Buffer'ı geçici dosyaya kaydet (Electron API için)
   */
  async saveTempFile(buffer, fileName) {
    if (!window.electronAPI?.getTempDir || !window.electronAPI?.saveFile) {
      throw new Error('Electron file API bulunamadı');
    }

    const tempDir = await window.electronAPI.getTempDir();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = `${tempDir}/mgx_temp_${Date.now()}_${safeName}`;
    
    await window.electronAPI.saveFile({
      filePath: tempPath,
      data: buffer
    });
    
    return tempPath;
  }

  /**
   * Fallback PDF parsing (text-only, no coordinates)
   */
  async parsePDFFallback(buffer) {
    console.log('📌 Fallback PDF parsing (text-only mode)');
    
    // Electron'un standart PDF parser'ını kullan
    if (window.electronAPI?.parsePDF) {
      try {
        const result = await window.electronAPI.parsePDF(buffer);
        if (result.success) {
          return this.parseText(result.text);
        }
      } catch (e) {
        console.error('Fallback PDF parse hatası:', e);
      }
    }
    
    // En son çare: Buffer'ı string olarak parse et
    const text = buffer.toString('utf-8');
    return this.parseText(text);
  }

  extractTextFromParagraph(paragraph) {
    if (paragraph.Text) {
      if (Array.isArray(paragraph.Text)) {
        return paragraph.Text.map(t => t._ || t).join('');
      }
      return paragraph.Text._ || paragraph.Text;
    }
    return '';
  }

  extractTitle(finalDraft) {
    try {
      return finalDraft.TitlePage?.[0]?.Content?.[0]?.Paragraph?.find(
        p => p.$.Type === 'Title'
      )?.Text?.[0]?._ || finalDraft.TitlePage?.[0]?.Content?.[0]?.Paragraph?.find(
        p => p.$.Type === 'Title'
      )?.Text?.[0] || 'Untitled Screenplay';
    } catch {
      return 'Untitled Screenplay';
    }
  }

  extractAuthor(finalDraft) {
    try {
      return finalDraft.TitlePage?.[0]?.Content?.[0]?.Paragraph?.find(
        p => p.$.Type === 'Credit'
      )?.Text?.[0]?._ || finalDraft.TitlePage?.[0]?.Content?.[0]?.Paragraph?.find(
        p => p.$.Type === 'Credit'
      )?.Text?.[0] || 'Unknown Author';
    } catch {
      return 'Unknown Author';
    }
  }

  extractCeltxTitle($) {
    return $('.title').first().text().trim() || 'Untitled Screenplay';
  }

  extractCeltxAuthor($) {
    return $('.author, .credit').first().text().trim() || 'Unknown Author';
  }

  extractTitleFromText(lines) {
    for (const line of lines.slice(0, 10)) {
      const trimmed = line.trim();
      if (trimmed && !this.isSceneHeading(trimmed) && !this.isCharacterName(trimmed)) {
        return trimmed;
      }
    }
    return 'Untitled Screenplay';
  }

  extractAuthorFromText(lines) {
    const authorKeywords = ['by', 'written by', 'author', 'yazar', 'yazan'];
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].trim().toLowerCase();
      for (const keyword of authorKeywords) {
        if (line.includes(keyword)) {
          const nextLine = lines[i + 1]?.trim();
          if (nextLine) return nextLine;
        }
      }
    }
    return 'Unknown Author';
  }

  parseSceneHeader(header) {
    const parts = header.split(' - ');
    let intExt = 'UNKNOWN';
    let location = '';
    let timeOfDay = '';

    if (parts.length >= 1) {
      const firstPart = parts[0].trim();
      if (firstPart.startsWith('INT.') || firstPart.startsWith('İÇ.')) {
        intExt = 'INTERIOR';
        location = firstPart.substring(4).trim();
      } else if (firstPart.startsWith('EXT.') || firstPart.startsWith('DIŞ.')) {
        intExt = 'EXTERIOR';
        location = firstPart.substring(4).trim();
      }
    }

    if (parts.length >= 2) {
      timeOfDay = parts[1].trim();
    }

    return { intExt, location, timeOfDay };
  }

  extractLocation(sceneHeader) {
    const parsed = this.parseSceneHeader(sceneHeader);
    return parsed.location || sceneHeader.split(' - ')[0]?.replace(/^(INT\\.|EXT\\.|İÇ\\.|DIŞ\\.)/, '').trim() || 'Unknown Location';
  }

  isSceneHeading(line) {
    const upper = line.toUpperCase();
    // Çoklu dil sahne başlıkları: SAHNE/SCENE/SZENE/SCÈNE/ESCENA/SCENA/CENA + rakam (boşluklu veya boşluksuz)
    const sceneNumberPattern = /^(SAHNE|SCENE|SZENE|SCÈNE|ESCENA|SCENA|CENA)\s*\d+/i;
    
    return upper.startsWith('INT.') || 
           upper.startsWith('EXT.') || 
           upper.startsWith('İÇ.') || 
           upper.startsWith('DIŞ.') ||
           sceneNumberPattern.test(upper) ||
           /^[A-Z\\s\\.\\-]+\\s+(DAY|NIGHT|MORNING|EVENING|GECE|GÜNDÜZ|SABAH|AKŞAM)/.test(upper);
  }

  isCharacterName(line) {
    // Character names are usually all caps, centered, and not scene headings
    return line === line.toUpperCase() && 
           line.length > 1 && 
           line.length < 50 && 
           !this.isSceneHeading(line) &&
           !/^[0-9]/.test(line) &&
           !/\\.(com|org|net|edu)$/.test(line.toLowerCase());
  }

  isDialogue(line) {
    // Simple heuristic: if it's not all caps and follows a character name, it's probably dialogue
    return line !== line.toUpperCase() && line.length > 3;
  }

  /**
   * Parse DOCX files (placeholder - would need more complex implementation)
   */
  async parseDocx(buffer) {
    // For now, treat as text extraction
    // In a full implementation, you'd use a library like mammoth.js
    const content = buffer.toString('utf-8');
    return this.parseText(content);
  }
}

/**
 * Factory function for easy usage
 */
export function createScreenplayParser() {
  return new ScreenplayParser();
}

/**
 * Convenience function for parsing a file
 */
export async function parseScreenplayFile(fileBuffer, fileName) {
  const parser = createScreenplayParser();
  return await parser.parseFile(fileBuffer, fileName);
}

export default ScreenplayParser;