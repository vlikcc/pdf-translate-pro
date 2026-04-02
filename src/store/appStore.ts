import { create } from 'zustand'
import type {
  SelectionRegion,
  TranslationResult,
  LaTeXResult,
  EditorBlock,
  PDFState,
  RateLimitState,
  ProcessingStatus,
  AppNotification,
  DocumentStyle,
} from '../types/index.ts'

interface AppStore {
  pdf: PDFState
  selections: SelectionRegion[]
  translations: TranslationResult[]
  latexResults: LaTeXResult[]
  editorBlocks: EditorBlock[]
  documentStyle: DocumentStyle
  rateLimit: RateLimitState
  status: ProcessingStatus
  notifications: AppNotification[]
  activeSelectionId: string | null

  setPDF: (pdf: Partial<PDFState>) => void
  resetPDF: () => void
  setCurrentPage: (page: number) => void
  setScale: (scale: number) => void

  addSelection: (region: SelectionRegion) => void
  updateSelection: (id: string, updates: Partial<SelectionRegion>) => void
  removeSelection: (id: string) => void
  clearSelections: () => void
  setActiveSelection: (id: string | null) => void

  addTranslation: (result: TranslationResult) => void
  addLatexResult: (result: LaTeXResult) => void

  addEditorBlock: (block: EditorBlock) => void
  updateEditorBlock: (id: string, updates: Partial<EditorBlock>) => void
  removeEditorBlock: (id: string) => void
  reorderEditorBlocks: (fromIndex: number, toIndex: number) => void
  clearEditorBlocks: () => void

  updateRateLimit: (updates: Partial<RateLimitState>) => void
  incrementRequests: () => void

  setStatus: (status: ProcessingStatus) => void
  setDocumentStyle: (updates: Partial<DocumentStyle>) => void

  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
}

const initialPDFState: PDFState = {
  file: null,
  fileName: '',
  arrayBuffer: null,
  totalPages: 0,
  currentPage: 1,
  scale: 1.0,
  isScannedPDF: false,
}

const initialRateLimit: RateLimitState = {
  requestsThisMinute: 0,
  requestsToday: 0,
  lastRequestTime: 0,
  minuteResetTime: 0,
}

const initialDocumentStyle: DocumentStyle = {
  fontFamily: 'serif',
  fontSize: 14,
  lineHeight: 1.7,
  textIndent: 0,
}

let notificationCounter = 0

export const useAppStore = create<AppStore>((set) => ({
  pdf: initialPDFState,
  selections: [],
  translations: [],
  latexResults: [],
  editorBlocks: [],
  documentStyle: initialDocumentStyle,
  rateLimit: initialRateLimit,
  status: 'idle',
  notifications: [],
  activeSelectionId: null,

  setPDF: (updates) =>
    set((state) => ({ pdf: { ...state.pdf, ...updates } })),

  resetPDF: () =>
    set({
      pdf: initialPDFState,
      selections: [],
      translations: [],
      latexResults: [],
    }),

  setCurrentPage: (page) =>
    set((state) => ({ pdf: { ...state.pdf, currentPage: page } })),

  setScale: (scale) =>
    set((state) => ({ pdf: { ...state.pdf, scale } })),

  addSelection: (region) =>
    set((state) => ({ selections: [...state.selections, region] })),

  updateSelection: (id, updates) =>
    set((state) => ({
      selections: state.selections.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  removeSelection: (id) =>
    set((state) => ({
      selections: state.selections.filter((s) => s.id !== id),
      activeSelectionId: state.activeSelectionId === id ? null : state.activeSelectionId,
    })),

  clearSelections: () =>
    set({ selections: [], activeSelectionId: null }),

  setActiveSelection: (id) =>
    set({ activeSelectionId: id }),

  addTranslation: (result) =>
    set((state) => ({ translations: [...state.translations, result] })),

  addLatexResult: (result) =>
    set((state) => ({ latexResults: [...state.latexResults, result] })),

  addEditorBlock: (block) =>
    set((state) => ({ editorBlocks: [...state.editorBlocks, block] })),

  updateEditorBlock: (id, updates) =>
    set((state) => ({
      editorBlocks: state.editorBlocks.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    })),

  removeEditorBlock: (id) =>
    set((state) => ({
      editorBlocks: state.editorBlocks.filter((b) => b.id !== id),
    })),

  reorderEditorBlocks: (fromIndex, toIndex) =>
    set((state) => {
      const blocks = [...state.editorBlocks]
      const [moved] = blocks.splice(fromIndex, 1)
      blocks.splice(toIndex, 0, moved)
      return { editorBlocks: blocks.map((b, i) => ({ ...b, order: i })) }
    }),

  clearEditorBlocks: () =>
    set({ editorBlocks: [] }),

  setDocumentStyle: (updates) =>
    set((state) => ({ documentStyle: { ...state.documentStyle, ...updates } })),

  updateRateLimit: (updates) =>
    set((state) => ({ rateLimit: { ...state.rateLimit, ...updates } })),

  incrementRequests: () =>
    set((state) => {
      const now = Date.now()
      const minuteReset = now - state.rateLimit.minuteResetTime > 60000
      return {
        rateLimit: {
          requestsThisMinute: minuteReset ? 1 : state.rateLimit.requestsThisMinute + 1,
          requestsToday: state.rateLimit.requestsToday + 1,
          lastRequestTime: now,
          minuteResetTime: minuteReset ? now : state.rateLimit.minuteResetTime,
        },
      }
    }),

  setStatus: (status) => set({ status }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: `notif-${++notificationCounter}`, timestamp: Date.now() },
      ],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}))
