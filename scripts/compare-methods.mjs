// Offline comparison of the three existing selection paths; opt-in API use.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import * as tf from '@tensorflow/tfjs';
import {resampleAudio} from '../public/resample.js';
import {genres,moods,topTags} from '../public/music-analysis.js';
import {demo,validate,requestBody,candidates} from '../catalog.mjs';
const require=createRequire(import.meta.url);
const {Essentia,EssentiaWASM}=require('essentia.js');
const wav=require('node-wav');
const root=new URL('../',import.meta.url);
const live=process.argv.includes('--live');
if(live&&!process.env.TYPESAFE_API_KEY)throw Error('Set TYPESAFE_API_KEY locally');
const ess=new Essentia(EssentiaWASM);
await tf.setBackend('cpu');await tf.ready();
const graph=JSON.parse(await readFile(new URL('public/models/musicnn/model.json',root)));
const bytes=await readFile(new URL('public/models/musicnn/group1-shard1of1.bin',root));
const model=await tf.loadGraphModel(tf.io.fromMemory({modelTopology:graph.modelTopology,weightSpecs:graph.weightsManifest.flatMap(g=>g.weights),weightData:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}));
const labels=JSON.parse(await readFile(new URL('public/models/musicnn/metadata.json',root))).classes;
const clamp=x=>Math.max(0,Math.min(1,x));
function acoustic(pcm,rate){
 // Deterministic offline approximation to AnalyserNode: 2048-point Blackman,
 // magnitude smoothing 0.7 at 100ms intervals; average final 10s of the 12s clip.
 const n=2048,previous=new Float32Array(n/2),frames=[];
 for(let end=n;end<=pcm.length;end+=Math.round(rate*.1)){
  const frame=pcm.subarray(end-n,end);const rms=Math.sqrt(frame.reduce((s,x)=>s+x*x,0)/n);
  const window=Float32Array.from(frame,(x,i)=>x*(.42-.5*Math.cos(2*Math.PI*i/n)+.08*Math.cos(4*Math.PI*i/n)));
  const vector=ess.arrayToVector(window);const spectrum=ess.Spectrum(vector,n).spectrum;
  const values=ess.vectorToArray(spectrum);let power=0,weighted=0,low=0;
  for(let i=1;i<n/2;i++){const mag=.7*previous[i]+.3*values[i];previous[i]=mag;const p=mag*mag,hz=i*rate/n;power+=p;weighted+=hz*p;if(hz<250)low+=p;}
  vector.delete();spectrum.delete();
  if(end/rate<2||rms<.001)continue;
  frames.push({energy:clamp((20*Math.log10(rms)+55)/45),brightness:clamp(Math.log2(1+weighted/(power||1)/400)/4),bass:clamp(low/(power||1))});
 }
 return Object.fromEntries(['energy','brightness','bass'].map(k=>[k,frames.reduce((s,f)=>s+f[k],0)/frames.length]));
}
function music(pcm,rate){
 const audio=resampleAudio(pcm,rate,16000),mel=[];
 const patches=Math.floor((Math.floor((audio.length-512)/256)+1)/187);
 for(let i=0;i<patches*187;i++){const input=ess.arrayToVector(audio.subarray(i*256,i*256+512));const bands=ess.TensorflowInputMusiCNN(input).bands;mel.push(...ess.vectorToArray(bands));input.delete();bands.delete();}
 const scores=tf.tidy(()=>Array.from(model.execute({'model/Placeholder':tf.tensor3d(mel,[patches,187,96]),'model/Placeholder_1':tf.tensor([false],[1],'bool')},'model/Sigmoid').mean(0).dataSync()));
 const input=ess.arrayToVector(resampleAudio(pcm,rate,44100));const tempo=ess.RhythmExtractor2013(input,208,'multifeature',40);
 const result={source:'msd-musicnn-1',windowSeconds:12,bpm:Number.isFinite(tempo.bpm)&&tempo.confidence>=1&&tempo.ticks.size()>=4?Math.round(tempo.bpm):null,tempoConfidence:Math.max(0,tempo.confidence),genres:topTags(scores,labels,genres),moods:topTags(scores,labels,moods)};
 input.delete();for(const k of ['ticks','estimates','bpmIntervals'])tempo[k].delete();return result;
}
const report={createdAt:new Date().toISOString(),live,repeats:3,window:[0,12],acousticMethod:'Offline AnalyserNode approximation, 44.1kHz, Blackman 2048, magnitude smoothing 0.7 at 100ms; average final 10s. Not browser-bit-identical.',musicBackend:'TensorFlow.js CPU, same model/preprocessing as application',runs:[],clips:[]};
const files=['01-soft-evening.wav','02-citrus-spark.wav','03-deep-groove.wav'];
for(const file of files){
 const buffer=await readFile(new URL('samples/'+file,root));const decoded=wav.decode(buffer);const pcm=decoded.channelData[0].slice(0,decoded.sampleRate*12);
 const start=performance.now();const input=validate({features:acoustic(resampleAudio(pcm,decoded.sampleRate,44100),44100),music:music(pcm,decoded.sampleRate),preference:'all'});
 report.clips.push({file,sha256:createHash('sha256').update(buffer).digest('hex'),analysisMs:performance.now()-start,input});
 console.log(file,JSON.stringify(input));
}
await mkdir(new URL('evaluation/',root),{recursive:true});
const save=()=>writeFile(new URL('evaluation/comparison-results.json',root),JSON.stringify(report,null,2)+'\n');
await save();
for(let repeat=0;repeat<3;repeat++)for(const clip of report.clips){
 // Alternate model order to reduce systematic warm-up/time-order bias.
 const methods=repeat%2?['rule','jev-full','jev-audio']:['rule','jev-audio','jev-full'];
 for(const method of methods){
  if(method!=='rule'&&!live)continue;
  const input={...clip.input,music:method==='jev-full'?clip.input.music:null};
  const start=performance.now();const run={file:clip.file,repeat:repeat+1,method};
  try{
   if(method==='rule'){run.choice=demo(input).id;run.model='squared-distance';}
   else{
    const payload=requestBody(input);run.requestSha256=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${process.env.TYPESAFE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('API HTTP '+response.status);
    const data=await response.json(),answer=data.answers?.cocktail;
    if(!candidates(input).some(r=>r.id===answer?.choice)||!Number.isFinite(answer.confidence)||answer.confidence<0||answer.confidence>1)throw Error('Invalid selection response');
    run.choice=answer.choice;run.confidence=answer.confidence;run.model=data.model;run.usage=data.usage??null;
   }
  }catch(e){run.error=e.name==='TimeoutError'?'Timeout':e.message;}
  run.selectionMs=performance.now()-start;report.runs.push(run);await save();console.log(JSON.stringify(run));
 }
}
model.dispose();
