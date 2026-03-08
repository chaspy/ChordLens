/** Raw MIDI metadata */
export type MidiMeta = {
  sourceFile: string
  ticksPerBeat: number
  tempoBpm: number
  timeSignature: string
  beatsPerBar: number
  durationSeconds: number
  /** First bar containing notes */
  firstActiveBar: number
  /** Whether the piece starts with a pickup (anacrusis) */
  hasPickup: boolean
}

/** Single note event from MIDI */
export type MidiNote = {
  pitch: number
  noteName: string
  pitchClass: number
  startTick: number
  durationTick: number
  endTick: number
  startBeat: number
  durationBeat: number
  endBeat: number
  bar: number
  beatInBar: number
  velocity: number
  channel: number
  /** Whether this note falls on a strong beat (beat 1 or 3 in 4/4) */
  isOnStrongBeat: boolean
  /** Accent weight: beat1=4, beat3=2, other=1, multiplied by velocity/127 */
  accentWeight: number
}

/** A single track's data */
export type MidiTrack = {
  id: number
  name: string
  notes: MidiNote[]
}

/** Pitch class histogram (C through B) */
export type PitchClassHistogram = Record<string, number>

/** Note range info */
export type NoteRange = {
  lowest: string
  highest: string
  lowestPitch: number
  highestPitch: number
}

/** Per-pitch-class contribution to a key candidate score */
export type PitchClassContribution = {
  pitchClass: string
  count: number
  profileWeight: number
  contribution: number
}

/** Bias signals that adjust key candidate scores beyond K-S correlation */
export type KeyBiasSignals = {
  /** Bonus if final note is tonic */
  finalNoteBias: number
  /** Bonus if phrase endings land on tonic/dominant */
  phraseEndingBias: number
  /** Bonus for bar-downbeat presence of tonic */
  barDownbeatBias: number
  /** Coverage of tonic triad (1/3/5) in the piece */
  tonicTriadCoverage: number
  /** Number of notes outside this key's scale */
  nonScaleToneCount: number
}

/** Scale degree histogram for a key (degree 1-7 → count) */
export type ScaleDegreeHistogram = Record<string, number>

/** Key candidate with detailed breakdown */
export type KeyCandidateScore = {
  key: string
  tonic: string
  mode: 'major' | 'minor'
  score: number
  /** Pearson correlation only (before bias adjustment) */
  profileScore: number
  method: 'count' | 'duration' | 'strongBeat' | 'combined'
  breakdown: PitchClassContribution[]
  biasSignals: KeyBiasSignals
  scaleDegreeHistogram: ScaleDegreeHistogram
  /** Relative major/minor key */
  relativeKey: string
  /** Parallel major/minor key (same tonic, opposite mode) */
  parallelKey: string
}

/** Chord candidate for a bar */
export type ChordCandidate = {
  chord: string
  root: string
  quality: string
  score: number
  isDiatonic: boolean
  matchedNotes: string[]
  /** Important bar notes not covered by this chord */
  unmatchedNotes: string[]
  /** Priority tier: 'primary' for triads/7th, 'extended' for sus/add, 'altered' for dim/aug */
  tier: 'primary' | 'extended' | 'altered'
}

/** Progression-level chord candidate with transition context */
export type ProgressionCandidate = {
  chord: string
  localScore: number
  transitionCost: number
  cadenceLikelihood: number
  progressionScore: number
}

/** Per-bar aggregation */
export type BarAnalysis = {
  bar: number
  startBeat: number
  endBeat: number
  noteCount: number
  pitchClasses: string[]
  melodyNotes: string[]
  chordCandidates: ChordCandidate[]
  progressionCandidates: ProgressionCandidate[]
}

/** Phrase segment */
export type Phrase = {
  id: number
  startBar: number
  endBar: number
  startBeat: number
  endBeat: number
  noteCount: number
  range: NoteRange
  pitchClasses: PitchClassHistogram
  keyCandidates: KeyCandidateScore[]
  /** Average pitch (for contour analysis) */
  avgPitch: number
  /** Similarity score to other phrases (0-1), for detecting repetition */
  similarPhraseIds: number[]
}

/** All histogram variants */
export type Histograms = {
  count: PitchClassHistogram
  durationWeighted: PitchClassHistogram
  strongBeatWeighted: PitchClassHistogram
}

/** Analysis results derived from raw data */
export type MidiAnalysis = {
  histograms: Histograms
  range: NoteRange
  keyCandidates: KeyCandidateScore[]
  bars: BarAnalysis[]
  phrases: Phrase[]
}

/** Summary statistics */
export type MidiSummary = {
  noteCount: number
  trackCount: number
  barCount: number
  phraseCount: number
  durationSeconds: number
  firstActiveBar: number
}

/** Top-level analysis result combining raw + derived data */
export type MidiAnalysisResult = {
  meta: MidiMeta
  tracks: MidiTrack[]
  analysis: MidiAnalysis
  summary: MidiSummary
}
