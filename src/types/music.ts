export type Mode = 'major' | 'minor'

export type KeyCandidate = {
  name: string
  mode: Mode
  tonic: string
  scaleNotes: string[]
  diatonicChords: string[]
}

export type KeyResult = {
  key: string
  score: number
  confidence: number
  breakdown: {
    diatonicScore: number
    resolutionScore: number
    dominantScore: number
    penalty: number
  }
  keyCandidate: KeyCandidate
}

export type ModulationResult = {
  from: string
  to: string
  atIndex: number
  reason: string
}
