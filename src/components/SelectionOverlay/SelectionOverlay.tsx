import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore.ts'
import type { SelectionRegion, ContentType } from '../../types/index.ts'

interface SelectionOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onTranslate: (region: SelectionRegion) => void
  onLatex: (region: SelectionRegion) => void
  onCaptureImage: (region: SelectionRegion) => void
}

let selectionCounter = 0

export default function SelectionOverlay({
  canvasRef,
  onTranslate,
  onLatex,
  onCaptureImage,
}: SelectionOverlayProps) {
  const { selections, addSelection, updateSelection, removeSelection, activeSelectionId, setActiveSelection, pdf } =
    useAppStore()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    },
    [canvasRef],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('.selection-actions') || target.closest('.resize-handle')) return

      setActiveSelection(null)
      const coords = getCanvasCoords(e)
      setIsDrawing(true)
      setStartPos(coords)
      setCurrentRect(null)
    },
    [getCanvasCoords, setActiveSelection],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing) return
      const coords = getCanvasCoords(e)
      const x = Math.min(startPos.x, coords.x)
      const y = Math.min(startPos.y, coords.y)
      const width = Math.abs(coords.x - startPos.x)
      const height = Math.abs(coords.y - startPos.y)
      setCurrentRect({ x, y, width, height })
    },
    [isDrawing, startPos, getCanvasCoords],
  )

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentRect) {
      setIsDrawing(false)
      return
    }

    if (currentRect.width > 10 && currentRect.height > 10) {
      const id = `sel-${++selectionCounter}-${Date.now()}`
      const region: SelectionRegion = {
        id,
        pageNumber: pdf.currentPage,
        ...currentRect,
        contentType: 'text',
        isProcessing: false,
        isProcessed: false,
      }
      addSelection(region)
      setActiveSelection(id)
    }

    setIsDrawing(false)
    setCurrentRect(null)
  }, [isDrawing, currentRect, pdf.currentPage, addSelection, setActiveSelection])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveSelection(null)
        setIsDrawing(false)
        setCurrentRect(null)
      }
      if (e.key === 'Delete' && activeSelectionId) {
        removeSelection(activeSelectionId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSelectionId, removeSelection, setActiveSelection])

  const toDisplayCoords = (r: { x: number; y: number; width: number; height: number }) => ({
    left: r.x,
    top: r.y,
    width: r.width,
    height: r.height,
  })

  const handleContentTypeChange = useCallback(
    (id: string, contentType: ContentType) => {
      updateSelection(id, { contentType })
    },
    [updateSelection],
  )

  const pageSelections = selections.filter((s) => s.pageNumber === pdf.currentPage)

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ pointerEvents: pdf.arrayBuffer ? 'auto' : 'none' }}
    >
      {currentRect && (
        <div
          className="selection-region"
          style={toDisplayCoords(currentRect)}
        />
      )}

      {pageSelections.map((sel) => {
        const display = toDisplayCoords(sel)
        const isActive = sel.id === activeSelectionId
        return (
          <div key={sel.id} onClick={() => setActiveSelection(sel.id)}>
            <div
              className={`selection-region ${isActive ? 'active' : ''} ${sel.isProcessed ? 'border-green-500 bg-green-500/10' : ''}`}
              style={{
                ...display,
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
            >
              {sel.isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                  <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>

            {isActive && !sel.isProcessing && (
              <div
                className="selection-actions absolute z-20 flex flex-col gap-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2"
                style={{
                  left: display.left + display.width + 8,
                  top: display.top,
                  minWidth: 140,
                }}
              >
                <div className="flex items-center gap-1 mb-1 px-1">
                  <select
                    value={sel.contentType}
                    onChange={(e) => handleContentTypeChange(sel.id, e.target.value as ContentType)}
                    className="text-xs border border-gray-200 rounded px-1 py-0.5 flex-1"
                  >
                    <option value="text">Metin</option>
                    <option value="formula">Formül</option>
                    <option value="image">Görsel</option>
                    <option value="mixed">Karma</option>
                  </select>
                </div>

                <button
                  onClick={() => onTranslate(sel)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-blue-50 text-blue-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  Çevir
                </button>

                <button
                  onClick={() => onLatex(sel)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-50 text-purple-700 transition-colors"
                >
                  <span className="text-[10px] font-bold w-3.5 text-center">fx</span>
                  LaTeX
                </button>

                <button
                  onClick={() => onCaptureImage(sel)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-green-50 text-green-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Görsel Kes
                </button>

                <hr className="border-gray-100" />

                <button
                  onClick={() => removeSelection(sel.id)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-red-50 text-red-500 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Sil
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
