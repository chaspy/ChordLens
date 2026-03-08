import { useMemo } from 'react'
import type { MidiTrack } from '../types/midi'

type Props = {
  tracks: MidiTrack[]
}

const TRACK_COLORS = [
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#ec4899', // pink
  '#f97316', // orange
]

export function PianoRoll({ tracks }: Props) {
  const allNotes = useMemo(() => tracks.flatMap((t) => t.notes), [tracks])

  const bounds = useMemo(() => {
    if (allNotes.length === 0) return { minPitch: 60, maxPitch: 72, maxBeat: 4 }
    let minP = 127, maxP = 0, maxB = 0
    for (const n of allNotes) {
      if (n.pitch < minP) minP = n.pitch
      if (n.pitch > maxP) maxP = n.pitch
      const end = n.startBeat + n.durationBeat
      if (end > maxB) maxB = end
    }
    return {
      minPitch: Math.max(0, minP - 2),
      maxPitch: Math.min(127, maxP + 2),
      maxBeat: Math.ceil(maxB),
    }
  }, [allNotes])

  const pitchRange = bounds.maxPitch - bounds.minPitch + 1
  const noteHeight = 6
  const beatWidth = 40
  const svgWidth = Math.max(600, bounds.maxBeat * beatWidth)
  const svgHeight = pitchRange * noteHeight
  const labelWidth = 40

  if (allNotes.length === 0) {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-200">Piano Roll</h3>
        <p className="text-sm text-slate-400">No notes to display</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h3 className="mb-2 text-sm font-medium text-slate-200">Piano Roll</h3>
      {tracks.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-3">
          {tracks.map((t, i) => (
            <span key={t.id} className="flex items-center gap-1 text-xs text-slate-300">
              <span
                className="inline-block h-2 w-4 rounded"
                style={{ backgroundColor: TRACK_COLORS[i % TRACK_COLORS.length] }}
              />
              {t.name}
            </span>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <svg
          width={svgWidth + labelWidth}
          height={svgHeight + 20}
          className="bg-slate-900"
        >
          {/* Grid lines for beats */}
          {Array.from({ length: bounds.maxBeat + 1 }, (_, i) => (
            <line
              key={`beat-${i}`}
              x1={labelWidth + i * beatWidth}
              y1={0}
              x2={labelWidth + i * beatWidth}
              y2={svgHeight}
              stroke={i % 4 === 0 ? '#475569' : '#1e293b'}
              strokeWidth={i % 4 === 0 ? 1 : 0.5}
            />
          ))}

          {/* Pitch labels for every octave C */}
          {Array.from({ length: pitchRange }, (_, i) => {
            const pitch = bounds.maxPitch - i
            if (pitch % 12 !== 0) return null
            const y = i * noteHeight + noteHeight / 2
            return (
              <text
                key={`label-${pitch}`}
                x={2}
                y={y + 3}
                fontSize={9}
                fill="#94a3b8"
              >
                C{Math.floor(pitch / 12) - 1}
              </text>
            )
          })}

          {/* Horizontal guides for octave boundaries */}
          {Array.from({ length: pitchRange }, (_, i) => {
            const pitch = bounds.maxPitch - i
            if (pitch % 12 !== 0) return null
            return (
              <line
                key={`hline-${pitch}`}
                x1={labelWidth}
                y1={i * noteHeight}
                x2={svgWidth + labelWidth}
                y2={i * noteHeight}
                stroke="#334155"
                strokeWidth={0.5}
              />
            )
          })}

          {/* Notes */}
          {tracks.map((track, trackIdx) =>
            track.notes.map((note, noteIdx) => {
              const x = labelWidth + note.startBeat * beatWidth
              const y = (bounds.maxPitch - note.pitch) * noteHeight
              const w = Math.max(2, note.durationBeat * beatWidth)
              const opacity = 0.5 + (note.velocity / 127) * 0.5
              return (
                <rect
                  key={`${trackIdx}-${noteIdx}`}
                  x={x}
                  y={y}
                  width={w}
                  height={noteHeight - 1}
                  rx={1}
                  fill={TRACK_COLORS[trackIdx % TRACK_COLORS.length]}
                  opacity={opacity}
                >
                  <title>
                    {note.noteName} | Bar {note.bar} Beat {note.beatInBar} | Vel {note.velocity}
                  </title>
                </rect>
              )
            })
          )}

          {/* Beat numbers */}
          {Array.from({ length: Math.floor(bounds.maxBeat / 4) + 1 }, (_, i) => (
            <text
              key={`beatnum-${i}`}
              x={labelWidth + i * 4 * beatWidth + 2}
              y={svgHeight + 14}
              fontSize={9}
              fill="#64748b"
            >
              {i * 4 + 1}
            </text>
          ))}
        </svg>
      </div>
    </section>
  )
}
