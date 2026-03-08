import { Midi } from '@tonejs/midi'
import type { MidiMeta, MidiNote, MidiTrack } from '../types/midi'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** Convert MIDI pitch number to note name (e.g. 60 → "C4") */
export function pitchToNoteName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1
  const noteIndex = pitch % 12
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

/** Extract pitch class (0-11) from MIDI pitch */
export function pitchToPitchClass(pitch: number): number {
  return pitch % 12
}

/** Read a File as ArrayBuffer */
async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Parse a MIDI file into structured metadata and tracks */
export async function parseMidiFile(file: File): Promise<{ meta: MidiMeta; tracks: MidiTrack[] }> {
  const arrayBuffer = await fileToArrayBuffer(file)
  const midi = new Midi(arrayBuffer)

  const ticksPerBeat = midi.header.ppq
  const tempo = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120
  const timeSig = midi.header.timeSignatures.length > 0
    ? midi.header.timeSignatures[0]
    : null
  const timeSignature = timeSig
    ? `${timeSig.timeSignature[0]}/${timeSig.timeSignature[1]}`
    : '4/4'

  const beatsPerBar = timeSig ? timeSig.timeSignature[0] : 4

  const tracks: MidiTrack[] = midi.tracks
    .map((track, index) => {
      const notes: MidiNote[] = track.notes.map((note) => {
        const startTick = Math.round(note.ticks)
        const durationTick = Math.round(note.durationTicks)
        const endTick = startTick + durationTick
        const startBeat = startTick / ticksPerBeat
        const durationBeat = durationTick / ticksPerBeat
        const endBeat = startBeat + durationBeat
        const bar = Math.floor(startBeat / beatsPerBar) + 1
        const beatInBar = (startBeat % beatsPerBar) + 1
        const beatInt = Math.floor(beatInBar)
        const isOnStrongBeat = beatInt === 1 || (beatsPerBar === 4 && beatInt === 3)
        const beatWeight = beatInt === 1 ? 4 : (beatsPerBar === 4 && beatInt === 3) ? 2 : 1
        const vel = Math.round(note.velocity * 127)
        const accentWeight = round3(beatWeight * (vel / 127))

        return {
          pitch: note.midi,
          noteName: pitchToNoteName(note.midi),
          pitchClass: pitchToPitchClass(note.midi),
          startTick,
          durationTick,
          endTick,
          startBeat: round3(startBeat),
          durationBeat: round3(durationBeat),
          endBeat: round3(endBeat),
          bar,
          beatInBar: round3(beatInBar),
          velocity: vel,
          channel: track.channel ?? 0,
          isOnStrongBeat,
          accentWeight,
        }
      })

      return {
        id: index,
        name: track.name || `Track ${index}`,
        notes,
      }
    })
    .filter((track) => track.notes.length > 0)

  // Detect first active bar and pickup
  const allNotes = tracks.flatMap((t) => t.notes)
  const firstActiveBar = allNotes.length > 0 ? Math.min(...allNotes.map((n) => n.bar)) : 1
  // A pickup exists if the first active bar has notes that don't start on beat 1
  // or if bar 1 is empty and the piece starts later
  const firstBarNotes = allNotes.filter((n) => n.bar === firstActiveBar)
  const hasPickup = firstActiveBar > 1 ||
    (firstBarNotes.length > 0 && firstBarNotes.every((n) => n.beatInBar > 2))

  const meta: MidiMeta = {
    sourceFile: file.name,
    ticksPerBeat,
    tempoBpm: Math.round(tempo * 100) / 100,
    timeSignature,
    beatsPerBar,
    durationSeconds: Math.round(midi.duration * 100) / 100,
    firstActiveBar,
    hasPickup,
  }

  return { meta, tracks }
}
