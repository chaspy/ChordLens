import type { KeyResult } from '../types/music'
import { ConfidenceBar } from './ConfidenceBar'

type Props = {
  rank: number
  result: KeyResult
  highlight?: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']

export function KeyCard({ rank, result, highlight = false }: Props) {
  return (
    <article
      className={`rounded-xl border p-4 transition ${
        highlight ? 'border-teal-400 bg-slate-800/90' : 'border-slate-700 bg-slate-800/60'
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{MEDALS[rank] ?? `#${rank + 1}`}</p>
          <h3 className={`font-semibold ${highlight ? 'text-2xl text-white' : 'text-lg text-slate-100'}`}>
            {result.key}
          </h3>
        </div>
        <p className="text-sm text-slate-300">Score: {result.score}</p>
      </div>

      <ConfidenceBar value={result.confidence} />

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
        <div className="rounded bg-slate-700/50 p-2">Diatonic: {result.breakdown.diatonicScore}</div>
        <div className="rounded bg-slate-700/50 p-2">Resolution: {result.breakdown.resolutionScore}</div>
        <div className="rounded bg-slate-700/50 p-2">Dominant: {result.breakdown.dominantScore}</div>
        <div className="rounded bg-slate-700/50 p-2">Penalty: {result.breakdown.penalty}</div>
      </dl>

      <div className="mt-3 space-y-2 text-xs">
        <p className="text-slate-300">
          Scale: <span className="text-slate-100">{result.keyCandidate.scaleNotes.join(' - ')}</span>
        </p>
        <p className="text-slate-300">
          Diatonic: <span className="text-slate-100">{result.keyCandidate.diatonicChords.join(' ')}</span>
        </p>
      </div>
    </article>
  )
}
