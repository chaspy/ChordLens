import type { KeyResult } from '../types/music'

const FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F']

type Props = {
  topResult?: KeyResult
}

function getParallelLabel(key: string): string {
  const [tonic, mode] = key.split(' ')
  if (!tonic || !mode) {
    return ''
  }
  return `${tonic} ${mode === 'major' ? 'minor' : 'major'}`
}

export function TonalMap({ topResult }: Props) {
  const active = topResult?.key ?? ''
  const parallel = active ? getParallelLabel(active) : ''
  const activeTonic = active.split(' ')[0]
  const parallelTonic = parallel.split(' ')[0]

  const size = 320
  const center = size / 2
  const radius = 120

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-200">Tonal Map (Circle of Fifths)</h3>
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-sm">
        <defs>
          <radialGradient id="ring" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>
        </defs>
        <circle cx={center} cy={center} r={radius + 18} fill="url(#ring)" stroke="#334155" strokeWidth="2" />

        {FIFTHS.map((note, idx) => {
          const angle = (idx / FIFTHS.length) * Math.PI * 2 - Math.PI / 2
          const x = center + Math.cos(angle) * radius
          const y = center + Math.sin(angle) * radius
          const isActive = note === activeTonic
          const isParallel = note === parallelTonic && !isActive

          return (
            <g key={note}>
              <line x1={center} y1={center} x2={x} y2={y} stroke="#1e293b" strokeWidth="1" />
              <circle
                cx={x}
                cy={y}
                r={isActive ? 16 : isParallel ? 13 : 11}
                fill={isActive ? '#14b8a6' : isParallel ? '#f59e0b' : '#334155'}
                className="transition-all duration-700"
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize="11"
                fill={isActive || isParallel ? '#020617' : '#e2e8f0'}
                fontWeight={isActive ? '700' : '500'}
              >
                {note}
              </text>
            </g>
          )
        })}
        <circle cx={center} cy={center} r={30} fill="#020617" stroke="#334155" />
        <text x={center} y={center - 2} textAnchor="middle" fontSize="10" fill="#94a3b8">
          Active
        </text>
        <text x={center} y={center + 11} textAnchor="middle" fontSize="11" fill="#e2e8f0">
          {active || '-'}
        </text>
      </svg>
      <p className="mt-2 text-xs text-slate-400">
        Teal: candidate key / Amber: parallel key ({parallel || '-'})
      </p>
    </section>
  )
}
