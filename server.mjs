import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validate,demo,candidates,requestBody} from './catalog.mjs';
const root=fileURLToPath(new URL('./public/',import.meta.url));
let busy=false;
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/status'&&req.method==='GET') return json(res,200,{mode:process.env.TYPESAFE_API_KEY?'jev':'demo'});
 if(url.pathname==='/api/recommend'&&req.method==='POST'){
   const origin=req.headers.origin;
   if(origin&&origin!==`http://${req.headers.host}`)return json(res,403,{error:'別のサイトからの呼び出しは許可されません'});
   let body=''; for await(const chunk of req){body+=chunk;if(body.length>8000)return json(res,413,{error:'入力が大きすぎます'});}
   let input;try{input=validate(JSON.parse(body));}catch{return json(res,400,{error:'入力を確認してください'});}
   if(!process.env.TYPESAFE_API_KEY)return json(res,200,{recipe:demo(input),mode:'demo',confidence:null});
   if(busy)return json(res,429,{error:'選択中です。少し待って再試行してください'});
   busy=true;
   try{
    const upstream=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{'Authorization':`Bearer ${process.env.TYPESAFE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(requestBody(input)),signal:AbortSignal.timeout(15000)});
    if(!upstream.ok)return json(res,502,{error:`Jev APIが応答できませんでした (${upstream.status})。設定・残高を確認してください。`});
    const data=await upstream.json(), answer=data.answers?.cocktail;
    const recipe=candidates(input).find(r=>r.id===answer?.choice);
    if(!recipe||!Number.isFinite(answer.confidence)||answer.confidence<0||answer.confidence>1)return json(res,502,{error:'Jevの応答形式を確認できませんでした'});
    return json(res,200,{recipe,mode:'jev',confidence:answer.confidence,model:data.model});
   }finally{busy=false;}
 }
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 const vendor={
 'tf.min.js':'@tensorflow/tfjs/dist/tf.min.js',
 'tf-backend-wasm.min.js':'@tensorflow/tfjs-backend-wasm/dist/tf-backend-wasm.min.js',
 ...Object.fromEntries(['tfjs-backend-wasm.wasm','tfjs-backend-wasm-simd.wasm','tfjs-backend-wasm-threaded-simd.wasm'].map(f=>[f,'@tensorflow/tfjs-backend-wasm/dist/'+f])),
 ...Object.fromEntries(['essentia-wasm.umd.js','essentia-wasm.web.js','essentia-wasm.web.wasm','essentia.js-core.js'].map(f=>[f,'essentia.js/dist/'+f]))
 };
 const vendorFile=url.pathname.startsWith('/vendor/')?vendor[url.pathname.slice(8)]:null;
 const models=['model.json','metadata.json','group1-shard1of1.bin'];
 const modelFile=url.pathname.startsWith('/models/musicnn/')&&models.includes(url.pathname.slice(16))?url.pathname.slice(16):null;
 if(vendorFile||modelFile){const filename=vendorFile?path.join(root,'../node_modules',vendorFile):path.join(root,'models/musicnn',modelFile);const bytes=await readFile(filename);res.writeHead(200,{'Content-Type':filename.endsWith('.js')?'text/javascript':filename.endsWith('.wasm')?'application/wasm':filename.endsWith('.json')?'application/json':'application/octet-stream','Cache-Control':'public, max-age=3600'});return res.end(bytes);}
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/music-worker.js':'music-worker.js','/music-analysis.js':'music-analysis.js','/capture-worklet.js':'capture-worklet.js','/resample.js':'resample.js'};
 if(!files[url.pathname])return json(res,404,{error:'Not found'});
 const file=files[url.pathname];res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache'});res.end(await readFile(root+file));
 }catch(e){json(res,500,{error:e.name==='TimeoutError'?'Jevの応答がタイムアウトしました。再試行してください。':'処理に失敗しました。再試行してください。'});}
});
server.listen(Number(process.env.PORT)||4317,'127.0.0.1',()=>console.log(`Music Cocktail: http://127.0.0.1:${Number(process.env.PORT)||4317}`));
