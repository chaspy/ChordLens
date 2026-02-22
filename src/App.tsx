import { useMemo, useState } from 'react'
import { ImageDropzone } from './components/ImageDropzone'
import { KeyCard } from './components/KeyCard'
import { TonalMap } from './components/TonalMap'
import { sanitizeChordArray } from './lib/chords'
import { detectKeyCandidates, detectModulation, isAmbiguousParallel } from './lib/keyDetection'
import { extractChordsWithLLM } from './lib/openai'
import './index.css'

const DEFAULT_EXAMPLES = ['C Am F G', 'Am F C G', 'Dm G C Am', 'C Am Em G']

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [model, setModel] = useState(import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4.1-mini')
  const [baseUrl, setBaseUrl] = useState(import.meta.env.VITE_OPENAI_BASE_URL ?? 'https://api.openai.com/v1')
  const [chordText, setChordText] = useState('')
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [analysisClicked, setAnalysisClicked] = useState(false)

  const progression = useMemo(() => sanitizeChordArray(chordText.split(/[\n,\s]+/)), [chordText])
  const keyResults = useMemo(() => detectKeyCandidates(progression), [progression])
  const ambiguous = useMemo(() => isAmbiguousParallel(keyResults), [keyResults])
  const modulation = useMemo(() => detectModulation(progression), [progression])

  const activeApiKey = apiKeyInput.trim() || import.meta.env.VITE_OPENAI_API_KEY || ''

  const onSelectFile = async (file: File) => {
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setStatus('画像を読み込みました。必要なら手動でコードを入力してから解析できます。')
  }

  const onExtract = async () => {
    if (!selectedFile) {
      setStatus('先に画像を選択してください。')
      return
    }
    if (!activeApiKey) {
      setStatus('APIキーが未設定です。.env.local または入力欄に設定してください。')
      return
    }

    try {
      setLoading(true)
      setStatus('LLMでコード抽出中...')
      const imageDataUrl = await fileToDataUrl(selectedFile)
      const chords = await extractChordsWithLLM({
        imageDataUrl,
        apiKey: activeApiKey,
        model,
        baseUrl
      })
      setChordText(chords.join(' '))
      setStatus('抽出完了。必要なら手修正して「Analyze Key」を押してください。')
    } catch (error) {
      setStatus(
        `抽出に失敗しました。手動で入力して続行してください: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setLoading(false)
    }
  }

  const onAnalyze = () => {
    setAnalysisClicked(true)
    if (progression.length < 3) {
      setStatus('Not enough harmonic data（3つ以上のコードが必要です）')
      return
    }
    setStatus('解析完了')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">ChordLens</h1>
          <p className="mt-1 text-sm text-slate-400">Image-to-Chords + Local Key Detection (No Backend)</p>
        </header>

        <section className="mb-6 grid gap-4 rounded-xl border border-slate-700 bg-slate-800/40 p-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-300">OpenAI API Key（必須）</span>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-...（空なら.env.localを使用）"
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none ring-teal-400/60 transition focus:ring"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Model</span>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none ring-teal-400/60 transition focus:ring"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Base URL</span>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none ring-teal-400/60 transition focus:ring"
              />
            </label>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <ImageDropzone onSelectFile={onSelectFile} previewUrl={previewUrl} />

            <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-200">Chord Progression</h3>
                <div className="space-x-2">
                  <button
                    onClick={onExtract}
                    disabled={loading || !selectedFile}
                    className="rounded-md bg-teal-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Extracting...' : 'Extract Chords'}
                  </button>
                  <button
                    onClick={onAnalyze}
                    className="rounded-md border border-slate-500 px-3 py-2 text-sm transition hover:border-slate-400"
                  >
                    Analyze Key
                  </button>
                </div>
              </div>

              <textarea
                rows={5}
                value={chordText}
                onChange={(e) => setChordText(e.target.value)}
                placeholder="例: C Am F G"
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none ring-teal-400/60 transition focus:ring"
              />

              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {DEFAULT_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setChordText(ex)}
                    className="rounded-full border border-slate-600 px-2 py-1 text-slate-300 transition hover:border-teal-400 hover:text-teal-300"
                  >
                    {ex}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-xs text-slate-400">{status || '画像抽出または手入力後に解析できます。'}</p>
            </section>

            <TonalMap topResult={analysisClicked ? keyResults[0] : undefined} />
          </div>

          <div className="space-y-4">
            <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <h2 className="text-lg font-semibold">Top 3 Key Candidates</h2>
              {analysisClicked && progression.length < 3 && (
                <p className="mt-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  Not enough harmonic data
                </p>
              )}
              {analysisClicked && progression.length >= 3 && ambiguous && (
                <p className="mt-2 rounded-md border border-cyan-400/50 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
                  Ambiguous (parallel key)
                </p>
              )}
              {analysisClicked && progression.length >= 3 ? (
                <div className="mt-4 space-y-3">
                  {keyResults.map((result, idx) => (
                    <KeyCard key={result.key} rank={idx} result={result} highlight={idx === 0} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">解析結果はここに表示されます。</p>
              )}
            </section>

            <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-xs text-slate-300">
              <h3 className="mb-2 text-sm font-medium text-slate-200">Future Hook</h3>
              <p>detectModulation result count: {modulation.length}</p>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
