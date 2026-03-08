import type { BarAnalysis } from '../types/midi'

type Props = {
  bars: BarAnalysis[]
}

const TIER_STYLES = {
  primary: 'bg-teal-500/20 text-teal-300',
  extended: 'bg-blue-500/15 text-blue-300',
  altered: 'bg-slate-600/30 text-slate-400',
}

export function BarChordTable({ bars }: Props) {
  if (bars.length === 0) return null

  const activeBars = bars.filter((b) => b.noteCount > 0)

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-200">
        Per-Bar Chord Candidates ({activeBars.length} bars)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th className="px-2 py-1">Bar</th>
              <th className="px-2 py-1">PCs</th>
              <th className="px-2 py-1">Chords (local)</th>
              <th className="px-2 py-1">Progression</th>
            </tr>
          </thead>
          <tbody>
            {activeBars.map((bar) => (
              <tr key={bar.bar} className="border-b border-slate-800">
                <td className="px-2 py-1.5 font-mono text-slate-300">{bar.bar}</td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-0.5">
                    {bar.pitchClasses.map((pc) => (
                      <span key={pc} className="rounded bg-slate-700 px-1 py-0.5 text-[10px] text-slate-300">
                        {pc}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {bar.chordCandidates.slice(0, 5).map((cc) => (
                      <span
                        key={cc.chord}
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          cc.isDiatonic ? TIER_STYLES[cc.tier] : 'bg-amber-500/15 text-amber-300'
                        }`}
                        title={`matched: ${cc.matchedNotes.join(',')} | unmatched: ${cc.unmatchedNotes.join(',') || 'none'} | tier: ${cc.tier}`}
                      >
                        {cc.chord}
                        <span className="ml-0.5 opacity-60">({cc.score.toFixed(2)})</span>
                      </span>
                    ))}
                    {bar.chordCandidates.length === 0 && (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {bar.progressionCandidates.slice(0, 3).map((pc) => (
                      <span
                        key={pc.chord}
                        className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300"
                        title={`local: ${pc.localScore} | trans: ${pc.transitionCost} | cadence: ${pc.cadenceLikelihood}`}
                      >
                        {pc.chord}
                        <span className="ml-0.5 opacity-60">({pc.progressionScore.toFixed(2)})</span>
                      </span>
                    ))}
                    {bar.progressionCandidates.length === 0 && (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
        <span><span className="inline-block h-2 w-3 rounded bg-teal-500/30" /> diatonic</span>
        <span><span className="inline-block h-2 w-3 rounded bg-amber-500/20" /> non-diatonic</span>
        <span><span className="inline-block h-2 w-3 rounded bg-violet-500/20" /> progression-aware</span>
      </div>
    </section>
  )
}
