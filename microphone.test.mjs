import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const code=(await readFile(new URL('./public/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/,'');
function harness(getUserMedia){
 const elements=new Map(),events={},nodes=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,paused:true,addEventListener(){},setAttribute(k,v){this[k]=v;},pause(){}});return elements.get(id);};
 class Context{
  destination={};state='running';
  async resume(){}
  createAnalyser(){return {frequencyBinCount:1024,connect(){}};}
  createGain(){const node={gain:{value:1},connect(){}};nodes.push(node);return node;}
  createMediaElementSource(){return {connect(){}};}
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
 }
 const sandbox={document:{getElementById:element},navigator:{mediaDevices:{getUserMedia}},AudioContext:Context,fetch:async()=>({json:async()=>({mode:'demo'})}),requestAnimationFrame(){},clearInterval(){},window:{addEventListener(k,cb){events[k]=cb;}},Float32Array};
 vm.runInNewContext(code,sandbox);
 return {element,events,nodes};
}
function stream(){let stopped=0;const track={stop(){stopped++;},addEventListener(){}};return {getTracks:()=>[track],getAudioTracks:()=>[track],stops:()=>stopped};}
test('microphone is muted locally and stopped on user action',async()=>{
 const s=stream(),h=harness(async()=>s);
 await h.element('mic').onclick();
 assert.equal(h.element('mic')['aria-pressed'],'true');assert.equal(h.nodes[0].gain.value,0);
 await h.element('mic').onclick();
 assert.equal(s.stops(),1);assert.equal(h.nodes[0].gain.value,1);assert.equal(h.element('mic')['aria-pressed'],'false');
});
test('cancel while permission is pending disposes a late stream',async()=>{
 let resolve;const s=stream(),h=harness(()=>new Promise(r=>{resolve=r;}));
 const pending=h.element('mic').onclick();await new Promise(setImmediate);
 await h.element('mic').onclick();resolve(s);await pending;
 assert.equal(s.stops(),1);assert.equal(h.element('mic')['aria-pressed'],'false');
});
test('denied permission displays a useful error',async()=>{
 const h=harness(async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});});
 await h.element('mic').onclick();assert.match(h.element('status').textContent,/許可されていません/);assert.equal(h.element('mic')['aria-pressed'],'false');
});
test('leaving the page releases microphone tracks',async()=>{
 const s=stream(),h=harness(async()=>s);await h.element('mic').onclick();h.events.pagehide();assert.equal(s.stops(),1);
});
