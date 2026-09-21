export const genres=['rock','pop','alternative','indie','electronic','dance','alternative rock','jazz','metal','classic rock','soul','indie rock','electronica','folk','punk','blues','hard rock','ambient','experimental','Hip-Hop','country','funk','electro','heavy metal','Progressive rock','rnb','indie pop','House'];
export const moods=['happy','sad','Mellow','chill','chillout','party','beautiful','easy listening'];
export const moodNames={happy:'明るい',sad:'切ない',Mellow:'穏やか',chill:'落ち着く',chillout:'リラックス',party:'にぎやか',beautiful:'美しい', 'easy listening':'やさしい'};
export function topTags(scores,labels,allowed){return labels.map((label,i)=>({label,score:scores[i]})).filter(v=>allowed.includes(v.label)&&Number.isFinite(v.score)).sort((a,b)=>b.score-a.score).slice(0,3);}
export function validateMusic(music){
 if(music==null)return null;
 if(music.source!=='msd-musicnn-1'||!Number.isFinite(music.windowSeconds)||music.windowSeconds<3||music.windowSeconds>30)throw Error('Invalid music analysis');
 const clean=(list,allowed)=>{if(!Array.isArray(list)||list.length>3)throw Error('Invalid tags');return list.map(v=>{if(!allowed.includes(v.label)||!Number.isFinite(v.score)||v.score<0||v.score>1)throw Error('Invalid tag');return {label:v.label,score:v.score};});};
 const bpm=music.bpm;if(bpm!==null&&(!Number.isFinite(bpm)||bpm<40||bpm>208))throw Error('Invalid tempo');
 if(!Number.isFinite(music.tempoConfidence)||music.tempoConfidence<0)throw Error('Invalid tempo confidence');
 return {source:music.source,windowSeconds:music.windowSeconds,bpm,tempoConfidence:music.tempoConfidence,genres:clean(music.genres,genres),moods:clean(music.moods,moods)};
}
