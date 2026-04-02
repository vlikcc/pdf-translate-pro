export type ContentType = 'text' | 'image' | 'formula' | 'mixed'

export interface SelectionRegion {
  id: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  contentType: ContentType
  isProcessing: boolean
  isProcessed: boolean
}

export interface TranslationResult {
  id: string
  regionId: string
  originalText: string
  translated: string
  detectedLanguage: string
  confidence: number
}

export interface LaTeXResult {
  id: string
  regionId: string
  latex: string
  formulaCount: number
  hasUncertainty: boolean
}

export type EditorBlockType = 'text' | 'formula' | 'image'

export interface EditorBlock {
  id: string
  type: EditorBlockType
  content: string
  imageData?: string
  caption?: string
  order: number
  widthPercent?: number
  heightPx?: number
}

export interface PDFState {
  file: File | null
  fileName: string
  arrayBuffer: ArrayBuffer | null
  totalPages: number
  currentPage: number
  scale: number
  isScannedPDF: boolean
}

export interface RateLimitState {
  requestsThisMinute: number
  requestsToday: number
  lastRequestTime: number
  minuteResetTime: number
}

export interface GeminiConfig {
  model: string
  apiKey: string
  maxRetries: number
  retryDelayMs: number
  minRequestIntervalMs: number
}

export interface DocumentStyle {
  fontFamily: string
  fontSize: number
  lineHeight: number
  textIndent: number
}

export type ProcessingStatus = 'idle' | 'loading' | 'processing' | 'success' | 'error'

export interface AppNotification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  timestamp: number
}
