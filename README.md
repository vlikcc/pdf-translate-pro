# PDF Translate Pro

Matematiksel ve bilimsel içerikli PDF belgelerini Türkçeye çeviren tarayıcı tabanlı web uygulaması. Formüller LaTeX olarak korunur ve KaTeX ile render edilir.

## Özellikler

- PDF dosyalarını sürükle-bırak veya dosya seçici ile yükleme
- Sayfa navigasyonu ve yakınlaştırma/uzaklaştırma
- Seçili bölgenin Gemini AI ile Türkçeye çevirisi
- Matematiksel ifadelerin LaTeX formatında korunması ve KaTeX ile render edilmesi
- Markdown biçimlendirme desteği (başlık, kalın, italik, listeler)
- Görsel yakalama (seçili alanın resim olarak kaydedilmesi)
- Bağımsız LaTeX editörü ve canlı önizleme
- Çıktı editöründe yazı tipi, boyut, satır aralığı ve paragraf girintisi ayarları
- Blok bazında genişlik/yükseklik boyutlandırma
- Sürükle-bırak ile blok sıralaması
- Ayarlanabilir panel boyutları (PDF görüntüleyici / çıktı editörü)
- PDF olarak dışa aktarma
- HiDPI / Retina ekran desteği

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Stil | Tailwind CSS 4 |
| State | Zustand |
| PDF Render | PDF.js |
| AI Çeviri | Google Gemini API |
| Formül Render | KaTeX |
| PDF Export | jsPDF + html2canvas-pro |

## Gereksinimler

- **Node.js** ≥ 18
- **pnpm** (önerilen paket yöneticisi)
- **Google Gemini API anahtarı** — [Google AI Studio](https://aistudio.google.com/apikey) üzerinden ücretsiz alınabilir

## pnpm Kurulumu

Eğer sisteminizde pnpm yüklü değilse aşağıdaki yöntemlerden birini kullanın:

```bash
# npm ile (Node.js yüklüyse en hızlı yol)
npm install -g pnpm

# Homebrew ile (macOS)
brew install pnpm

# Standalone script ile (macOS / Linux)
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

Kurulumu doğrulamak için:

```bash
pnpm --version
```

## Kurulum

```bash
# 1. Depoyu klonlayın (veya proje dizinine gidin)
cd pdf-translate-pro

# 2. Bağımlılıkları yükleyin
pnpm install

# 3. Ortam değişkenlerini ayarlayın
cp .env.local.example .env.local
```

`.env.local` dosyasını açıp Gemini API anahtarınızı girin:

```
VITE_GEMINI_API_KEY=buraya_api_anahtarinizi_yazin
```

## Çalıştırma

```bash
# Geliştirme sunucusu (hot reload)
pnpm dev
```

Tarayıcınızda `http://localhost:5173` adresine gidin.

## Derleme (Production Build)

```bash
pnpm build
```

Derlenmiş dosyalar `dist/` klasörüne oluşturulur.

```bash
# Derlenmiş sürümü yerelde önizleme
pnpm preview
```

## Proje Yapısı

```
src/
├── App.tsx                          # Ana uygulama bileşeni ve layout
├── main.tsx                         # React giriş noktası
├── index.css                        # Tailwind + KaTeX stilleri
├── types/
│   └── index.ts                     # TypeScript tip tanımları
├── store/
│   └── appStore.ts                  # Zustand global state yönetimi
├── services/
│   ├── GeminiService.ts             # Gemini API istemcisi, çeviri ve LaTeX OCR
│   ├── PDFExtractor.ts              # PDF yükleme, sayfa render, metin/görsel çıkarma
│   └── ExportService.ts             # PDF dışa aktarma (jsPDF + html2canvas-pro)
├── hooks/
│   ├── useGemini.ts                 # Çeviri/LaTeX/görsel yakalama hook'ları
│   └── usePDF.ts                    # PDF yükleme/navigasyon hook'ları
└── components/
    ├── PDFViewer/PDFViewer.tsx       # PDF görüntüleyici + dosya yükleme
    ├── SelectionOverlay/            # Bölge seçimi overlay'i
    ├── OutputEditor/OutputEditor.tsx # Çıktı editörü + biçimlendirme araçları
    └── LaTeXEditor/LaTeXEditor.tsx   # LaTeX editörü + canlı önizleme
```

## Kullanım

1. Uygulamayı açın ve bir PDF dosyası yükleyin (sürükle-bırak veya buton ile)
2. PDF üzerinde çevirmek istediğiniz alanı fare ile seçin
3. Seçim üzerindeki butonlardan birini tıklayın:
   - **Çevir**: Seçili alanı Türkçeye çevirir (formüller LaTeX olarak korunur)
   - **LaTeX**: Seçili alandaki formülleri LaTeX koduna dönüştürür
   - **Görsel**: Seçili alanı resim olarak yakalar
4. Sağ paneldeki çıktı editöründe sonuçları düzenleyin
5. Biçimlendirme araç çubuğundan yazı tipi, boyut ve satır aralığını ayarlayın
6. Blokların köşe/kenar tutamaçlarını sürükleyerek boyutlarını ayarlayın
7. Hazır olunca **PDF İndir** butonuyla dışa aktarın

## Ortam Değişkenleri

| Değişken | Açıklama |
|---|---|
| `VITE_GEMINI_API_KEY` | Google Gemini API anahtarı (zorunlu) |

## Lisans

Bu proje özel kullanım amaçlıdır.
