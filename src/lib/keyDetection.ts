import type { KeyCandidate, KeyResult, ModulationResult, Mode } from '../types/music'
import { extractRoot, simplifyChordQuality } from './chords'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const NOTE_INDEX = new Map<string, number>(NOTES.map((n, i) => [n, i]))

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]

const MAJOR_QUALITIES = ['', 'm', 'm', '', '', 'm', 'dim']
const MINOR_QUALITIES = ['m', 'dim', '', 'm', 'm', '', '']

function transpose(note: string, semitone: number): string {
  const idx = NOTE_INDEX.get(note)
  if (idx === undefined) {
    return note
  }
  return NOTES[(idx + semitone + 12) % 12]
}

function buildScale(tonic: string, mode: Mode): string[] {
  const intervals = mode === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS
  return intervals.map((i) => transpose(tonic, i))
}

function buildDiatonicChords(scale: string[], mode: Mode): string[] {
  const qualities = mode === 'major' ? MAJOR_QUALITIES : MINOR_QUALITIES
  return scale.map((note, i) => `${note}${qualities[i]}`)
}

export function generateAllKeyCandidates(): KeyCandidate[] {
  const majors = NOTES.map((tonic) => {
    const scale = buildScale(tonic, 'major')
    return {
      name: `${tonic} major`,
      mode: 'major' as const,
      tonic,
      scaleNotes: scale,
      diatonicChords: buildDiatonicChords(scale, 'major')
    }
  })
  const minors = NOTES.map((tonic) => {
    const scale = buildScale(tonic, 'minor')
    return {
      name: `${tonic} minor`,
      mode: 'minor' as const,
      tonic,
      scaleNotes: scale,
      diatonicChords: buildDiatonicChords(scale, 'minor')
    }
  })
  return [...majors, ...minors]
}

function getRomanRoot(candidate: KeyCandidate, degreeIndex: number): string {
  return candidate.scaleNotes[degreeIndex]
}

function isDiatonicRoot(candidate: KeyCandidate, root: string): boolean {
  return candidate.scaleNotes.includes(root)
}

function chordHasAccidentalOutsideScale(candidate: KeyCandidate, chord: string): boolean {
  const normalized = simplifyChordQuality(chord)
  const root = extractRoot(normalized)
  if (!root) {
    return true
  }
  return !candidate.scaleNotes.includes(root)
}

function calculateBreakdown(candidate: KeyCandidate, progression: string[]) {
  let diatonicScore = 0
  let resolutionScore = 0
  let dominantScore = 0
  let penalty = 0

  const roots = progression.map(extractRoot).filter(Boolean)

  roots.forEach((root) => {
    if (isDiatonicRoot(candidate, root)) {
      diatonicScore += 3
    } else {
      diatonicScore -= 1
    }
  })

  const lastRoot = roots[roots.length - 1]
  if (lastRoot) {
    const iRoot = getRomanRoot(candidate, 0)
    const viRoot = getRomanRoot(candidate, candidate.mode === 'major' ? 5 : 5)
    if (lastRoot === iRoot) {
      resolutionScore += 5
    } else if (lastRoot === viRoot) {
      resolutionScore += 3
    }
  }

  const vRoot = getRomanRoot(candidate, 4)
  const iRoot = getRomanRoot(candidate, 0)
  for (let i = 0; i < roots.length - 1; i += 1) {
    if (roots[i] === vRoot && roots[i + 1] === iRoot) {
      dominantScore += 4
      break
    }
  }

  progression.forEach((chord) => {
    if (chordHasAccidentalOutsideScale(candidate, chord)) {
      penalty -= 1
    }
  })

  return { diatonicScore, resolutionScore, dominantScore, penalty }
}

function normalizeConfidence(scores: number[]): number[] {
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  if (max === min) {
    return scores.map(() => 1)
  }
  return scores.map((s) => (s - min) / (max - min))
}

export function detectKeyCandidates(progression: string[]): KeyResult[] {
  const clean = progression.filter(Boolean)
  const candidates = generateAllKeyCandidates()

  const scored = candidates.map((candidate) => {
    const breakdown = calculateBreakdown(candidate, clean)
    const score =
      breakdown.diatonicScore + breakdown.resolutionScore + breakdown.dominantScore + breakdown.penalty

    return {
      key: candidate.name,
      score,
      confidence: 0,
      breakdown,
      keyCandidate: candidate
    }
  })

  const sorted = scored.sort((a, b) => b.score - a.score)
  const top3 = sorted.slice(0, 3)
  const confidences = normalizeConfidence(top3.map((k) => k.score))

  return top3.map((item, idx) => ({
    ...item,
    confidence: Number(confidences[idx].toFixed(3))
  }))
}

export function areParallelKeys(a: string, b: string): boolean {
  const [aTonic, aMode] = a.split(' ')
  const [bTonic, bMode] = b.split(' ')
  return aTonic === bTonic && aMode !== bMode
}

export function isAmbiguousParallel(results: KeyResult[]): boolean {
  if (results.length < 2) {
    return false
  }
  const top = results[0]
  const second = results[1]
  if (Math.abs(top.score - second.score) > 2) {
    return false
  }
  if (areParallelKeys(top.key, second.key)) {
    return true
  }

  const topCandidate = top.keyCandidate
  const relatedMinorTonic = topCandidate.mode === 'major' ? topCandidate.scaleNotes[5] : topCandidate.scaleNotes[2]
  const expected = `${relatedMinorTonic} ${topCandidate.mode === 'major' ? 'minor' : 'major'}`
  return second.key === expected
}

export function detectModulation(_progression: string[]): ModulationResult[] {
  // TODO: implement in future release.
  return []
}
