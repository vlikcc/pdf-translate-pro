import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore.ts'
import { geminiService } from '../services/GeminiService.ts'
import { pdfExtractor } from '../services/PDFExtractor.ts'
import type { SelectionRegion } from '../types/index.ts'

export function useGemini() {
  const {
    addTranslation,
    addLatexResult,
    addEditorBlock,
    updateSelection,
    addNotification,
    incrementRequests,
    setStatus,
    editorBlocks,
    pdf,
  } = useAppStore()

  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = geminiService.initialize()
    }
  }, [])

  const translateRegion = useCallback(
    async (region: SelectionRegion, canvas: HTMLCanvasElement) => {
      if (!initialized.current) {
        addNotification({ type: 'error', message: 'Gemini API başlatılmamış. API key kontrol edin.' })
        return
      }

      updateSelection(region.id, { isProcessing: true })
      setStatus('processing')

      try {
        const regionRect = { x: region.x, y: region.y, width: region.width, height: region.height }

        const text = await pdfExtractor.extractText(
          region.pageNumber,
          regionRect,
          pdf.scale,
        )

        const imageBase64 = await pdfExtractor.captureRegion(canvas, regionRect)

        if (!text.trim() && !imageBase64) {
          addNotification({ type: 'warning', message: 'Metin bulunamadı. Görsel OCR modunu deneyin.' })
          updateSelection(region.id, { isProcessing: false, contentType: 'image' })
          setStatus('idle')
          return
        }

        incrementRequests()

        const result = imageBase64
          ? await geminiService.translateWithImage(text || '(metin çıkarılamadı — görseli analiz et)', imageBase64)
          : await geminiService.translate(text)

        const translationId = `tr-${Date.now()}`
        addTranslation({
          id: translationId,
          regionId: region.id,
          originalText: text,
          translated: result.translated,
          detectedLanguage: result.detectedLanguage,
          confidence: result.confidence,
        })

        addEditorBlock({
          id: `block-${Date.now()}`,
          type: 'text',
          content: result.translated,
          order: editorBlocks.length,
        })

        updateSelection(region.id, { isProcessing: false, isProcessed: true })
        setStatus('success')
        addNotification({ type: 'success', message: 'Çeviri tamamlandı.' })
      } catch (err) {
        const message = geminiService.getErrorMessage(err)
        addNotification({ type: 'error', message })
        updateSelection(region.id, { isProcessing: false })
        setStatus('error')
      }
    },
    [addTranslation, addEditorBlock, updateSelection, addNotification, incrementRequests, setStatus, editorBlocks.length, pdf.scale],
  )

  const recognizeLatex = useCallback(
    async (region: SelectionRegion, canvas: HTMLCanvasElement) => {
      if (!initialized.current) {
        addNotification({ type: 'error', message: 'Gemini API başlatılmamış. API key kontrol edin.' })
        return
      }

      updateSelection(region.id, { isProcessing: true })
      setStatus('processing')

      try {
        const base64 = await pdfExtractor.captureRegion(canvas, {
          x: region.x, y: region.y, width: region.width, height: region.height,
        })

        incrementRequests()
        const result = await geminiService.recognizeLatexFromImage(base64)

        const latexId = `ltx-${Date.now()}`
        addLatexResult({
          id: latexId,
          regionId: region.id,
          latex: result.latex,
          formulaCount: result.formulaCount,
          hasUncertainty: result.hasUncertainty,
        })

        addEditorBlock({
          id: `block-${Date.now()}`,
          type: 'formula',
          content: result.latex,
          order: editorBlocks.length,
        })

        updateSelection(region.id, { isProcessing: false, isProcessed: true })
        setStatus('success')

        if (result.hasUncertainty) {
          addNotification({ type: 'warning', message: 'Bazı formüller belirsiz olabilir. Lütfen kontrol edin.' })
        } else {
          addNotification({ type: 'success', message: `${result.formulaCount} formül tanındı.` })
        }
      } catch (err) {
        const message = geminiService.getErrorMessage(err)
        addNotification({ type: 'error', message })
        updateSelection(region.id, { isProcessing: false })
        setStatus('error')
      }
    },
    [addLatexResult, addEditorBlock, updateSelection, addNotification, incrementRequests, setStatus, editorBlocks.length],
  )

  const captureImage = useCallback(
    async (region: SelectionRegion, canvas: HTMLCanvasElement) => {
      try {
        const base64 = await pdfExtractor.captureRegion(canvas, {
          x: region.x, y: region.y, width: region.width, height: region.height,
        }, 0)

        addEditorBlock({
          id: `block-${Date.now()}`,
          type: 'image',
          content: '',
          imageData: `data:image/png;base64,${base64}`,
          order: editorBlocks.length,
        })

        updateSelection(region.id, { isProcessing: false, isProcessed: true })
        addNotification({ type: 'success', message: 'Görsel kesildi ve editöre eklendi.' })
      } catch {
        addNotification({ type: 'error', message: 'Görsel kesilirken hata oluştu.' })
      }
    },
    [addEditorBlock, updateSelection, addNotification, editorBlocks.length],
  )

  return {
    isInitialized: initialized.current,
    translateRegion,
    recognizeLatex,
    captureImage,
  }
}
