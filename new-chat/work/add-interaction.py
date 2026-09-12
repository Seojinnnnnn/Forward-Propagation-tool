from pathlib import Path
p=Path('dist/app.js');s=p.read_text()
s=s.replace('let exportController=null;', "let exportController=null;\nlet initialPositions=null,toolMode='move',selected=-1,gesture=null;")
s=s.replace("$('seek').value=cursor;", "$('visible-canvas').checked=state.visible;\n $('seek').value=cursor;")
s=s.replace('function resetWorld(){world=new E.World(textValue(),width,height,state);', '''function createWorld(config){
 const sim=new E.World(textValue(),width,height,config);
 if(initialPositions&&initialPositions.layout===config.layout&&initialPositions.points.length===sim.particles.length)sim.particles.forEach((p,i)=>{const point=initialPositions.points[i];p.z=point.z*Math.max(width,height);E.moveParticle(sim,config,i,point.x*width,point.y*height);});
 return sim;
}
function rememberPositions(){initialPositions={layout:state.layout,points:world.particles.map(p=>({x:p.x/width,y:p.y/height,z:p.z/Math.max(width,height)}))};}
function resetWorld(){world=createWorld(state);''')
s=s.replace('function rebuildText(){resetWorld();', 'function rebuildText(reset=true){if(reset)resetWorld();')
s=s.replace("state.layout=$('layout').value;world.arrange(state);", "state.layout=$('layout').value;initialPositions=null;world.arrange(state);")
s=s.replace("$('arrange').onclick=()=>{world.arrange(state);", "$('arrange').onclick=()=>{initialPositions=null;world.arrange(state);")
s=s.replace("$('sphere-select').onchange=updateIndividual;", "$('sphere-select').onchange=()=>{selected=Number($('sphere-select').value);updateIndividual();};")
s=s.replace('function onText(){edited();', 'function onText(){initialPositions=null;selected=-1;edited();')
s=s.replace('const sim=new E.World(textValue(),width,height,configAt(0,base,list));','const sim=createWorld(configAt(0,base,list));')
s=s.replace('fps:Number($(\'fps\').value),customFont};','fps:Number($(\'fps\').value),customFont,initialPositions,brushText:$(\'brush-text\').value};')
s=s.replace("return p;\n}", """if(p.initialPositions!==undefined&&p.initialPositions!==null){const origin=p.initialPositions;
 if(!origin||!['text','row','column','grid','circle'].includes(origin.layout)||!Array.isArray(origin.points)||origin.points.length!==E.letters(p.text).length)throw Error('배치 정보를 확인해주세요.');
 for(const point of origin.points)if(!point||['x','y','z'].some(k=>typeof point[k]!=='number'||!Number.isFinite(point[k])||Math.abs(point[k])>.5))throw Error('구의 위치를 확인해주세요.');
 }
 if(p.brushText!==undefined&&(typeof p.brushText!=='string'||p.brushText.length>80))throw Error('그릴 글자를 확인해주세요.');return p;
}""")
s=s.replace('state=p.config;keys=p.keyframes;', "state=p.config;initialPositions=p.initialPositions||null;selected=-1;$('brush-text').value=p.brushText||'오류 페스티벌';keys=p.keyframes;")
s=s.replace("if(!paused){accumulator+=delta;", "if(!paused&&!gesture){accumulator+=delta;")
s=s.replace('renderer.draw(world,state);if(now-lastUISync', 'renderer.draw(world,state);drawSelection();if(now-lastUISync')
s=s.replace("if(!renderer||exporting)return;", "if(!renderer||exporting||gesture)return;")
s=s.replace("if(exporting)throw Error('저장이 끝난 뒤 조절해주세요.');", "if(exporting||gesture)throw Error('저장이나 드래그가 끝난 뒤 조절해주세요.');")
s=s.replace("$('text').value=input.text;invalidateTimeline", "initialPositions=null;selected=-1;$('text').value=input.text;invalidateTimeline")
s=s.replace('else if(layoutChanged)world.arrange(state);', 'else if(layoutChanged){initialPositions=null;world.arrange(state);}')
# Keep new interaction code before the renderer initialization; functions are hoisted.
marker='function makeRenderer(){'
code='''function setTool(mode){
 if(gesture)finishGesture(true);toolMode=mode;canvas.dataset.tool=mode;
 $('tool-move').setAttribute('aria-pressed',String(mode==='move'));$('tool-draw').setAttribute('aria-pressed',String(mode==='draw'));$('brush-controls').hidden=mode!=='draw';
 $('interaction-hint').textContent=mode==='draw'?'드래그한 경로에 위 글자를 반복해서 추가해요. Escape로 취소할 수 있어요.':'구를 클릭하고 드래그해서 옮기세요. 선택 후 방향키로도 이동할 수 있어요.';
}
$('tool-move').onclick=()=>setTool('move');$('tool-draw').onclick=()=>setTool('draw');
$('visible-canvas').onchange=()=>{state.visible=$('visible-canvas').checked;edited();};
function pointerPosition(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)/rect.width*width-width/2,y:height/2-(event.clientY-rect.top)/rect.height*height};}
function drawSelection(){
 const ring=$('selection-ring');$('selection-overlay').setAttribute('viewBox','0 0 '+width+' '+height);
 const p=world.particles[selected];ring.setAttribute('visibility',p&&!exporting?'visible':'hidden');if(!p)return;
 ring.setAttribute('cx',p.x+width/2);ring.setAttribute('cy',height/2-p.y);ring.setAttribute('r',E.radius(state,width,height,world.particles.length)+7);
}
function stamp(point){
 const char=gesture.chars[gesture.added%gesture.chars.length];if(textValue().length+char.length>240){gesture.full=true;return false;}
 $('text').value+=char;const letter=E.letters(textValue()).at(-1);world.particles.push({...letter,x:0,y:0,z:0,tx:0,ty:0,vx:0,vy:0,vz:0,spin:0});
 E.moveParticle(world,state,letter.index,point.x,point.y);selected=letter.index;gesture.added++;gesture.changed=true;rebuildText(false);$('sphere-select').value=String(selected);updateIndividual();return true;
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
 if(gesture.mode==='move'){E.moveParticle(world,state,selected,point.x+gesture.dx,point.y+gesture.dy);gesture.changed=true;}
 else{
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
  if(old.mode==='draw'){invalidateTimeline('글자 구가 추가되어');notice(old.added+'개의 구를 추가했어요.'+(old.full?' 최대 240자에 도달했어요.':'')+' 이 배치에서 타임라인과 영상이 시작돼요.');}
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
'''
s=s.replace(marker,code+'\n'+marker)
p.write_text(s)
