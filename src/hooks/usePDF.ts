import { useCallback, useRef } from 'react'
import { useAppStore } from '../store/appStore.ts'
import { pdfExtractor } from '../services/PDFExtractor.ts'

const MAX_FILE_SIZE = 50 * 1024 * 1024

export function usePDF() {
  const { setPDF, resetPDF, setCurrentPage, setScale, addNotification, setStatus, pdf } =
    useAppStore()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const loadFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        addNotification({ type: 'error', message: 'Lütfen bir PDF dosyası seçin.' })
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        addNotification({ type: 'error', message: 'Dosya boyutu 50 MB\'ı aşamaz.' })
        return
      }

      setStatus('loading')
      try {
        const arrayBuffer = await file.arrayBuffer()
        const { totalPages, isScanned } = await pdfExtractor.loadDocument(arrayBuffer)

        setPDF({
          file,
          fileName: file.name,
          arrayBuffer,
          totalPages,
          currentPage: 1,
          isScannedPDF: isScanned,
        })

        if (isScanned) {
          addNotification({
            type: 'warning',
            message: 'Bu PDF taranmış görünüyor. Metin çıkarma çalışmayabilir, görsel OCR modunu deneyebilirsiniz.',
          })
        }

        addNotification({ type: 'success', message: `${file.name} başarıyla yüklendi (${totalPages} sayfa).` })
        setStatus('idle')
      } catch {
        addNotification({ type: 'error', message: 'PDF yüklenirken bir hata oluştu.' })
        setStatus('error')
      }
    },
    [setPDF, addNotification, setStatus],
  )

  const renderCurrentPage = useCallback(
    async (canvas: HTMLCanvasElement) => {
      canvasRef.current = canvas
      if (!pdf.arrayBuffer) return
      try {
        await pdfExtractor.renderPage(pdf.currentPage, canvas, pdf.scale)
      } catch {
        addNotification({ type: 'error', message: 'Sayfa render edilirken hata oluştu.' })
      }
    },
    [pdf.arrayBuffer, pdf.currentPage, pdf.scale, addNotification],
  )

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= pdf.totalPages) {
        setCurrentPage(page)
      }
    },
    [pdf.totalPages, setCurrentPage],
  )

  const zoom = useCallback(
    (delta: number) => {
      const newScale = Math.min(3.0, Math.max(0.5, pdf.scale + delta))
      setScale(Math.round(newScale * 10) / 10)
    },
    [pdf.scale, setScale],
  )

  const fitToWidth = useCallback(
    (containerWidth: number) => {
      if (!canvasRef.current) return
      const ratio = containerWidth / (canvasRef.current.width / pdf.scale)
      setScale(Math.round(ratio * 10) / 10)
    },
    [pdf.scale, setScale],
  )

  const close = useCallback(() => {
    pdfExtractor.destroy()
    resetPDF()
  }, [resetPDF])

  return {
    pdf,
    canvasRef,
    loadFile,
    renderCurrentPage,
    goToPage,
    zoom,
    fitToWidth,
    close,
  }
}
