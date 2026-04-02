import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker()

export interface TextItem {
  text: string
  x: number
  y: number
  width: number
  height: number
}

class PDFExtractor {
  private document: PDFDocumentProxy | null = null
  private pageCache = new Map<number, PDFPageProxy>()

  async loadDocument(arrayBuffer: ArrayBuffer): Promise<{ totalPages: number; isScanned: boolean }> {
    this.destroy()
    const data = new Uint8Array(arrayBuffer)
    this.document = await pdfjsLib.getDocument({ data }).promise
    const totalPages = this.document.numPages

    const firstPage = await this.getPage(1)
    const textContent = await firstPage.getTextContent()
    const isScanned = textContent.items.length === 0

    return { totalPages, isScanned }
  }

  private async getPage(pageNumber: number): Promise<PDFPageProxy> {
    if (!this.document) throw new Error('PDF yüklenmemiş')
    if (this.pageCache.has(pageNumber)) return this.pageCache.get(pageNumber)!

    const page = await this.document.getPage(pageNumber)
    this.pageCache.set(pageNumber, page)
    return page
  }

  async renderPage(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number,
  ): Promise<{ width: number; height: number }> {
    const page = await this.getPage(pageNumber)
    const dpr = window.devicePixelRatio || 1
    const renderScale = Math.max(scale * dpr, 2.0)

    const cssViewport = page.getViewport({ scale })
    const renderViewport = page.getViewport({ scale: renderScale })

    canvas.width = renderViewport.width
    canvas.height = renderViewport.height
    canvas.style.width = `${cssViewport.width}px`
    canvas.style.height = `${cssViewport.height}px`

    const context = canvas.getContext('2d')!
    await page.render({ canvasContext: context, viewport: renderViewport, canvas }).promise

    return { width: cssViewport.width, height: cssViewport.height }
  }

  async extractText(
    pageNumber: number,
    rect?: { x: number; y: number; width: number; height: number },
    scale = 1.0,
  ): Promise<string> {
    const page = await this.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const viewport = page.getViewport({ scale })

    const items: TextItem[] = textContent.items
      .filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number } => 'str' in item && 'transform' in item)
      .map((item) => {
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
        return {
          text: item.str,
          x: tx[4],
          y: tx[5],
          width: item.width * scale,
          height: item.height * scale,
        }
      })

    if (!rect) {
      return items.map((i) => i.text).join(' ')
    }

    const filtered = items.filter((item) => {
      const itemRight = item.x + item.width
      const itemBottom = item.y + item.height
      const rectRight = rect.x + rect.width
      const rectBottom = rect.y + rect.height

      return (
        item.x < rectRight &&
        itemRight > rect.x &&
        item.y < rectBottom &&
        itemBottom > rect.y
      )
    })

    filtered.sort((a, b) => {
      const lineDiff = Math.abs(a.y - b.y)
      if (lineDiff < 5) return a.x - b.x
      return a.y - b.y
    })

    return filtered.map((i) => i.text).join(' ')
  }

  async captureRegion(
    canvas: HTMLCanvasElement,
    rect: { x: number; y: number; width: number; height: number },
    maxDimension: number = 2048,
  ): Promise<string> {
    const cssWidth = parseFloat(canvas.style.width)
    const renderScale = cssWidth > 0 ? canvas.width / cssWidth : (window.devicePixelRatio || 1)

    const srcX = rect.x * renderScale
    const srcY = rect.y * renderScale
    const srcW = rect.width * renderScale
    const srcH = rect.height * renderScale

    const fitScale = maxDimension > 0
      ? Math.min(1, maxDimension / Math.max(srcW, srcH))
      : 1

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = Math.round(srcW * fitScale)
    tempCanvas.height = Math.round(srcH * fitScale)

    const ctx = tempCanvas.getContext('2d')!
    ctx.drawImage(
      canvas,
      srcX, srcY, srcW, srcH,
      0, 0, tempCanvas.width, tempCanvas.height,
    )

    const dataUrl = tempCanvas.toDataURL('image/png')
    return dataUrl.split(',')[1]
  }

  getPageCount(): number {
    return this.document?.numPages ?? 0
  }

  destroy(): void {
    if (this.document) {
      this.document.destroy()
      this.document = null
    }
    this.pageCache.clear()
  }
}

export const pdfExtractor = new PDFExtractor()
