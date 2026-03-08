import { useCallback } from 'react'
import type { MidiAnalysisResult } from '../types/midi'

type Props = {
  data: MidiAnalysisResult
}

export function JsonPanel({ data }: Props) {
  const jsonString = JSON.stringify(data, null, 2)

  const handleDownload = useCallback(() => {
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const baseName = data.meta.sourceFile.replace(/\.(mid|midi|smf)$/i, '')
    a.href = url
    a.download = `${baseName}-analysis.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [jsonString, data.meta.sourceFile])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(jsonString)
  }, [jsonString])

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">JSON Output</h3>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="rounded bg-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-600"
          >
            Copy
          </button>
          <button
            onClick={handleDownload}
            className="rounded bg-teal-600 px-3 py-1 text-xs text-white transition hover:bg-teal-500"
          >
            Download
          </button>
        </div>
      </div>
      <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-300">
        {jsonString}
      </pre>
    </section>
  )
}
