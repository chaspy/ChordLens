import type {
  MidiNote, MidiTrack, PitchClassHistogram, NoteRange,
  KeyCandidateScore, PitchClassContribution, KeyBiasSignals, ScaleDegreeHistogram,
  MidiAnalysis, MidiSummary, MidiMeta,
  Histograms, BarAnalysis, ChordCandidate, ProgressionCandidate, Phrase,
  RootMotion, PedalToneSegment, ChromaticApproachNote, StrongBeatRoots, BassAnalysis,
} from '../types/midi'
import { pitchToNoteName } from './midiParser'

const PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const PC_INDEX = new Map<string, number>(PC.map((n, i) => [n, i]))

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]

// Chord type definitions: [intervals from root, quality label, tier]
const CHORD_TYPES: { intervals: number[]; quality: string; label: string; tier: 'primary' | 'extended' | 'altered' }[] = [
  { intervals: [0, 4, 7], quality: 'major', label: '', tier: 'primary' },
  { intervals: [0, 3, 7], quality: 'minor', label: 'm', tier: 'primary' },
  { intervals: [0, 4, 7, 11], quality: 'maj7', label: 'maj7', tier: 'primary' },
  { intervals: [0, 4, 7, 10], quality: '7', label: '7', tier: 'primary' },
  { intervals: [0, 3, 7, 10], quality: 'm7', label: 'm7', tier: 'primary' },
  { intervals: [0, 5, 7], quality: 'sus4', label: 'sus4', tier: 'extended' },
  { intervals: [0, 4, 7, 14 % 12], quality: 'add9', label: 'add9', tier: 'extended' },
  { intervals: [0, 3, 6], quality: 'dim', label: 'dim', tier: 'altered' },
  { intervals: [0, 4, 8], quality: 'aug', label: 'aug', tier: 'altered' },
  { intervals: [0, 3, 6, 9], quality: 'dim7', label: 'dim7', tier: 'altered' },
]

// Relative key offsets: major→relative minor is +9 semitones, minor→relative major is +3
const RELATIVE_MINOR_OFFSET = 9
const RELATIVE_MAJOR_OFFSET = 3

// Common diatonic progressions for transition scoring (scale degree pairs)
const COMMON_TRANSITIONS: Record<string, number> = {
  'I-IV': 0.0, 'I-V': 0.0, 'I-vi': 0.1, 'I-ii': 0.1,
  'IV-V': 0.0, 'IV-I': 0.1, 'IV-vi': 0.1,
  'V-I': 0.0, 'V-vi': 0.1, 'V-IV': 0.2,
  'vi-IV': 0.0, 'vi-V': 0.1, 'vi-ii': 0.1,
  'ii-V': 0.0, 'ii-IV': 0.1,
  'iii-vi': 0.1, 'iii-IV': 0.1,
  'vii-I': 0.1,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function collectAllNotes(tracks: MidiTrack[]): MidiNote[] {
  return tracks.flatMap((t) => t.notes)
}

function emptyHistogram(): PitchClassHistogram {
  const h: PitchClassHistogram = {}
  for (const n of PC) h[n] = 0
  return h
}

function rotate<T>(arr: T[], n: number): T[] {
  const len = arr.length
  const shift = ((n % len) + len) % len
  return [...arr.slice(shift), ...arr.slice(0, shift)]
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function scaleForKey(tonic: number, mode: 'major' | 'minor'): number[] {
  const intervals = mode === 'major' ? MAJOR_SCALE : MINOR_SCALE
  return intervals.map((i) => (tonic + i) % 12)
}

// ---------------------------------------------------------------------------
// 1. Histograms
// ---------------------------------------------------------------------------

export function computeCountHistogram(notes: MidiNote[]): PitchClassHistogram {
  const h = emptyHistogram()
  for (const n of notes) h[PC[n.pitchClass]] += 1
  return h
}

export function computeDurationHistogram(notes: MidiNote[]): PitchClassHistogram {
  const h = emptyHistogram()
  for (const n of notes) h[PC[n.pitchClass]] += n.durationBeat
  for (const k of PC) h[k] = r3(h[k])
  return h
}

export function computeStrongBeatHistogram(notes: MidiNote[]): PitchClassHistogram {
  const h = emptyHistogram()
  for (const n of notes) h[PC[n.pitchClass]] += n.accentWeight * n.durationBeat
  for (const k of PC) h[k] = r3(h[k])
  return h
}

export function computeHistograms(notes: MidiNote[]): Histograms {
  return {
    count: computeCountHistogram(notes),
    durationWeighted: computeDurationHistogram(notes),
    strongBeatWeighted: computeStrongBeatHistogram(notes),
  }
}

// ---------------------------------------------------------------------------
// 2. Range
// ---------------------------------------------------------------------------

export function computeRange(notes: MidiNote[]): NoteRange {
  if (notes.length === 0) return { lowest: '-', highest: '-', lowestPitch: 0, highestPitch: 0 }
  let minP = 127, maxP = 0
  for (const n of notes) {
    if (n.pitch < minP) minP = n.pitch
    if (n.pitch > maxP) maxP = n.pitch
  }
  return { lowest: pitchToNoteName(minP), highest: pitchToNoteName(maxP), lowestPitch: minP, highestPitch: maxP }
}

// ---------------------------------------------------------------------------
// 3. Key detection with bias signals
// ---------------------------------------------------------------------------

function pearson(x: number[], y: number[]): number {
  const n = x.length
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy
  }
  const d = Math.sqrt(dx2 * dy2)
  return d === 0 ? 0 : num / d
}

function computeBreakdown(dist: number[], profile: number[], tonic: number): PitchClassContribution[] {
  const rot = rotate(dist, tonic)
  const n = 12
  const mx = rot.reduce((a, b) => a + b, 0) / n
  const my = profile.reduce((a, b) => a + b, 0) / n
  let dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) { dx2 += (rot[i] - mx) ** 2; dy2 += (profile[i] - my) ** 2 }
  const den = Math.sqrt(dx2 * dy2)
  return Array.from({ length: 12 }, (_, i) => ({
    pitchClass: PC[(i + tonic) % 12],
    count: dist[(i + tonic) % 12],
    profileWeight: r3(profile[i]),
    contribution: r3(den === 0 ? 0 : ((rot[i] - mx) * (profile[i] - my)) / den),
  }))
}

function histogramToArray(h: PitchClassHistogram): number[] {
  return PC.map((p) => h[p] || 0)
}

function computeBiasSignals(
  tonicIdx: number,
  mode: 'major' | 'minor',
  notes: MidiNote[],
  phrases: { notes: MidiNote[] }[]
): KeyBiasSignals {
  if (notes.length === 0) return { finalNoteBias: 0, phraseEndingBias: 0, barDownbeatBias: 0, tonicTriadCoverage: 0, nonScaleToneCount: 0 }

  const scale = scaleForKey(tonicIdx, mode)
  const triad = [tonicIdx, (tonicIdx + (mode === 'major' ? 4 : 3)) % 12, (tonicIdx + 7) % 12]

  // Final note bias: is the last note the tonic?
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat)
  const lastNote = sorted[sorted.length - 1]
  const finalNoteBias = lastNote.pitchClass === tonicIdx ? 0.08
    : lastNote.pitchClass === (tonicIdx + 7) % 12 ? 0.04 // dominant
    : 0

  // Phrase ending bias: how many phrases end on tonic or dominant?
  let phraseEndScore = 0
  for (const phrase of phrases) {
    if (phrase.notes.length === 0) continue
    const phraseSorted = [...phrase.notes].sort((a, b) => a.startBeat - b.startBeat)
    const endNote = phraseSorted[phraseSorted.length - 1]
    if (endNote.pitchClass === tonicIdx) phraseEndScore += 0.04
    else if (endNote.pitchClass === (tonicIdx + 7) % 12) phraseEndScore += 0.02
  }
  const phraseEndingBias = r3(Math.min(phraseEndScore, 0.1))

  // Bar downbeat bias: how often does tonic appear on beat 1?
  const downbeatNotes = notes.filter((n) => n.isOnStrongBeat && Math.floor(n.beatInBar) === 1)
  const tonicDownbeats = downbeatNotes.filter((n) => n.pitchClass === tonicIdx).length
  const barDownbeatBias = downbeatNotes.length > 0
    ? r3(0.06 * (tonicDownbeats / downbeatNotes.length))
    : 0

  // Tonic triad coverage: what fraction of the triad's pitch classes appear?
  const pcSet = new Set(notes.map((n) => n.pitchClass))
  const triadHits = triad.filter((t) => pcSet.has(t)).length
  const tonicTriadCoverage = r3(triadHits / 3)

  // Non-scale tone count
  const nonScaleToneCount = notes.filter((n) => !scale.includes(n.pitchClass)).length

  return { finalNoteBias, phraseEndingBias, barDownbeatBias, tonicTriadCoverage, nonScaleToneCount }
}

function computeScaleDegreeHistogram(notes: MidiNote[], tonicIdx: number, mode: 'major' | 'minor'): ScaleDegreeHistogram {
  const scale = scaleForKey(tonicIdx, mode)
  const degreeNames = mode === 'major'
    ? ['1', '2', '3', '4', '5', '6', '7']
    : ['1', '2', 'b3', '4', '5', 'b6', 'b7']
  const h: ScaleDegreeHistogram = {}
  for (const d of degreeNames) h[d] = 0
  h['non-scale'] = 0

  for (const n of notes) {
    const idx = scale.indexOf(n.pitchClass)
    if (idx >= 0) h[degreeNames[idx]] += 1
    else h['non-scale'] += 1
  }
  return h
}

function getRelativeKey(tonic: string, mode: 'major' | 'minor'): string {
  const idx = PC_INDEX.get(tonic) ?? 0
  if (mode === 'major') {
    const relIdx = (idx + RELATIVE_MINOR_OFFSET) % 12
    return `${PC[relIdx]} minor`
  }
  const relIdx = (idx + RELATIVE_MAJOR_OFFSET) % 12
  return `${PC[relIdx]} major`
}

function getParallelKey(tonic: string, mode: 'major' | 'minor'): string {
  return `${tonic} ${mode === 'major' ? 'minor' : 'major'}`
}

function detectAllKeysWithBias(
  dist: number[],
  method: KeyCandidateScore['method'],
  notes: MidiNote[],
  phraseGroups: { notes: MidiNote[] }[]
): KeyCandidateScore[] {
  const results: KeyCandidateScore[] = []

  for (let tonic = 0; tonic < 12; tonic++) {
    const rot = rotate(dist, tonic)
    const profileScore = r3(pearson(rot, MAJOR_PROFILE))
    const bias = computeBiasSignals(tonic, 'major', notes, phraseGroups)
    const biasTotal = bias.finalNoteBias + bias.phraseEndingBias + bias.barDownbeatBias
      + (bias.tonicTriadCoverage >= 1 ? 0.05 : 0)
    results.push({
      key: `${PC[tonic]} major`, tonic: PC[tonic], mode: 'major',
      score: r3(profileScore + biasTotal), profileScore, method,
      breakdown: computeBreakdown(dist, MAJOR_PROFILE, tonic),
      biasSignals: bias,
      scaleDegreeHistogram: computeScaleDegreeHistogram(notes, tonic, 'major'),
      relativeKey: getRelativeKey(PC[tonic], 'major'),
      parallelKey: getParallelKey(PC[tonic], 'major'),
    })
  }

  for (let tonic = 0; tonic < 12; tonic++) {
    const rot = rotate(dist, tonic)
    const profileScore = r3(pearson(rot, MINOR_PROFILE))
    const bias = computeBiasSignals(tonic, 'minor', notes, phraseGroups)
    const biasTotal = bias.finalNoteBias + bias.phraseEndingBias + bias.barDownbeatBias
      + (bias.tonicTriadCoverage >= 1 ? 0.05 : 0)
    results.push({
      key: `${PC[tonic]} minor`, tonic: PC[tonic], mode: 'minor',
      score: r3(profileScore + biasTotal), profileScore, method,
      breakdown: computeBreakdown(dist, MINOR_PROFILE, tonic),
      biasSignals: bias,
      scaleDegreeHistogram: computeScaleDegreeHistogram(notes, tonic, 'minor'),
      relativeKey: getRelativeKey(PC[tonic], 'minor'),
      parallelKey: getParallelKey(PC[tonic], 'minor'),
    })
  }

  return results
}

export function detectKeyCandidates(
  histograms: Histograms,
  notes: MidiNote[],
  phraseGroups: { notes: MidiNote[] }[]
): KeyCandidateScore[] {
  const cDist = histogramToArray(histograms.count)
  const dDist = histogramToArray(histograms.durationWeighted)
  const sDist = histogramToArray(histograms.strongBeatWeighted)

  const countAll = detectAllKeysWithBias(cDist, 'count', notes, phraseGroups)
  const durAll = detectAllKeysWithBias(dDist, 'duration', notes, phraseGroups)
  const sbAll = detectAllKeysWithBias(sDist, 'strongBeat', notes, phraseGroups)

  const top5 = (arr: KeyCandidateScore[]) => [...arr].sort((a, b) => b.score - a.score).slice(0, 5)
  const countTop = top5(countAll)
  const durTop = top5(durAll)
  const sbTop = top5(sbAll)

  // Combined: weighted merge
  const allKeys = new Map<string, {
    totalScore: number; totalProfile: number
    bias: KeyBiasSignals; breakdown: PitchClassContribution[]
    sdh: ScaleDegreeHistogram; tonic: string; mode: 'major' | 'minor'
  }>()

  function merge(results: KeyCandidateScore[], weight: number) {
    for (const r of results) {
      const e = allKeys.get(r.key)
      if (e) {
        e.totalScore += r.score * weight
        e.totalProfile += r.profileScore * weight
      } else {
        allKeys.set(r.key, {
          totalScore: r.score * weight, totalProfile: r.profileScore * weight,
          bias: r.biasSignals, breakdown: r.breakdown,
          sdh: r.scaleDegreeHistogram, tonic: r.tonic, mode: r.mode,
        })
      }
    }
  }

  merge(countAll, 0.25)
  merge(durAll, 0.35)
  merge(sbAll, 0.40)

  const combined: KeyCandidateScore[] = []
  for (const [key, data] of allKeys.entries()) {
    combined.push({
      key, tonic: data.tonic, mode: data.mode,
      score: r3(data.totalScore), profileScore: r3(data.totalProfile),
      method: 'combined', breakdown: data.breakdown,
      biasSignals: data.bias,
      scaleDegreeHistogram: data.sdh,
      relativeKey: getRelativeKey(data.tonic, data.mode),
      parallelKey: getParallelKey(data.tonic, data.mode),
    })
  }
  combined.sort((a, b) => b.score - a.score)

  return [...combined.slice(0, 5), ...countTop, ...durTop, ...sbTop]
}

// ---------------------------------------------------------------------------
// 4. Chord candidates (extended types + diatonic priority)
// ---------------------------------------------------------------------------

function generateChordCandidates(
  detectedTonic: number,
  detectedMode: 'major' | 'minor'
): { root: number; intervals: number[]; quality: string; label: string; isDiatonic: boolean; tier: 'primary' | 'extended' | 'altered' }[] {
  const scale = scaleForKey(detectedTonic, detectedMode)
  const candidates: typeof generateChordCandidates extends (...a: never[]) => (infer R)[] ? R[] : never = []

  for (const ct of CHORD_TYPES) {
    for (const root of scale) {
      const notes = ct.intervals.map((i) => (root + i) % 12)
      const allInScale = notes.every((n) => scale.includes(n))
      if (allInScale) {
        candidates.push({ root, intervals: ct.intervals, quality: ct.quality, label: ct.label, isDiatonic: true, tier: ct.tier })
      }
    }
  }

  // Non-diatonic on chromatic roots (primary/extended only for brevity)
  for (const ct of CHORD_TYPES) {
    for (let root = 0; root < 12; root++) {
      if (!candidates.some((c) => c.root === root && c.quality === ct.quality)) {
        candidates.push({ root, intervals: ct.intervals, quality: ct.quality, label: ct.label, isDiatonic: false, tier: ct.tier })
      }
    }
  }

  return candidates
}

function scoreChordForBar(
  chord: { root: number; intervals: number[]; quality: string; label: string; isDiatonic: boolean; tier: 'primary' | 'extended' | 'altered' },
  barPitchClasses: Set<number>,
  barNotes: MidiNote[]
): ChordCandidate | null {
  const chordNotes = chord.intervals.map((i) => (chord.root + i) % 12)
  const matched: number[] = []
  const unmatched: number[] = []

  for (const cn of chordNotes) {
    if (barPitchClasses.has(cn)) matched.push(cn)
  }

  // Important bar notes not in chord (weighted by duration)
  const barPCsByDur = new Map<number, number>()
  for (const n of barNotes) {
    barPCsByDur.set(n.pitchClass, (barPCsByDur.get(n.pitchClass) ?? 0) + n.durationBeat)
  }
  for (const [pc] of barPCsByDur) {
    if (!chordNotes.includes(pc)) unmatched.push(pc)
  }

  const matchRatio = matched.length / chordNotes.length
  const missing = chordNotes.length - matched.length
  const coverageNotes = barNotes.filter((n) => chordNotes.includes(n.pitchClass))
  const barCoverage = coverageNotes.length / Math.max(barNotes.length, 1)
  // Duration-weighted coverage
  const coveredDur = coverageNotes.reduce((s, n) => s + n.durationBeat, 0)
  const totalDur = barNotes.reduce((s, n) => s + n.durationBeat, 0)
  const durCoverage = totalDur > 0 ? coveredDur / totalDur : 0

  // Diatonic bonus
  const diatonicBonus = chord.isDiatonic ? 0.15 : 0
  // Tier penalty
  const tierPenalty = chord.tier === 'altered' ? 0.1 : chord.tier === 'extended' ? 0.02 : 0

  const score = r3(matchRatio * 0.3 + barCoverage * 0.2 + durCoverage * 0.2
    - missing * 0.1 + diatonicBonus - tierPenalty)

  if (score < 0.15) return null

  return {
    chord: `${PC[chord.root]}${chord.label}`,
    root: PC[chord.root],
    quality: chord.quality,
    score,
    isDiatonic: chord.isDiatonic,
    matchedNotes: matched.map((p) => PC[p]),
    unmatchedNotes: unmatched.map((p) => PC[p]),
    tier: chord.tier,
  }
}

// ---------------------------------------------------------------------------
// 5. Progression-aware scoring
// ---------------------------------------------------------------------------

function scaleDegreeLabel(root: number, tonicIdx: number, mode: 'major' | 'minor'): string {
  const scale = scaleForKey(tonicIdx, mode)
  const degreeIdx = scale.indexOf(root)
  if (degreeIdx < 0) return '?'
  const romanMajor = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
  const romanMinor = ['i', 'ii', 'III', 'iv', 'v', 'VI', 'VII']
  return (mode === 'major' ? romanMajor : romanMinor)[degreeIdx]
}

function computeTransitionCost(
  prevChord: string | null,
  currentRoot: number,
  tonicIdx: number,
  mode: 'major' | 'minor'
): number {
  if (!prevChord) return 0
  const prevRootName = prevChord.replace(/[^A-G#]/g, '')
  const prevRootIdx = PC_INDEX.get(prevRootName)
  if (prevRootIdx === undefined) return 0.3

  const prevDeg = scaleDegreeLabel(prevRootIdx, tonicIdx, mode)
  const currDeg = scaleDegreeLabel(currentRoot, tonicIdx, mode)
  const pair = `${prevDeg}-${currDeg}`
  return COMMON_TRANSITIONS[pair] ?? 0.3
}

function computeCadenceLikelihood(
  currentRoot: number,
  nextChordRoot: number | null,
  tonicIdx: number
): number {
  if (nextChordRoot === null) return 0
  // V-I or V-i cadence
  const dom = (tonicIdx + 7) % 12
  if (currentRoot === dom && nextChordRoot === tonicIdx) return 0.9
  // IV-I plagal
  const sub = (tonicIdx + 5) % 12
  if (currentRoot === sub && nextChordRoot === tonicIdx) return 0.6
  // ii-V
  const ii = (tonicIdx + 2) % 12
  if (currentRoot === ii && nextChordRoot === dom) return 0.5
  return 0
}

function computeProgressionCandidates(
  bars: { chordCandidates: ChordCandidate[] }[],
  barIdx: number,
  tonicIdx: number,
  mode: 'major' | 'minor'
): ProgressionCandidate[] {
  const currentBar = bars[barIdx]
  if (!currentBar || currentBar.chordCandidates.length === 0) return []

  const prevBar = barIdx > 0 ? bars[barIdx - 1] : null
  const nextBar = barIdx < bars.length - 1 ? bars[barIdx + 1] : null
  const prevChord = prevBar?.chordCandidates[0]?.chord ?? null
  const nextRoot = nextBar?.chordCandidates[0] ? PC_INDEX.get(nextBar.chordCandidates[0].root) ?? null : null

  return currentBar.chordCandidates.slice(0, 5).map((cc) => {
    const rootIdx = PC_INDEX.get(cc.root) ?? 0
    const tc = computeTransitionCost(prevChord, rootIdx, tonicIdx, mode)
    const cl = computeCadenceLikelihood(rootIdx, nextRoot, tonicIdx)
    const progressionScore = r3(cc.score * 0.5 + (1 - tc) * 0.3 + cl * 0.2)
    return {
      chord: cc.chord,
      localScore: cc.score,
      transitionCost: r3(tc),
      cadenceLikelihood: r3(cl),
      progressionScore,
    }
  }).sort((a, b) => b.progressionScore - a.progressionScore)
}

// ---------------------------------------------------------------------------
// 6. Per-bar analysis
// ---------------------------------------------------------------------------

export function computeBars(
  notes: MidiNote[],
  meta: MidiMeta,
  tonicIdx: number,
  mode: 'major' | 'minor'
): BarAnalysis[] {
  if (notes.length === 0) return []

  const maxBar = Math.max(...notes.map((n) => n.bar))
  const chordDefs = generateChordCandidates(tonicIdx, mode)

  // Phase 1: compute chord candidates per bar
  const barsRaw: { bar: number; startBeat: number; endBeat: number; noteCount: number; pitchClasses: string[]; melodyNotes: string[]; chordCandidates: ChordCandidate[] }[] = []

  for (let b = 1; b <= maxBar; b++) {
    const barNotes = notes.filter((n) => n.bar === b)
    const barPCs = new Set(barNotes.map((n) => n.pitchClass))
    const pcs = [...new Set(barNotes.map((n) => PC[n.pitchClass]))];

    const chordCandidates: ChordCandidate[] = []
    for (const cd of chordDefs) {
      const result = scoreChordForBar(cd, barPCs, barNotes)
      if (result) chordCandidates.push(result)
    }

    // Sort: diatonic+primary first, then by score
    chordCandidates.sort((a, b) => {
      if (a.isDiatonic !== b.isDiatonic) return a.isDiatonic ? -1 : 1
      const tierOrder = { primary: 0, extended: 1, altered: 2 }
      if (a.tier !== b.tier) return tierOrder[a.tier] - tierOrder[b.tier]
      return b.score - a.score
    })

    barsRaw.push({
      bar: b,
      startBeat: (b - 1) * meta.beatsPerBar,
      endBeat: b * meta.beatsPerBar,
      noteCount: barNotes.length,
      pitchClasses: pcs,
      melodyNotes: barNotes.map((n) => n.noteName),
      chordCandidates: chordCandidates.slice(0, 8),
    })
  }

  // Phase 2: progression-aware scoring
  return barsRaw.map((bar, idx) => ({
    ...bar,
    progressionCandidates: computeProgressionCandidates(barsRaw, idx, tonicIdx, mode),
  }))
}

// ---------------------------------------------------------------------------
// 7. Phrase segmentation (rest + contour + repetition)
// ---------------------------------------------------------------------------

function intervalVector(notes: MidiNote[]): number[] {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat)
  const vec: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    vec.push(sorted[i].pitch - sorted[i - 1].pitch)
  }
  return vec
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]
  }
  const d = Math.sqrt(magA) * Math.sqrt(magB)
  return d === 0 ? 0 : dot / d
}

export function computePhrases(
  notes: MidiNote[],
  restThresholdBeats: number = 1.0
): Phrase[] {
  if (notes.length === 0) return []

  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat)

  // Split by rest gaps
  const groups: MidiNote[][] = [[sorted[0]]]
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    const gap = curr.startBeat - (prev.startBeat + prev.durationBeat)
    if (gap > restThresholdBeats) {
      groups.push([curr])
    } else {
      groups[groups.length - 1].push(curr)
    }
  }

  // Also split on large pitch contour changes (>= octave jump after sustained note)
  const refined: MidiNote[][] = []
  for (const group of groups) {
    const current: MidiNote[] = [group[0]]
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1]
      const curr = group[i]
      const interval = Math.abs(curr.pitch - prev.pitch)
      const gap = curr.startBeat - (prev.startBeat + prev.durationBeat)
      // Split if large interval AND some gap
      if (interval >= 12 && gap > 0.3) {
        refined.push([...current])
        current.length = 0
      }
      current.push(curr)
    }
    if (current.length > 0) refined.push(current)
  }

  // Build phrases
  const phrases: Phrase[] = refined.map((pn, idx) => {
    const range = computeRange(pn)
    const pitchClasses = computeCountHistogram(pn)
    const dist = PC.map((p) => pitchClasses[p] || 0)

    // Simplified key detection for phrases (no bias for performance)
    const phraseKeys: KeyCandidateScore[] = []
    for (let t = 0; t < 12; t++) {
      const rot = rotate(dist, t)
      phraseKeys.push({
        key: `${PC[t]} major`, tonic: PC[t], mode: 'major',
        score: r3(pearson(rot, MAJOR_PROFILE)), profileScore: r3(pearson(rot, MAJOR_PROFILE)),
        method: 'count', breakdown: [], biasSignals: { finalNoteBias: 0, phraseEndingBias: 0, barDownbeatBias: 0, tonicTriadCoverage: 0, nonScaleToneCount: 0 },
        scaleDegreeHistogram: {}, relativeKey: '', parallelKey: '',
      })
      phraseKeys.push({
        key: `${PC[t]} minor`, tonic: PC[t], mode: 'minor',
        score: r3(pearson(rot, MINOR_PROFILE)), profileScore: r3(pearson(rot, MINOR_PROFILE)),
        method: 'count', breakdown: [], biasSignals: { finalNoteBias: 0, phraseEndingBias: 0, barDownbeatBias: 0, tonicTriadCoverage: 0, nonScaleToneCount: 0 },
        scaleDegreeHistogram: {}, relativeKey: '', parallelKey: '',
      })
    }
    phraseKeys.sort((a, b) => b.score - a.score)

    const avgPitch = pn.length > 0 ? r3(pn.reduce((s, n) => s + n.pitch, 0) / pn.length) : 0

    return {
      id: idx,
      startBar: Math.min(...pn.map((n) => n.bar)),
      endBar: Math.max(...pn.map((n) => n.bar)),
      startBeat: r3(Math.min(...pn.map((n) => n.startBeat))),
      endBeat: r3(Math.max(...pn.map((n) => n.startBeat + n.durationBeat))),
      noteCount: pn.length,
      range,
      pitchClasses,
      keyCandidates: phraseKeys.slice(0, 3),
      avgPitch,
      similarPhraseIds: [],
    }
  })

  // Detect similar phrases by interval vector cosine similarity
  const vectors = refined.map((pn) => intervalVector(pn))
  for (let i = 0; i < phrases.length; i++) {
    for (let j = i + 1; j < phrases.length; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j])
      if (sim > 0.8) {
        phrases[i].similarPhraseIds.push(j)
        phrases[j].similarPhraseIds.push(i)
      }
    }
  }

  return phrases
}

// ---------------------------------------------------------------------------
// 8. Bass analysis
// ---------------------------------------------------------------------------

/** Find the lowest-pitch note near a target beat in a bar's notes */
function findBassRoot(
  barNotes: MidiNote[],
  targetBeat: number
): { root: string; rootPitchClass: number } | null {
  // Notes within half a beat of the target
  const candidates = barNotes.filter((n) => Math.abs(Math.floor(n.beatInBar) - targetBeat) < 1)
  if (candidates.length === 0) return null
  const lowest = candidates.reduce((a, b) => (a.pitch < b.pitch ? a : b))
  return { root: PC[lowest.pitchClass], rootPitchClass: lowest.pitchClass }
}

/** Extract beat 1 and beat 3 roots per bar */
export function computeStrongBeatRoots(notes: MidiNote[], meta: MidiMeta): StrongBeatRoots[] {
  if (notes.length === 0) return []
  const maxBar = Math.max(...notes.map((n) => n.bar))
  const results: StrongBeatRoots[] = []

  for (let b = 1; b <= maxBar; b++) {
    const barNotes = notes.filter((n) => n.bar === b)
    const beat1 = findBassRoot(barNotes, 1)
    const beat3 = meta.beatsPerBar >= 4 ? findBassRoot(barNotes, 3) : null
    results.push({
      bar: b,
      beat1Root: beat1?.root ?? null,
      beat1RootPitchClass: beat1?.rootPitchClass ?? null,
      beat3Root: beat3?.root ?? null,
      beat3RootPitchClass: beat3?.rootPitchClass ?? null,
    })
  }
  return results
}

/** Compute intervals between consecutive bar roots (shortest distance ≤6 semitones) */
export function computeRootMotionSequence(strongBeatRoots: StrongBeatRoots[]): RootMotion[] {
  const barsWithRoots = strongBeatRoots.filter((b) => b.beat1Root !== null)
  return barsWithRoots.map((b, idx) => {
    const next = idx < barsWithRoots.length - 1 ? barsWithRoots[idx + 1] : null
    let intervalToNext: number | null = null
    let directionToNext: RootMotion['directionToNext'] = null

    if (next && b.beat1RootPitchClass !== null && next.beat1RootPitchClass !== null) {
      const raw = ((next.beat1RootPitchClass - b.beat1RootPitchClass) + 12) % 12
      const shortest = raw <= 6 ? raw : raw - 12
      intervalToNext = Math.abs(shortest)
      directionToNext = shortest > 0 ? 'up' : shortest < 0 ? 'down' : 'same'
    }

    return {
      bar: b.bar,
      root: b.beat1Root!,
      rootPitchClass: b.beat1RootPitchClass!,
      intervalToNext,
      directionToNext,
    }
  })
}

/** Group consecutive bars with the same root into pedal tone segments (≥2 bars) */
export function computePedalToneSegments(rootMotion: RootMotion[]): PedalToneSegment[] {
  if (rootMotion.length === 0) return []
  const segments: PedalToneSegment[] = []
  let start = 0

  for (let i = 1; i <= rootMotion.length; i++) {
    if (i === rootMotion.length || rootMotion[i].rootPitchClass !== rootMotion[start].rootPitchClass) {
      const count = i - start
      if (count >= 2) {
        segments.push({
          root: rootMotion[start].root,
          rootPitchClass: rootMotion[start].rootPitchClass,
          startBar: rootMotion[start].bar,
          endBar: rootMotion[i - 1].bar,
          barCount: count,
        })
      }
      start = i
    }
  }
  return segments
}

/** Find notes that approach the next bar's root by 1 semitone */
export function computeChromaticApproachNotes(
  notes: MidiNote[],
  rootMotion: RootMotion[]
): ChromaticApproachNote[] {
  const rootByBar = new Map<number, number>()
  for (const rm of rootMotion) rootByBar.set(rm.bar, rm.rootPitchClass)

  const results: ChromaticApproachNote[] = []

  for (const n of notes) {
    // Look at the next bar's root
    const nextBarRoot = rootByBar.get(n.bar + 1)
    if (nextBarRoot === undefined) continue

    const diff = ((n.pitchClass - nextBarRoot) + 12) % 12
    if (diff === 1) {
      // One semitone above the target
      results.push({
        noteName: n.noteName,
        pitchClass: n.pitchClass,
        targetRoot: PC[nextBarRoot],
        targetRootPitchClass: nextBarRoot,
        bar: n.bar,
        beatInBar: n.beatInBar,
        approachType: 'above',
      })
    } else if (diff === 11) {
      // One semitone below the target
      results.push({
        noteName: n.noteName,
        pitchClass: n.pitchClass,
        targetRoot: PC[nextBarRoot],
        targetRootPitchClass: nextBarRoot,
        bar: n.bar,
        beatInBar: n.beatInBar,
        approachType: 'below',
      })
    }
  }
  return results
}

/** Compute full bass analysis for a single track */
export function computeBassAnalysis(track: MidiTrack, meta: MidiMeta): BassAnalysis {
  const strongBeatRoots = computeStrongBeatRoots(track.notes, meta)
  const rootMotionSequence = computeRootMotionSequence(strongBeatRoots)
  const pedalToneSegments = computePedalToneSegments(rootMotionSequence)
  const chromaticApproachNotes = computeChromaticApproachNotes(track.notes, rootMotionSequence)

  return {
    trackId: track.id,
    trackName: track.name,
    rootMotionSequence,
    pedalToneSegments,
    chromaticApproachNotes,
    strongBeatRoots,
  }
}

// ---------------------------------------------------------------------------
// 9. Summary
// ---------------------------------------------------------------------------

export function computeSummary(
  meta: MidiMeta, tracks: MidiTrack[], notes: MidiNote[],
  bars: BarAnalysis[], phrases: Phrase[]
): MidiSummary {
  return {
    noteCount: notes.length, trackCount: tracks.length,
    barCount: bars.length, phraseCount: phrases.length,
    durationSeconds: meta.durationSeconds, firstActiveBar: meta.firstActiveBar,
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function analyzeNotes(
  meta: MidiMeta,
  tracks: MidiTrack[]
): { analysis: MidiAnalysis; summary: MidiSummary } {
  const allNotes = collectAllNotes(tracks)
  const histograms = computeHistograms(allNotes)
  const range = computeRange(allNotes)

  // Pre-compute phrase groups for bias signals
  const sorted = [...allNotes].sort((a, b) => a.startBeat - b.startBeat)
  const phraseGroupsRaw: MidiNote[][] = sorted.length > 0 ? [[sorted[0]]] : []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (curr.startBeat - (prev.startBeat + prev.durationBeat) > 1.0) {
      phraseGroupsRaw.push([curr])
    } else {
      phraseGroupsRaw[phraseGroupsRaw.length - 1].push(curr)
    }
  }
  const phraseGroups = phraseGroupsRaw.map((notes) => ({ notes }))

  const keyCandidates = detectKeyCandidates(histograms, allNotes, phraseGroups)

  const topKey = keyCandidates.find((k) => k.method === 'combined') ?? keyCandidates[0]
  const tonicIdx = topKey ? PC_INDEX.get(topKey.tonic) ?? 0 : 0
  const topMode = topKey?.mode ?? 'major'

  const bars = computeBars(allNotes, meta, tonicIdx, topMode)
  const phrases = computePhrases(allNotes)

  // Bass analysis for bass tracks
  const bassAnalysis: BassAnalysis[] = tracks
    .filter((t) => t.isBass)
    .map((t) => computeBassAnalysis(t, meta))

  const analysis: MidiAnalysis = { histograms, range, keyCandidates, bars, phrases, bassAnalysis }
  const summary = computeSummary(meta, tracks, allNotes, bars, phrases)
  return { analysis, summary }
}
