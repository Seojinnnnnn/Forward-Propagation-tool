'use strict';
const E=BalloonEngine,X=BalloonExport,$=id=>document.getElementById(id);
let state={...E.defaults},keys=[],overrides={},world,customFont=null;
let width=1280,height=720,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let liveTime=0,cursor=0,timelinePlaying=false,exporting=false,seeking=false,seekToken=0,last=0,accumulator=0,lastUISync=0;
const resolutions=['1280x720','1920x1080','3508x4960','4960x3508','2480x3508','3508x2480','1080x1080','1080x1350','1080x1440','1080x1920','720x1280','1200x1800','1080x2160'];
let googleFont=null,googleLink=null,fontBusy=false;
let exportController=null;
let initialPositions=null,toolMode='move',selected=-1,gesture=null;
const canvas=$('canvas');
const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});
const fonts={gothic:'"Apple SD Gothic Neo", "Malgun Gothic", sans-serif',serif:'"AppleMyungjo", "Batang", serif',rounded:'"Arial Rounded MT Bold", "NanumSquareRound", "Apple SD Gothic Neo", sans-serif',mono:'"D2Coding", "SFMono-Regular", monospace',brush:'"GungSeo", "Gungsuh", serif',custom:'"BalloonCustom", sans-serif'};
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function duration(){return Number($('duration').value);}
function textValue(){return $('text').value;}
function setRangeFill(el){el.style.setProperty('--fill',((Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min))*100)+'%');}
function syncUI(){
 for(const name of Object.keys(E.ranges)){const el=$(name);el.value=state[name];$(name+'-out').value=Math.round(state[name]);setRangeFill(el);}
 for(const name of ['visible','collision','hold'])$(name).checked=state[name];
 for(const name of ['font','layout',...E.colors])$(name).value=state[name];
 $('pause').textContent=paused?'▶ 재생':'Ⅱ 일시정지';$('pause').setAttribute('aria-pressed',String(paused));
 $('timeline-play').textContent=timelinePlaying?'Ⅱ 타임라인 정지':'▶ 타임라인 재생';
 $('status').textContent=exporting?'파일을 만드는 중':timelinePlaying?'키프레임을 재생하는 중':paused?'움직임을 멈춘 상태':state.hold?'정렬을 유지하며 떠다니는 중':'바람과 충돌에 반응하는 중';
 $('visible-canvas').checked=state.visible;
 $('mode-label').textContent=state.visible?'구 표시 · 표면 글자':'구 투명 · 앞뒤 글자 모두 표시';
 $('seek').value=cursor;setRangeFill($('seek'));$('time-out').value=cursor.toFixed(2)+'s';
}
function edited(){seekToken++;seeking=false;timelinePlaying=false;accumulator=0;syncUI();}
function createWorld(config){
 const sim=new E.World(textValue(),width,height,config);
 if(initialPositions&&initialPositions.layout===config.layout&&initialPositions.points.length===sim.particles.length)sim.particles.forEach((p,i)=>{const point=initialPositions.points[i];p.z=point.z*Math.max(width,height);E.moveParticle(sim,config,i,point.x*width,point.y*height);p.pinned=!!point.pinned;p.anchor=point.anchor??undefined;p.offsetX=(point.offsetX||0)*width;p.offsetY=(point.offsetY||0)*height;p.offsetZ=(point.offsetZ||0)*Math.max(width,height);});
 return sim;
}
function rememberPositions(){initialPositions={layout:state.layout,points:world.particles.map(p=>({x:p.x/width,y:p.y/height,z:p.z/Math.max(width,height),pinned:!!p.pinned,anchor:p.anchor??null,offsetX:(p.offsetX||0)/width,offsetY:(p.offsetY||0)/height,offsetZ:(p.offsetZ||0)/Math.max(width,height)}))};}
function resetWorld(){world=createWorld(state);liveTime=0;accumulator=0;}
function rebuildText(reset=true){if(reset)resetWorld();const letters=E.letters(textValue());$('count').textContent=letters.length+'개의 구';$('empty').hidden=letters.length>0;
 const select=$('sphere-select'),old=select.value;select.replaceChildren();for(const s of letters){const option=document.createElement('option');option.value=s.index;option.textContent=(s.index+1)+' · '+s.char;select.append(option);}if(letters.some(s=>String(s.index)===old))select.value=old;select.disabled=!letters.length;$('individual-color').disabled=!letters.length;$('clear-color').disabled=!letters.length;updateIndividual();
}
function updateIndividual(){const index=Number($('sphere-select').value);$('individual-color').value=overrides[index]||(index%7===0?state.accent:state.color);}
function configAt(t,base=state,list=keys){return E.interpolate(list,t,base);}
function stepWorld(targetWorld,target,base,list=keys){while(targetWorld.time+E.STEP<=target+1e-7){const t=targetWorld.time+E.STEP;targetWorld.step(E.STEP,configAt(t,base,list));}}
function invalidateTimeline(reason){if(keys.length){keys=[];renderKeys();notice(reason+' 기존 키프레임을 지웠어요.');}cursor=0;timelinePlaying=false;}
for(const name of Object.keys(E.ranges))$(name).oninput=()=>{state[name]=Number($(name).value);edited();};
for(const name of ['visible','collision','hold'])$(name).onchange=()=>{state[name]=$(name).checked;edited();};
for(const name of ['font',...E.colors])$(name).oninput=()=>{state[name]=$(name).value;edited();updateIndividual();};
$('layout').onchange=()=>{state.layout=$('layout').value;initialPositions=null;world.arrange(state);edited();};
$('arrange').onclick=()=>{initialPositions=null;world.arrange(state);edited();notice('정렬했어요. 현재 위치를 유지하려면 ‘정렬 유지’를 켜세요.');};
$('sphere-select').onchange=()=>{selected=Number($('sphere-select').value);updateIndividual();};
$('individual-color').oninput=()=>{overrides[$('sphere-select').value]=$('individual-color').value;edited();};
$('clear-color').onclick=()=>{delete overrides[$('sphere-select').value];updateIndividual();edited();};
function onText(){refreshGoogleGlyphs();initialPositions=null;selected=-1;edited();invalidateTimeline('텍스트 구성이 바뀌어');overrides={};rebuildText();}
$('text').addEventListener('input',e=>{if(!e.isComposing)onText();});$('text').addEventListener('compositionend',onText);
$('pause').onclick=()=>{seekToken++;seeking=false;timelinePlaying=false;paused=!paused;syncUI();};
function fitStage(){const parent=$('stage').parentElement;const w=Math.max(10,parent.clientWidth-26),h=Math.max(10,parent.clientHeight-26);const scale=Math.min(w/width,h/height);$('stage').style.width=(width*scale)+'px';$('stage').style.height=(height*scale)+'px';}
function setResolution(value){
 if(!resolutions.includes(value))throw Error('지원하는 판형을 선택해주세요.');
 const [pixelWidth,pixelHeight]=value.split('x').map(Number);
 // Keep scene proportions and motion independent of export pixel density.
 const scale=720/Math.min(pixelWidth,pixelHeight);width=pixelWidth*scale;height=pixelHeight*scale;
 canvas.width=pixelWidth;canvas.height=pixelHeight;$('resolution-label').textContent=pixelWidth+' × '+pixelHeight+' px';$('stage').style.aspectRatio=width+'/'+height;
 $('format-note').textContent=Math.max(pixelWidth,pixelHeight)>3000?'A3/A4 실제 크기로 배치하면 약 300ppi입니다. 큰 판형은 PNG 저장을 권장하며, 영상 지원은 브라우저에 따라 달라요.':'선택한 판형의 픽셀 크기로 PNG와 영상을 저장해요.';fitStage();
}
$('resolution').onchange=()=>{edited();setResolution($('resolution').value);resetWorld();notice('화면 비율을 바꿨어요. 키프레임은 새 화면 안에서 재생돼요.');};
if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitStage).observe($('stage').parentElement);else window.addEventListener('resize',fitStage);
function renderKeys(){
 const container=$('keyframes');container.replaceChildren();
 for(const key of keys){const chip=document.createElement('div');chip.className='key-chip'+(Math.abs(cursor-key.time)<.02?' active':'');const select=document.createElement('button');select.textContent='◆ '+key.time.toFixed(2)+'s';select.title='이 키프레임으로 이동';select.onclick=()=>seekTo(key.time);const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',key.time+'초 키프레임 삭제');remove.onclick=()=>{keys=keys.filter(k=>k!==key);timelinePlaying=false;renderKeys();syncUI();};chip.append(select,remove);container.append(chip);}
}
$('add-key').onclick=()=>{
 if(keys.length>=100&&!keys.some(k=>Math.abs(k.time-cursor)<.005)){notice('키프레임은 최대 100개까지 저장할 수 있어요.',true);return;}
 const time=Math.round(cursor*100)/100;keys=keys.filter(k=>Math.abs(k.time-time)>.005);keys.push({time,config:{...state}});keys.sort((a,b)=>a.time-b.time);renderKeys();notice(time.toFixed(2)+'초의 설정을 저장했어요.');
};
async function seekTo(target){
 const token=++seekToken;seeking=true;timelinePlaying=false;paused=true;const base={...state},list=keys.map(k=>({time:k.time,config:{...k.config}}));const sim=createWorld(configAt(0,base,list));
 try{let count=0;while(sim.time+E.STEP<=target+1e-7){sim.step(E.STEP,configAt(sim.time+E.STEP,base,list));if(++count%240===0){await new Promise(r=>setTimeout(r,0));if(token!==seekToken)return;}}
  if(token!==seekToken)return;world=sim;cursor=target;state=configAt(target,base,list);syncUI();renderKeys();
 }finally{if(token===seekToken)seeking=false;}
}
$('seek').oninput=()=>seekTo(Number($('seek').value));
$('duration').onchange=()=>{const raw=Number($('duration').value);const value=Math.max(1,Math.min(30,Number.isFinite(raw)?Math.round(raw):6));$('duration').value=value;$('seek').max=value;const removed=keys.some(k=>k.time>value);keys=keys.filter(k=>k.time<=value);cursor=Math.min(cursor,value);timelinePlaying=false;renderKeys();syncUI();if(removed)notice('길이 밖의 키프레임을 삭제했어요.');};
$('timeline-play').onclick=()=>{
 if(timelinePlaying){timelinePlaying=false;paused=true;syncUI();return;}
 seekToken++;seeking=false;state=configAt(0);resetWorld();cursor=0;paused=false;timelinePlaying=true;syncUI();notice(keys.length?'0초부터 키프레임을 재생해요.':'키프레임이 없어 현재 설정으로 재생해요.');
};
function readDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('파일을 읽지 못했어요.'));reader.readAsDataURL(file);});}
function validGoogleFamily(name){return typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9 -]{0,79}$/.test(name);}
function fontSample(){return Array.from(new Set(textValue()+$('brush-text').value+'가나다ABC')).join('');}
async function loadGoogleFont(family){
 if(!validGoogleFamily(family))throw Error('Google Fonts의 영문 폰트 이름을 입력해주세요.');
 const link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(family)+'&display=swap';
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('폰트 연결 시간이 초과됐어요. 네트워크를 확인해주세요.')),15000);link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);reject(Error('폰트를 찾지 못했어요. 이름과 인터넷 연결을 확인해주세요.'));};document.head.append(link);});
  const loaded=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('폰트 다운로드 시간이 초과됐어요.')),20000);document.fonts.load('400 32px '+JSON.stringify(family),fontSample()).then(resolve,reject).finally(()=>clearTimeout(timer));});
  if(!loaded.length)throw Error('이름에 해당하는 폰트를 불러오지 못했어요.');
  googleLink?.remove();googleLink=link;googleFont={family};fonts.google=JSON.stringify(family)+', sans-serif';
  let option=$('font').querySelector('option[value="google"]');if(!option){option=document.createElement('option');option.value='google';$('font').append(option);}option.textContent=family+' · Google';$('google-family').value=family;renderer?.clearTextures();
 }catch(e){link.remove();throw e;}
}
async function applyGoogle(){if(fontBusy||exporting)return;fontBusy=true;$('google-connect').disabled=true;$('google-connect').textContent='연결 중';try{await loadGoogleFont($('google-family').value.trim());state.font='google';edited();$('font-note').textContent=googleFont.family+' · Google Fonts 연결됨';notice('Google 폰트를 적용했어요. 설정 파일에는 연결 이름이 저장돼요.');}catch(e){notice(e.message,true);}finally{fontBusy=false;$('google-connect').disabled=false;$('google-connect').textContent='연결';}}
$('google-connect').onclick=applyGoogle;$('google-family').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyGoogle();}});
$('brush-text').addEventListener('input',()=>refreshGoogleGlyphs());
function refreshGoogleGlyphs(){if(!googleFont)return;document.fonts.load('400 32px '+JSON.stringify(googleFont.family),fontSample()).then(()=>renderer?.clearTextures()).catch(()=>notice('추가 글자의 폰트를 불러오지 못했어요. 인터넷 연결을 확인해주세요.',true));}
async function installFont(data,name){const face=new FontFace('BalloonCustom','url('+data+')');await face.load();for(const f of document.fonts)if(f.family==='BalloonCustom')document.fonts.delete(f);document.fonts.add(face);customFont={data,name};if(!$('font').querySelector('option[value="custom"]')){const option=document.createElement('option');option.value='custom';$('font').append(option);}$('font').querySelector('option[value="custom"]').textContent=name;$('font-note').textContent=name+' · 이 도구 안에서만 사용해요.';renderer?.clearTextures();}
$('font-file').onchange=async()=>{if(fontBusy||exporting)return;const file=$('font-file').files[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('10MB 이하의 폰트를 선택해주세요.');if(!/\.(woff2?|ttf|otf)$/i.test(file.name))throw Error('WOFF, WOFF2, TTF, OTF 폰트를 선택해주세요.');await installFont(await readDataURL(file),file.name);state.font='custom';edited();notice('폰트를 불러왔어요.');}catch(e){notice('폰트를 열지 못했어요. '+e.message,true);}finally{$('font-file').value='';}};
function projectData(){return {format:'balloon-studio',version:2,text:textValue(),config:{...state},keyframes:keys,overrides,resolution:$('resolution').value,duration:duration(),fps:Number($('fps').value),customFont,googleFont,initialPositions,brushText:$('brush-text').value};}
$('save-project').onclick=()=>{X.download(new Blob([JSON.stringify(projectData(),null,2)],{type:'application/json'}),'balloon-keyframes.json');notice('텍스트·폰트·색상·키프레임 설정을 저장했어요.');};
function validateProject(p){
 if(!p||p.format!=='balloon-studio'||p.version!==2||typeof p.text!=='string'||p.text.length>240)throw Error('둥실 설정 파일인지 확인해주세요.');
 if(p.googleFont!==undefined&&p.googleFont!==null&&(!p.googleFont||!validGoogleFamily(p.googleFont.family)))throw Error('Google 폰트 정보를 확인해주세요.');
 p.config=E.validateConfig(p.config);if(!resolutions.includes(p.resolution)||![24,30,60].includes(p.fps)||!Number.isInteger(p.duration)||p.duration<1||p.duration>30)throw Error('출력 설정을 확인해주세요.');
 if(!Array.isArray(p.keyframes)||p.keyframes.length>100)throw Error('키프레임 형식을 확인해주세요.');const seen=new Set();p.keyframes=p.keyframes.map(k=>{if(!k||typeof k.time!=='number'||!Number.isFinite(k.time)||k.time<0||k.time>p.duration||seen.has(k.time))throw Error('키프레임 시간을 확인해주세요.');seen.add(k.time);return {time:k.time,config:E.validateConfig(k.config)};}).sort((a,b)=>a.time-b.time);
 if(!p.overrides||typeof p.overrides!=='object'||Array.isArray(p.overrides))throw Error('구 색상을 확인해주세요.');for(const [key,color]of Object.entries(p.overrides))if(!/^\d+$/.test(key)||Number(key)>=E.letters(p.text).length||typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw Error('개별 색상 형식을 확인해주세요.');
 if(p.customFont&&((typeof p.customFont.data!=='string'||!/^data:[a-z0-9.+/-]*;base64,[A-Za-z0-9+/=]+$/i.test(p.customFont.data)||p.customFont.data.length>15*1024*1024)||typeof p.customFont.name!=='string'||p.customFont.name.length>255))throw Error('폰트 데이터를 확인해주세요.');
 if(!p.googleFont&&(p.config.font==='google'||p.keyframes.some(k=>k.config.font==='google')))throw Error('Google 폰트 연결 정보가 빠져 있어요.');
 if(!p.customFont&&(p.config.font==='custom'||p.keyframes.some(k=>k.config.font==='custom')))throw Error('사용한 폰트 파일이 빠져 있어요.');if(p.initialPositions!==undefined&&p.initialPositions!==null){const origin=p.initialPositions;
 if(!origin||!['text','row','column','grid','circle'].includes(origin.layout)||!Array.isArray(origin.points)||origin.points.length!==E.letters(p.text).length)throw Error('배치 정보를 확인해주세요.');
 for(const [index,point]of origin.points.entries()){if(point?.pinned!==undefined&&typeof point.pinned!=='boolean')throw Error('고정 설정을 확인해주세요.');if(point?.anchor!==undefined&&point.anchor!==null&&(!Number.isInteger(point.anchor)||point.anchor<0||point.anchor>=index||!origin.points[point.anchor].pinned))throw Error('풍선 연결을 확인해주세요.');for(const key of ['offsetX','offsetY','offsetZ'])if(point?.[key]!==undefined&&(typeof point[key]!=='number'||!Number.isFinite(point[key])||Math.abs(point[key])>1))throw Error('풍선 간격을 확인해주세요.');}
 for(const point of origin.points)if(!point||['x','y','z'].some(k=>typeof point[k]!=='number'||!Number.isFinite(point[k])||Math.abs(point[k])>.5))throw Error('구의 위치를 확인해주세요.');
 }
 if(p.brushText!==undefined&&(typeof p.brushText!=='string'||p.brushText.length>80))throw Error('그릴 글자를 확인해주세요.');return p;
}
$('load-project').onchange=async()=>{const file=$('load-project').files[0];if(!file)return;try{if(file.size>16*1024*1024)throw Error('설정 파일은 16MB 이하여야 해요.');const p=validateProject(JSON.parse(await file.text()));if(p.googleFont)await loadGoogleFont(p.googleFont.family);if(p.customFont)await installFont(p.customFont.data,p.customFont.name);else{customFont=null;for(const f of document.fonts)if(f.family==='BalloonCustom')document.fonts.delete(f);$('font').querySelector('option[value="custom"]')?.remove();$('font-note').textContent='기기에 설치된 폰트를 사용해요.';renderer?.clearTextures();}edited();state=p.config;initialPositions=p.initialPositions||null;selected=-1;$('brush-text').value=p.brushText||'오ㄹ류페스티벌';keys=p.keyframes;overrides=p.overrides;$('text').value=p.text;$('resolution').value=p.resolution;setResolution(p.resolution);$('duration').value=p.duration;$('seek').max=p.duration;$('fps').value=p.fps;cursor=0;paused=true;rebuildText();refreshGoogleGlyphs();syncUI();renderKeys();notice('설정을 불러왔어요. 타임라인을 재생해보세요.');}catch(e){notice('설정을 열지 못했어요. '+e.message,true);}finally{$('load-project').value='';}};
function setTool(mode){
 if(gesture)finishGesture(true);toolMode=mode;canvas.dataset.tool=mode;
 $('tool-move').setAttribute('aria-pressed',String(mode==='move'));$('tool-draw').setAttribute('aria-pressed',String(mode==='draw'));$('brush-controls').hidden=mode!=='draw';$('clear-all').hidden=mode!=='draw';
 $('interaction-hint').textContent=mode==='draw'?'첫 구는 고정되고 이어진 구들이 흔들려요. 입력한 글자를 한 번만 생성하며, 손을 떼면 다시 그릴 수 있어요.':'구를 클릭하고 드래그해서 옮기세요. 선택 후 방향키로도 이동할 수 있어요.';
}
$('tool-move').onclick=()=>setTool('move');$('tool-draw').onclick=()=>setTool('draw');
$('clear-all').onclick=()=>{if(exporting)return;if(gesture)finishGesture(true);$('text').value='';onText();drawSelection();notice('모든 글자 구와 고정점을 지웠어요. 그릴 글자는 유지했어요.');};
$('visible-canvas').onchange=()=>{state.visible=$('visible-canvas').checked;edited();};
function pointerPosition(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)/rect.width*width-width/2,y:height/2-(event.clientY-rect.top)/rect.height*height};}
function drawSelection(){
 const ring=$('selection-ring');$('selection-overlay').setAttribute('viewBox','0 0 '+width+' '+height);
 const p=world.particles[selected];ring.setAttribute('visibility',p&&!exporting?'visible':'hidden');if(!p)return;
 ring.setAttribute('cx',p.x+width/2);ring.setAttribute('cy',height/2-p.y);ring.setAttribute('r',E.radius(state,width,height,world.particles.length)+7);
}
function stamp(point){
 if(gesture.added>=gesture.chars.length)return false;
 const char=gesture.chars[gesture.added];if(textValue().length+char.length>240){gesture.full=true;return false;}
 $('text').value+=char;const letter=E.letters(textValue()).at(-1);world.particles.push({...letter,x:0,y:0,z:0,tx:0,ty:0,vx:0,vy:0,vz:0,spin:0});
 E.moveParticle(world,state,letter.index,point.x,point.y);
 const added=world.particles[letter.index];
 if(gesture.added===0){gesture.anchor=letter.index;added.pinned=true;}
 else{const root=world.particles[gesture.anchor];added.anchor=gesture.anchor;added.offsetX=added.x-root.x;added.offsetY=added.y-root.y;added.offsetZ=added.z-root.z;}
 selected=letter.index;gesture.added++;gesture.changed=true;rebuildText(false);$('sphere-select').value=String(selected);updateIndividual();return true;
}
canvas.addEventListener('pointerdown',event=>{
 if(exporting||seeking||gesture||!renderer||event.button!==0)return;
 const point=pointerPosition(event),hit=E.hitTest(world,state,point.x,point.y);
 if(toolMode==='move'&&hit<0){selected=-1;drawSelection();return;}
 const chars=E.letters($('brush-text').value).map(p=>p.char);
 if(toolMode==='draw'&&!chars.length){notice('먼저 ‘그릴 글자’를 입력해주세요.',true);return;}
 if(toolMode==='draw'&&textValue().length>=240){notice('최대 240자까지 만들 수 있어요. 텍스트를 줄여주세요.',true);return;}
 const before={world:world.snapshot(),text:textValue(),selected,origin:initialPositions,paused,cursor,timelinePlaying};
 edited();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);canvas.dataset.dragging='true';
 gesture={id:event.pointerId,mode:toolMode,before,point,remainder:0,spacing:E.radius(state,width,height,world.particles.length)*2.2,chars,added:0,changed:false};
 if(toolMode==='draw')stamp(point);else{selected=hit;$('sphere-select').value=String(hit);updateIndividual();gesture.dx=world.particles[hit].x-point.x;gesture.dy=world.particles[hit].y-point.y;}
 event.preventDefault();drawSelection();
});
function moveGesture(event){
 if(!gesture||gesture.id!==event.pointerId)return;
 const point=pointerPosition(event);
 if(gesture.mode==='move'&&Math.hypot(point.x-gesture.point.x,point.y-gesture.point.y)>1e-6){E.moveParticle(world,state,selected,point.x+gesture.dx,point.y+gesture.dy);gesture.changed=true;}
 else if(gesture.mode==='draw'){
  const sample=E.sampleSegment(gesture.point,point,gesture.spacing,gesture.remainder);gesture.remainder=sample.remainder;
  for(const p of sample.points)if(!stamp(p))break;
 }
 gesture.point=point;event.preventDefault();drawSelection();
}
canvas.addEventListener('pointermove',moveGesture);
function finishGesture(cancel=false){
 if(!gesture)return;const old=gesture;gesture=null;canvas.dataset.dragging='false';
 if(cancel){world.restore(old.before.world);$('text').value=old.before.text;selected=old.before.selected;initialPositions=old.before.origin;paused=old.before.paused;cursor=old.before.cursor;timelinePlaying=old.before.timelinePlaying;rebuildText(false);notice('드래그를 취소했어요.');}
 else if(old.changed){rememberPositions();cursor=0;
  if(old.mode==='draw'){invalidateTimeline('글자 구가 추가되어');notice(old.added+'개의 구를 추가했어요.'+(old.full?' 최대 240자에 도달했어요.':'')+' 첫 구는 고정했어요. 손을 떼고 다시 그리면 글자가 처음부터 생성돼요.');}
  else notice('구를 옮겼어요. 이 배치가 재생·저장의 시작점이에요.');
 }
 if(canvas.hasPointerCapture?.(old.id))canvas.releasePointerCapture(old.id);accumulator=0;syncUI();drawSelection();
}
canvas.addEventListener('pointerup',event=>{if(gesture?.id===event.pointerId){moveGesture(event);finishGesture();}});
canvas.addEventListener('pointercancel',event=>{if(gesture?.id===event.pointerId)finishGesture(true);});
canvas.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId)finishGesture(true);});
canvas.addEventListener('keydown',event=>{
 if(event.key==='Escape'){if(gesture)finishGesture(true);else selected=-1;drawSelection();event.preventDefault();return;}
 if(exporting||gesture||selected<0)return;const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[event.key];if(!delta)return;
 event.preventDefault();edited();const p=world.particles[selected];if(!p)return;const amount=event.shiftKey?20:5;E.moveParticle(world,state,selected,p.x+delta[0]*amount,p.y+delta[1]*amount);rememberPositions();cursor=0;syncUI();drawSelection();
});

function makeRenderer(){
 if(!gl)throw Error('WebGL이 지원되지 않습니다.');
 const vert=`attribute vec3 position;attribute vec2 uv;uniform vec3 center;uniform vec3 angles;uniform vec2 viewport;uniform float radius;uniform float squash;uniform vec3 squashAxis;varying vec2 texUV;varying float facing;
 void main(){vec3 p=position;float c=cos(angles.x),s=sin(angles.x);p=vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);c=cos(angles.y);s=sin(angles.y);p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);c=cos(angles.z);s=sin(angles.z);p=vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);float axial=1.0-squash;float transverse=inversesqrt(axial);vec3 normal=p/transverse+(1.0/axial-1.0/transverse)*dot(p,squashAxis)*squashAxis;facing=normal.z;p=p*transverse+(axial-transverse)*dot(p,squashAxis)*squashAxis;vec3 world=p*radius+center;gl_Position=vec4(world.x/(viewport.x*.5),world.y/(viewport.y*.5),-world.z/1800.0,1.0);texUV=uv;}`;
 const frag=`precision mediump float;uniform sampler2D lettering;uniform vec3 color;uniform vec3 inkColor;uniform vec3 background;uniform float visible;uniform float letteringPass;varying vec2 texUV;varying float facing;void main(){if(letteringPass<.5){if(visible<.5||facing<0.0)discard;gl_FragColor=vec4(color,1.0);}else{if(visible>.5&&facing<0.0)discard;float alpha=texture2D(lettering,texUV).a;if(alpha<.02)discard;gl_FragColor=vec4(inkColor,alpha);}}`;
 function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vert));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('3D 프로그램을 시작하지 못했습니다.');gl.useProgram(program);
 const uniforms={};for(const n of ['center','angles','viewport','radius','squash','squashAxis','lettering','color','inkColor','background','visible','letteringPass'])uniforms[n]=gl.getUniformLocation(program,n);
 const points=[],uvs=[],indices=[],nx=64,ny=32;
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=i/nx,v=j/ny,lon=(u-.5)*Math.PI*2,lat=(.5-v)*Math.PI;points.push(Math.sin(lon)*Math.cos(lat),Math.sin(lat),Math.cos(lon)*Math.cos(lat));uvs.push(u,v);}
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
 function attribute(name,values,size){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);}
 attribute('position',points,3);attribute('uv',uvs,2);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);gl.enable(gl.DEPTH_TEST);
 let signature='',textures=new Map();
 function clearTextures(){for(const t of textures.values())gl.deleteTexture(t);textures.clear();signature='';}
 function texture(char,config){if(textures.has(char))return textures.get(char);const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#000';ctx.font=Math.round(config.weight/100)*100+' '+Math.round(215*config.typeSize/100)+'px '+fonts[config.font];ctx.textAlign='left';ctx.textBaseline='alphabetic';let metrics=ctx.measureText?.(char);
 if(metrics&&metrics.width>500){ctx.font=Math.round(config.weight/100)*100+' '+Math.round(215*config.typeSize/100*500/metrics.width)+'px '+fonts[config.font];metrics=ctx.measureText(char);}
 if(metrics&&Number.isFinite(metrics.actualBoundingBoxLeft)&&Number.isFinite(metrics.actualBoundingBoxAscent)){ctx.fillText(char,512+(metrics.actualBoundingBoxLeft-metrics.actualBoundingBoxRight)/2,256+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2);}else{ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(char,512,256,500);} const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);textures.set(char,t);return t;}
 function draw(sim,config){
  const nextSignature=[Math.round(215*config.typeSize/100),Math.round(config.weight/100),config.font].join('|');if(nextSignature!==signature){clearTextures();signature=nextSignature;}
  gl.disable(gl.CULL_FACE);gl.depthMask(true);gl.viewport(0,0,canvas.width,canvas.height);const bg=E.rgb(config.background);gl.clearColor(...bg,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform2f(uniforms.viewport,sim.width,sim.height);gl.uniform1f(uniforms.visible,config.visible?1:0);gl.uniform3f(uniforms.inkColor,...E.rgb(config.ink));gl.uniform3f(uniforms.background,...bg);const r=E.radius(config,sim.width,sim.height,sim.particles.length);
  for(const s of [...sim.particles].sort((a,b)=>a.z-b.z)){const turn=s.turn||0,profile=E.rotationProfile(s.index);gl.uniform3f(uniforms.center,s.x,s.y,s.z);gl.uniform1f(uniforms.radius,r);gl.uniform1f(uniforms.squash,config.softness===0?0:(s.squash||0));gl.uniform3f(uniforms.squashAxis,s.squashAxisX||0,s.squashAxisY===undefined?1:s.squashAxisY,s.squashAxisZ||0);gl.uniform3f(uniforms.angles,Math.sin(turn)*profile.tilt,turn-.42*Math.sin(2*turn),Math.sin(turn)*profile.roll);gl.uniform3f(uniforms.color,...E.rgb(overrides[s.index]||(s.index%7===0?config.accent:config.color)));gl.bindTexture(gl.TEXTURE_2D,texture(s.char,config));
   // A visible body hides rear lettering; a hidden body reveals its mirrored back side.
   gl.uniform1f(uniforms.letteringPass,0);
   if(config.visible)gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
   gl.uniform1f(uniforms.letteringPass,1);gl.depthMask(false);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
   gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);}
 }
 return {draw,clearTextures};
}
let renderer;
try{renderer=makeRenderer();}catch(e){$('error').hidden=false;notice(e.message,true);}
setResolution($('resolution').value);rebuildText();syncUI();renderKeys();
document.fonts.ready.then(()=>renderer?.clearTextures());
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();paused=true;exportController?.abort();$('error').hidden=false;notice('3D 연결이 끊겼어요. 설정을 저장한 뒤 화면을 새로고침해주세요.',true);});
function tick(now){
 const delta=Math.min((now-last)/1000,.08);last=now;
 if(!exporting&&!seeking&&renderer){
  if(!paused&&!gesture){accumulator+=delta;while(accumulator>=E.STEP){if(timelinePlaying){cursor=Math.min(cursor+E.STEP,duration());state=configAt(cursor);world.step(E.STEP,state);if(cursor>=duration()-1e-7){cursor=duration();paused=true;timelinePlaying=false;accumulator=0;syncUI();break;}}else{world.step(E.STEP,state);liveTime+=E.STEP;}accumulator-=E.STEP;}}
  renderer.draw(world,state);drawSelection();if(now-lastUISync>120){syncUI();lastUISync=now;}
 }
 requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
const format=X.videoFormat();$('record').textContent=format?(format.extension.toUpperCase()+' 녹화'):'영상 녹화 불가';$('record').disabled=!format||!renderer;
$('export-note').textContent=(format?format.extension==='mp4'?'이 브라우저는 MP4 녹화를 지원해요.':'이 브라우저에서는 WebM 영상으로 저장돼요.':'이 브라우저는 영상 녹화를 지원하지 않아요. PNG 저장을 이용해주세요.')+' 영상은 실시간 녹화, PNG는 정확한 프레임 간격으로 저장해요. PNG는 최대 600프레임.';
function setBusy(value){exporting=value;document.body.classList.toggle('busy',value);$('cancel-export').hidden=!value;$('progress').hidden=!value;for(const el of document.querySelectorAll('button,input,select,textarea')){if(value){el.dataset.wasDisabled=String(el.disabled);if(el.id!=='cancel-export')el.disabled=true;}else if(el.dataset.wasDisabled!==undefined){el.disabled=el.dataset.wasDisabled==='true';delete el.dataset.wasDisabled;}}syncUI();}
$('cancel-export').onclick=()=>exportController?.abort();
$('snapshot').onclick=async()=>{if(!renderer)return;try{renderer.draw(world,state);X.download(await X.png(canvas),'balloon-frame.png');notice('현재 화면을 PNG로 저장했어요.');}catch(e){notice(e.message,true);}};
async function exportAnimation(kind){
 if(fontBusy){notice('폰트 연결이 끝난 뒤 저장해주세요.',true);return;}if(!renderer||exporting||gesture)return;
 const fps=Number($('fps').value),length=duration(),total=Math.round(length*fps);
 if(kind==='png'&&total>600){notice('PNG는 한 번에 최대 600프레임까지 저장해요. 길이나 fps를 줄여주세요.',true);return;}
 const saved={config:{...state},world:world.snapshot(),paused,cursor,timelinePlaying};const base={...state},list=keys.map(k=>({time:k.time,config:{...k.config}}));const sim=createWorld(configAt(0,base,list));
 seekToken++;seeking=false;exportController=new AbortController();const signal=exportController.signal;setBusy(true);$('progress').value=0;
 try{
  if(googleFont)await document.fonts.load('400 32px '+JSON.stringify(googleFont.family),fontSample());
  await document.fonts.ready;
  if(kind==='png'){
   const zip=new X.ZipWriter();
   for(let i=0;i<total;i++){
    if(signal.aborted)throw new DOMException('저장을 취소했어요.','AbortError');const t=i/fps;stepWorld(sim,t,base,list);renderer.draw(sim,configAt(t,base,list));await zip.add('frame_'+String(i).padStart(5,'0')+'.png',await X.png(canvas));$('progress').value=(i+1)/total;notice('PNG 프레임 '+(i+1)+' / '+total+' 저장 중');if(i%3===0)await new Promise(r=>setTimeout(r,0));
   }
   if(signal.aborted)throw new DOMException('저장을 취소했어요.','AbortError');await zip.add('sequence.json',new Blob([JSON.stringify({fps,frameCount:total,duration:length,width:canvas.width,height:canvas.height,startFrame:0,timeOfFrame:'index / fps'},null,2)],{type:'application/json'}));X.download(zip.finish(),'balloon-frames-'+fps+'fps.zip');notice(total+'개의 PNG 프레임을 ZIP으로 저장했어요.');
  }else{
   notice('0초부터 '+length+'초 동안 녹화해요. 이 창을 열어두세요.');
   const blob=await X.record(canvas,{fps,duration:length,format,signal,onFrame(t){stepWorld(sim,t,base,list);renderer.draw(sim,configAt(t,base,list));},onProgress(p){$('progress').value=p;notice('영상 녹화 중 · '+(p*length).toFixed(1)+' / '+length+'초');}});
   X.download(blob,'balloon-motion.'+(blob.type.includes('mp4')?'mp4':'webm'));notice('영상을 저장했어요.');
  }
 }catch(e){notice(e.name==='AbortError'?'저장을 취소했어요.':e.message,e.name!=='AbortError');}
 finally{state=saved.config;world.restore(saved.world);paused=saved.paused;cursor=saved.cursor;timelinePlaying=saved.timelinePlaying;exportController=null;setBusy(false);last=performance.now();renderer.draw(world,state);}
}
$('record').onclick=()=>exportAnimation('video');$('frames').onclick=()=>exportAnimation('png');
// Reuse visible configuration actions for browsers that support WebMCP.
if(!renderer)for(const id of ['record','frames','snapshot','timeline-play'])$(id).disabled=true;
const context=document.modelContext;
if(context?.registerTool){try{Promise.resolve(context.registerTool({name:'configure_moving_identity',description:'텍스트, 바람, 충돌, 정렬, 글자와 구 색상을 조정합니다. 파일 저장이나 녹화는 시작하지 않습니다.',inputSchema:{type:'object',properties:{text:{type:'string',maxLength:240},config:{type:'object',properties:Object.fromEntries(Object.entries(E.defaults).map(([k,v])=>[k,E.ranges[k]?{type:'number',minimum:E.ranges[k][0],maximum:E.ranges[k][1]}:{type:typeof v}])),additionalProperties:false}},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(exporting||gesture)throw Error('저장이나 드래그가 끝난 뒤 조절해주세요.');if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['text','config'].includes(k)))throw Error('설정 형식을 확인해주세요.');if(input.text!==undefined&&(typeof input.text!=='string'||input.text.length>240))throw Error('텍스트를 확인해주세요.');const next=E.validateConfig({...state,...input.config});if(next.font==='google'&&!googleFont)throw Error('먼저 Google 폰트를 연결해주세요.');if(next.font==='custom'&&!customFont)throw Error('먼저 폰트를 불러와주세요.');edited();const layoutChanged=next.layout!==state.layout;state=next;if(input.text!==undefined){initialPositions=null;selected=-1;$('text').value=input.text;invalidateTimeline('텍스트 구성이 바뀌어');overrides={};rebuildText();}else if(layoutChanged){initialPositions=null;world.arrange(state);}syncUI();return {text:textValue(),count:world.particles.length,config:{...state}};}})).catch(()=>{});}catch(e){}}
