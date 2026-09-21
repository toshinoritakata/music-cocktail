import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resampleAudio} from './public/resample.js';
import {validateMusic,topTags,genres} from './public/music-analysis.js';
import {validate,requestBody} from './catalog.mjs';
const music={source:'msd-musicnn-1',windowSeconds:12,bpm:120,tempoConfidence:2.5,genres:[{label:'jazz',score:.4}],moods:[{label:'Mellow',score:.3}]};
test('music analysis survives validation and is sent to Jev',()=>{
 const input=validate({features:{energy:.5,brightness:.3,bass:.8},preference:'zero',music});
 assert.deepEqual(requestBody(input).state.music,music);
 assert.match(requestBody(input).questions.cocktail.instructions,/music.moods/);
});
test('unknown labels, invalid scores and invalid tempos are rejected',()=>{
 for(const patch of [{bpm:500},{bpm:NaN},{genres:[{label:'invented',score:.3}]},{moods:[{label:'sad',score:2}]},{tempoConfidence:Infinity}])assert.throws(()=>validateMusic({...music,...patch}));
 assert.equal(validateMusic({...music,bpm:null}).bpm,null);
 assert.equal(validateMusic(undefined),null);
});
test('ranking selects supported genres without relabeling model outputs',()=>{
 assert.deepEqual(topTags([.5,.9,.2],['jazz','happy','rock'],genres),[{label:'jazz',score:.5},{label:'rock',score:.2}]);
});
test('resampler preserves an audible tone while removing out-of-band energy',()=>{
 const tone=hz=>Float32Array.from({length:48000},(_,i)=>Math.sin(2*Math.PI*hz*i/48000));
 const rms=x=>Math.sqrt(x.slice(200,-200).reduce((s,v)=>s+v*v,0)/(x.length-400));
 const low=resampleAudio(tone(1000),48000,16000),high=resampleAudio(tone(12000),48000,16000);
 assert.equal(low.length,16000);assert.ok(rms(low)>.65);assert.ok(rms(high)<.015);
});
