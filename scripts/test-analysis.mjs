// Standalone test script that mirrors the app's analysis logic
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

const CHORD_TYPES = [
  {intervals:[0,4,7],quality:'major',label:'',tier:'primary'},
  {intervals:[0,3,7],quality:'minor',label:'m',tier:'primary'},
  {intervals:[0,4,7,11],quality:'maj7',label:'maj7',tier:'primary'},
  {intervals:[0,4,7,10],quality:'7',label:'7',tier:'primary'},
  {intervals:[0,3,7,10],quality:'m7',label:'m7',tier:'primary'},
  {intervals:[0,5,7],quality:'sus4',label:'sus4',tier:'extended'},
  {intervals:[0,4,7,2],quality:'add9',label:'add9',tier:'extended'},
  {intervals:[0,3,6],quality:'dim',label:'dim',tier:'altered'},
  {intervals:[0,4,8],quality:'aug',label:'aug',tier:'altered'},
]

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
const buf = readFileSync('/Users/chaspy/Downloads/melody.mid')
const midi = new Midi(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength))
const ppq=midi.header.ppq,bpm=midi.header.tempos[0]?.bpm??120
const ts=midi.header.timeSignatures[0]??null
const bpb=ts?ts.timeSignature[0]:4
const tsStr=ts?`${ts.timeSignature[0]}/${ts.timeSignature[1]}`:'4/4'

const tracks=midi.tracks.map((t,i)=>({
  id:i,name:t.name||`Track ${i}`,
  notes:t.notes.map(n=>{
    const st=Math.round(n.ticks),dt=Math.round(n.durationTicks),et=st+dt
    const sb=st/ppq,db=dt/ppq,eb=sb+db,bar=Math.floor(sb/bpb)+1,bib=sb%bpb+1
    const beatInt=Math.floor(bib),strong=beatInt===1||(bpb===4&&beatInt===3)
    const vel=Math.round(n.velocity*127),bw=beatInt===1?4:(bpb===4&&beatInt===3)?2:1
    return{pitch:n.midi,noteName:p2n(n.midi),pitchClass:n.midi%12,startTick:st,durationTick:dt,endTick:et,
      startBeat:r3(sb),durationBeat:r3(db),endBeat:r3(eb),bar,beatInBar:r3(bib),velocity:vel,channel:t.channel??0,
      isOnStrongBeat:strong,accentWeight:r3(bw*(vel/127))}
  })
})).filter(t=>t.notes.length>0)

const all=tracks.flatMap(t=>t.notes)
const firstActiveBar=Math.min(...all.map(n=>n.bar))
const firstBarNotes=all.filter(n=>n.bar===firstActiveBar)
const hasPickup=firstActiveBar>1||(firstBarNotes.length>0&&firstBarNotes.every(n=>n.beatInBar>2))

const meta={sourceFile:'melody.mid',ticksPerBeat:ppq,tempoBpm:r3(bpm),timeSignature:tsStr,
  beatsPerBar:bpb,durationSeconds:r3(midi.duration),firstActiveBar,hasPickup}

// Histograms
const countH={},durH={},sbH={}
PC.forEach(p=>{countH[p]=0;durH[p]=0;sbH[p]=0})
all.forEach(n=>{
  countH[PC[n.pitchClass]]+=1
  durH[PC[n.pitchClass]]+=n.durationBeat
  sbH[PC[n.pitchClass]]+=n.accentWeight*n.durationBeat
})
PC.forEach(p=>{durH[p]=r3(durH[p]);sbH[p]=r3(sbH[p])})

// Range
let minP=127,maxP=0;all.forEach(n=>{if(n.pitch<minP)minP=n.pitch;if(n.pitch>maxP)maxP=n.pitch})
const range={lowest:p2n(minP),highest:p2n(maxP),lowestPitch:minP,highestPitch:maxP}

// Phrase groups for bias
const sorted=[...all].sort((a,b)=>a.startBeat-b.startBeat)
const phraseGroupsRaw=[sorted.length>0?[sorted[0]]:[]]
for(let i=1;i<sorted.length;i++){
  const prev=sorted[i-1],curr=sorted[i]
  if(curr.startBeat-(prev.startBeat+prev.durationBeat)>1.0)phraseGroupsRaw.push([curr])
  else phraseGroupsRaw[phraseGroupsRaw.length-1].push(curr)
}
const phraseGroups=phraseGroupsRaw.map(notes=>({notes}))

// Bias signals
function computeBias(tonicIdx,mode){
  const scale=scaleFor(tonicIdx,mode)
  const triad=[tonicIdx,(tonicIdx+(mode==='major'?4:3))%12,(tonicIdx+7)%12]
  const lastNote=sorted[sorted.length-1]
  const finalNoteBias=lastNote?.pitchClass===tonicIdx?0.08:lastNote?.pitchClass===(tonicIdx+7)%12?0.04:0
  let phraseEndScore=0
  for(const pg of phraseGroups){
    if(!pg.notes.length)continue
    const ps=[...pg.notes].sort((a,b)=>a.startBeat-b.startBeat)
    const en=ps[ps.length-1]
    if(en.pitchClass===tonicIdx)phraseEndScore+=0.04
    else if(en.pitchClass===(tonicIdx+7)%12)phraseEndScore+=0.02
  }
  const phraseEndingBias=r3(Math.min(phraseEndScore,0.1))
  const db=all.filter(n=>n.isOnStrongBeat&&Math.floor(n.beatInBar)===1)
  const tonicDb=db.filter(n=>n.pitchClass===tonicIdx).length
  const barDownbeatBias=db.length>0?r3(0.06*(tonicDb/db.length)):0
  const pcSet=new Set(all.map(n=>n.pitchClass))
  const triadHits=triad.filter(t=>pcSet.has(t)).length
  const tonicTriadCoverage=r3(triadHits/3)
  const nonScaleToneCount=all.filter(n=>!scale.includes(n.pitchClass)).length
  return{finalNoteBias,phraseEndingBias,barDownbeatBias,tonicTriadCoverage,nonScaleToneCount}
}

function scaleDegreeHist(notes,ti,m){
  const scale=scaleFor(ti,m)
  const dn=m==='major'?['1','2','3','4','5','6','7']:['1','2','b3','4','5','b6','b7']
  const h={};dn.forEach(d=>h[d]=0);h['non-scale']=0
  notes.forEach(n=>{const i=scale.indexOf(n.pitchClass);if(i>=0)h[dn[i]]+=1;else h['non-scale']+=1})
  return h
}

function relKey(t,m){const i=PCI.get(t)??0;return m==='major'?`${PC[(i+9)%12]} minor`:`${PC[(i+3)%12]} major`}
function parKey(t,m){return `${t} ${m==='major'?'minor':'major'}`}

// Key detection with bias
function detectAllWithBias(dist,method){
  const res=[]
  for(let t=0;t<12;t++){
    const rot=rotate(dist,t),ps=r3(pearson(rot,MAJOR_PROFILE))
    const bias=computeBias(t,'major')
    const bt=bias.finalNoteBias+bias.phraseEndingBias+bias.barDownbeatBias+(bias.tonicTriadCoverage>=1?0.05:0)
    res.push({key:`${PC[t]} major`,tonic:PC[t],mode:'major',score:r3(ps+bt),profileScore:ps,method,
      biasSignals:bias,scaleDegreeHistogram:scaleDegreeHist(all,t,'major'),
      relativeKey:relKey(PC[t],'major'),parallelKey:parKey(PC[t],'major'),breakdown:[]})
  }
  for(let t=0;t<12;t++){
    const rot=rotate(dist,t),ps=r3(pearson(rot,MINOR_PROFILE))
    const bias=computeBias(t,'minor')
    const bt=bias.finalNoteBias+bias.phraseEndingBias+bias.barDownbeatBias+(bias.tonicTriadCoverage>=1?0.05:0)
    res.push({key:`${PC[t]} minor`,tonic:PC[t],mode:'minor',score:r3(ps+bt),profileScore:ps,method,
      biasSignals:bias,scaleDegreeHistogram:scaleDegreeHist(all,t,'minor'),
      relativeKey:relKey(PC[t],'minor'),parallelKey:parKey(PC[t],'minor'),breakdown:[]})
  }
  return res
}

const cDist=PC.map(p=>countH[p]),dDist=PC.map(p=>durH[p]),sDist=PC.map(p=>sbH[p])
const cAll=detectAllWithBias(cDist,'count'),dAll=detectAllWithBias(dDist,'duration'),sAll=detectAllWithBias(sDist,'strongBeat')

const top5=r=>[...r].sort((a,b)=>b.score-a.score).slice(0,5)
const cTop=top5(cAll),dTop=top5(dAll),sTop=top5(sAll)

const allK=new Map()
function merge(r,w){for(const c of r){const e=allK.get(c.key);if(e){e.ts+=c.score*w;e.tp+=c.profileScore*w}else allK.set(c.key,{ts:c.score*w,tp:c.profileScore*w,...c})}}
merge(cAll,0.25);merge(dAll,0.35);merge(sAll,0.40)
const combined=[];for(const[k,v]of allK)combined.push({...v,key:k,score:r3(v.ts),profileScore:r3(v.tp),method:'combined'})
combined.sort((a,b)=>b.score-a.score)

const keyCandidates=[...combined.slice(0,5),...cTop,...dTop,...sTop]

// Output summary
console.log('=== Key Candidates (Combined, top 10) ===')
combined.slice(0,10).forEach((k,i)=>{
  const b=k.biasSignals
  console.log(`${i+1}. ${k.key} (total=${k.score}, profile=${k.profileScore}) [finalNote=${b.finalNoteBias}, phraseEnd=${b.phraseEndingBias}, downbeat=${b.barDownbeatBias}, triadCov=${b.tonicTriadCoverage}, nonScale=${b.nonScaleToneCount}]`)
  console.log(`   relative: ${k.relativeKey} | parallel: ${k.parallelKey}`)
  const sdh=k.scaleDegreeHistogram;console.log(`   degrees: ${Object.entries(sdh).map(([d,c])=>d+'='+c).join(', ')}`)
})

console.log('\n=== By Method ===')
;[['Count',cTop],['Duration',dTop],['Strong Beat',sTop]].forEach(([label,res])=>{
  console.log(`${label}: ${res.map(k=>`${k.key}(${k.score})`).join(', ')}`)
})

// Why B major / G# minor might not rank high
console.log('\n=== B major / G# minor analysis ===')
const bMajor=combined.find(k=>k.key==='B major')
const gsMinor=combined.find(k=>k.key==='G# minor')
if(bMajor){
  console.log(`B major: rank=${combined.indexOf(bMajor)+1}, total=${bMajor.score}, profile=${bMajor.profileScore}`)
  console.log(`  bias: finalNote=${bMajor.biasSignals.finalNoteBias}, downbeat=${bMajor.biasSignals.barDownbeatBias}, nonScale=${bMajor.biasSignals.nonScaleToneCount}`)
  console.log(`  degrees: ${Object.entries(bMajor.scaleDegreeHistogram).map(([d,c])=>d+'='+c).join(', ')}`)
}
if(gsMinor){
  console.log(`G# minor: rank=${combined.indexOf(gsMinor)+1}, total=${gsMinor.score}, profile=${gsMinor.profileScore}`)
  console.log(`  bias: finalNote=${gsMinor.biasSignals.finalNoteBias}, downbeat=${gsMinor.biasSignals.barDownbeatBias}, nonScale=${gsMinor.biasSignals.nonScaleToneCount}`)
  console.log(`  degrees: ${Object.entries(gsMinor.scaleDegreeHistogram).map(([d,c])=>d+'='+c).join(', ')}`)
}

// Pickup info
console.log(`\nfirstActiveBar: ${firstActiveBar}, hasPickup: ${hasPickup}`)

// Write full output
const topKey=combined[0]
const tonicIdx=PCI.get(topKey.tonic)??0
const topMode=topKey.mode
const scale=scaleFor(tonicIdx,topMode)

// Chord candidates
function genChords(){
  const cands=[]
  for(const ct of CHORD_TYPES){
    for(const root of scale){
      const ns=ct.intervals.map(i=>(root+i)%12)
      if(ns.every(n=>scale.includes(n)))cands.push({...ct,root,isDiatonic:true})
    }
  }
  for(const ct of CHORD_TYPES){
    for(let root=0;root<12;root++){
      if(!cands.some(c=>c.root===root&&c.quality===ct.quality))cands.push({...ct,root,isDiatonic:false})
    }
  }
  return cands
}
const chordDefs=genChords()
const maxBar=Math.max(...all.map(n=>n.bar))
const bars=[]
for(let b=1;b<=maxBar;b++){
  const bn=all.filter(n=>n.bar===b)
  const pcs=[...new Set(bn.map(n=>PC[n.pitchClass]))]
  const barPCs=new Set(bn.map(n=>n.pitchClass))
  const chords=[]
  for(const cd of chordDefs){
    const cn=cd.intervals.map(i=>(cd.root+i)%12)
    const matched=[],unmatched=[]
    cn.forEach(c=>{if(barPCs.has(c))matched.push(c)})
    const barPCByDur=new Map();bn.forEach(n=>barPCByDur.set(n.pitchClass,(barPCByDur.get(n.pitchClass)??0)+n.durationBeat))
    for(const[pc]of barPCByDur)if(!cn.includes(pc))unmatched.push(pc)
    const matchR=matched.length/cn.length,miss=cn.length-matched.length
    const covN=bn.filter(n=>cn.includes(n.pitchClass)),barCov=covN.length/Math.max(bn.length,1)
    const covDur=covN.reduce((s,n)=>s+n.durationBeat,0),totDur=bn.reduce((s,n)=>s+n.durationBeat,0)
    const durCov=totDur>0?covDur/totDur:0
    const diaB=cd.isDiatonic?0.15:0,tierP=cd.tier==='altered'?0.1:cd.tier==='extended'?0.02:0
    const score=r3(matchR*0.3+barCov*0.2+durCov*0.2-miss*0.1+diaB-tierP)
    if(score>=0.15)chords.push({chord:`${PC[cd.root]}${cd.label}`,root:PC[cd.root],quality:cd.quality,score,isDiatonic:cd.isDiatonic,matchedNotes:matched.map(p=>PC[p]),unmatchedNotes:unmatched.map(p=>PC[p]),tier:cd.tier})
  }
  chords.sort((a,b)=>{if(a.isDiatonic!==b.isDiatonic)return a.isDiatonic?-1:1;const to={primary:0,extended:1,altered:2};if(a.tier!==b.tier)return to[a.tier]-to[b.tier];return b.score-a.score})
  bars.push({bar:b,startBeat:(b-1)*bpb,endBeat:b*bpb,noteCount:bn.length,pitchClasses:pcs,melodyNotes:bn.map(n=>n.noteName),chordCandidates:chords.slice(0,8),progressionCandidates:[]})
}

console.log('\n=== Bars (chords, top 3 per bar) ===')
bars.filter(b=>b.noteCount>0).forEach(b=>{
  const top=b.chordCandidates.slice(0,3).map(c=>`${c.chord}(${c.score},${c.tier},${c.isDiatonic?'dia':'non'})`).join(', ')
  console.log(`Bar ${b.bar}: [${b.pitchClasses}] -> ${top||'-'}`)
})

// Phrases
const phraseGroupsFinal=[[sorted[0]]]
for(let i=1;i<sorted.length;i++){
  const prev=sorted[i-1],curr=sorted[i]
  if(curr.startBeat-(prev.startBeat+prev.durationBeat)>1.0)phraseGroupsFinal.push([curr])
  else phraseGroupsFinal[phraseGroupsFinal.length-1].push(curr)
}
// Contour split
const refined=[]
for(const g of phraseGroupsFinal){
  const cur=[g[0]]
  for(let i=1;i<g.length;i++){
    const prev=g[i-1],curr=g[i]
    if(Math.abs(curr.pitch-prev.pitch)>=12&&curr.startBeat-(prev.startBeat+prev.durationBeat)>0.3){
      refined.push([...cur]);cur.length=0
    }
    cur.push(curr)
  }
  if(cur.length>0)refined.push(cur)
}
console.log(`\nPhrases: ${refined.length}`)
refined.forEach((pn,i)=>{
  const avg=r3(pn.reduce((s,n)=>s+n.pitch,0)/pn.length)
  console.log(`  Phrase ${i+1}: bar ${Math.min(...pn.map(n=>n.bar))}-${Math.max(...pn.map(n=>n.bar))}, notes=${pn.length}, avgPitch=${avg}`)
})

// Write JSON (without tracks for brevity in console)
const output={meta,tracks,
  analysis:{histograms:{count:countH,durationWeighted:durH,strongBeatWeighted:sbH},range,keyCandidates:keyCandidates.slice(0,20),bars,phrases:refined.map((pn,i)=>({
    id:i,startBar:Math.min(...pn.map(n=>n.bar)),endBar:Math.max(...pn.map(n=>n.bar)),
    startBeat:r3(Math.min(...pn.map(n=>n.startBeat))),endBeat:r3(Math.max(...pn.map(n=>n.endBeat))),
    noteCount:pn.length,avgPitch:r3(pn.reduce((s,n)=>s+n.pitch,0)/pn.length),similarPhraseIds:[]
  }))},
  summary:{noteCount:all.length,trackCount:tracks.length,barCount:bars.length,phraseCount:refined.length,durationSeconds:meta.durationSeconds,firstActiveBar}
}
writeFileSync('/Users/chaspy/Downloads/melody-analysis-v2.json',JSON.stringify(output,null,2))
console.log('\nWrote /Users/chaspy/Downloads/melody-analysis-v2.json')
