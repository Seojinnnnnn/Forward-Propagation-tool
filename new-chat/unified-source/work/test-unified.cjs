const vm=require('vm'),fs=require('fs'),assert=require('assert/strict');
const E=require('../dist/engine.js'),X=require('../dist/export.js');
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.value='';this.min=0;this.max=100;this.disabled=false;this.dataset={};this.style={setProperty(){}};this.classList={toggle(){}};this.children=[];this.listeners={};this.clientWidth=1000;this.clientHeight=400;this.files=[];this.hidden=false;}
 setAttribute(k,v){this[k]=v;}addEventListener(k,f){this.listeners[k]=f;}append(...items){items.forEach(x=>{x.parent=this;this.children.push(x);});if(this.tagName==='SELECT'&&!this.value)this.value=String(items[0]?.value||'');}replaceChildren(){this.children=[];this.value='';}querySelector(){return this.children.find(c=>c.value==='custom')||null;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}getContext(){return {fillText(){},measureText(text){return {width:text.length*20};}};}
}
const html=fs.readFileSync('dist/index.html','utf8'),elements={};
for(const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const el=new Element(match[1]);el.id=match[3];for(const name of ['value','min','max','step']){const m=match[2].match(new RegExp(name+'="([^"]+)"'));if(m)el[name]=m[1];}elements[el.id]=el;}
elements.text.value='오류 페스티벌';elements.resolution.value='1280x720';elements.fps.value='30';elements.stage.parentElement=new Element();
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true},{get:(o,k)=>k in o?o[k]:(()=>({}))});elements.canvas.getContext=()=>gl;
const fontSet=new Set();fontSet.ready=Promise.resolve();let registered,raf,downloaded=[];
const document={getElementById:id=>{assert(elements[id],'Missing UI '+id);return elements[id];},createElement:tag=>new Element(tag),fonts:fontSet,body:{classList:{toggle(){}}},querySelectorAll:()=>Object.values(elements).filter(e=>['BUTTON','INPUT','SELECT','TEXTAREA'].includes(e.tagName)),modelContext:{registerTool:t=>registered=t}};
const presetStorage=new Map();
const context={localStorage:{getItem:k=>presetStorage.get(k)||null,setItem:(k,v)=>presetStorage.set(k,v)},FontFace:class{constructor(family){this.family=family;}async load(){return this;}},BalloonEngine:E,BalloonExport:{...X,videoFormat:()=>null,download:(blob,name)=>downloaded.push({blob,name}),png:async()=>new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'})},document,matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}},window:{addEventListener(){}},requestAnimationFrame:f=>{raf=f;return 1;},performance,console,setTimeout,AbortController,DOMException,Blob};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);
const evaluate=s=>vm.runInContext(s,context);

vm.runInContext(fs.readFileSync('dist/unified.js','utf8'),context);
(async()=>{
 elements['text-unit'].value='words';elements['text-unit'].onchange();elements.text.value='어랏 어랏 어랏';elements.text.listeners.input({isComposing:false});assert.equal(evaluate('world.particles.length'),3);
 elements['text-unit'].value='block';elements['text-unit'].onchange();assert.equal(evaluate('world.particles.length'),1);
 elements['space-mode'].value='through';elements['space-mode'].onchange();elements['start-mode'].value='filled';elements['start-mode'].onchange();elements['apply-start'].onclick();assert(evaluate('world.particles.some(p=>Math.abs(p.y)<height/2)'));assert(evaluate('state.repeatFlight'));
 elements['motion-mode'].value='bounce';elements['motion-mode'].onchange();assert(evaluate('state.wallBounce&&!state.repeatFlight&&!state.flowThrough'));assert.equal(evaluate('state.startMode'),'arranged');
 for(const key of ['basic','depth','ad']){elements['studio-preset'].value=key;await elements['studio-preset-apply'].onclick();assert.equal(evaluate('state.textMode'),key==='ad'?'block':'letters');assert(evaluate('world.particles.length>0'));evaluate('renderer.draw(world,state)');}
 for(const mode of ['letters','words','block']){evaluate(`state.textMode='${mode}';state.startMode='random'`);context.roundtrip=JSON.parse(evaluate('JSON.stringify(projectData())'));await evaluate('applyProject(roundtrip)');assert.equal(evaluate('state.textMode'),mode);assert.equal(evaluate('state.overlapEnabled'),undefined);assert.equal(evaluate('state.startMode'),'random');}
 const saved=evaluate('JSON.stringify(projectData())');context.saved=JSON.parse(saved);await evaluate('applyProject(saved)');assert.equal(evaluate('state.textMode'),'block');
 elements.background.value='#123456';document.activeElement=elements.background;evaluate('syncUI()');assert.equal(elements.background.value,'#123456');elements.background.onchange();assert.equal(evaluate('state.backgroundGradient'),false);
 elements['transparent-export'].checked=true;await elements.snapshot.onclick();assert(downloaded.some(v=>v.name.includes('transparent')));evaluate('renderer.draw(world,state,true)');
 elements['export-start'].value='2';elements['export-length'].value='.1';elements.fps.value='30';
 evaluate('globalThis.exportTimes=[];const originalDraw=renderer.draw;renderer.draw=(sim,c,t)=>{if(exporting)exportTimes.push(sim.time);return originalDraw(sim,c,t)}');
 await evaluate("exportAnimation('png')");
 const times=evaluate('exportTimes');assert(times.length>=3);assert(Math.abs(times[0]-2)<1/60);assert(Math.abs(times[2]-(2+2/30))<1/60);assert(downloaded.some(v=>v.name.endsWith('.zip')));
 elements['project-filename'].value='풍선 실험.json';elements['save-project'].onclick();assert.equal(downloaded.at(-1).name,'풍선 실험.json');elements['project-filename'].value=' ';elements['save-project'].onclick();assert.equal(downloaded.at(-1).name,'balloon-keyframes.json');
 console.log('PASS selected export start and duration');
 console.log('PASS unified initialization, text modes, independent start/space/motion, three presets, JSON round trip, background picker and transparent PNG');
})().catch(e=>{console.error(e);process.exitCode=1;});
