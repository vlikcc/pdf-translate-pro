import { useCallback, useEffect, useRef, useState } from 'react'
import { usePDF } from '../../hooks/usePDF.ts'
import { useAppStore } from '../../store/appStore.ts'

interface PDFViewerProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  children?: React.ReactNode
}

export default function PDFViewer({ canvasRef, children }: PDFViewerProps) {
  const { pdf, loadFile, renderCurrentPage, goToPage, zoom, close } = usePDF()
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [pageInput, setPageInput] = useState('')
  const status = useAppStore((s) => s.status)

  useEffect(() => {
    if (canvasRef.current && pdf.arrayBuffer) {
      renderCurrentPage(canvasRef.current)
    }
  }, [pdf.currentPage, pdf.scale, pdf.arrayBuffer, renderCurrentPage, canvasRef])

  useEffect(() => {
    setPageInput(String(pdf.currentPage))
  }, [pdf.currentPage])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) loadFile(file)
    },
    [loadFile],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) loadFile(file)
    },
    [loadFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handlePageInputSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const page = parseInt(pageInput, 10)
      if (!isNaN(page)) goToPage(page)
    },
    [pageInput, goToPage],
  )

  if (!pdf.arrayBuffer) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-full border-2 border-dashed rounded-xl transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">PDF Dosyası Yükleyin</h3>
          <p className="text-sm text-gray-500 mb-4">Sürükle-bırak veya dosya seçin (maks. 50 MB)</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm cursor-pointer"
          >
            Dosya Seç
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 truncate max-w-[160px]" title={pdf.fileName}>
            {pdf.fileName}
          </span>
          <button onClick={close} className="text-gray-400 hover:text-red-500 transition-colors" title="Kapat">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(pdf.currentPage - 1)}
            disabled={pdf.currentPage <= 1}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
            title="Önceki sayfa"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              className="w-10 text-center text-xs border border-gray-300 rounded px-1 py-0.5"
            />
            <span className="text-xs text-gray-500">/ {pdf.totalPages}</span>
          </form>
          <button
            onClick={() => goToPage(pdf.currentPage + 1)}
            disabled={pdf.currentPage >= pdf.totalPages}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
            title="Sonraki sayfa"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => zoom(-0.1)}
            disabled={pdf.scale <= 0.5}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
            title="Uzaklaştır"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs text-gray-600 min-w-[40px] text-center">
            {Math.round(pdf.scale * 100)}%
          </span>
          <button
            onClick={() => zoom(0.1)}
            disabled={pdf.scale >= 3.0}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
            title="Yakınlaştır"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {pdf.isScannedPDF && (
        <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Taranmış PDF — metin katmanı bulunamadı. Görsel OCR modunu kullanın.
        </div>
      )}

      <div className="flex-1 overflow-auto bg-gray-200">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
            <div className="flex items-center gap-2 text-blue-600">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Yükleniyor...</span>
            </div>
          </div>
        )}
        <div className="flex justify-center p-4">
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              className="shadow-lg bg-white block"
            />
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
