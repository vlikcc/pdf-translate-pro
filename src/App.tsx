import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import PDFViewer from './components/PDFViewer/PDFViewer.tsx'
import SelectionOverlay from './components/SelectionOverlay/SelectionOverlay.tsx'
import OutputEditor from './components/OutputEditor/OutputEditor.tsx'
import LaTeXEditor from './components/LaTeXEditor/LaTeXEditor.tsx'
import { useAppStore } from './store/appStore.ts'
import { useGemini } from './hooks/useGemini.ts'
import { exportService } from './services/ExportService.ts'
import type { SelectionRegion } from './types/index.ts'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editorRef = useRef<HTMLDivElement | null>(null)

  const {
    pdf,
    editorBlocks,
    notifications,
    removeNotification,
    status,
    addEditorBlock,
  } = useAppStore()

  const { translateRegion, recognizeLatex, captureImage } = useGemini()

  const [showLatexEditor, setShowLatexEditor] = useState(false)
  const [activeLatex, setActiveLatex] = useState('')
  const [splitPercent, setSplitPercent] = useState(50)
  const isDraggingSplit = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleSplitMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    isDraggingSplit.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: globalThis.MouseEvent) => {
      if (!isDraggingSplit.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitPercent(Math.min(80, Math.max(20, pct)))
    }

    const onMouseUp = () => {
      isDraggingSplit.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  const handleTranslate = useCallback(
    (region: SelectionRegion) => {
      if (!canvasRef.current) return
      translateRegion(region, canvasRef.current)
    },
    [translateRegion],
  )

  const handleLatex = useCallback(
    async (region: SelectionRegion) => {
      if (!canvasRef.current) return
      await recognizeLatex(region, canvasRef.current)
      const latest = useAppStore.getState().latexResults
      const result = latest.find((r) => r.regionId === region.id)
      if (result) {
        setActiveLatex(result.latex)
        setShowLatexEditor(true)
      }
    },
    [recognizeLatex],
  )

  const handleCaptureImage = useCallback(
    (region: SelectionRegion) => {
      if (!canvasRef.current) return
      captureImage(region, canvasRef.current)
    },
    [captureImage],
  )

  const handleLatexInsert = useCallback(
    (latex: string) => {
      addEditorBlock({
        id: `block-${Date.now()}`,
        type: 'formula',
        content: latex,
        order: editorBlocks.length,
      })
      setShowLatexEditor(false)
    },
    [addEditorBlock, editorBlocks.length],
  )

  const handleExportPDF = useCallback(async () => {
    if (!editorRef.current || editorBlocks.length === 0) {
      useAppStore.getState().addNotification({ type: 'warning', message: 'Dışa aktarılacak içerik yok.' })
      return
    }
    useAppStore.getState().addNotification({ type: 'info', message: 'PDF hazırlanıyor...' })
    try {
      await exportService.exportToPDF(editorBlocks, pdf.fileName || 'document', editorRef.current)
      useAppStore.getState().addNotification({ type: 'success', message: 'PDF başarıyla indirildi.' })
    } catch (err) {
      console.error('PDF export error:', err)
      useAppStore.getState().addNotification({
        type: 'error',
        message: `PDF dışa aktarılırken hata: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`,
      })
    }
  }, [editorBlocks, pdf.fileName])

  const handleExportWord = useCallback(async () => {
    if (editorBlocks.length === 0) {
      useAppStore.getState().addNotification({ type: 'warning', message: 'Dışa aktarılacak içerik yok.' })
      return
    }
    useAppStore.getState().addNotification({ type: 'info', message: 'Word belgesi hazırlanıyor...' })
    try {
      await exportService.exportToWord(editorBlocks, pdf.fileName || 'document')
      useAppStore.getState().addNotification({ type: 'success', message: 'Word belge başarıyla indirildi.' })
    } catch (err) {
      console.error('Word export error:', err)
      useAppStore.getState().addNotification({ type: 'error', message: 'Word dışa aktarılırken hata' })
    }
  }, [editorBlocks, pdf.fileName])

  const handleExportLaTeX = useCallback(() => {
    if (editorBlocks.length === 0) {
      useAppStore.getState().addNotification({ type: 'warning', message: 'Dışa aktarılacak içerik yok.' })
      return
    }
    useAppStore.getState().addNotification({ type: 'info', message: 'LaTeX oluşturuluyor...' })
    try {
      exportService.exportToLaTeX(editorBlocks, pdf.fileName || 'document')
      useAppStore.getState().addNotification({ type: 'success', message: 'LaTeX dosyası başarıyla indirildi.' })
    } catch (err) {
      console.error('LaTeX export error:', err)
      useAppStore.getState().addNotification({ type: 'error', message: 'LaTeX dışa aktarılırken hata' })
    }
  }, [editorBlocks, pdf.fileName])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (notifications.length > 0) {
        const oldest = notifications[0]
        if (Date.now() - oldest.timestamp > 5000) {
          removeNotification(oldest.id)
        }
      }
    }, 5000)
    return () => clearTimeout(timeout)
  }, [notifications, removeNotification])

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-800 leading-tight">PDF Translate Pro</h1>

            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status === 'processing' && (
            <div className="flex items-center gap-1.5 text-blue-600">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs">İşleniyor...</span>
            </div>
          )}

          <button
            onClick={() => setShowLatexEditor(!showLatexEditor)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${showLatexEditor
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
          >
            LaTeX Editör
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              disabled={editorBlocks.length === 0}
              className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              PDF İndir
            </button>
            <button
              onClick={handleExportWord}
              disabled={editorBlocks.length === 0}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Word İndir
            </button>
            <button
              onClick={handleExportLaTeX}
              disabled={editorBlocks.length === 0}
              className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              LaTeX İndir
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Left Panel — PDF Viewer */}
        <div className="flex flex-col" style={{ width: `${splitPercent}%` }}>
          <PDFViewer canvasRef={canvasRef}>
            {pdf.arrayBuffer && (
              <SelectionOverlay
                canvasRef={canvasRef}
                onTranslate={handleTranslate}
                onLatex={handleLatex}
                onCaptureImage={handleCaptureImage}
              />
            )}
          </PDFViewer>
        </div>

        {/* Resizable Divider */}
        <div
          onMouseDown={handleSplitMouseDown}
          className="w-1.5 shrink-0 cursor-col-resize bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors relative group"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-400 group-hover:bg-white transition-colors" />
        </div>

        {/* Right Panel */}
        <div className="flex flex-col" style={{ width: `${100 - splitPercent}%` }}>
          {showLatexEditor ? (
            <div className="h-2/5 border-b border-gray-200">
              <LaTeXEditor
                initialLatex={activeLatex}
                onInsert={handleLatexInsert}
                onClose={() => setShowLatexEditor(false)}
              />
            </div>
          ) : null}
          <div className={showLatexEditor ? 'h-3/5' : 'h-full'}>
            <OutputEditor editorRef={editorRef} />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between px-4 py-1.5 bg-white border-t border-gray-200 text-xs text-gray-500 shrink-0">
        <div className="flex items-center gap-4">
          {pdf.arrayBuffer && (
            <>
              <span>Sayfa {pdf.currentPage}/{pdf.totalPages}</span>
              <span>Yakınlaştırma: {Math.round(pdf.scale * 100)}%</span>
            </>
          )}
        </div>
      </footer>

      {/* Notifications */}
      <div className="fixed bottom-12 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm animate-slide-in ${n.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                n.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                  n.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
              }`}
          >
            <span className="flex-1">{n.message}</span>
            <button
              onClick={() => removeNotification(n.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
