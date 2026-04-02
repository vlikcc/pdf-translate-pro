import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'
import { Document, Packer, Paragraph, TextRun, ImageRun } from 'docx'
import type { EditorBlock } from '../types/index.ts'

class ExportService {
  async exportToPDF(
    _blocks: EditorBlock[],
    fileName: string,
    editorElement: HTMLElement,
  ): Promise<void> {
    const clone = editorElement.cloneNode(true) as HTMLElement

    clone.style.position = 'absolute'
    clone.style.left = '-9999px'
    clone.style.top = '0'
    clone.style.width = `${editorElement.scrollWidth}px`
    clone.style.minHeight = 'auto'
    clone.style.overflow = 'visible'
    clone.style.border = 'none'
    clone.style.boxShadow = 'none'
    clone.style.background = '#ffffff'
    clone.style.color = '#1f2937'

    clone.querySelectorAll('[class*="group-hover"]').forEach((el) => {
      (el as HTMLElement).style.display = 'none'
    })
    clone.querySelectorAll('.opacity-0').forEach((el) => {
      (el as HTMLElement).style.display = 'none'
    })
    clone.querySelectorAll('[draggable]').forEach((el) => {
      el.removeAttribute('draggable')
    })

    document.body.appendChild(clone)

    try {
      await new Promise((r) => setTimeout(r, 100))

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        foreignObjectRendering: false,
        removeContainer: false,
      })

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const contentWidth = pdfWidth - margin * 2

      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = contentWidth / imgWidth
      const pageContentHeight = pdfHeight - margin * 2
      const sourcePageHeight = pageContentHeight / ratio

      if (imgHeight * ratio <= pageContentHeight) {
        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, imgHeight * ratio)
      } else {
        let yOffset = 0
        let pageIndex = 0

        while (yOffset < imgHeight) {
          const sliceHeight = Math.min(sourcePageHeight, imgHeight - yOffset)

          const pageCanvas = document.createElement('canvas')
          pageCanvas.width = imgWidth
          pageCanvas.height = Math.round(sliceHeight)

          const ctx = pageCanvas.getContext('2d')!
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
          ctx.drawImage(
            canvas,
            0, Math.round(yOffset), imgWidth, Math.round(sliceHeight),
            0, 0, imgWidth, Math.round(sliceHeight),
          )

          const pageImg = pageCanvas.toDataURL('image/jpeg', 0.95)
          if (pageIndex > 0) pdf.addPage()
          pdf.addImage(pageImg, 'JPEG', margin, margin, contentWidth, sliceHeight * ratio)

          yOffset += sliceHeight
          pageIndex++
        }
      }

      const outputName = this.buildFileName(fileName, 'pdf')
      pdf.save(outputName)
    } finally {
      document.body.removeChild(clone)
    }
  }

  private buildFileName(original: string, ext: string): string {
    const base = original.replace(/\.[^.]+$/, '')
    return `${base}_TR.${ext}`
  }

  private async getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.src = base64
    })
  }

  async exportToWord(blocks: EditorBlock[], fileName: string): Promise<void> {
    const children: any[] = []

    for (const block of blocks) {
      if (block.type === 'image' && block.imageData) {
        try {
          const dims = await this.getImageDimensions(block.imageData)
          const ratio = Math.min(1, 500 / dims.width)
          const base64Data = block.imageData.replace(/^data:image\/\w+;base64,/, '')
          const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: Math.round(dims.width * ratio),
                    height: Math.round(dims.height * ratio),
                  },
                  type: 'png' as const,
                } as any),
              ],
              spacing: { after: 200 }
            })
          )
        } catch (e) {
          console.error('Docx image error', e)
        }
      } else {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.content,
                font: block.type === 'formula' ? 'Courier New' : 'Calibri',
                size: 24, // 12pt
              })
            ],
            spacing: { after: 200 }
          })
        )
      }
    }

    const doc = new Document({
      sections: [{ properties: {}, children }],
    })

    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = this.buildFileName(fileName, 'docx')
    link.click()
    URL.revokeObjectURL(url)
  }

  exportToLaTeX(blocks: EditorBlock[], fileName: string): void {
    let tex = "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n\\usepackage{graphicx}\n\n\\begin{document}\n\n"

    for (const block of blocks) {
      if (block.type === 'text') {
        tex += `${block.content}\n\n`
      } else if (block.type === 'formula') {
        tex += `\\begin{equation*}\n${block.content}\n\\end{equation*}\n\n`
      } else if (block.type === 'image') {
        tex += `\\begin{figure}[h!]\n\\centering\n% [Görsel bulunmaktadır: Resmi LaTeX belgesine manuel ekleyiniz]\n\\caption{${block.caption || 'Görsel'}}\n\\end{figure}\n\n`
      }
    }

    tex += "\\end{document}\n"

    const blob = new Blob([tex], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = this.buildFileName(fileName, 'tex')
    link.click()
    URL.revokeObjectURL(url)
  }
}

export const exportService = new ExportService()
