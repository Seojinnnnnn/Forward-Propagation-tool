/* Deterministic shared-space simulation. No browser or rendering dependency. */
(function(root){
'use strict';
const STEP=1/120;
const defaults={positionHold:false,positionStrength:40,startMode:"arranged",typeTracking:0,typeLeading:0,energy:0,keepOrder:false,orderStrength:80,freeRotation:false,wallBounce:false,depth:24,depthScale:32,textMode:"letters",verticalBob:true,verticalRange:100,startFilled:false,repeatFlight:false,startSpread:5,startSeed:0,lockTypeSize:true,typeSizeReferenceRadius:10.4,sphereStops:null,backgroundStops:null,sphereGradientMode:"linear",backgroundGradientMode:"linear",sphereGradientAngle:0,backgroundGradientAngle:0,sphereGradient:false,backgroundGradient:false,sphereColorEnd:"#3d9fff",backgroundColorEnd:"#792cff",float:32,speed:28,rotation:30,rotationShare:30,size:20,typeSize:135,weight:500,font:'pretendard',visible:true,openTop:false,flowThrough:false,collision:true,bounce:38,softness:35,windTop:0,windBottom:6,windLeft:0,windRight:0,hold:false,letterSpacing:0,lineSpacing:0,layout:'text',color:'#d9ff96',ink:'#211c19',background:'#ffffff'};
const ranges={positionStrength:[0,100],typeTracking:[0,100],typeLeading:[0,100],energy:[0,100],orderStrength:[0,100],depth:[0,100],depthScale:[0,100],verticalRange:[0,200],startSpread:[0,100],letterSpacing:[0,300],lineSpacing:[0,300],float:[0,100],speed:[0,100],rotation:[0,100],rotationShare:[0,100],size:[1,600],typeSize:[1,400],weight:[100,900],bounce:[0,100],softness:[0,100],windTop:[0,100],windBottom:[0,100],windLeft:[0,100],windRight:[0,100]};
const colors=['color','ink','background','sphereColorEnd','backgroundColorEnd'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function validateConfig(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('설정 형식을 확인해주세요.');
 const out={...defaults};
 for(const [key,value]of Object.entries(input)){
  if(key==='startMode'){if(!['arranged','random','below','filled'].includes(value))throw Error('시작 상태를 확인해주세요.');out[key]=value;continue;}
  if(key==='textMode'){if(!['letters','words','block'].includes(value))throw Error('텍스트 모드를 확인해주세요.');out[key]=value;continue;}
  if(key==='startSeed'){if(!Number.isInteger(value)||value<0||value>2147483647)throw Error('시작 배치 값을 확인해주세요.');out[key]=value;continue;}
  if(['accent','overlapEnabled','overlapUseBackground','overlapColor'].includes(key))continue; // Older saved projects remain readable.
  if(!Object.prototype.hasOwnProperty.call(defaults,key))throw Error('알 수 없는 설정입니다: '+key);
  if(key==='typeSizeReferenceRadius'){if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>10000)throw Error('글자 크기 기준을 확인해주세요.');
  }else if(key==='sphereStops'||key==='backgroundStops'){
   if(value!==null&&(!Array.isArray(value)||value.length<2||value.length>16||value.some((s,i)=>!s||typeof s.position!=='number'||!Number.isFinite(s.position)||s.position<0||s.position>1||typeof s.color!=='string'||!/^#[0-9a-f]{6}$/i.test(s.color)||(i>0&&s.position<value[i-1].position))))throw Error('그라디언트 포인트를 확인해주세요.');
  }else if(key.endsWith('GradientMode')){if(!['linear','radial'].includes(value))throw Error('그라디언트 종류를 확인해주세요.');
  }else if(key.endsWith('GradientAngle')){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>360)throw Error('그라디언트 각도를 확인해주세요.');
  }else if(ranges[key]){const [a,b]=ranges[key];if(typeof value!=='number'||!Number.isFinite(value)||value<a||value>b)throw Error('설정 범위를 확인해주세요: '+key);}
  else if(colors.includes(key)){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw Error('색상 형식을 확인해주세요.');}
  else if(['positionHold','freeRotation','keepOrder','wallBounce','verticalBob','visible','collision','hold','lockTypeSize','sphereGradient','backgroundGradient','openTop','flowThrough','repeatFlight','startFilled'].includes(key)){if(typeof value!=='boolean')throw Error('켜기/끄기 설정을 확인해주세요.');}
  else if(key==='layout'&&!['text','row','column','grid','circle','diagonal','zigzag','rings'].includes(value))throw Error('정렬 방식을 확인해주세요.');
  else if(key==='font'&&!['gothic','serif','rounded','mono','brush','custom','google','pretendard'].includes(value))throw Error('폰트를 확인해주세요.');
  out[key]=value;
 }
 return out;
}
function letters(text,mode="letters"){
 if(mode==="block")return text.trim()?[{char:text,row:0,col:0,index:0}]:[];
 if(mode==="words"){const result=[];text.split(/\r?\n/).forEach((line,row)=>line.trim().split(/\s+/u).filter(Boolean).forEach((char,col)=>result.push({char,row,col,index:result.length})));return result;}
 const chars=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text),x=>x.segment):Array.from(text);
 const result=[];let row=0,col=0;
 for(const char of chars){if(char==='\n'){row++;col=0;}else if(/\s/u.test(char))col+=.45;else{result.push({char,row,col,index:result.length});col++;}}
 return result;
}
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
function mixColor(a,b,t){return '#'+rgb(a).map((x,i)=>Math.round((x+(rgb(b)[i]-x)*t)*255).toString(16).padStart(2,'0')).join('');}
function interpolate(keys,t,fallback){
 if(!keys.length)return {...fallback};
 if(t<=keys[0].time)return {...keys[0].config};
 if(t>=keys[keys.length-1].time)return {...keys[keys.length-1].config};
 let index=1;while(keys[index].time<t)index++;
 const a=keys[index-1],b=keys[index];let f=(t-a.time)/(b.time-a.time);f=f*f*(3-2*f);
 const out={...a.config};
 for(const key of Object.keys(ranges))out[key]=a.config[key]+(b.config[key]-a.config[key])*f;
 for(const key of colors)out[key]=mixColor(a.config[key],b.config[key],f);
 if(t>=b.time-1e-8)for(const key of ['startMode','textMode','font','positionHold','freeRotation','keepOrder','wallBounce','verticalBob','visible','collision','hold','lockTypeSize','sphereGradient','backgroundGradient','openTop','flowThrough','repeatFlight','startFilled','layout'])out[key]=b.config[key];
 return out;
}
function depthExtent(config){return 35+(config.depth||0)*3.5;}
function particleScale(config,p){if(!config.depth)return 1;return Math.exp(clamp(p.z/(depthExtent(config)*.9),-1,1)*(config.depthScale||0)/100*Math.log(6));}
// Match the projected ellipsoid used by the shader, including squash at impact.
function wallPose(config,p,w,h,r){
 r*=particleScale(config,p);
 const q=config.softness===0?0:(p.squash||0),a=1-q,t=1/a,d=a*a-t;
 const ex=Math.sqrt(t+d*(p.squashAxisX||0)**2),ey=Math.sqrt(t+d*(p.squashAxisY===undefined?1:p.squashAxisY)**2);
 const fit=Math.min(r,w/(2*ex),h/(2*ey)),bx=Math.max(0,w/2-fit*ex),by=Math.max(0,h/2-fit*ey);
 return {x:clamp(p.x,-bx,bx),y:clamp(p.y,-by,by),z:p.z,radius:fit};
}
function radius(config,w,h,n){
 let limit=Math.max(10,Math.min(w,h)/2-32);
 if(config.collision&&n>1){let packing=0;for(let cols=1;cols<=n;cols++){const rows=Math.ceil(n/cols);packing=Math.max(packing,Math.min((w-60)/(cols*2.24),(h-60)/(rows*2.24)));}limit=Math.min(limit,packing);}
 return Math.min(52*config.size/100,limit);
}
// Orthographic hit testing uses the front surface depth, not array order.
function hitTest(world,config,x,y){
 const r=radius(config,world.width,world.height,(world.sourceCount||world.particles.length));let hit=-1,front=-Infinity;
 for(const p of world.particles){const pr=r*particleScale(config,p),d2=(p.x-x)**2+(p.y-y)**2;if(d2>pr*pr)continue;const z=p.z+Math.sqrt(pr*pr-d2);if(z>front){front=z;hit=p.index;}}
 return hit;
}
function moveParticle(world,config,index,x,y){
 const p=world.particles[index];if(!p)return;const r=radius(config,world.width,world.height,(world.sourceCount||world.particles.length));
 const bx=Math.max(0,world.width/2-r-24+(world.spacingOverflowX||0)),by=Math.max(0,world.height/2-r-24+(world.spacingOverflowY||0));
 p.x=clamp(x,-bx,bx);p.y=clamp(y,-by,by);p.tx=p.x;p.ty=p.y;p.vx=p.vy=p.vz=0;
 if(Number.isInteger(p.anchor)&&world.particles[p.anchor]){const root=world.particles[p.anchor];p.offsetX=p.x-root.x;p.offsetY=p.y-root.y;p.offsetZ=p.z-root.z;}
}
function sampleSegment(from,to,spacing,remainder=0){
 const distance=Math.hypot(to.x-from.x,to.y-from.y),points=[];if(distance<1e-9)return {points,remainder};
 let at=spacing-remainder;
 for(;at<=distance+1e-8;at+=spacing){const f=at/distance;points.push({x:from.x+(to.x-from.x)*f,y:from.y+(to.y-from.y)*f});}
 return {points,remainder:(remainder+distance)%spacing};
}
// Seeded variation keeps random-looking motion identical in preview and frame exports.
function rotationRandom(index,salt){let x=Math.imul(index+1,374761393)^Math.imul(salt+1,668265263);x=Math.imul(x^(x>>>13),1274126177);return ((x^(x>>>16))>>>0)/4294967296;}
function rotatingIndices(count,share=30,round=0){
 const maximum=share<=0?0:Math.min(count,Math.max(1,Math.ceil(count*share/100)));
 const amount=maximum>0?1+Math.floor(rotationRandom(round,701)*maximum):0;
 return new Set(Array.from({length:count},(_,index)=>index).sort((a,b)=>rotationRandom(a,99+round*31)-rotationRandom(b,99+round*31)).slice(0,amount));
}
function rotationProfile(index){const active=3+rotationRandom(index,1)*4;return {delay:rotationRandom(index,2)*3.5,active,period:active+1.5+rotationRandom(index,3)*4,tilt:(rotationRandom(index,4)-.5)*.8,roll:(rotationRandom(index,5)-.5)*.6};}
function rotationRate(index,clock){const profile=rotationProfile(index),elapsed=clock-profile.delay;if(elapsed<0)return 0;const cycle=Math.floor(elapsed/profile.period),phase=elapsed-cycle*profile.period;if(phase>=profile.active)return 0;const direction=rotationRandom(index,cycle+20)<.5?-1:1;return direction*Math.PI*Math.PI/profile.active*Math.sin(Math.PI*phase/profile.active);}
function balloonImpact(p,nx,ny,nz,speed,softness){
 if(speed<5||softness<=0)return;
 p.squashAxisX=nx;p.squashAxisY=ny;p.squashAxisZ=nz;
 p.squashVelocity=Math.min(2.8,(p.squashVelocity||0)+speed*.023*(softness/100)*.8);
}
class World{
 constructor(text,width,height,config){this.width=width;this.height=height;this.time=0;this.motionTime=0;this.rotationTimeline=0;this.layout=config.layout;this.particles=letters(text,config.textMode).map(s=>({...s,x:0,y:0,z:0,vx:0,vy:0,vz:0,spin:0}));this.arrange(config);}
 arrange(config){
  this.particles=this.particles.filter(p=>p.sourceIndex===undefined);this.sourceCount=this.particles.length;this.repeatActive=!!config.repeatFlight;this.holdActive=!!config.hold;
  const ps=this.particles,n=ps.length,w=this.width,h=this.height,r=radius(config,w,h,n),margin=r+30;this.layout=config.layout;
  let targets=[];
  if(['diagonal','zigzag','rings'].includes(config.layout)){
   const bx=Math.max(0,w/2-margin),by=Math.max(0,h/2-margin);
   targets=ps.map((p,i)=>{const u=n<2?.5:i/(n-1);
    if(config.layout==='diagonal')return {x:(u*2-1)*bx,y:(1-u*2)*by};
    if(config.layout==='zigzag')return {x:n<2?0:(i%2?1:-1)*bx*.8,y:(1-u*2)*by};
    if(i===0)return {x:0,y:0};
    const ring=Math.ceil((Math.sqrt(1+4*i/3)-1)/2),start=1+3*(ring-1)*ring;
    const slots=Math.min(6*ring,n-start),angle=(i-start)/slots*Math.PI*2;
    const rings=Math.max(1,Math.ceil((Math.sqrt(1+4*(n-1)/3)-1)/2));
    return {x:Math.sin(angle)*bx*ring/rings,y:Math.cos(angle)*by*ring/rings};
   });
  }
  else if(config.layout==='circle'){const ring=Math.min(w,h)*.36;targets=ps.map((s,i)=>({x:n===1?0:Math.sin(i/n*Math.PI*2)*ring,y:n===1?0:Math.cos(i/n*Math.PI*2)*ring}));}
  else{
   const cols=config.layout==='row'?Math.max(1,n):config.layout==='column'?1:Math.max(1,Math.ceil(Math.sqrt(n*w/h)));
   let offset=0,prev=-1;const rows=new Map();
   targets=ps.map((s,i)=>{
    let row=Math.floor(i/cols),col=i%cols;
    if(config.layout==='text'){
     const maxCols=Math.max(1,Math.floor((w-60)/(r*2.25)));
     if(s.row!==prev){if(prev>=0)offset=Math.max(...rows.keys())+1;prev=s.row;}
     row=offset+Math.floor(s.col/maxCols);col=s.col%maxCols;
    }
    rows.set(row,Math.max(rows.get(row)||0,col+1));return {row,col};
   });
   const rowCount=Math.max(1,...Array.from(rows.keys(),r=>r+1));
   const stepX=Math.max(0,Math.min(r*2.35,(w-margin*2)/Math.max(1,...Array.from(rows.values(),v=>v-1))))+config.letterSpacing,stepY=Math.max(0,Math.min(r*2.35,(h-margin*2)/Math.max(1,rowCount-1)))+config.lineSpacing;
   targets=targets.map(p=>({x:(p.col-(rows.get(p.row)-1)/2)*stepX,y:((rowCount-1)/2-p.row)*stepY}));
  }
  if(['circle','rings','diagonal','zigzag'].includes(config.layout))targets=targets.map(p=>({x:p.x*(1+config.letterSpacing/(r*2.35)),y:p.y*(1+config.lineSpacing/(r*2.35))}));
  this.spacingOverflowX=Math.max(0,...targets.map(p=>Math.abs(p.x)+r+24-w/2));
  this.spacingOverflowY=Math.max(0,...targets.map(p=>Math.abs(p.y)+r+24-h/2));
  if(config.startMode==='random'&&config.startSeed){const spread=Math.min(w,h)*.5*(config.startSpread??5)/100;targets=targets.map((p,i)=>({x:p.x+(rotationRandom(i,config.startSeed)*2-1)*spread,y:p.y+(rotationRandom(i,config.startSeed+719)*2-1)*spread}));this.spacingOverflowX+=spread;this.spacingOverflowY+=spread;}
  this.letterSpacing=config.letterSpacing;this.lineSpacing=config.lineSpacing;
  ps.forEach((s,i)=>{s.pinned=false;delete s.anchor;s.x=targets[i].x;s.y=targets[i].y;s.z=0;s.tx=s.x;s.ty=s.y;s.vx=0;s.vy=0;s.vz=0;s.spin=0;s.turn=0;s.rotationClock=0;s.turnStart=null;s.turnDuration=0;s.turnDirection=1;s.turnReadyAt=0;delete s.turnRound;s.lastTurnStart=-1;s.squash=0;s.squashVelocity=0;});
  this.flightSpan=Math.max(h+4*r+24,Math.max(0,...ps.map(p=>p.y))-Math.min(0,...ps.map(p=>p.y))+h+4*r+config.lineSpacing+24);
  this.flowActive=!!config.flowThrough;
  if((config.startMode==='below'||config.repeatFlight)&&ps.length){const highest=ps.reduce((v,p)=>Math.max(v,p.y),-Infinity);const shift=highest+h/2+r*1.2+12;for(const p of ps){p.y-=shift;p.ty=p.y;p.vy=60;}}
  if(config.repeatFlight&&ps.length){
   const top=Math.max(...ps.map(p=>p.y)),bottom=Math.min(...ps.map(p=>p.y));
   const period=Math.max(r*2.35+config.lineSpacing,40)+top-bottom;
   const copies=Math.max(2,Math.ceil((h+4*r)/period)+1),base=ps.map(p=>({...p}));
   for(let j=1;j<copies;j++)for(const p of base)ps.push({...p,index:ps.length,sourceIndex:p.index,y:p.y-j*period,ty:p.ty-j*period});
   this.flightSpan=copies*period;
   if(config.startMode==='filled'){const shift=h-2*r;for(const p of ps){p.y+=shift;p.ty+=shift;}}
  }
 }
 respace(config){
  if(config.repeatFlight){this.arrange(config);return;}

  const old=this.particles.map(p=>({...p}));this.arrange(config);
  this.particles.forEach((p,i)=>{const tx=p.tx,ty=p.ty;Object.assign(p,old[i]);p.x+=tx-old[i].tx;p.y+=ty-old[i].ty;p.tx=tx;p.ty=ty;});
 }
 step(dt,config){
  if(config.wallBounce){if(!this.wallActive)for(const p of this.particles){p.vx=(rotationRandom(p.index,501)<.5?-1:1)*140;p.vy=170;}config={...config,hold:false,openTop:false,flowThrough:false,repeatFlight:false};}this.wallActive=!!config.wallBounce;
  if(!!config.repeatFlight!==!!this.repeatActive)this.arrange(config);
  if(this.letterSpacing!==config.letterSpacing||this.lineSpacing!==config.lineSpacing)this.respace(config);
  if(!!config.flowThrough!==!!this.flowActive){if(config.flowThrough)this.arrange(config);else this.flowActive=false;}
  if(config.layout!==this.layout)this.arrange(config);
  if(!!config.hold!==!!this.holdActive){if(config.hold)for(const p of this.particles)p.ty=p.y;this.holdActive=!!config.hold;}
  this.time+=dt;const d=dt*config.speed/40;if(d===0)return;
  this.motionTime+=d;
  const t=this.motionTime,ps=this.particles,r=radius(config,this.width,this.height,this.sourceCount||ps.length),amp=config.float/100;
  this.rotationTimeline=(this.rotationTimeline||0)+d*config.rotation/100*2;
  const clock=this.rotationTimeline;
  // Independent renewal clocks avoid synchronized batch starts and survive snapshots.
  const share=config.rotationShare/100;
  const wait=(p,round)=>.12-Math.log(Math.max(.001,1-rotationRandom(p.index,round*37+910)))*(.18+5*(1-share)**2);
  for(const p of ps){
   if(p.turnStart!=null){const u=clamp((clock-p.turnStart)/p.turnDuration,0,1);const split=p.turnSplit||.5,v=u<split?u/split:(u-split)/(1-split);p.turn=p.turnDirection*Math.PI*((u<split?0:1)+v*v*(3-2*v));
    if(u>=1){p.turnStart=null;p.turnReadyAt=clock+wait(p,p.turnRound||0);}
   }
   if(!Number.isFinite(p.turnRound)){p.turnRound=0;p.turnReadyAt=clock+wait(p,0);}
   const visible=!p.pinned&&Math.abs(p.x)<=this.width/2&&Math.abs(p.y)<=this.height/2;
   if(!visible||config.rotation<=0||share<=0||p.turnStart!=null||clock<p.turnReadyAt)continue;
   const round=++p.turnRound;
   p.turnStart=clock;p.lastTurnStart=clock;p.turnDuration=3.1+rotationRandom(p.index,round*37+202)*2.8;
   p.turnDirection=rotationRandom(p.index,round*37+203)<.5?-1:1;p.turn=0;
   p.turnSplit=.25+rotationRandom(p.index,round*37+206)*.5;
   const az=rotationRandom(p.index,round*37+204)*Math.PI*2,z=(rotationRandom(p.index,round*37+205)*2-1)*.55,rad=Math.sqrt(1-z*z);
   p.turnAxisX=rad*Math.cos(az);p.turnAxisY=rad*Math.sin(az);p.turnAxisZ=z;
  }
  if(config.keepOrder){const k=(config.orderStrength||0)/100*.7;for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i];if(a.pinned||b.pinned||a.sourceIndex!==undefined||b.sourceIndex!==undefined)continue;const fx=((b.tx-a.tx)-(b.x-a.x))*k*d,fy=((b.ty-a.ty)-(b.y-a.y))*k*d;a.vx-=fx;a.vy-=fy;b.vx+=fx;b.vy+=fy;}}
  const ax=(config.windLeft-config.windRight)*2.3,ay=(config.windBottom-config.windTop)*2.3+((config.openTop||config.flowThrough||config.repeatFlight)?30:0);
  for(const s of ps){
   if(s.pinned){s.vx=s.vy=s.vz=0;continue;}
   const anchor=Number.isInteger(s.anchor)?ps[s.anchor]:null;
   if(anchor){s.vx+=(anchor.x+s.offsetX-s.x)*1.1*d;s.vy+=(anchor.y+s.offsetY-s.y)*1.1*d;s.vz+=(anchor.z+s.offsetZ-s.z)*1.1*d;}
   if(config.positionHold&&!anchor){
    // Restore the arranged position without removing wind, depth or collisions.
    const strength=(config.positionStrength??40)/100;
    s.vx+=((s.tx-s.x)*3.2*strength-s.vx*1.1*strength)*d;
    s.vy+=((s.ty-s.y)*4*strength-s.vy*1.3*strength)*d;
   }
   const p=s.index*2.399;
   const energy=(config.energy||0)/100;
   s.vx+=(Math.sin(t*.43+p)*110+Math.sin(t*.79+p*1.7)*45)*energy*d;
   s.vy+=(Math.cos(t*.51+p*1.3)*100+Math.sin(t*.87+p)*35)*energy*d;
   let q=s.squash||0,sv=s.squashVelocity||0;
   sv+=(-105*q-12*sv)*d;q+=sv*d;
   if(q>.09){q=.09;sv=Math.min(0,sv);}if(q<-.025){q=-.025;sv=Math.max(0,sv);}
   s.squash=q;s.squashVelocity=sv;
   const legacyHold=config.hold&&!config.positionHold;
   s.vx+=(ax+(Math.sin(t*.64+p)*30+Math.sin(t*1.27+p)*12)*amp+(legacyHold?(s.tx-s.x)*2.8:0))*d;
   // Keep vertical bobbing bounded around a steadily rising target in flight modes.
   const heldFlight=legacyHold&&(config.openTop||config.flowThrough||config.repeatFlight);
   const riseSpeed=heldFlight?clamp(ay/.52,-300,300):0;
   if(heldFlight)s.ty+=riseSpeed*d;
   s.vy+=(ay+(Math.sin(t*1.75+p)*100+Math.sin(t*3.5+p*2)*28+Math.cos(t*.39+p)*18)*amp*(config.verticalBob===false?0:(config.verticalRange??100)/100)*(legacyHold?.6:1)+(legacyHold?(s.ty-s.y)*4-(s.vy-riseSpeed)*.8:0))*d;
   if(config.depth){
   // Slowly varying depth targets create buoyant travel instead of wall rebounds.
   let depthTarget=0;
   if(config.depth){
    if(!Number.isFinite(s.depthRound)){s.depthRound=-1;s.depthElapsed=0;s.depthDuration=0;s.depthFrom=clamp(s.z/depthExtent(config),-1,1);s.depthTo=s.depthFrom;}
    s.depthElapsed+=d;
    while(s.depthElapsed>=s.depthDuration){
     s.depthElapsed-=s.depthDuration;s.depthFrom=s.depthTo;s.depthRound++;
     const salt=1201+s.depthRound*7;
     s.depthTo=(rotationRandom(s.index,salt)*2-1)*.98;
     s.depthDuration=2.5+rotationRandom(s.index,salt+1)*4.5;
    }
    const u=clamp(s.depthElapsed/s.depthDuration,0,1),ease=u*u*u*(u*(u*6-15)+10);
    depthTarget=depthExtent(config)*(s.depthFrom+(s.depthTo-s.depthFrom)*ease);
   }
   s.vz+=((depthTarget-s.z)*2.2-s.vz*2.5)*d;
   }else{s.vz+=(Math.sin(t*.63+p)*amp*20-s.z*.32)*d;}
   const damp=Math.exp(-.52*d);s.vx*=damp;s.vy*=damp;s.vz*=damp;
   const speed=Math.hypot(s.vx,s.vy,s.vz);if(speed>380){s.vx*=380/speed;s.vy*=380/speed;s.vz*=380/speed;}
   s.x+=s.vx*d;s.y+=s.vy*d;s.z+=s.vz*d;s.spin*=Math.exp(-1.6*d);
  }
  if(config.repeatFlight){
   const span=Math.max(this.height+4*r+24,this.flightSpan||0);
   for(const s of ps){if(s.pinned||Number.isInteger(s.anchor))continue;
    if(s.y>this.height/2+r*1.3+12){const shift=Math.ceil((s.y-(this.height/2+r*1.3+12))/span)*span;s.y-=shift;s.ty-=shift;}
   }
  }
  // Resolve contacts in depth: separated spheres may overlap in projection.
  for(let iteration=0;iteration<(config.collision?10:1);iteration++){
  const pairs=[];
  if(config.collision){const cells=new Map(),cellSize=Math.max(.001,r*2.1);
   for(let i=0;i<ps.length;i++){const scale=particleScale(config,ps[i]),x=Math.floor(ps[i].x/scale/cellSize),y=Math.floor(ps[i].y/scale/cellSize);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of cells.get((x+dx)+','+(y+dy))||[])pairs.push([j,i]);
    const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
   }
  }
  for(const [i,j] of pairs){
   const a=ps[i],b=ps[j];const wa=a.pinned?0:1,wb=b.pinned?0:1,total=wa+wb;if(!total)continue;const sa=particleScale(config,a),sb=particleScale(config,b);let dx=b.x/sb-a.x/sa,dy=b.y/sb-a.y/sa,dz=config.depth?b.z-a.z:0;let distance=Math.hypot(dx,dy,dz);
   const contact=r*2.05;if(distance>=contact)continue;
   if(distance<1e-6){dx=Math.cos(i+j);dy=Math.sin(i+j);dz=0;distance=Math.hypot(dx,dy);}
   const nx=dx/distance,ny=dy/distance,nz=dz/distance,penetration=(contact-distance)*.51;
   a.x-=nx*penetration*2*wa/total*sa;a.y-=ny*penetration*2*wa/total*sa;a.z-=nz*penetration*2*wa/total;b.x+=nx*penetration*2*wb/total*sb;b.y+=ny*penetration*2*wb/total*sb;b.z+=nz*penetration*2*wb/total;
   const relative=(b.vx/sb-a.vx/sa)*nx+(b.vy/sb-a.vy/sa)*ny+(b.vz-a.vz)*nz;
   if(relative<0){balloonImpact(a,nx,ny,nz,-relative,config.softness);balloonImpact(b,nx,ny,nz,-relative,config.softness);const impulse=-(1.3+config.bounce/100*.65)*relative/total;
    a.vx-=impulse*nx*wa*sa;a.vy-=impulse*ny*wa*sa;a.vz-=impulse*nz*wa;b.vx+=impulse*nx*wb*sb;b.vy+=impulse*ny*wb*sb;b.vz+=impulse*nz*wb;
    a.spin=clamp(a.spin+impulse*.006,-.7,.7);b.spin=clamp(b.spin-impulse*.006,-.7,.7);
   }
  }
  for(const s of ps){
   const pr=r*particleScale(config,s),pose=wallPose(config,{...s,x:1e9,y:1e9},this.width,this.height,r);
   const bx=config.wallBounce?pose.x:Math.max(0,this.width/2-pr-24+(this.spacingOverflowX||0)),by=config.wallBounce?pose.y:Math.max(0,this.height/2-pr-24+(this.spacingOverflowY||0)),bz=config.depth?depthExtent(config):Math.max(35,r*.8);const restitution=.4+config.bounce/100*.55;
   for(const [pos,vel,bound]of [['x','vx',bx],['y','vy',by],['z','vz',bz]]){
    if(s[pos]>bound&&!((config.openTop||config.flowThrough||config.repeatFlight)&&pos==='y')){s[pos]=bound;if(s[vel]>0){balloonImpact(s,pos==='x'?1:0,pos==='y'?1:0,pos==='z'?1:0,s[vel],config.softness);s[vel]=config.wallBounce?-Math.abs(s[vel])*.88:s[vel]*-restitution;}}
    else if(s[pos]<-bound&&!((config.flowThrough||config.repeatFlight)&&pos==='y')){s[pos]=-bound;if(s[vel]<0){balloonImpact(s,pos==='x'?1:0,pos==='y'?1:0,pos==='z'?1:0,-s[vel],config.softness);s[vel]=config.wallBounce?Math.abs(s[vel])*.88:s[vel]*-restitution;}}
   }
  }
  }
  if(config.wallBounce)for(const p of ps){const fit=wallPose(config,p,this.width,this.height,r);p.x=fit.x;p.y=fit.y;}
 }
 snapshot(){return {wallActive:this.wallActive,holdActive:this.holdActive,sourceCount:this.sourceCount,repeatActive:this.repeatActive,flightSpan:this.flightSpan,spacingOverflowX:this.spacingOverflowX,spacingOverflowY:this.spacingOverflowY,rotationSelectionRound:this.rotationSelectionRound,letterSpacing:this.letterSpacing,lineSpacing:this.lineSpacing,flowActive:!!this.flowActive,width:this.width,height:this.height,time:this.time,motionTime:this.motionTime,rotationTimeline:this.rotationTimeline,layout:this.layout,particles:this.particles.map(s=>({...s}))};}
 restore(s){Object.assign(this,s,{particles:s.particles.map(p=>({...p}))});}
}
const api={particleScale,wallPose,STEP,defaults,ranges,colors,validateConfig,letters,rgb,mixColor,interpolate,radius,hitTest,moveParticle,sampleSegment,rotatingIndices,rotationProfile,rotationRate,World};
root.BalloonEngine=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
