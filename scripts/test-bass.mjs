// Bass line analysis script - focuses on per-bar root analysis and interlude from bar 11
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { Midi } = require('@tonejs/midi')
import { readFileSync, writeFileSync } from 'fs'

const PC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const PCI = new Map(PC.map((n,i)=>[n,i]))
const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]
const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]
const MAJOR_SCALE = [0,2,4,5,7,9,11]
const MINOR_SCALE = [0,2,3,5,7,8,10]

function r3(n){return Math.round(n*1000)/1000}
function rotate(a,n){const s=((n%a.length)+a.length)%a.length;return[...a.slice(s),...a.slice(0,s)]}
function pearson(x,y){
  const n=x.length,mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n
  let num=0,dx2=0,dy2=0
  for(let i=0;i<n;i++){const dx=x[i]-mx,dy=y[i]-my;num+=dx*dy;dx2+=dx*dx;dy2+=dy*dy}
  const d=Math.sqrt(dx2*dy2);return d===0?0:num/d
}
function p2n(p){return PC[p%12]+(Math.floor(p/12)-1)}
function scaleFor(t,m){return(m==='major'?MAJOR_SCALE:MINOR_SCALE).map(i=>(t+i)%12)}

// Parse MIDI
const buf = readFileSync('/Users/chaspy/Downloads/bass.mid')
const midi = new Midi(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength))
const ppq=midi.header.ppq,bpm=midi.header.tempos[0]?.bpm??120
const ts=midi.header.timeSignatures[0]??null
const bpb=ts?ts.timeSignature[0]:4
const tsStr=ts?`${ts.timeSignature[0]}/${ts.timeSignature[1]}`:'4/4'
const gridResolution = ppq / 4 // 1/16 note grid

const tracks=midi.tracks.map((t,i)=>{
  // Instrument detection
  const instrumentNum = t.instrument?.number ?? -1
  const instrumentName = t.instrument?.name ?? 'unknown'
  const instrumentFamily = t.instrument?.family ?? 'unknown'
  const trackNameLower = (t.name || '').toLowerCase()
  const isBass = (instrumentNum >= 32 && instrumentNum <= 39) || trackNameLower.includes('bass')

  return {
    id:i,name:t.name||`Track ${i}`,
    instrument: instrumentNum,
    instrumentName,
    instrumentFamily,
    isBass,
    notes:t.notes.map(n=>{
      const st=Math.round(n.ticks),dt=Math.round(n.durationTicks),et=st+dt
      const sb=st/ppq,db=dt/ppq,eb=sb+db,bar=Math.floor(sb/bpb)+1,bib=sb%bpb+1
      const beatInt=Math.floor(bib),strong=beatInt===1||(bpb===4&&beatInt===3)
      const vel=Math.round(n.velocity*127),bw=beatInt===1?4:(bpb===4&&beatInt===3)?2:1
      const quantizedStartTick = Math.round(st / gridResolution) * gridResolution
      const microTimingOffset = st - quantizedStartTick
      return{pitch:n.midi,noteName:p2n(n.midi),pitchClass:n.midi%12,startTick:st,durationTick:dt,endTick:et,
        startBeat:r3(sb),durationBeat:r3(db),endBeat:r3(eb),bar,beatInBar:r3(bib),velocity:vel,channel:t.channel??0,
        isOnStrongBeat:strong,accentWeight:r3(bw*(vel/127)),quantizedStartTick,microTimingOffset}
    })
  }
}).filter(t=>t.notes.length>0)

const all=tracks.flatMap(t=>t.notes).sort((a,b)=>a.startBeat-b.startBeat)
const maxBar=Math.max(...all.map(n=>n.bar))
const firstActiveBar=Math.min(...all.map(n=>n.bar))

const meta={sourceFile:'bass.mid',ticksPerBeat:ppq,tempoBpm:r3(bpm),timeSignature:tsStr,
  beatsPerBar:bpb,durationSeconds:r3(midi.duration),firstActiveBar}

console.log('=== META ===')
console.log(`File: bass.mid | Tempo: ${meta.tempoBpm} BPM | Time Sig: ${tsStr} | PPQ: ${ppq}`)
console.log(`Duration: ${meta.durationSeconds}s | Bars: ${maxBar} | Notes: ${all.length}`)

// Instrument detection output
console.log('\n=== INSTRUMENT DETECTION ===')
tracks.forEach(t=>{
  console.log(`Track ${t.id} "${t.name}": program=${t.instrument}, name=${t.instrumentName}, family=${t.instrumentFamily}, isBass=${t.isBass}`)
})

// Quantization sample
console.log('\n=== QUANTIZATION SAMPLE (first 5 notes) ===')
all.slice(0,5).forEach(n=>{
  console.log(`  ${n.noteName} tick=${n.startTick} quantized=${n.quantizedStartTick} offset=${n.microTimingOffset}`)
})

// Per-bar analysis
console.log('\n=== PER-BAR BASS NOTES ===')
const barData = []
for(let b=1;b<=maxBar;b++){
  const bn=all.filter(n=>n.bar===b)
  const notes=bn.map(n=>({name:n.noteName,pc:PC[n.pitchClass],beat:n.beatInBar,dur:n.durationBeat,vel:n.velocity}))
  const pcs=[...new Set(bn.map(n=>PC[n.pitchClass]))]
  // Determine bass root (lowest/longest note on beat 1)
  const beat1=bn.filter(n=>Math.floor(n.beatInBar)===1)
  const root = beat1.length>0
    ? beat1.sort((a,b)=>a.pitch-b.pitch)[0]
    : bn.length>0 ? bn.sort((a,b)=>a.pitch-b.pitch)[0] : null
  barData.push({bar:b,noteCount:bn.length,pcs,notes,root:root?{name:root.noteName,pc:PC[root.pitchClass]}:null})
  if(bn.length>0){
    const noteStr=notes.map(n=>`${n.name}(b${n.beat.toFixed(1)},d${n.dur.toFixed(2)})`).join(' ')
    console.log(`Bar ${b}: root=${root?root.noteName:'-'} | PCs=[${pcs.join(',')}] | ${noteStr}`)
  }
}

// Section analysis: bars 1-10 (main) vs 11+ (interlude)
console.log('\n=== SECTION SPLIT: MAIN (bar 1-10) vs INTERLUDE (bar 11+) ===')
const mainNotes = all.filter(n=>n.bar<=10)
const interludeNotes = all.filter(n=>n.bar>=11)

function sectionHistogram(notes){
  const h={}; PC.forEach(p=>h[p]=0)
  notes.forEach(n=>h[PC[n.pitchClass]]+=n.durationBeat)
  PC.forEach(p=>h[p]=r3(h[p]))
  return h
}
function sectionCountHist(notes){
  const h={}; PC.forEach(p=>h[p]=0)
  notes.forEach(n=>h[PC[n.pitchClass]]+=1)
  return h
}

const mainHist=sectionHistogram(mainNotes)
const interHist=sectionHistogram(interludeNotes)
const mainCount=sectionCountHist(mainNotes)
const interCount=sectionCountHist(interludeNotes)

console.log('\nMain section (bar 1-10):')
console.log('  Duration-weighted:', PC.map(p=>`${p}=${mainHist[p]}`).filter(s=>!s.endsWith('=0')).join(', '))
console.log('  Count:', PC.map(p=>`${p}=${mainCount[p]}`).filter(s=>!s.endsWith('=0')).join(', '))
console.log(`  Notes: ${mainNotes.length}`)

console.log('\nInterlude (bar 11+):')
console.log('  Duration-weighted:', PC.map(p=>`${p}=${interHist[p]}`).filter(s=>!s.endsWith('=0')).join(', '))
console.log('  Count:', PC.map(p=>`${p}=${interCount[p]}`).filter(s=>!s.endsWith('=0')).join(', '))
console.log(`  Notes: ${interludeNotes.length}`)

// Key detection per section
function detectKeys(hist,label){
  const dist=PC.map(p=>hist[p])
  const results=[]
  for(let t=0;t<12;t++){
    const rmaj=rotate(dist,t),rmin=rotate(dist,t)
    results.push({key:`${PC[t]} major`,score:r3(pearson(rmaj,MAJOR_PROFILE)),tonic:t,mode:'major'})
    results.push({key:`${PC[t]} minor`,score:r3(pearson(rmin,MINOR_PROFILE)),tonic:t,mode:'minor'})
  }
  results.sort((a,b)=>b.score-a.score)
  console.log(`\n  Key candidates (${label}, top 5):`)
  results.slice(0,5).forEach((k,i)=>console.log(`    ${i+1}. ${k.key} (${k.score})`))
  return results
}

detectKeys(mainHist,'Main section')
detectKeys(interHist,'Interlude')

// Full file key detection
console.log('\n=== FULL FILE KEY DETECTION ===')
const fullHist=sectionHistogram(all)
detectKeys(fullHist,'Full file')

// Bass root progression
console.log('\n=== BASS ROOT PROGRESSION ===')
const rootProg = barData.filter(b=>b.root).map(b=>({bar:b.bar,root:b.root.pc}))
console.log('Main (1-10):', rootProg.filter(b=>b.bar<=10).map(b=>`${b.bar}:${b.root}`).join(' → '))
console.log('Interlude (11+):', rootProg.filter(b=>b.bar>=11).map(b=>`${b.bar}:${b.root}`).join(' → '))

// Analyze implied harmony from bass roots
console.log('\n=== IMPLIED HARMONY FROM BASS ROOTS ===')
// In F# major context
const fsScale = scaleFor(PCI.get('F#'),  'major') // F# major: F# G# A# B C# D# E#(F)
const degreeNames = ['I','II','III','IV','V','VI','VII']
const fsMajorDegrees = new Map()
fsScale.forEach((pc,i) => fsMajorDegrees.set(pc, degreeNames[i]))

console.log('F# major scale tones:', fsScale.map(pc => PC[pc]).join(' '))

rootProg.forEach(b => {
  const pcIdx = PCI.get(b.root)
  const degree = fsMajorDegrees.get(pcIdx)
  const inScale = degree ? `(${degree})` : '(non-diatonic)'
  console.log(`  Bar ${b.bar}: ${b.root} ${inScale}`)
})

// Chromatic motion analysis in interlude
console.log('\n=== CHROMATIC MOTION IN INTERLUDE ===')
const intRoots = rootProg.filter(b=>b.bar>=11)
for(let i=1;i<intRoots.length;i++){
  const prev=PCI.get(intRoots[i-1].root)
  const curr=PCI.get(intRoots[i].root)
  const interval = ((curr-prev)+12)%12
  const semitones = interval<=6 ? interval : interval-12
  const dir = semitones>0?'↑':'↓'
  console.log(`  ${intRoots[i-1].root} → ${intRoots[i].root}: ${Math.abs(semitones)} semitone${Math.abs(semitones)!==1?'s':''} ${dir} (bar ${intRoots[i-1].bar}→${intRoots[i].bar})`)
}

// ---------------------------------------------------------------------------
// Bass Analysis (mirrors TS implementation)
// ---------------------------------------------------------------------------

function findBassRootForBeat(barNotes, targetBeat) {
  const candidates = barNotes.filter(n => Math.abs(Math.floor(n.beatInBar) - targetBeat) < 1)
  if (candidates.length === 0) return null
  const lowest = candidates.reduce((a, b) => a.pitch < b.pitch ? a : b)
  return { root: PC[lowest.pitchClass], rootPitchClass: lowest.pitchClass }
}

function computeStrongBeatRootsFn(notes, beatsPerBar) {
  if (notes.length === 0) return []
  const maxB = Math.max(...notes.map(n => n.bar))
  const results = []
  for (let b = 1; b <= maxB; b++) {
    const barNotes = notes.filter(n => n.bar === b)
    const beat1 = findBassRootForBeat(barNotes, 1)
    const beat3 = beatsPerBar >= 4 ? findBassRootForBeat(barNotes, 3) : null
    results.push({
      bar: b,
      beat1Root: beat1?.root ?? null, beat1RootPitchClass: beat1?.rootPitchClass ?? null,
      beat3Root: beat3?.root ?? null, beat3RootPitchClass: beat3?.rootPitchClass ?? null,
    })
  }
  return results
}

function computeRootMotionSequenceFn(strongBeatRoots) {
  const withRoots = strongBeatRoots.filter(b => b.beat1Root !== null)
  return withRoots.map((b, idx) => {
    const next = idx < withRoots.length - 1 ? withRoots[idx + 1] : null
    let intervalToNext = null, directionToNext = null
    if (next && b.beat1RootPitchClass !== null && next.beat1RootPitchClass !== null) {
      const raw = ((next.beat1RootPitchClass - b.beat1RootPitchClass) + 12) % 12
      const shortest = raw <= 6 ? raw : raw - 12
      intervalToNext = Math.abs(shortest)
      directionToNext = shortest > 0 ? 'up' : shortest < 0 ? 'down' : 'same'
    }
    return { bar: b.bar, root: b.beat1Root, rootPitchClass: b.beat1RootPitchClass, intervalToNext, directionToNext }
  })
}

function computePedalToneSegmentsFn(rootMotion) {
  if (rootMotion.length === 0) return []
  const segments = []
  let start = 0
  for (let i = 1; i <= rootMotion.length; i++) {
    if (i === rootMotion.length || rootMotion[i].rootPitchClass !== rootMotion[start].rootPitchClass) {
      const count = i - start
      if (count >= 2) {
        segments.push({
          root: rootMotion[start].root, rootPitchClass: rootMotion[start].rootPitchClass,
          startBar: rootMotion[start].bar, endBar: rootMotion[i - 1].bar, barCount: count,
        })
      }
      start = i
    }
  }
  return segments
}

function computeChromaticApproachNotesFn(notes, rootMotion) {
  const rootByBar = new Map()
  for (const rm of rootMotion) rootByBar.set(rm.bar, rm.rootPitchClass)
  const results = []
  for (const n of notes) {
    const nextBarRoot = rootByBar.get(n.bar + 1)
    if (nextBarRoot === undefined) continue
    const diff = ((n.pitchClass - nextBarRoot) + 12) % 12
    if (diff === 1) {
      results.push({ noteName: n.noteName, pitchClass: n.pitchClass, targetRoot: PC[nextBarRoot],
        targetRootPitchClass: nextBarRoot, bar: n.bar, beatInBar: n.beatInBar, approachType: 'above' })
    } else if (diff === 11) {
      results.push({ noteName: n.noteName, pitchClass: n.pitchClass, targetRoot: PC[nextBarRoot],
        targetRootPitchClass: nextBarRoot, bar: n.bar, beatInBar: n.beatInBar, approachType: 'below' })
    }
  }
  return results
}

// Run bass analysis on bass tracks
const bassTracks = tracks.filter(t => t.isBass)
const bassAnalysis = bassTracks.map(t => {
  const sbr = computeStrongBeatRootsFn(t.notes, bpb)
  const rms = computeRootMotionSequenceFn(sbr)
  const pts = computePedalToneSegmentsFn(rms)
  const can = computeChromaticApproachNotesFn(t.notes, rms)
  return { trackId: t.id, trackName: t.name, rootMotionSequence: rms, pedalToneSegments: pts, chromaticApproachNotes: can, strongBeatRoots: sbr }
})

console.log('\n=== BASS ANALYSIS ===')
if (bassAnalysis.length === 0) {
  console.log('No bass tracks detected.')
} else {
  for (const ba of bassAnalysis) {
    console.log(`\nTrack ${ba.trackId} "${ba.trackName}":`)
    console.log('  Root motion:', ba.rootMotionSequence.map(r => `${r.bar}:${r.root}(${r.intervalToNext ?? '-'}${r.directionToNext ? ' '+r.directionToNext : ''})`).join(' → '))
    console.log('  Pedal tones:', ba.pedalToneSegments.length > 0
      ? ba.pedalToneSegments.map(p => `${p.root} bars ${p.startBar}-${p.endBar} (${p.barCount} bars)`).join(', ')
      : 'none')
    console.log('  Chromatic approaches:', ba.chromaticApproachNotes.length > 0
      ? ba.chromaticApproachNotes.map(c => `${c.noteName} → ${c.targetRoot} (bar ${c.bar}, beat ${c.beatInBar.toFixed(1)}, ${c.approachType})`).join(', ')
      : 'none')
  }
}

// Write JSON
const output = {meta, tracks: tracks.map(t => ({id:t.id,name:t.name,instrument:t.instrument,instrumentName:t.instrumentName,instrumentFamily:t.instrumentFamily,isBass:t.isBass,noteCount:t.notes.length})),
  barData, rootProgression: rootProg, bassAnalysis,
  sections: {
    main: {bars:'1-10', notes: mainNotes.length, histogram: mainHist},
    interlude: {bars:'11+', notes: interludeNotes.length, histogram: interHist}
  }
}
writeFileSync('/Users/chaspy/Downloads/bass-analysis.json', JSON.stringify(output,null,2))
console.log('\nWrote /Users/chaspy/Downloads/bass-analysis.json')
