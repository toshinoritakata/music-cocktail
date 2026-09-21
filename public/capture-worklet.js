// Audio stays in this browser. Collect a rolling 12-second window every 6 seconds.
class MusicCapture extends AudioWorkletProcessor {
 constructor(){super();this.ring=new Float32Array(Math.round(sampleRate*12));this.position=0;this.total=0;this.since=0;this.generation=0;this.port.onmessage=e=>{this.position=0;this.total=0;this.since=0;this.generation=e.data.generation;};}
 process(inputs){const channels=inputs[0];if(!channels?.length)return true;
  for(let i=0;i<channels[0].length;i++){let v=0;for(const c of channels)v+=c[i]/channels.length;this.ring[this.position]=v;this.position=(this.position+1)%this.ring.length;this.total++;this.since++;}
  if(this.total>=this.ring.length&&this.since>=sampleRate*6){this.since=0;const pcm=new Float32Array(this.ring.length);pcm.set(this.ring.subarray(this.position));pcm.set(this.ring.subarray(0,this.position),this.ring.length-this.position);this.port.postMessage({pcm,sampleRate,generation:this.generation},[pcm.buffer]);}
  return true;
 }
}
registerProcessor('music-capture',MusicCapture);
