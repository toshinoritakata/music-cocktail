import {moodNames} from './music-analysis.js';
const $=id=>document.getElementById(id), audio=$('audio');
let ctx,analyser,monitor,source,micSource,micStream,micOn=false,micPending=false,micGeneration=0,bufferUrl,sampleTimer,sampleNodes=[],sampleOn=false,frames=[],lastFrame=0,lastRequest=0,busy=false,locked=false,epoch=0,previousId='',streak=0,shown='',controller;
let freq,time,lastAudible=0,mode='demo';
let music=null,musicAt=0,musicGeneration=0,musicWorker,captureNode,capturePromise,workerReady=false,workerBusy=false,submittedAt=0;
const clamp=x=>Math.min(1,Math.max(0,x));
fetch('/api/status').then(r=>r.json()).then(s=>{mode=s.mode;$('mode').textContent=mode==='jev'?'● Jev 接続設定あり':'○ デモ / ルールで選択';}).catch(()=>{$('mode').textContent='接続エラー';});
function setup(){if(ctx)return;ctx=new AudioContext();analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.7;freq=new Float32Array(analyser.frequencyBinCount);time=new Float32Array(analyser.fftSize);monitor=ctx.createGain();analyser.connect(monitor);monitor.connect(ctx.destination);source=ctx.createMediaElementSource(audio);source.connect(analyser);startMusicAnalysis();}
function renderMusic(){
 $('bpm-value').textContent=music?.bpm?`${music.bpm} BPM`:'判定待ち';
 const describe=(items,isMood)=>items?.map(v=>`${isMood?(moodNames[v.label]||v.label):v.label} ${Math.round(v.score*100)}${v.score<.15?'（弱）':''}`).join(' / ')||'解析待ち';
 $('genre-value').textContent=describe(music?.genres,false);
 $('mood-value').textContent=describe(music?.moods,true);
 if(music&&!music.bpm)$('bpm-value').textContent='拍が不明瞭';
}
function startMusicAnalysis(){
 if(capturePromise||!ctx.audioWorklet||typeof Worker==='undefined')return;
 $('music-status').textContent='音楽解析モデルを準備しています…';
 capturePromise=(async()=>{
  musicWorker=new Worker('/music-worker.js');
  musicWorker.onerror=()=>{workerReady=false;workerBusy=false;music=null;renderMusic();$('music-status').textContent='モデルを読み込めません。再読み込みしてください。音響特徴のみ利用します。';};
  musicWorker.onmessage=({data})=>{
   if(data.type==='ready'){workerReady=true;$('music-status').textContent='モデル準備完了。12秒の音を集めて解析します。';return;}
   workerBusy=false;
   if(data.generation!==undefined&&data.generation!==musicGeneration)return;
   if(data.type==='error'){music=null;renderMusic();$('music-status').textContent=data.error;return;}
   music=data.music;musicAt=submittedAt;renderMusic();
   $('music-status').textContent=music?'直近12秒の推定を反映しました。約6秒ごとに再解析します。':'音が小さいため、音楽解析を待っています。';
   lastRequest=0;
  };
  await ctx.audioWorklet.addModule('/capture-worklet.js');
  captureNode=new AudioWorkletNode(ctx,'music-capture');
  captureNode.port.postMessage({generation:musicGeneration});
  captureNode.port.onmessage=({data})=>{
   if(data.generation!==musicGeneration||!workerReady||workerBusy||(!micOn&&!sampleOn&&audio.paused))return;
   workerBusy=true;submittedAt=performance.now();$('music-status').textContent='ジャンル・ムード・テンポを解析中…';
   musicWorker.postMessage(data,[data.pcm.buffer]);
  };
  analyser.connect(captureNode);const sink=ctx.createGain();sink.gain.value=0;captureNode.connect(sink);sink.connect(ctx.destination);
 })().catch(()=>{$('music-status').textContent='音楽解析を開始できません。音響特徴のみ利用します。';});
}
function reset(){musicGeneration++;music=null;musicAt=0;captureNode?.port.postMessage({generation:musicGeneration});renderMusic();lastAudible=0;epoch++;controller?.abort();frames=[];previousId='';streak=0;lastRequest=0;$('recommend').disabled=true;}
function stopMic(){
 micGeneration++;micPending=false;
 micSource?.disconnect();micSource=null;
 micStream?.getTracks().forEach(track=>track.stop());micStream=null;micOn=false;
 if(monitor)monitor.gain.value=1;
 $('mic').textContent='マイクで聴く';$('mic').setAttribute('aria-pressed','false');
}
$('mic').onclick=async()=>{
 if(micOn||micPending){stopMic();reset();$('status').textContent='マイク入力を停止しました。';return;}
 if(!navigator.mediaDevices?.getUserMedia){$('status').textContent='このブラウザではマイクを使えません。localhostまたはHTTPSで開いてください。';return;}
 setup();audio.pause();stopSample();reset();
 const version=++micGeneration;micPending=true;
 $('mic').textContent='許可を待っています / キャンセル';$('status').textContent='ブラウザでマイクの使用を許可してください。';
 let acquired;
 try{
  await ctx.resume();
  if(version!==micGeneration)return;
  acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  if(version!==micGeneration){acquired.getTracks().forEach(t=>t.stop());return;}
  micStream=acquired;monitor.gain.value=0;
  micSource=ctx.createMediaStreamSource(micStream);micSource.connect(analyser);
  micOn=true;micPending=false;$('mic').textContent='■ マイクを停止';$('mic').setAttribute('aria-pressed','true');
  $('track').textContent='Microphone · 周囲の音楽';$('status').textContent='マイクから音を解析しています。音声は録音・送信しません。';
  micStream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{if(version===micGeneration){stopMic();reset();$('status').textContent='マイクが切断されました。もう一度開始してください。';}}));
 }catch(e){
  acquired?.getTracks().forEach(t=>t.stop());
  if(version!==micGeneration)return;
  stopMic();reset();
  const messages={NotAllowedError:'マイクが許可されていません。ブラウザのサイト設定で許可し、もう一度お試しください。',NotFoundError:'マイクが見つかりません。接続を確認してください。',NotReadableError:'マイクを使用できません。他のアプリの使用状況やOSの権限を確認してください。'};
  $('status').textContent=messages[e.name]||'マイクを開始できませんでした。接続と権限を確認してください。';
 }
};
window.addEventListener('pagehide',()=>{stopMic();stopSample();audio.pause();});
function stopSample(){clearInterval(sampleTimer);sampleTimer=null;sampleNodes.forEach(n=>{try{n.stop();}catch{}});sampleNodes=[];sampleOn=false;$('sample').textContent='サンプル音を再生';}
$('file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;stopMic();stopSample();audio.pause();reset();if(bufferUrl)URL.revokeObjectURL(bufferUrl);bufferUrl=URL.createObjectURL(file);audio.src=bufferUrl;$('track').textContent=file.name;$('status').textContent='再生ボタンを押して解析を開始してください。';});
audio.addEventListener('play',async()=>{try{setup();stopMic();stopSample();reset();await ctx.resume();}catch{$('status').textContent='音声を開始できませんでした。もう一度再生してください。';}});
audio.addEventListener('seeking',reset);audio.addEventListener('pause',()=>{reset();$('status').textContent='再生を一時停止しています。';});audio.addEventListener('ended',()=>{reset();$('status').textContent='再生が終了しました。';});audio.addEventListener('error',()=>{$('status').textContent='この音声形式を再生できません。MP3やWAVをお試しください。';});
function note(hz,start,duration,volume,type='sine'){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=hz;g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(volume,start+.03);g.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(g);g.connect(analyser);o.start(start);o.stop(start+duration+.01);sampleNodes.push(o);o.onended=()=>{o.disconnect();g.disconnect();sampleNodes=sampleNodes.filter(n=>n!==o);};}
$('sample').onclick=async()=>{if(sampleOn){stopSample();reset();$('status').textContent='サンプル音を停止しました。';return;}try{setup();stopMic();audio.pause();reset();await ctx.resume();sampleOn=true;$('sample').textContent='サンプル音を停止';$('track').textContent='Evening study · 合成サンプル';let bar=0;const play=()=>{const t=ctx.currentTime+.05,root=[130.81,110,87.31,98][bar++%4];[1,1.25,1.5].forEach((v,i)=>note(root*v*2,t+i*.08,1.9,.025,'triangle'));for(let j=0;j<4;j++){note(root,t+j*.5,.32,.09);note(root*[2,3,2.5,3][j],t+j*.5+.25,.28,.025,'sine');}};play();sampleTimer=setInterval(play,2000);}catch{$('status').textContent='サンプルを開始できませんでした。';}};
function features(){if(frames.length<45)return null;return Object.fromEntries(['energy','brightness','bass'].map(k=>[k,frames.reduce((s,f)=>s+f[k],0)/frames.length]));}
function render(result,f,musicSnapshot){const r=result.recipe;shown=r.id;document.documentElement.style.setProperty('--drink',r.color);$('name').textContent=r.name;$('ja').textContent=r.ja;$('profile').textContent=r.profile;$('kind').textContent=r.alcohol?'COCKTAIL / HOUSE RECIPE':'ZERO PROOF / HOUSE RECIPE';$('ingredients').replaceChildren(...r.ingredients.map(s=>{const li=document.createElement('li');li.textContent=s;return li;}));$('method').textContent=r.method;const words=[f.energy>.55?'音量感が強め':'音量感は穏やか',f.brightness>.5?'高域が明るめ':'低〜中域寄り',f.bass>.5?'低音が豊か':'低音は控えめ'];$('evidence').textContent=`解析した音：${words.join('・')}。味の方向：${r.profile}。${musicSnapshot?` 曲の推定：${musicSnapshot.bpm?musicSnapshot.bpm+' BPM / ':''}${musicSnapshot.genres[0]?.label||'ジャンル不明'} / ${moodNames[musicSnapshot.moods[0]?.label]||'ムード不明'}（暫定）。`:''}`; $('selection').textContent=result.mode==='jev'?`Jev選択 · 分布の集中度 ${Math.round(result.confidence*100)}%（正答率ではありません） · ${result.model}`:'デモ選択：3つの音響特徴だけを比較。音楽タグはJev接続時に反映します。';$('lock').disabled=false;}
async function recommend(manual=false){const f=features();if(!f||busy||locked||(!micOn&&!sampleOn&&audio.paused))return;busy=true;lastRequest=performance.now();const version=epoch;const musicSnapshot=performance.now()-musicAt<30000?music:null;controller=new AbortController();$('status').textContent=mode==='jev'?'Jevが音の質感から選んでいます…':'デモの候補を比較しています…';try{const response=await fetch('/api/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({features:f,music:musicSnapshot,preference:$('preference').value}),signal:controller.signal});const result=await response.json();if(version!==epoch)return;if(!response.ok)throw new Error(result.error);if(result.recipe.id===previousId)streak++;else{previousId=result.recipe.id;streak=1;}if(manual||!shown||streak>=2){render(result,f,musicSnapshot);$('status').textContent='提案を更新しました。気に入ったら固定できます。';}else $('status').textContent='次の候補を確認中。続けて選ばれたら切り替えます。';}catch(e){if(version===epoch&&e.name!=='AbortError')$('status').textContent=e.message||'通信に失敗しました。';}finally{busy=false;}}
$('recommend').onclick=()=>recommend(true);$('lock').onclick=()=>{locked=!locked;if(locked){epoch++;controller?.abort();}$('lock').textContent=locked?'● 固定中 / 解除':'○ 固定する';$('status').textContent=locked?'この一杯を固定しました。解析は続けます。':'固定を解除しました。';};$('preference').onchange=()=>{locked=false;$('lock').textContent='○ 固定する';epoch++;controller?.abort();previousId='';streak=0;shown='';$('name').textContent='Your next sip.';$('ja').textContent='新しい条件で選び直します。';$('ingredients').replaceChildren();$('method').textContent='—';$('profile').textContent='条件を更新しました';$('selection').textContent='';$('evidence').textContent='再生中の音から候補を選び直します。';$('lock').disabled=true;lastRequest=0;};
function tick(now){requestAnimationFrame(tick);if(music&&now-musicAt>30000){music=null;renderMusic();$('music-status').textContent='解析結果が古いため、新しい音を待っています。';}const active=ctx?.state==='running'&&(micOn||sampleOn||!audio.paused);$('live').textContent=active?(micOn?'● MIC LIVE':'● LISTENING'):'待機中';const canvas=$('spectrum'),g=canvas.getContext('2d');canvas.width=canvas.clientWidth*devicePixelRatio;canvas.height=canvas.clientHeight*devicePixelRatio;g.scale(devicePixelRatio,devicePixelRatio);const w=canvas.clientWidth,h=canvas.clientHeight;g.clearRect(0,0,w,h);if(active){analyser.getFloatFrequencyData(freq);analyser.getFloatTimeDomainData(time);}for(let i=0;i<56;i++){const index=Math.floor((i/56)**2*(freq?.length||1024));const value=active?clamp((freq[index]+85)/65):.04;const height=Math.max(3,value*h*.85);g.fillStyle=`rgba(198,213,167,${.3+i/100})`;g.fillRect(i*w/56,h/2-height/2,w/56-3,height);}if(!active||now-lastFrame<100)return;lastFrame=now;const rms=Math.sqrt(time.reduce((s,v)=>s+v*v,0)/time.length);if(rms<.001){if(now-lastAudible>1500){frames=[];$('recommend').disabled=true;$('status').textContent='音が小さいため、解析を待っています。';}return;}lastAudible=now;let power=0,weighted=0,low=0;for(let i=1;i<freq.length;i++){const hz=i*ctx.sampleRate/analyser.fftSize,p=10**(freq[i]/10);power+=p;weighted+=hz*p;if(hz<250)low+=p;}const f={energy:clamp((20*Math.log10(rms)+55)/45),brightness:clamp(Math.log2(1+weighted/(power||1)/400)/4),bass:clamp(low/(power||1))};frames.push({...f,at:now});frames=frames.filter(v=>now-v.at<10000);for(const k of ['energy','brightness','bass']){$(k).value=f[k];$(k+'-value').textContent=Math.round(f[k]*100);}$('recommend').disabled=!features()||locked;if(frames.length<45)$('status').textContent=`音を解析中… ${Math.min(5,Math.floor(frames.length/10))} / 5秒`;if($('auto').checked&&features()&&now-lastRequest>5000)recommend();}
requestAnimationFrame(tick);
