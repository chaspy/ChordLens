import type { Phrase } from '../types/midi'

type Props = {
  phrases: Phrase[]
}

export function PhraseList({ phrases }: Props) {
  if (phrases.length === 0) return null

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-200">
        Phrases ({phrases.length})
      </h3>
      <div className="space-y-2">
        {phrases.map((phrase) => (
          <div
            key={phrase.id}
            className="rounded-lg border border-slate-700 bg-slate-800/60 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">
                Phrase {phrase.id + 1}
                {phrase.similarPhraseIds.length > 0 && (
                  <span className="ml-2 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300">
                    similar to {phrase.similarPhraseIds.map((i) => i + 1).join(', ')}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-400">
                bar {phrase.startBar}–{phrase.endBar} | beat {phrase.startBeat}–{phrase.endBeat}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              <div className="rounded bg-slate-700/50 p-1.5">
                <span className="text-slate-400">Notes: </span>
                <span className="text-slate-200">{phrase.noteCount}</span>
              </div>
              <div className="rounded bg-slate-700/50 p-1.5">
                <span className="text-slate-400">Range: </span>
                <span className="text-slate-200">
                  {phrase.range.lowest}–{phrase.range.highest}
                </span>
              </div>
              <div className="rounded bg-slate-700/50 p-1.5">
                <span className="text-slate-400">Avg: </span>
                <span className="text-slate-200">{phrase.avgPitch.toFixed(1)}</span>
              </div>
              <div className="rounded bg-slate-700/50 p-1.5">
                <span className="text-slate-400">Key: </span>
                <span className="text-teal-300">
                  {phrase.keyCandidates[0]?.key ?? '-'}
                </span>
              </div>
            </div>

            {/* Mini pitch class bars */}
            <div className="mt-2 flex gap-0.5">
              {Object.entries(phrase.pitchClasses).map(([pc, count]) => {
                const maxCount = Math.max(1, ...Object.values(phrase.pitchClasses))
                const height = count > 0 ? Math.max(2, (count / maxCount) * 20) : 0
                return (
                  <div key={pc} className="flex flex-col items-center" style={{ width: '7%' }}>
                    <div
                      className="w-full rounded-sm bg-teal-500/60"
                      style={{ height: `${height}px` }}
                      title={`${pc}: ${count}`}
                    />
                    {count > 0 && (
                      <span className="text-[8px] text-slate-500">{pc}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
