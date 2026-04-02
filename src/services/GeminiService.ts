import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import type { ContentType } from '../types/index.ts'

interface TranslateResponse {
  translated: string
  detectedLanguage: string
  confidence: number
}

interface LaTeXResponse {
  latex: string
  formulaCount: number
  hasUncertainty: boolean
}

interface ContentTypeResponse {
  contentType: ContentType
  confidence: number
}

const FORMATTING_RULES = `
BİÇİMLENDİRME KURALLARI (çok önemli — orijinal yapıyı koru):
- Başlıklar: Markdown başlık formatı kullan. Ana başlık: "## Başlık", alt başlık: "### Alt Başlık"
- Kalın metin: **kalın metin** şeklinde yaz
- İtalik metin: *italik metin* şeklinde yaz
- Paragraflar: Paragraflar arasında boş bir satır bırak (çift newline \\n\\n)
- Numaralı liste: "1. madde\\n2. madde" formatı
- Madde işaretli liste: "- madde\\n- madde" formatı
- Satır içi formüller: $...$ (örn: $x^2 + y^2 = r^2$)
- Ayrı satırdaki büyük formüller: $$...$$ (kendi paragrafında, öncesinde ve sonrasında boş satır)
- Tek değişkenler bile LaTeX ile: $x$, $y$, $n$, $ABC$ gibi
- Orijinal metindeki girinti ve yapısal hiyerarşiyi koru`

const TRANSLATION_PROMPT = `Sen bir matematik ve fen bilimleri uzmanı çevirmenisin.
Görevin: Verilen metni Türkçeye çevirmek ve orijinal biçimlendirmeyi korumak.

KURALLAR:
1. Matematiksel terimlerin Türkçe karşılıklarını kullan (örn. "derivative" → "türev", "integral" → "integral")
2. Formüller ve değişken adları çevrilmez — LaTeX formatına dönüştürülür
${FORMATTING_RULES}

ÇIKTI FORMATI:
JSON olarak döndür: { "translated": "...", "detectedLanguage": "...", "confidence": 0.0-1.0 }
Sadece JSON döndür — preamble, açıklama veya markdown code fence yazma.

ÖRNEK:
Giriş: "0.3 Other Notations and Conventions\\n\\nConsider a triangle ABC. Throughout this text, let a = BC, b = CA, c = AB.\\nWe use ∠ to denote a directed angle measured in degrees."
Çıkış: { "translated": "### 0.3 Diğer Gösterimler ve Kabuller\\n\\nBir $ABC$ üçgenini ele alalım. Bu metin boyunca $a = BC$, $b = CA$, $c = AB$ olsun.\\n\\nYönlendirilmiş bir açıyı ayırt etmek için $\\\\angle$ sembolünü kullanırız.", "detectedLanguage": "en", "confidence": 0.95 }`

const TRANSLATION_WITH_IMAGE_PROMPT = `Sen bir matematik ve fen bilimleri uzmanı çevirmenisin.
Sana bir PDF sayfasından kesilmiş görsel bölge ve bu bölgeden çıkarılan metin verilecek.

GÖREV: İçeriği Türkçeye çevir. Orijinal biçimlendirmeyi (başlık, kalın, italik, paragraf yapısı) koru. Görseldeki formülleri LaTeX'e dönüştür.

KURALLAR:
1. Matematiksel terimlerin Türkçe karşılıklarını kullan
2. Eğer metin eksik veya bozuksa, görseldeki içeriği temel al
${FORMATTING_RULES}

ÇIKTI FORMATI:
JSON olarak döndür: { "translated": "...", "detectedLanguage": "...", "confidence": 0.0-1.0 }
Sadece JSON döndür.`

const LATEX_OCR_PROMPT = `Sen bir matematiksel formül tanıma uzmanısın.
Sana bir PDF sayfasından kesilmiş görsel bölge verilecek.

GÖREV: Bu bölgedeki tüm matematiksel ifadeleri LaTeX koduna dönüştür.

KURALLAR:
1. Sadece LaTeX kodu döndür — \\begin{} veya $...$ ile çevrele
2. Display math için \\[ ... \\], inline için $ ... $ kullan
3. Birden fazla formül varsa her birini ayrı satırda yaz
4. Emin olmadığın karakterler için en olası LaTeX komutunu seç
5. JSON formatında döndür: { "latex": "...", "formulaCount": N, "hasUncertainty": bool }`

const LATEX_TEXT_PROMPT = `Sen bir matematiksel formül dönüştürme uzmanısın.
Sana Unicode matematiksel semboller ve metin verilecek.

GÖREV: Verilen metindeki tüm matematiksel ifadeleri LaTeX koduna dönüştür.

KURALLAR:
1. Display math için \\[ ... \\], inline için $ ... $ kullan
2. Birden fazla formül varsa her birini ayrı satırda yaz
3. JSON formatında döndür: { "latex": "...", "formulaCount": N, "hasUncertainty": false }`

const CONTENT_TYPE_PROMPT = `Sana bir PDF sayfasından kesilmiş görsel bölge verilecek.
Bu bölgenin içerik tipini belirle.

KURALLAR:
1. Tipler: "text" (düz metin), "formula" (matematiksel formül), "image" (geometrik şekil/grafik/diyagram), "mixed" (karma içerik)
2. JSON formatında döndür: { "contentType": "...", "confidence": 0.0-1.0 }
3. Sadece JSON döndür, başka bir şey yazma`

interface QueueItem {
  execute: () => Promise<unknown>
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

class GeminiService {
  private client: GoogleGenerativeAI | null = null
  private model: GenerativeModel | null = null
  private queue: QueueItem[] = []
  private isProcessingQueue = false
  private lastRequestTime = 0
  private readonly MIN_INTERVAL_MS = 4000
  private readonly MAX_RETRIES = 3
  private readonly MODEL_NAME = 'gemini-3-flash-preview'

  initialize(): boolean {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
      console.warn('Gemini API key tanımlanmamış. .env.local dosyasını kontrol edin.')
      return false
    }
    this.client = new GoogleGenerativeAI(apiKey)
    this.model = this.client.getGenerativeModel({ model: this.MODEL_NAME })
    return true
  }

  private async enqueue<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: execute as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      })
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return
    this.isProcessingQueue = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()!
      const elapsed = Date.now() - this.lastRequestTime
      if (elapsed < this.MIN_INTERVAL_MS) {
        await this.sleep(this.MIN_INTERVAL_MS - elapsed)
      }

      try {
        this.lastRequestTime = Date.now()
        const result = await this.withRetry(item.execute)
        item.resolve(result)
      } catch (err) {
        item.reject(err)
      }
    }

    this.isProcessingQueue = false
  }

  private async withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await fn()
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string }
      if (attempt >= this.MAX_RETRIES) throw err

      const isRetryable = error.status === 429 || error.status === 503
      if (!isRetryable) throw err

      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000
      console.warn(`Gemini isteği başarısız (${error.status}). ${delay}ms sonra tekrar denenecek...`)
      await this.sleep(delay)
      return this.withRetry(fn, attempt + 1)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private parseJSON<T>(text: string): T {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as T
  }

  private ensureModel(): GenerativeModel {
    if (!this.model) {
      throw new Error('Gemini servisi başlatılmamış. Lütfen API key ayarlayın.')
    }
    return this.model
  }

  private getResponseText(result: any): string {
    if (!result?.response) {
      throw new Error('API yanıt döndürmedi.')
    }
    
    const candidate = result.response.candidates?.[0]
    if (!candidate) {
      return result.response.text?.() || ''
    }

    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCK') {
      throw new Error('İçerik güvenlik veya politika filtresine takıldı.')
    }

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('API geçerli bir metin üretemedi (boş içerik döndürdü). Görüntü desteklenmiyor olabilir veya çok karmaşık.')
    }

    return result.response.text()
  }

  async translate(text: string): Promise<TranslateResponse> {
    const model = this.ensureModel()
    return this.enqueue(async () => {
      const result = await model.generateContent([
        TRANSLATION_PROMPT,
        `\nÇevrilecek metin:\n${text}`,
      ])
      const responseText = this.getResponseText(result)
      return this.parseJSON<TranslateResponse>(responseText)
    })
  }

  async translateWithImage(text: string, imageBase64: string): Promise<TranslateResponse> {
    const model = this.ensureModel()
    return this.enqueue(async () => {
      const result = await model.generateContent([
        TRANSLATION_WITH_IMAGE_PROMPT,
        `\nMetin içeriği:\n${text}`,
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
      ])
      const responseText = this.getResponseText(result)
      return this.parseJSON<TranslateResponse>(responseText)
    })
  }

  async recognizeLatexFromImage(imageBase64: string): Promise<LaTeXResponse> {
    const model = this.ensureModel()
    return this.enqueue(async () => {
      const result = await model.generateContent([
        LATEX_OCR_PROMPT,
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
      ])
      const responseText = this.getResponseText(result)
      return this.parseJSON<LaTeXResponse>(responseText)
    })
  }

  async recognizeLatexFromText(text: string): Promise<LaTeXResponse> {
    const model = this.ensureModel()
    return this.enqueue(async () => {
      const result = await model.generateContent([
        LATEX_TEXT_PROMPT,
        `\nDönüştürülecek metin:\n${text}`,
      ])
      const responseText = this.getResponseText(result)
      return this.parseJSON<LaTeXResponse>(responseText)
    })
  }

  async detectContentType(imageBase64: string): Promise<ContentTypeResponse> {
    const model = this.ensureModel()
    return this.enqueue(async () => {
      const result = await model.generateContent([
        CONTENT_TYPE_PROMPT,
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
      ])
      const responseText = this.getResponseText(result)
      return this.parseJSON<ContentTypeResponse>(responseText)
    })
  }

  getErrorMessage(error: unknown): string {
    const err = error as { status?: number; message?: string }
    if (err.status === 429) return 'İstek limiti aşıldı. Lütfen biraz bekleyin.'
    if (err.status === 403) return 'API key geçersiz. .env.local dosyasını kontrol edin.'
    if (err.status === 503) return 'Gemini servisi geçici olarak kullanılamıyor.'
    if (err.message?.includes('API key')) return 'API key tanımlanmamış veya geçersiz.'
    return err.message ?? 'Bilinmeyen bir hata oluştu.'
  }
}

export const geminiService = new GeminiService()
