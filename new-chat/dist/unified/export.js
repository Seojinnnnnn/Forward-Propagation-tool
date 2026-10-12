(function(root){
'use strict';
const table=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
class ZipWriter{
 constructor(){this.parts=[];this.entries=[];this.offset=0;}
 async add(name,blob){
  if(this.offset+blob.size>384*1024*1024)throw Error('프레임 파일이 384MB를 넘었어요. 길이·해상도·프레임 수를 줄여주세요.');
  const bytes=new Uint8Array(await blob.arrayBuffer()),filename=new TextEncoder().encode(name),crc=crc32(bytes);
  const header=new Uint8Array(30+filename.length),view=new DataView(header.buffer);
  view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);view.setUint32(14,crc,true);view.setUint32(18,blob.size,true);view.setUint32(22,blob.size,true);view.setUint16(26,filename.length,true);header.set(filename,30);
  this.parts.push(header,blob);this.entries.push({filename,crc,size:blob.size,offset:this.offset});this.offset+=header.length+blob.size;
 }
 finish(){
  const directory=[];let size=0;
  for(const e of this.entries){const h=new Uint8Array(46+e.filename.length),v=new DataView(h.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,e.crc,true);v.setUint32(20,e.size,true);v.setUint32(24,e.size,true);v.setUint16(28,e.filename.length,true);v.setUint32(42,e.offset,true);h.set(e.filename,46);directory.push(h);size+=h.length;}
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,this.entries.length,true);v.setUint16(10,this.entries.length,true);v.setUint32(12,size,true);v.setUint32(16,this.offset,true);
  return new Blob([...this.parts,...directory,end],{type:'application/zip'});
 }
}
function png(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG를 만들지 못했어요.')),'image/png'));}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function videoFormat(){
 if(typeof MediaRecorder==='undefined'||typeof HTMLCanvasElement==='undefined'||!HTMLCanvasElement.prototype.captureStream)return null;
 const types=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
 const mime=types.find(type=>MediaRecorder.isTypeSupported(type));return mime?{mime,extension:mime.includes('mp4')?'mp4':'webm'}:null;
}
function record(canvas,{fps,duration,format,signal,onFrame,onProgress}){
 return new Promise((resolve,reject)=>{
  let stream,recorder,raf,start,finished=false,failure=null;const chunks=[];
  function stop(error){if(finished)return;failure=error||null;cancelAnimationFrame(raf);if(recorder&&recorder.state!=='inactive')recorder.stop();else finish();}
  function finish(){if(finished)return;finished=true;cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());signal.removeEventListener('abort',abort);document.removeEventListener('visibilitychange',visibility);if(failure)reject(failure);else{const blob=new Blob(chunks,{type:recorder?.mimeType||format.mime});blob.size?resolve(blob):reject(Error('영상이 비어 있어요. PNG 프레임 저장을 이용해주세요.'));}}
  const abort=()=>stop(new DOMException('저장을 취소했어요.','AbortError'));
  const visibility=()=>{if(document.hidden)stop(Error('녹화 중 화면이 숨겨졌어요. 이 창을 열어둔 상태로 다시 녹화해주세요.'));};
  try{
   if(signal.aborted){failure=new DOMException('취소','AbortError');finish();return;}
   onFrame(0);stream=canvas.captureStream(fps);recorder=new MediaRecorder(stream,{mimeType:format.mime,videoBitsPerSecond:12000000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>stop(e.error||Error('영상 녹화에 실패했어요. PNG 프레임 저장을 이용해주세요.'));recorder.onstop=finish;
   signal.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',visibility);recorder.start(250);start=performance.now();
   const tick=now=>{try{const t=Math.min((now-start)/1000,duration);onFrame(t);onProgress(t/duration);if(t>=duration)stop();else raf=requestAnimationFrame(tick);}catch(e){stop(e);}};raf=requestAnimationFrame(tick);
  }catch(e){failure=e;finish();}
 });
}
const api={ZipWriter,crc32,png,download,videoFormat,record};root.BalloonExport=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
