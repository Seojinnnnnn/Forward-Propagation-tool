const vm=require('vm'),fs=require('fs'),assert=require('assert/strict');
const E=require('../dist/engine.js'),X=require('../dist/export.js');
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.value='';this.min=0;this.max=100;this.disabled=false;this.dataset={};this.style={setProperty(){}};this.classList={toggle(){}};this.children=[];this.listeners={};this.clientWidth=1000;this.clientHeight=400;this.files=[];this.hidden=false;}
 setAttribute(k,v){this[k]=v;}addEventListener(k,f){this.listeners[k]=f;}append(...items){items.forEach(x=>{x.parent=this;this.children.push(x);});if(this.tagName==='SELECT'&&!this.value)this.value=String(items[0]?.value||'');}replaceChildren(){this.children=[];this.value='';}querySelector(){return this.children.find(c=>c.value==='custom')||null;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}getContext(){return {fillText(){}};}
}
const html=fs.readFileSync('dist/index.html','utf8'),elements={};
for(const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const el=new Element(match[1]);el.id=match[3];for(const name of ['value','min','max']){const m=match[2].match(new RegExp(name+'="([^"]+)"'));if(m)el[name]=m[1];}elements[el.id]=el;}
elements.text.value='오류 페스티벌';elements.resolution.value='1280x720';elements.fps.value='30';elements.stage.parentElement=new Element();
elements.canvas.getBoundingClientRect=()=>({left:0,top:0,width:640,height:360});elements.canvas.focus=()=>{};elements.canvas.setPointerCapture=()=>{};elements.canvas.hasPointerCapture=()=>false;
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true},{get:(o,k)=>k in o?o[k]:(()=>({}))});elements.canvas.getContext=()=>gl;
const fontSet=new Set();fontSet.ready=Promise.resolve();let registered,raf,downloaded=[];
const document={getElementById:id=>{assert(elements[id],'Missing UI '+id);return elements[id];},createElement:tag=>new Element(tag),fonts:fontSet,body:{classList:{toggle(){}}},querySelectorAll:()=>Object.values(elements).filter(e=>['BUTTON','INPUT','SELECT','TEXTAREA'].includes(e.tagName)),modelContext:{registerTool:t=>registered=t}};
const context={BalloonEngine:E,BalloonExport:{...X,videoFormat:()=>null,download:(blob,name)=>downloaded.push({blob,name}),png:async()=>new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'})},document,matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}},window:{addEventListener(){}},requestAnimationFrame:f=>{raf=f;return 1;},performance,console,setTimeout,AbortController,DOMException,Blob};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);
const evaluate=s=>vm.runInContext(s,context);
(async()=>{
 await Promise.resolve();assert.equal(elements.count.textContent,'6개의 구');raf(16);
 const r=registered.execute({config:{windLeft:80,font:'serif',color:'#ff0000'},text:'첨단주간'});assert.equal(r.count,4);assert.equal(r.config.windLeft,80);assert.equal(r.config.color,'#ff0000');
 assert.throws(()=>registered.execute({config:{windLeft:101}}));assert.throws(()=>registered.execute({config:{font:'custom'}}));
 elements['add-key'].onclick();assert.equal(evaluate('keys.length'),1);await evaluate('seekTo(2)');elements.windLeft.value=0;elements.windLeft.oninput();elements['add-key'].onclick();assert.equal(evaluate('keys.length'),2);await evaluate('seekTo(1)');assert.equal(evaluate('state.windLeft'),40);
 elements.layout.value='column';elements.layout.onchange();assert(evaluate('world.particles.every(p=>p.x===0)'));
 elements['individual-color'].value='#123456';elements['sphere-select'].value='0';elements['individual-color'].oninput();assert.equal(evaluate('overrides[0]'),'#123456');elements['clear-color'].onclick();assert.equal(evaluate('overrides[0]'),undefined);
 elements['save-project'].onclick();assert.equal(downloaded[0].name,'balloon-keyframes.json');const project=JSON.parse(await downloaded[0].blob.text());assert.equal(project.keyframes.length,2);context.projectInput=project;assert.equal(evaluate('validateProject(projectInput).text'),'첨단주간');project.duration=-1;assert.throws(()=>evaluate('validateProject(projectInput)'));project.duration=6;
 elements.text.value='';elements.text.listeners.input({isComposing:false});assert.equal(evaluate('keys.length'),0);assert.equal(elements.empty.hidden,false);
 elements.text.value='가나';elements.text.listeners.input({isComposing:false});elements.duration.value=1;elements.fps.value=24;
 const before=evaluate('JSON.stringify(world.snapshot())');await evaluate("exportAnimation('png')");assert.equal(downloaded.at(-1).name,'balloon-frames-24fps.zip');assert.equal(evaluate('exporting'),false);assert.equal(evaluate('JSON.stringify(world.snapshot())'),before);fs.writeFileSync('work/app-frames.zip',Buffer.from(await downloaded.at(-1).blob.arrayBuffer()));
 const count=downloaded.length;elements.duration.value=30;elements.fps.value=60;await evaluate("exportAnimation('png')");assert.equal(downloaded.length,count);assert(elements.notice.textContent.includes('600'));
 // Cancellation must restore the live composition and avoid partial downloads.
 elements.duration.value=1;elements.fps.value=24;const task=evaluate("exportAnimation('png')");evaluate('exportController.abort()');await task;assert.equal(downloaded.length,count);assert.equal(evaluate('exporting'),false);
 // Pointer interactions at half-size canvas coordinates.
 const pointer=(x,y)=>({button:0,pointerId:1,clientX:(x+640)/2,clientY:(360-y)/2,preventDefault(){}});
 evaluate('paused=true;state.size=100;resetWorld()');elements['tool-draw'].onclick();elements['brush-text'].value='가나';
 const original=evaluate('world.particles.length');elements.canvas.listeners.pointerdown(pointer(-300,150));elements.canvas.listeners.pointermove(pointer(100,150));elements.canvas.listeners.pointerup(pointer(100,150));
 assert(evaluate('world.particles.length')>original);assert.equal(evaluate('gesture'),null);assert(evaluate('initialPositions.points.length')>original);
 assert(evaluate('world.particles.slice('+original+').every(p=>p.y===150)'));
 const lastIndex=evaluate('world.particles.length-1');const x=evaluate('world.particles['+lastIndex+'].x');elements['tool-move'].onclick();elements.canvas.listeners.pointerdown(pointer(x,150));elements.canvas.listeners.pointermove(pointer(x+30,210));elements.canvas.listeners.pointerup(pointer(x+30,210));assert.equal(evaluate('selected'),lastIndex);assert.equal(evaluate('world.particles['+lastIndex+'].y'),210);
 await evaluate('seekTo(0)');assert.equal(evaluate('world.particles['+lastIndex+'].y'),210);
 elements['visible-canvas'].checked=false;elements['visible-canvas'].onchange();assert.equal(evaluate('state.visible'),false);assert.equal(elements.visible.checked,false);
 elements.canvas.listeners.pointerdown(pointer(x+30,210));assert.equal(evaluate('selected'),lastIndex);elements.canvas.listeners.pointermove(pointer(x+60,240));elements.canvas.listeners.pointercancel(pointer(x+60,240));assert.equal(evaluate('world.particles['+lastIndex+'].y'),210);
 const pre=evaluate('world.particles.length');elements['tool-draw'].onclick();elements.canvas.listeners.pointerdown(pointer(-200,-100));elements.canvas.listeners.pointermove(pointer(150,-100));elements.canvas.listeners.pointercancel(pointer(150,-100));assert.equal(evaluate('world.particles.length'),pre);
 const startCount=evaluate('world.particles.length');elements['brush-text'].value='하늘';elements['tool-draw'].onclick();elements.canvas.listeners.pointerdown(pointer(-300,-180));elements.canvas.listeners.pointermove(pointer(400,200));elements.canvas.listeners.pointermove(pointer(-400,220));assert.equal(evaluate('world.particles.length'),startCount+2);elements.canvas.listeners.pointerup(pointer(-400,220));assert.equal(evaluate('world.particles['+startCount+'].pinned'),true);assert.equal(evaluate('world.particles['+(startCount+1)+'].anchor'),startCount);
 const rootBefore=evaluate('JSON.stringify([world.particles['+startCount+'].x,world.particles['+startCount+'].y])');evaluate('for(let k=0;k<720;k++)world.step(E.STEP,state)');assert.equal(evaluate('JSON.stringify([world.particles['+startCount+'].x,world.particles['+startCount+'].y])'),rootBefore);
 elements.canvas.listeners.pointerdown(pointer(50,-180));elements.canvas.listeners.pointermove(pointer(50,250));elements.canvas.listeners.pointerup(pointer(50,250));assert.equal(evaluate('world.particles.length'),startCount+4);assert.equal(evaluate('world.particles['+(startCount+2)+'].pinned'),true);
 context.tetherProject=evaluate('projectData()');assert(evaluate('validateProject(tetherProject).initialPositions.points['+startCount+'].pinned'));await evaluate('seekTo(0)');assert.equal(evaluate('world.particles['+startCount+'].pinned'),true);assert.equal(evaluate('world.particles['+(startCount+1)+'].anchor'),startCount);
 console.log('PASS: finite text per gesture, independent repeated strokes, immovable root, moving followers, saved tether and replay.');
})().catch(e=>{console.error(e);process.exitCode=1;});
