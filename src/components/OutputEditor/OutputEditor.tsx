import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import { useAppStore } from '../../store/appStore.ts'
import type { EditorBlock, DocumentStyle } from '../../types/index.ts'

const FONT_OPTIONS: { value: string; label: string; css: string }[] = [
  { value: 'serif', label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  { value: 'sans', label: 'Sans-serif', css: '"Inter", "Segoe UI", system-ui, sans-serif' },
  { value: 'mono', label: 'Mono', css: '"JetBrains Mono", "Fira Code", monospace' },
  { value: 'times', label: 'Times', css: '"Times New Roman", Times, serif' },
  { value: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { value: 'georgia', label: 'Georgia', css: 'Georgia, "Palatino Linotype", serif' },
]

const FONT_SIZE_OPTIONS = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24]
const LINE_HEIGHT_OPTIONS = [1.0, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0, 2.2, 2.5]
const TEXT_INDENT_OPTIONS = [0, 10, 15, 20, 25, 30, 40, 50]

function getFontCSS(family: string): string {
  return FONT_OPTIONS.find((f) => f.value === family)?.css ?? family
}

// ---------------------------------------------------------------------------
// Parsing: split content into paragraph-level blocks, each containing
// inline segments (plain text, bold, italic, inline-math, display-math).
// ---------------------------------------------------------------------------

type InlineType = 'text' | 'bold' | 'italic' | 'inline-math'

interface InlineSegment {
  type: InlineType
  content: string
}

type ParagraphKind = 'paragraph' | 'heading' | 'display-math' | 'list-item' | 'ordered-item'

interface ParagraphBlock {
  kind: ParagraphKind
  level?: number          // heading level (2 or 3)
  index?: number          // ordered-item number
  segments: InlineSegment[]
  raw: string
}

function parseContent(text: string): ParagraphBlock[] {
  const paragraphs = text.split(/\n{2,}/)
  const blocks: ParagraphBlock[] = []

  for (const raw of paragraphs) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    // Display math block (standalone $$ ... $$)
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      blocks.push({
        kind: 'display-math',
        segments: [{ type: 'inline-math', content: trimmed.slice(2, -2).trim() }],
        raw: trimmed,
      })
      continue
    }

    // Sub-lines within a paragraph (single newlines) become separate blocks
    // for list detection
    const lines = trimmed.split('\n')
    for (const line of lines) {
      const l = line.trim()
      if (!l) continue

      // Heading: ## or ###
      const headingMatch = l.match(/^(#{2,3})\s+(.+)$/)
      if (headingMatch) {
        blocks.push({
          kind: 'heading',
          level: headingMatch[1].length,
          segments: parseInline(headingMatch[2]),
          raw: l,
        })
        continue
      }

      // Ordered list: "1. text"
      const orderedMatch = l.match(/^(\d+)\.\s+(.+)$/)
      if (orderedMatch) {
        blocks.push({
          kind: 'ordered-item',
          index: parseInt(orderedMatch[1], 10),
          segments: parseInline(orderedMatch[2]),
          raw: l,
        })
        continue
      }

      // Unordered list: "- text"
      if (l.startsWith('- ')) {
        blocks.push({
          kind: 'list-item',
          segments: parseInline(l.slice(2)),
          raw: l,
        })
        continue
      }

      // Regular paragraph
      blocks.push({
        kind: 'paragraph',
        segments: parseInline(l),
        raw: l,
      })
    }
  }

  return blocks
}

/**
 * Parse inline content: LaTeX ($...$), **bold**, *italic*, plain text.
 * Order matters — $$ inside a line becomes inline-math with display intent,
 * handled at render time.
 */
function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  // Regex order: $$ (display inline), $ (inline math), ** (bold), * (italic)
  const re = /(\$\$[\s\S]+?\$\$|\$(?!\$)(?:[^$\\]|\\.)+?\$|\*\*(?:[^*]|\*(?!\*))+?\*\*|\*(?:[^*])+?\*)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', content: text.slice(last, match.index) })
    }
    const m = match[0]
    if (m.startsWith('$$') && m.endsWith('$$')) {
      segments.push({ type: 'inline-math', content: m.slice(2, -2).trim() })
    } else if (m.startsWith('$') && m.endsWith('$')) {
      segments.push({ type: 'inline-math', content: m.slice(1, -1).trim() })
    } else if (m.startsWith('**') && m.endsWith('**')) {
      segments.push({ type: 'bold', content: m.slice(2, -2) })
    } else if (m.startsWith('*') && m.endsWith('*')) {
      segments.push({ type: 'italic', content: m.slice(1, -1) })
    }
    last = re.lastIndex
  }

  if (last < text.length) {
    segments.push({ type: 'text', content: text.slice(last) })
  }

  return segments
}

// ---------------------------------------------------------------------------
// KaTeX render helpers
// ---------------------------------------------------------------------------

function KaTeXInline({ latex }: { latex: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!ref.current) return
    try {
      katex.render(latex, ref.current, { displayMode: false, throwOnError: false, trust: true })
    } catch {
      if (ref.current) ref.current.textContent = latex
    }
  }, [latex])
  return <span ref={ref} className="mx-0.5" />
}

function KaTeXDisplay({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    try {
      katex.render(latex, ref.current, { displayMode: true, throwOnError: false, trust: true })
    } catch {
      if (ref.current) ref.current.textContent = latex
    }
  }, [latex])
  return <div ref={ref} className="my-3 text-center overflow-x-auto" />
}

// ---------------------------------------------------------------------------
// Inline segment renderer
// ---------------------------------------------------------------------------

function InlineSegments({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'text':
            return <span key={i}>{seg.content}</span>
          case 'bold':
            return <strong key={i} className="font-bold">{seg.content}</strong>
          case 'italic':
            return <em key={i}>{seg.content}</em>
          case 'inline-math':
            return <KaTeXInline key={i} latex={seg.content} />
        }
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// ParagraphBlock renderer
// ---------------------------------------------------------------------------

function ParagraphBlockRenderer({ block, docStyle }: { block: ParagraphBlock; docStyle: DocumentStyle }) {
  const baseFontPx = docStyle.fontSize
  const fontCss = getFontCSS(docStyle.fontFamily)
  const lh = docStyle.lineHeight

  switch (block.kind) {
    case 'heading':
      if (block.level === 2) {
        return (
          <h2
            className="font-bold text-gray-900 mt-5 mb-2"
            style={{ fontSize: baseFontPx + 4, lineHeight: lh, fontFamily: fontCss }}
          >
            <InlineSegments segments={block.segments} />
          </h2>
        )
      }
      return (
        <h3
          className="font-bold text-gray-800 mt-4 mb-1.5"
          style={{ fontSize: baseFontPx + 2, lineHeight: lh, fontFamily: fontCss }}
        >
          <InlineSegments segments={block.segments} />
        </h3>
      )

    case 'display-math':
      return <KaTeXDisplay latex={block.segments[0]?.content ?? ''} />

    case 'list-item':
      return (
        <li
          className="ml-5 list-disc text-gray-700 mb-1"
          style={{ fontSize: baseFontPx, lineHeight: lh, fontFamily: fontCss }}
        >
          <InlineSegments segments={block.segments} />
        </li>
      )

    case 'ordered-item':
      return (
        <li
          className="ml-5 list-decimal text-gray-700 mb-1"
          value={block.index}
          style={{ fontSize: baseFontPx, lineHeight: lh, fontFamily: fontCss }}
        >
          <InlineSegments segments={block.segments} />
        </li>
      )

    case 'paragraph':
    default:
      return (
        <p
          className="text-gray-700 mb-3"
          style={{
            fontSize: baseFontPx,
            lineHeight: lh,
            fontFamily: fontCss,
            textIndent: docStyle.textIndent > 0 ? `${docStyle.textIndent}px` : undefined,
          }}
        >
          <InlineSegments segments={block.segments} />
        </p>
      )
  }
}

// ---------------------------------------------------------------------------
// RichTextBlock — view + edit modes for a text EditorBlock
// ---------------------------------------------------------------------------

function RichTextBlock({
  block,
  onUpdate,
  docStyle,
}: {
  block: EditorBlock
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void
  docStyle: DocumentStyle
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(block.content)
  const parsed = useMemo(() => parseContent(block.content), [block.content])

  useEffect(() => {
    setEditValue(block.content)
  }, [block.content])

  if (isEditing) {
    return (
      <div className="p-2">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            onUpdate(block.id, { content: editValue })
            setIsEditing(false)
          }}
          autoFocus
          className="w-full p-3 text-sm font-mono leading-relaxed border border-blue-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 min-h-[6em] bg-white"
          rows={Math.max(4, editValue.split('\n').length + 1)}
        />
        <div className="flex gap-3 mt-1.5 text-[10px] text-gray-400">
          <span>**kalın**</span>
          <span>*italik*</span>
          <span>## Başlık</span>
          <span>$formül$</span>
          <span>$$büyük formül$$</span>
          <span>Boş satır = paragraf</span>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="p-3 cursor-text hover:bg-blue-50/30 rounded transition-colors min-h-[2em]"
      title="Düzenlemek için tıklayın"
    >
      {parsed.map((pb, i) => (
        <ParagraphBlockRenderer key={i} block={pb} docStyle={docStyle} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formula block renderer (standalone formula)
// ---------------------------------------------------------------------------

function FormulaBlock({
  block,
  onUpdate,
}: {
  block: EditorBlock
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void
}) {
  const formulaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!formulaRef.current) return
    let code = block.content.trim()
    code = code
      .replace(/^\$\$(.*)\$\$$/s, '$1')
      .replace(/^\$(.*)\$$/s, '$1')
      .replace(/^\\\[(.*)\\\]$/s, '$1')
      .replace(/^\\\((.*)\\\)$/s, '$1')
      .trim()
    try {
      katex.render(code, formulaRef.current, { displayMode: true, throwOnError: false, trust: true })
    } catch {
      if (formulaRef.current) formulaRef.current.textContent = block.content
    }
  }, [block.content])

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div ref={formulaRef} className="text-center py-2 overflow-x-auto" />
      <details className="mt-2">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">LaTeX kodu</summary>
        <textarea
          value={block.content}
          onChange={(e) => onUpdate(block.id, { content: e.target.value })}
          className="w-full mt-1 p-2 text-xs font-mono bg-white border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-purple-300"
          rows={3}
        />
      </details>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Image block renderer
// ---------------------------------------------------------------------------

function ImageBlock({
  block,
  onUpdate,
}: {
  block: EditorBlock
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void
}) {
  return (
    <div className="p-2 text-center">
      {block.imageData && (
        <img
          src={block.imageData}
          alt={block.caption ?? 'Kesilen görsel'}
          className="max-w-full mx-auto rounded shadow-sm"
          style={{ maxHeight: block.heightPx ? '100%' : 400, objectFit: 'contain' }}
        />
      )}
      <input
        type="text"
        value={block.caption ?? ''}
        onChange={(e) => onUpdate(block.id, { caption: e.target.value })}
        placeholder="Açıklama ekle..."
        className="mt-2 text-xs text-center text-gray-500 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none w-full"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Block type dispatcher
// ---------------------------------------------------------------------------

function BlockRenderer({
  block,
  onUpdate,
  docStyle,
}: {
  block: EditorBlock
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void
  docStyle: DocumentStyle
}) {
  switch (block.type) {
    case 'text':
      return <RichTextBlock block={block} onUpdate={onUpdate} docStyle={docStyle} />
    case 'formula':
      return <FormulaBlock block={block} onUpdate={onUpdate} />
    case 'image':
      return <ImageBlock block={block} onUpdate={onUpdate} />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Resizable wrapper — adds corner/edge handles to resize a block
// ---------------------------------------------------------------------------

function ResizableBlockWrapper({
  block,
  onUpdate,
  children,
}: {
  block: EditorBlock
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void
  children: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)

  const widthPct = block.widthPercent ?? 100
  const heightPx = block.heightPx

  const startResize = useCallback(
    (e: React.MouseEvent, axis: 'both' | 'width' | 'height') => {
      e.preventDefault()
      e.stopPropagation()
      if (!containerRef.current) return

      setIsResizing(true)
      const parent = containerRef.current.parentElement
      if (!parent) return
      const parentWidth = parent.clientWidth
      const startX = e.clientX
      const startY = e.clientY
      const startW = containerRef.current.clientWidth
      const startH = containerRef.current.clientHeight

      document.body.style.cursor =
        axis === 'both' ? 'nwse-resize' : axis === 'width' ? 'ew-resize' : 'ns-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: globalThis.MouseEvent) => {
        const updates: Partial<EditorBlock> = {}

        if (axis === 'width' || axis === 'both') {
          const newW = startW + (ev.clientX - startX)
          const pct = Math.min(100, Math.max(20, (newW / parentWidth) * 100))
          updates.widthPercent = Math.round(pct)
        }

        if (axis === 'height' || axis === 'both') {
          const newH = startH + (ev.clientY - startY)
          updates.heightPx = Math.max(40, Math.round(newH))
        }

        onUpdate(block.id, updates)
      }

      const onUp = () => {
        setIsResizing(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [block.id, onUpdate],
  )

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: widthPct < 100 ? `${widthPct}%` : undefined,
        height: heightPx ? `${heightPx}px` : undefined,
        overflow: heightPx ? 'hidden' : undefined,
      }}
    >
      {children}

      {/* Right edge — width only */}
      <div
        onMouseDown={(e) => startResize(e, 'width')}
        className={`absolute top-0 -right-1 w-2 h-full cursor-ew-resize z-10 transition-colors ${
          isResizing ? 'bg-blue-400/40' : 'hover:bg-blue-300/30'
        }`}
      />

      {/* Bottom edge — height only */}
      <div
        onMouseDown={(e) => startResize(e, 'height')}
        className={`absolute -bottom-1 left-0 w-full h-2 cursor-ns-resize z-10 transition-colors ${
          isResizing ? 'bg-blue-400/40' : 'hover:bg-blue-300/30'
        }`}
      />

      {/* Corner handle — both */}
      <div
        onMouseDown={(e) => startResize(e, 'both')}
        className={`absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 cursor-nwse-resize z-20 rounded-sm transition-colors ${
          isResizing ? 'bg-blue-500' : 'bg-gray-300 hover:bg-blue-400'
        }`}
      >
        <svg className="w-full h-full text-white p-0.5" viewBox="0 0 10 10" fill="currentColor">
          <path d="M8 2v6H2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      {/* Dimension badge */}
      {isResizing && (
        <div className="absolute -bottom-6 right-0 text-[9px] text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 z-30 whitespace-nowrap">
          {Math.round(widthPct)}%{heightPx ? ` × ${heightPx}px` : ''}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main OutputEditor
// ---------------------------------------------------------------------------

interface OutputEditorProps {
  editorRef: React.RefObject<HTMLDivElement | null>
}

function StyleToolbar() {
  const { documentStyle, setDocumentStyle } = useAppStore()

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 whitespace-nowrap">Yazı Tipi</span>
        <select
          value={documentStyle.fontFamily}
          onChange={(e) => setDocumentStyle({ fontFamily: e.target.value })}
          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 whitespace-nowrap">Boyut</span>
        <select
          value={documentStyle.fontSize}
          onChange={(e) => setDocumentStyle({ fontSize: Number(e.target.value) })}
          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 w-14"
        >
          {FONT_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 whitespace-nowrap">Satır Aralığı</span>
        <select
          value={documentStyle.lineHeight}
          onChange={(e) => setDocumentStyle({ lineHeight: Number(e.target.value) })}
          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 w-14"
        >
          {LINE_HEIGHT_OPTIONS.map((lh) => (
            <option key={lh} value={lh}>{lh}x</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 whitespace-nowrap">Paragraf Girintisi</span>
        <select
          value={documentStyle.textIndent}
          onChange={(e) => setDocumentStyle({ textIndent: Number(e.target.value) })}
          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 w-16"
        >
          {TEXT_INDENT_OPTIONS.map((ti) => (
            <option key={ti} value={ti}>{ti === 0 ? 'Yok' : `${ti}px`}</option>
          ))}
        </select>
      </label>
    </div>
  )
}

export default function OutputEditor({ editorRef }: OutputEditorProps) {
  const { editorBlocks, documentStyle, updateEditorBlock, removeEditorBlock, reorderEditorBlocks, clearEditorBlocks } =
    useAppStore()

  const sorted = [...editorBlocks].sort((a, b) => a.order - b.order)

  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index
  }, [])

  const handleDragEnter = useCallback((index: number) => {
    dragOver.current = index
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragItem.current !== null && dragOver.current !== null && dragItem.current !== dragOver.current) {
      reorderEditorBlocks(dragItem.current, dragOver.current)
    }
    dragItem.current = null
    dragOver.current = null
  }, [reorderEditorBlocks])

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 mb-1">Henüz içerik yok</p>
        <p className="text-xs text-gray-400">PDF'den bölge seçip çeviri veya LaTeX dönüşümü yapın</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
        <h3 className="text-sm font-semibold text-gray-700">Çıktı Editörü</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{sorted.length} blok</span>
          <button
            onClick={clearEditorBlocks}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Temizle
          </button>
        </div>
      </div>

      <div className="px-3 py-2 bg-gray-50/70 border-b border-gray-200 shrink-0">
        <StyleToolbar />
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3 bg-white">
        <div ref={editorRef} className="max-w-[210mm] mx-auto bg-white shadow-sm border border-gray-100 rounded-lg px-10 py-8 min-h-[297mm]">
          {sorted.map((block, index) => (
            <div
              key={block.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="group relative mb-3 rounded-lg border border-transparent hover:border-gray-200 transition-colors"
            >
              <div className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
                </svg>
              </div>

              <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => removeEditorBlock(block.id)}
                  className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-sm"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <ResizableBlockWrapper block={block} onUpdate={updateEditorBlock}>
                <BlockRenderer block={block} onUpdate={updateEditorBlock} docStyle={documentStyle} />
              </ResizableBlockWrapper>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
