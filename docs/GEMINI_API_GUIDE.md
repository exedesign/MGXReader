# Gemini API Konfigürasyonu (Güncel - Kasım 2025)

Bu dosya, MGX Reader uygulamasında kullanılan Google Gemini API'nin güncel ayarlarını açıklamaktadır.

## Güncel Modeller

### Recommended (Önerilen)
- **Gemini 2.5 Flash**: En hızlı ve dengeli model, 1M token context window
- **Gemini 2.5 Pro**: Gelişmiş reasoning, 2M token context window

### Diğer Güncel Modeller
- **Gemini 1.5 Pro (Latest)**: Stabil versiyon, 2M token context window
- **Gemini 1.5 Flash (Latest)**: Hızlı versiyon, 1M token context window

### Legacy (Eski)
- **Gemini Pro**: 32K token context window (deprecated)

## API Konfigürasyonu

### Endpoint
```
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

### Yetkilendirme
```javascript
headers: {
  'Content-Type': 'application/json',
  'x-goog-api-key': 'YOUR_API_KEY'
}
```

### Request Format
```javascript
{
  "systemInstruction": {
    "parts": [{"text": "System prompt"}]
  },
  "contents": [{
    "role": "user", 
    "parts": [{"text": "User prompt"}]
  }],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 8192,
    "topP": 0.95,
    "topK": 40,
    "responseMimeType": "text/plain",
    "candidateCount": 1
  },
  "safetySettings": [...]
}
```

## Safety Settings (Güvenlik Ayarları)

- **HARM_CATEGORY_HARASSMENT**: BLOCK_ONLY_HIGH
- **HARM_CATEGORY_HATE_SPEECH**: BLOCK_ONLY_HIGH  
- **HARM_CATEGORY_SEXUALLY_EXPLICIT**: BLOCK_ONLY_HIGH
- **HARM_CATEGORY_DANGEROUS_CONTENT**: BLOCK_ONLY_HIGH
- **HARM_CATEGORY_CIVIC_INTEGRITY**: BLOCK_ONLY_HIGH

## API Key Alma

1. https://aistudio.google.com/apikey adresine gidin
2. Google hesabınızla giriş yapın
3. "Create API Key" butonuna tıklayın
4. API anahtarınızı kopyalayın ve güvenli bir yerde saklayın

## Kullanım

MGX Reader uygulamasında:

1. Settings > AI Configuration menüsüne gidin
2. Provider olarak "Google Gemini" seçin
3. API Key alanına anahtarınızı girin
4. Model olarak "Gemini 2.5 Flash" önerilen seçenek
5. "Test Connection" ile bağlantıyı test edin

## Önemli Notlar

- v1beta API endpoint kullanılıyor (en güncel)
- System instruction artık ayrı field olarak destekleniyor
- Token limitler modele göre değişiyor
- Safety settings daha esnek hale getirildi
- Response format ve error handling optimize edildi

## Güncellemeler

- **Kasım 2025**: Gemini 2.5 modelleri eklendi
- **v1beta API**: Sistem instruction desteği
- **Safety Settings**: Yeni kategoriler eklendi
- **Context Windows**: Büyük artışlar