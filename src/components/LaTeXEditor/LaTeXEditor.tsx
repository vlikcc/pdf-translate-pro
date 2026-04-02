import { useCallback, useEffect, useRef, useState } from 'react'
import katex from 'katex'

interface LaTeXEditorProps {
  initialLatex?: string
  onInsert: (latex: string) => void
  onClose: () => void
}

export default function LaTeXEditor({ initialLatex = '', onInsert, onClose }: LaTeXEditorProps) {
  const [latex, setLatex] = useState(initialLatex)
  const [displayMode, setDisplayMode] = useState<'inline' | 'display'>('display')
  const [error, setError] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!previewRef.current) return

    let code = latex.trim()
    if (!code) {
      previewRef.current.innerHTML = '<span class="text-gray-400 text-sm">LaTeX kodu girin...</span>'
      setError(null)
      return
    }

    code = code
      .replace(/^\$\$(.*)\$\$$/s, '$1')
      .replace(/^\$(.*)\$$/s, '$1')
      .replace(/^\\\[(.*)\\\]$/s, '$1')
      .replace(/^\\\((.*)\\\)$/s, '$1')
      .trim()

    try {
      katex.render(code, previewRef.current, {
        displayMode: displayMode === 'display',
        throwOnError: true,
        trust: true,
      })
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LaTeX render hatası'
      setError(msg)
      previewRef.current.innerHTML = `<span class="text-red-500 text-xs">${msg}</span>`
    }
  }, [latex, displayMode])

  useEffect(() => {
    setLatex(initialLatex)
  }, [initialLatex])

  const handleInsert = useCallback(() => {
    if (!latex.trim()) return
    const wrapped = displayMode === 'display'
      ? `\\[${latex.trim()}\\]`
      : `$${latex.trim()}$`
    onInsert(wrapped)
  }, [latex, displayMode, onInsert])

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-3 py-2 bg-purple-50 border-b border-purple-200">
        <h3 className="text-sm font-semibold text-purple-800">LaTeX Editör</h3>
        <button onClick={onClose} className="text-purple-400 hover:text-purple-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <span className="text-xs text-gray-500">Mod:</span>
        <button
          onClick={() => setDisplayMode('inline')}
          className={`text-xs px-2 py-0.5 rounded ${
            displayMode === 'inline'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } transition-colors`}
        >
          Inline ($...$)
        </button>
        <button
          onClick={() => setDisplayMode('display')}
          className={`text-xs px-2 py-0.5 rounded ${
            displayMode === 'display'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } transition-colors`}
        >
          Display (\\[...\\])
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 p-3 min-h-0">
          <textarea
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            placeholder="LaTeX kodu buraya yazın... (örn: \frac{a}{b})"
            className="w-full h-full resize-none border border-gray-200 rounded-lg p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
            spellCheck={false}
          />
        </div>

        <div className="border-t border-gray-200">
          <div className="px-3 py-1.5 text-xs text-gray-500 font-medium">Önizleme</div>
          <div
            ref={previewRef}
            className={`px-3 pb-3 min-h-[60px] flex items-center ${
              displayMode === 'display' ? 'justify-center' : 'justify-start'
            } ${error ? 'bg-red-50' : 'bg-gray-50'} mx-3 mb-3 rounded-lg`}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleInsert}
          disabled={!latex.trim() || !!error}
          className="flex-1 px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Editöre Ekle
        </button>
      </div>
    </div>
  )
}
