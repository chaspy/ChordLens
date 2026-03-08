import type { MidiMeta, MidiSummary, NoteRange } from '../types/midi'

type Props = {
  meta: MidiMeta
  summary: MidiSummary
  range: NoteRange
}

export function Summary({ meta, summary, range }: Props) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-200">Summary</h3>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded bg-slate-700/50 p-2">
          <dt className="text-xs text-slate-400">Tempo</dt>
          <dd className="font-medium text-slate-100">{meta.tempoBpm} BPM</dd>
        </div>
        <div className="rounded bg-slate-700/50 p-2">
          <dt className="text-xs text-slate-400">Time Signature</dt>
          <dd className="font-medium text-slate-100">{meta.timeSignature}</dd>
        </div>
        <div className="rounded bg-slate-700/50 p-2">
          <dt className="text-xs text-slate-400">Tracks</dt>
          <dd className="font-medium text-slate-100">{summary.trackCount}</dd>
        </div>
        <div className="rounded bg-slate-700/50 p-2">
          <dt className="text-xs text-slate-400">Notes</dt>
          <dd className="font-medium text-slate-100">{summary.noteCount}</dd>
        </div>
        <div className="rounded bg-slate-700/50 p-2">
          <dt className="text-xs text-slate-400">Bars</dt>
          <dd className="font-medium text-slate-100">{summary.barCount}</dd>
        </div>
        <div className="rounded bg-slate-700/50 p-2">
          <dt className="text-xs text-slate-400">Phrases</dt>
          <dd className="font-medium text-slate-100">{summary.phraseCount}</dd>
        </div>
        <div className="rounded bg-slate-700/50 p-2">
          <dt className="text-xs text-slate-400">Duration</dt>
          <dd className="font-medium text-slate-100">{summary.durationSeconds}s</dd>
        </div>
        <div className="rounded bg-slate-700/50 p-2">
          <dt className="text-xs text-slate-400">Range</dt>
          <dd className="font-medium text-slate-100">
            {range.lowest} – {range.highest}
          </dd>
        </div>
        <div className="rounded bg-slate-700/50 p-2">
          <dt className="text-xs text-slate-400">First Active Bar</dt>
          <dd className="font-medium text-slate-100">
            {summary.firstActiveBar}
            {meta.hasPickup && <span className="ml-1 text-xs text-amber-300">(pickup)</span>}
          </dd>
        </div>
      </dl>
    </section>
  )
}
