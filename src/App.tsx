import { useCallback, useState } from 'react'
import { MidiDropzone } from './components/MidiDropzone'
import { PianoRoll } from './components/PianoRoll'
import { PitchClassHistogramChart } from './components/PitchClassHistogram'
import { KeyCandidates } from './components/KeyCandidates'
import { Summary } from './components/Summary'
import { JsonPanel } from './components/JsonPanel'
import { TonalMap } from './components/TonalMap'
import { BarChordTable } from './components/BarChordTable'
import { PhraseList } from './components/PhraseList'
import { parseMidiFile } from './lib/midiParser'
import { analyzeNotes } from './lib/midiAnalysis'
import type { MidiAnalysisResult } from './types/midi'
import type { KeyResult } from './types/music'
import './index.css'

function App() {
  const [fileName, setFileName] = useState<string>('')
  const [result, setResult] = useState<MidiAnalysisResult | null>(null)
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const onSelectFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setError('')
    setStatus('解析中...')
    setLoading(true)

    try {
      const { meta, tracks } = await parseMidiFile(file)

      if (tracks.length === 0) {
        setError('MIDIファイルにノートデータが含まれていません。')
        setResult(null)
        setStatus('')
        return
      }

      const { analysis, summary } = analyzeNotes(meta, tracks)

      setResult({ meta, tracks, analysis, summary })
      setStatus(`解析完了 — ${summary.noteCount} notes, ${summary.trackCount} tracks, ${summary.barCount} bars, ${summary.phraseCount} phrases`)
    } catch (err) {
      setError(
        `MIDIファイルの読み込みに失敗しました: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
      setResult(null)
      setStatus('')
    } finally {
      setLoading(false)
    }
  }, [])

  // Bridge to TonalMap's KeyResult format
  const topCombined = result?.analysis.keyCandidates.find((k) => k.method === 'combined')
  const topKeyResult: KeyResult | undefined = topCombined
    ? {
        key: topCombined.key,
        score: topCombined.score,
        confidence: 1,
        breakdown: { diatonicScore: 0, resolutionScore: 0, dominantScore: 0, penalty: 0 },
        keyCandidate: {
          name: topCombined.key,
          mode: topCombined.mode,
          tonic: topCombined.tonic,
          scaleNotes: [],
          diatonicChords: [],
        },
      }
    : undefined

  const topKeyName = topCombined?.key

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">ChordLens</h1>
          <p className="mt-1 text-sm text-slate-400">
            MIDI Structure Analysis — Visualize, Analyze, Export
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Left column */}
          <div className="space-y-4">
            <MidiDropzone onSelectFile={onSelectFile} fileName={fileName} />

            {loading && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                <p className="animate-pulse text-sm text-teal-300">解析中...</p>
              </div>
            )}

            {status && !loading && (
              <p className="text-xs text-slate-400">{status}</p>
            )}

            {result && (
              <>
                <Summary
                  meta={result.meta}
                  summary={result.summary}
                  range={result.analysis.range}
                />
                <TonalMap topResult={topKeyResult} />
                <KeyCandidates candidates={result.analysis.keyCandidates} />
                <JsonPanel data={result} />
              </>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {result ? (
              <>
                <PianoRoll tracks={result.tracks} />
                <div className="grid gap-4 md:grid-cols-2">
                  <PitchClassHistogramChart
                    title="Count"
                    histogram={result.analysis.histograms.count}
                    detectedKey={topKeyName}
                  />
                  <PitchClassHistogramChart
                    title="Duration-weighted"
                    histogram={result.analysis.histograms.durationWeighted}
                    detectedKey={topKeyName}
                  />
                </div>
                <PitchClassHistogramChart
                  title="Strong-beat-weighted"
                  histogram={result.analysis.histograms.strongBeatWeighted}
                  detectedKey={topKeyName}
                />
                <BarChordTable bars={result.analysis.bars} />
                <PhraseList phrases={result.analysis.phrases} />
              </>
            ) : (
              <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 p-8">
                <div className="text-center">
                  <p className="text-lg text-slate-400">MIDIファイルをアップロードして解析を開始</p>
                  <p className="mt-2 text-sm text-slate-500">
                    .mid / .midi ファイルをドラッグ＆ドロップ
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
