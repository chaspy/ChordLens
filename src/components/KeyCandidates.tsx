import { useState } from 'react'
import type { KeyCandidateScore } from '../types/midi'

type Props = {
  candidates: KeyCandidateScore[]
}

const MEDALS = ['🥇', '🥈', '🥉']
const METHOD_LABELS: Record<string, string> = {
  combined: 'Combined', count: 'Count', duration: 'Duration', strongBeat: 'Strong Beat',
}

export function KeyCandidates({ candidates }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (candidates.length === 0) {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
        <h3 className="text-sm font-medium text-slate-200">Key Candidates</h3>
        <p className="mt-2 text-sm text-slate-400">No data available</p>
      </section>
    )
  }

  const combined = candidates.filter((c) => c.method === 'combined')
  const byMethod = candidates.filter((c) => c.method !== 'combined')
  const methods = [...new Set(byMethod.map((c) => c.method))]

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-200">Key Candidates</h3>

      <div className="space-y-2">
        {combined.map((candidate, idx) => {
          const maxScore = Math.max(...combined.map((c) => c.score))
          const pct = maxScore > 0 ? Math.max(0, (candidate.score / maxScore) * 100) : 0
          const uid = `${candidate.method}-${candidate.key}`
          const isExpanded = expandedKey === uid
          const bias = candidate.biasSignals

          return (
            <div key={uid}>
              <button
                onClick={() => setExpandedKey(isExpanded ? null : uid)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  idx === 0 ? 'border-teal-400 bg-slate-800/90' : 'border-slate-700 bg-slate-800/60'
                } hover:bg-slate-800`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{MEDALS[idx] ?? `#${idx + 1}`}</span>
                    <span className={`font-semibold ${idx === 0 ? 'text-lg text-white' : 'text-sm text-slate-200'}`}>
                      {candidate.key}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>profile={candidate.profileScore.toFixed(3)}</span>
                    <span>total={candidate.score.toFixed(3)}</span>
                  </div>
                </div>

                {/* Relative / parallel key */}
                <div className="mt-1 flex gap-3 text-[10px] text-slate-500">
                  <span>Relative: {candidate.relativeKey}</span>
                  <span>Parallel: {candidate.parallelKey}</span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="mt-1 space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
                  {/* Bias signals */}
                  <div>
                    <p className="mb-1 text-xs text-slate-400">Bias signals:</p>
                    <div className="grid grid-cols-5 gap-1 text-[10px]">
                      <div className="rounded bg-slate-800 p-1.5 text-center">
                        <div className="text-slate-500">finalNote</div>
                        <div className={bias.finalNoteBias > 0 ? 'text-teal-300' : 'text-slate-500'}>
                          {bias.finalNoteBias > 0 ? '+' : ''}{bias.finalNoteBias}
                        </div>
                      </div>
                      <div className="rounded bg-slate-800 p-1.5 text-center">
                        <div className="text-slate-500">phraseEnd</div>
                        <div className={bias.phraseEndingBias > 0 ? 'text-teal-300' : 'text-slate-500'}>
                          {bias.phraseEndingBias > 0 ? '+' : ''}{bias.phraseEndingBias}
                        </div>
                      </div>
                      <div className="rounded bg-slate-800 p-1.5 text-center">
                        <div className="text-slate-500">downbeat</div>
                        <div className={bias.barDownbeatBias > 0 ? 'text-teal-300' : 'text-slate-500'}>
                          {bias.barDownbeatBias > 0 ? '+' : ''}{bias.barDownbeatBias}
                        </div>
                      </div>
                      <div className="rounded bg-slate-800 p-1.5 text-center">
                        <div className="text-slate-500">triadCov</div>
                        <div className="text-slate-300">{bias.tonicTriadCoverage}</div>
                      </div>
                      <div className="rounded bg-slate-800 p-1.5 text-center">
                        <div className="text-slate-500">nonScale</div>
                        <div className={bias.nonScaleToneCount > 0 ? 'text-amber-300' : 'text-slate-300'}>
                          {bias.nonScaleToneCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scale degree histogram */}
                  {Object.keys(candidate.scaleDegreeHistogram).length > 0 && (
                    <div>
                      <p className="mb-1 text-xs text-slate-400">Scale degrees:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(candidate.scaleDegreeHistogram).map(([deg, count]) => (
                          <span
                            key={deg}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              deg === 'non-scale' ? 'bg-amber-900/30 text-amber-300' : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {deg}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pitch-class contributions */}
                  {candidate.breakdown.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs text-slate-400">Per-pitch-class contribution:</p>
                      <div className="grid grid-cols-6 gap-1 text-[10px]">
                        {candidate.breakdown.map((b) => (
                          <div
                            key={b.pitchClass}
                            className={`rounded p-1 text-center ${
                              b.contribution > 0 ? 'bg-teal-900/40 text-teal-300' : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            <div className="font-bold">{b.pitchClass}</div>
                            <div>n={b.count}</div>
                            <div>{b.contribution > 0 ? '+' : ''}{b.contribution.toFixed(3)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Per-method summaries */}
      {methods.length > 0 && (
        <div className="mt-4 space-y-2">
          {methods.map((method) => {
            const items = byMethod.filter((c) => c.method === method)
            return (
              <div key={method}>
                <p className="mb-1 text-xs font-medium text-slate-400">{METHOD_LABELS[method] ?? method}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((c, i) => (
                    <span
                      key={c.key}
                      className={`rounded border border-slate-600 px-2 py-1 text-xs ${
                        i === 0 ? 'text-slate-100' : 'text-slate-400'
                      }`}
                    >
                      {c.key} ({c.score.toFixed(3)})
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
