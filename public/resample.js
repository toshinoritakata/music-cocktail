// Windowed-sinc polyphase resampling. Filtering prevents aliases when downsampling.
export function resampleAudio(input, sourceRate, targetRate) {
 if(sourceRate===targetRate)return input.slice();
 if(!Number.isFinite(sourceRate)||!Number.isFinite(targetRate)||sourceRate<=0||targetRate<=0)throw Error('Invalid sample rate');
 const output=new Float32Array(Math.floor(input.length*targetRate/sourceRate));
 const radius=24,phases=256,taps=radius*2,cutoff=Math.min(1,targetRate/sourceRate)*.94;
 const kernels=Array.from({length:phases},(_,p)=>{
  const values=new Float32Array(taps);let sum=0;
  for(let k=0;k<taps;k++){
   const x=k-radius+1-p/phases;
   const sinc=Math.abs(x)<1e-9?cutoff:Math.sin(Math.PI*cutoff*x)/(Math.PI*x);
   values[k]=sinc*(.5+.5*Math.cos(Math.PI*x/radius));sum+=values[k];
  }
  for(let k=0;k<taps;k++)values[k]/=sum;
  return values;
 });
 for(let i=0;i<output.length;i++){
  const position=i*sourceRate/targetRate,base=Math.floor(position);
  const kernel=kernels[Math.min(phases-1,Math.floor((position-base)*phases))];
  let value=0;
  for(let k=0;k<taps;k++){const index=base+k-radius+1;if(index>=0&&index<input.length)value+=input[index]*kernel[k];}
  output[i]=value;
 }
 return output;
}
