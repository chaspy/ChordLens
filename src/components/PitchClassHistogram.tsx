import type { PitchClassHistogram as HistogramType } from '../types/midi'

type Props = {
  title?: string
  histogram: HistogramType
  detectedKey?: string
}

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]

function getScaleNotes(key: string): Set<string> {
  const parts = key.split(' ')
  if (parts.length < 2) return new Set()
  const tonic = parts[0]
  const mode = parts[1]
  const tonicIdx = PITCH_CLASSES.indexOf(tonic)
  if (tonicIdx < 0) return new Set()

  const intervals = mode === 'major' ? MAJOR_SCALE_INTERVALS : MINOR_SCALE_INTERVALS
  return new Set(intervals.map((i) => PITCH_CLASSES[(tonicIdx + i) % 12]))
}

export function PitchClassHistogramChart({ title, histogram, detectedKey }: Props) {
  const maxCount = Math.max(1, ...Object.values(histogram))
  const scaleNotes = detectedKey ? getScaleNotes(detectedKey) : new Set<string>()

  const barWidth = 32
  const barGap = 4
  const chartHeight = 120
  const labelHeight = 20
  const svgWidth = PITCH_CLASSES.length * (barWidth + barGap) - barGap + 8
  const svgHeight = chartHeight + labelHeight + 10

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h3 className="mb-2 text-sm font-medium text-slate-200">
        Pitch Class {title ? `(${title})` : 'Distribution'}
      </h3>
      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="mx-auto">
          {PITCH_CLASSES.map((pc, i) => {
            const count = histogram[pc] || 0
            const height = (count / maxCount) * chartHeight
            const x = 4 + i * (barWidth + barGap)
            const y = chartHeight - height
            const isInScale = scaleNotes.has(pc)

            return (
              <g key={pc}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx={2}
                  fill={isInScale ? '#14b8a6' : '#475569'}
                  opacity={count > 0 ? 0.85 : 0.3}
                />
                {count > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#94a3b8"
                  >
                    {Number.isInteger(count) ? count : count.toFixed(1)}
                  </text>
                )}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + labelHeight}
                  textAnchor="middle"
                  fontSize={11}
                  fill={isInScale ? '#2dd4bf' : '#64748b'}
                  fontWeight={isInScale ? 'bold' : 'normal'}
                >
                  {pc}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {detectedKey && (
        <p className="mt-2 text-center text-xs text-slate-400">
          Highlighted: diatonic notes of {detectedKey}
        </p>
      )}
    </section>
  )
}
