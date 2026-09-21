var exports={};
importScripts('/vendor/tf.min.js','/vendor/tf-backend-wasm.min.js','/vendor/essentia-wasm.umd.js','/vendor/essentia.js-core.js');
let essentia,model,labels,tags,resampler;
const ready=(async()=>{
 tf.wasm.setWasmPaths('/vendor/');await tf.setBackend('wasm');await tf.ready();
 essentia=new Essentia(exports.EssentiaWASM);
 [model,labels,tags,resampler]=await Promise.all([tf.loadGraphModel('/models/musicnn/model.json'),fetch('/models/musicnn/metadata.json').then(r=>r.json()).then(m=>m.classes),import('/music-analysis.js'),import('/resample.js')]);
 postMessage({type:'ready'});
})();
ready.catch(e=>{console.error('Model initialization:',e);postMessage({type:'error',error:'音楽解析モデルの初期化に失敗: '+e.message});});
function resample(pcm,rate,target){return resampler.resampleAudio(pcm,rate,target);}
function tempo(pcm,rate){let input,result;try{
 const audio=resample(pcm,rate,44100);input=essentia.arrayToVector(audio);result=essentia.RhythmExtractor2013(input,208,'multifeature',40);
 return {bpm:Number.isFinite(result.bpm)&&result.confidence>=1&&result.ticks.size()>=4?Math.round(result.bpm):null,tempoConfidence:Number.isFinite(result.confidence)?Math.max(0,result.confidence):0};
 }finally{input?.delete();for(const key of ['ticks','estimates','bpmIntervals'])result?.[key]?.delete();}}
let working=false;
self.onmessage=async({data})=>{
 if(working)return;working=true;
 try{await ready;const {pcm,sampleRate,generation}=data;
 const rms=Math.sqrt(pcm.reduce((s,v)=>s+v*v,0)/pcm.length);
 if(rms<.001){postMessage({type:'result',generation,music:null});return;}
 const audio=resample(pcm,sampleRate,16000),mel=[];
 // Four complete 187-frame patches. No zero padding or incomplete final patches.
 const count=Math.floor((audio.length-512)/256)+1,patches=Math.floor(count/187);
 for(let i=0;i<patches*187;i++){let input,output;try{input=essentia.arrayToVector(audio.subarray(i*256,i*256+512));output=essentia.TensorflowInputMusiCNN(input).bands;mel.push(Array.from(essentia.vectorToArray(output)));}finally{input?.delete();output?.delete();}}
 const scores=tf.tidy(()=>{
  const x=tf.tensor3d(mel.flat(),[patches,187,96]);
  const output=model.execute({'model/Placeholder':x,'model/Placeholder_1':tf.tensor([false],[1],'bool')},'model/Sigmoid');
  return Array.from(output.mean(0).dataSync());
 });
 const music={source:'msd-musicnn-1',windowSeconds:pcm.length/sampleRate,...tempo(pcm,sampleRate),genres:tags.topTags(scores,labels,tags.genres),moods:tags.topTags(scores,labels,tags.moods)};
 postMessage({type:'result',generation,music});
 }catch(e){console.error('Music analysis:',e.message);postMessage({type:'error',generation:data.generation,error:'音楽解析に失敗: '+(e.message||String(e))});}
 finally{working=false;}
};
