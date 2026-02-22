const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#'
}

const NOTE_INDEX = new Map<string, number>(SHARP_NOTES.map((n, i) => [n, i]))

function toSharp(note: string): string {
  const cleaned = note.trim()
  return FLAT_TO_SHARP[cleaned] ?? cleaned
}

function normalizeRootToken(token: string): string {
  const match = token.trim().match(/^([A-Ga-g])([#b]?)/)
  if (!match) {
    return ''
  }
  const base = match[1].toUpperCase() + (match[2] || '')
  const sharp = toSharp(base)
  return NOTE_INDEX.has(sharp) ? sharp : ''
}

export function extractRoot(chord: string): string {
  const head = chord.split('/')[0]
  return normalizeRootToken(head)
}

export function simplifyChordQuality(chord: string): string {
  const head = chord.split('/')[0].trim()
  const root = extractRoot(head)
  if (!root) {
    return chord.trim()
  }
  const rest = head.slice(root.length)
  if (/dim/i.test(rest)) {
    return `${root}dim`
  }
  if (/aug|\+/i.test(rest)) {
    return `${root}aug`
  }
  if (/sus/i.test(rest)) {
    return `${root}sus`
  }
  if (/m(?!aj)/i.test(rest)) {
    return `${root}m`
  }
  return root
}

export function normalizeChordSymbol(chord: string): string {
  const trimmed = chord.trim()
  if (!trimmed) {
    return ''
  }
  const root = extractRoot(trimmed)
  if (!root) {
    return trimmed
  }
  const body = trimmed.split('/')[0].slice(trimmed.split('/')[0].match(/^([A-Ga-g])([#b]?)/)?.[0].length || 0)
  const quality = body.replace(/\s+/g, '')
  return `${root}${quality}`
}

export function parseChordList(input: string): string[] {
  return input
    .split(/[\n,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
}

export function sanitizeChordArray(chords: string[]): string[] {
  return chords
    .map(normalizeChordSymbol)
    .filter(Boolean)
}
