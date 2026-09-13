/* Deterministic shared-space simulation. No browser or rendering dependency. */
(function(root){
'use strict';
const STEP=1/120;
const defaults={float:32,speed:28,rotation:30,rotationShare:30,size:20,typeSize:135,weight:500,font:'pretendard',visible:true,openTop:false,flowThrough:false,collision:true,bounce:38,softness:35,windTop:0,windBottom:6,windLeft:0,windRight:0,hold:false,letterSpacing:0,lineSpacing:0,layout:'text',color:'#d9ff96',ink:'#211c19',background:'#ffffff'};
const ranges={letterSpacing:[0,300],lineSpacing:[0,300],float:[0,100],speed:[0,100],rotation:[0,100],rotationShare:[0,100],size:[20,600],typeSize:[1,220],weight:[100,900],bounce:[0,100],softness:[0,100],windTop:[0,100],windBottom:[0,100],windLeft:[0,100],windRight:[0,100]};
const colors=['color','ink','background'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function validateConfig(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('설정 형식을 확인해주세요.');
 const out={...defaults};
 for(const [key,value]of Object.entries(input)){
  if(key==='accent')continue; // Older saved projects remain readable.
  if(!Object.prototype.hasOwnProperty.call(defaults,key))throw Error('알 수 없는 설정입니다: '+key);
  if(ranges[key]){const [a,b]=ranges[key];if(typeof value!=='number'||!Number.isFinite(value)||value<a||value>b)throw Error('설정 범위를 확인해주세요: '+key);}
  else if(colors.includes(key)){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw Error('색상 형식을 확인해주세요.');}
  else if(['visible','collision','hold','openTop','flowThrough'].includes(key)){if(typeof value!=='boolean')throw Error('켜기/끄기 설정을 확인해주세요.');}
  else if(key==='layout'&&!['text','row','column','grid','circle','diagonal','zigzag','rings'].includes(value))throw Error('정렬 방식을 확인해주세요.');
  else if(key==='font'&&!['gothic','serif','rounded','mono','brush','custom','google','pretendard'].includes(value))throw Error('폰트를 확인해주세요.');
  out[key]=value;
 }
 return out;
}
function letters(text){
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
 if(t>=b.time-1e-8)for(const key of ['font','visible','collision','hold','openTop','flowThrough','layout'])out[key]=b.config[key];
 return out;
}
function radius(config,w,h,n){
 let limit=Math.max(10,Math.min(w,h)/2-32);
 if(config.collision&&n>1){let packing=0;for(let cols=1;cols<=n;cols++){const rows=Math.ceil(n/cols);packing=Math.max(packing,Math.min((w-60)/(cols*2.24),(h-60)/(rows*2.24)));}limit=Math.min(limit,packing);}
 return Math.min(52*config.size/100,limit);
}
// Orthographic hit testing uses the front surface depth, not array order.
function hitTest(world,config,x,y){
 const r=radius(config,world.width,world.height,world.particles.length);let hit=-1,front=-Infinity;
 for(const p of world.particles){const d2=(p.x-x)**2+(p.y-y)**2;if(d2>r*r)continue;const z=p.z+Math.sqrt(r*r-d2);if(z>front){front=z;hit=p.index;}}
 return hit;
}
function moveParticle(world,config,index,x,y){
 const p=world.particles[index];if(!p)return;const r=radius(config,world.width,world.height,world.particles.length);
 const bx=Math.max(0,world.width/2-r-24),by=Math.max(0,world.height/2-r-24);
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
 p.squashVelocity=Math.min(2.8,(p.squashVelocity||0)+speed*.023*softness/100);
}
class World{
 constructor(text,width,height,config){this.width=width;this.height=height;this.time=0;this.motionTime=0;this.rotationTimeline=0;this.layout=config.layout;this.particles=letters(text).map(s=>({...s,x:0,y:0,z:0,vx:0,vy:0,vz:0,spin:0}));this.arrange(config);}
 arrange(config){
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
   const stepX=Math.min(r*2.35+config.letterSpacing,(w-margin*2)/Math.max(1,...Array.from(rows.values(),v=>v-1))),stepY=Math.min(r*2.35+config.lineSpacing,(h-margin*2)/Math.max(1,rowCount-1));
   targets=targets.map(p=>({x:(p.col-(rows.get(p.row)-1)/2)*stepX,y:((rowCount-1)/2-p.row)*stepY}));
  }
  if(['circle','rings','diagonal','zigzag'].includes(config.layout))targets=targets.map(p=>({x:p.x*(1+config.letterSpacing/(r*2.35)),y:p.y*(1+config.lineSpacing/(r*2.35))}));
  this.letterSpacing=config.letterSpacing;this.lineSpacing=config.lineSpacing;
  ps.forEach((s,i)=>{s.pinned=false;delete s.anchor;s.x=targets[i].x;s.y=targets[i].y;s.z=0;s.tx=s.x;s.ty=s.y;s.vx=0;s.vy=0;s.vz=0;s.spin=0;s.turn=0;s.rotationClock=0;s.turnStart=null;s.turnDuration=0;s.turnDirection=1;s.turnReadyAt=0;s.lastTurnStart=-1;s.squash=0;s.squashVelocity=0;});
  this.flowActive=!!config.flowThrough;
  if(config.flowThrough&&ps.length){const highest=ps.reduce((v,p)=>Math.max(v,p.y),-Infinity);const shift=highest+h/2+r*1.2+12;for(const p of ps){p.y-=shift;p.ty=p.y;p.vy=60;}}
 }
 respace(config){
  const old=this.particles.map(p=>({...p}));this.arrange(config);
  this.particles.forEach((p,i)=>{const tx=p.tx,ty=p.ty;Object.assign(p,old[i]);p.x+=tx-old[i].tx;p.y+=ty-old[i].ty;p.tx=tx;p.ty=ty;});
 }
 step(dt,config){
  if(this.letterSpacing!==config.letterSpacing||this.lineSpacing!==config.lineSpacing)this.respace(config);
  if(!!config.flowThrough!==!!this.flowActive){if(config.flowThrough)this.arrange(config);else this.flowActive=false;}
  if(config.layout!==this.layout)this.arrange(config);
  this.time+=dt;const d=dt*config.speed/40;if(d===0)return;
  this.motionTime+=d;
  const t=this.motionTime,ps=this.particles,r=radius(config,this.width,this.height,ps.length),amp=config.float/100;
  this.rotationTimeline=(this.rotationTimeline||0)+d*config.rotation/100*2;
  const clock=this.rotationTimeline;
  // Each selected balloon keeps its own full-turn clock, even as visibility changes.
  for(const p of ps){
   if(p.turnStart!=null){const u=clamp((clock-p.turnStart)/p.turnDuration,0,1);p.turn=p.turnDirection*Math.PI*2*(u*u*u*(u*(u*6-15)+10));
    if(u>=1){p.turnStart=null;p.turnReadyAt=clock+.4;}
   }
  }
  const selectionRound=Math.floor(clock/.4);
  if(config.rotation>0&&config.rotationShare>0&&selectionRound!==this.rotationSelectionRound){
   this.rotationSelectionRound=selectionRound;
   const visible=ps.filter(p=>!p.pinned&&p.x>=-this.width/2&&p.x<=this.width/2&&p.y>=-this.height/2&&p.y<=this.height/2);
   const target=rotatingIndices(visible.length,config.rotationShare,selectionRound).size;
   const active=visible.filter(p=>p.turnStart!=null).length;
   const candidates=visible.filter(p=>p.turnStart==null&&clock>=(p.turnReadyAt||0)).sort((a,b)=>(a.lastTurnStart??-1)-(b.lastTurnStart??-1)||rotationRandom(a.index,selectionRound+99)-rotationRandom(b.index,selectionRound+99));
   for(const p of candidates.slice(0,Math.max(0,target-active))){p.turnStart=clock;p.lastTurnStart=clock;p.turnDuration=3.4+rotationRandom(p.index,selectionRound*13+202)*2.2;p.turnDirection=rotationRandom(p.index,selectionRound*13+203)<.5?-1:1;p.turn=0;}
  }
  const ax=(config.windLeft-config.windRight)*2.3,ay=(config.windBottom-config.windTop)*2.3+((config.openTop||config.flowThrough)?30:0);
  for(const s of ps){
   if(s.pinned){s.vx=s.vy=s.vz=0;continue;}
   const anchor=Number.isInteger(s.anchor)?ps[s.anchor]:null;
   if(anchor){s.vx+=(anchor.x+s.offsetX-s.x)*1.1*d;s.vy+=(anchor.y+s.offsetY-s.y)*1.1*d;s.vz+=(anchor.z+s.offsetZ-s.z)*1.1*d;}
   const p=s.index*2.399;
   let q=s.squash||0,sv=s.squashVelocity||0;
   sv+=(-105*q-6.5*sv)*d;q+=sv*d;
   if(q>.14){q=.14;sv=Math.min(0,sv);}if(q<-.06){q=-.06;sv=Math.max(0,sv);}
   s.squash=q;s.squashVelocity=sv;
   s.vx+=(ax+(Math.sin(t*.64+p)*30+Math.sin(t*1.27+p)*12)*amp+(config.hold?(s.tx-s.x)*2.8:0))*d;
   s.vy+=(ay+(Math.sin(t*1.75+p)*100+Math.sin(t*3.5+p*2)*28+Math.cos(t*.39+p)*18)*amp+(config.hold&&!config.openTop&&!config.flowThrough?(s.ty-s.y)*2.8:0))*d;
   s.vz+=(Math.sin(t*.63+p)*amp*20-s.z*.32)*d;
   const damp=Math.exp(-.52*d);s.vx*=damp;s.vy*=damp;s.vz*=damp;
   const speed=Math.hypot(s.vx,s.vy,s.vz);if(speed>380){s.vx*=380/speed;s.vy*=380/speed;s.vz*=380/speed;}
   s.x+=s.vx*d;s.y+=s.vy*d;s.z+=s.vz*d;s.spin*=Math.exp(-1.6*d);
  }
  // Resolve screen-space contacts so depth cannot hide overlapping silhouettes.
  for(let iteration=0;iteration<(config.collision?10:1);iteration++){
  const pairs=[];
  if(config.collision){const cells=new Map(),cellSize=Math.max(.001,r*2.1);
   for(let i=0;i<ps.length;i++){const x=Math.floor(ps[i].x/cellSize),y=Math.floor(ps[i].y/cellSize);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of cells.get((x+dx)+','+(y+dy))||[])pairs.push([j,i]);
    const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
   }
  }
  for(const [i,j] of pairs){
   const a=ps[i],b=ps[j];const wa=a.pinned?0:1,wb=b.pinned?0:1,total=wa+wb;if(!total)continue;let dx=b.x-a.x,dy=b.y-a.y,dz=0;let distance=Math.hypot(dx,dy);
   if(distance>=r*2.1)continue;
   if(distance<1e-6){dx=Math.cos(i+j);dy=Math.sin(i+j);dz=0;distance=Math.hypot(dx,dy);}
   const nx=dx/distance,ny=dy/distance,nz=dz/distance,penetration=(r*2.1-distance)*.51;
   a.x-=nx*penetration*2*wa/total;a.y-=ny*penetration*2*wa/total;a.z-=nz*penetration*2*wa/total;b.x+=nx*penetration*2*wb/total;b.y+=ny*penetration*2*wb/total;b.z+=nz*penetration*2*wb/total;
   const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny+(b.vz-a.vz)*nz;
   if(relative<0){balloonImpact(a,nx,ny,nz,-relative,config.softness);balloonImpact(b,nx,ny,nz,-relative,config.softness);const impulse=-(1.3+config.bounce/100*.65)*relative/total;
    a.vx-=impulse*nx*wa;a.vy-=impulse*ny*wa;a.vz-=impulse*nz*wa;b.vx+=impulse*nx*wb;b.vy+=impulse*ny*wb;b.vz+=impulse*nz*wb;
    a.spin=clamp(a.spin+impulse*.006,-.7,.7);b.spin=clamp(b.spin-impulse*.006,-.7,.7);
   }
  }
  for(const s of ps){
   const bx=Math.max(0,this.width/2-r-24),by=Math.max(0,this.height/2-r-24),bz=Math.max(35,r*.8);const restitution=.4+config.bounce/100*.55;
   for(const [pos,vel,bound]of [['x','vx',bx],['y','vy',by],['z','vz',bz]]){
    if(s[pos]>bound&&!((config.openTop||config.flowThrough)&&pos==='y')){s[pos]=bound;if(s[vel]>0){balloonImpact(s,pos==='x'?1:0,pos==='y'?1:0,pos==='z'?1:0,s[vel],config.softness);s[vel]*=-restitution;}}
    else if(s[pos]<-bound&&!(config.flowThrough&&pos==='y')){s[pos]=-bound;if(s[vel]<0){balloonImpact(s,pos==='x'?1:0,pos==='y'?1:0,pos==='z'?1:0,-s[vel],config.softness);s[vel]*=-restitution;}}
   }
  }
  }
 }
 snapshot(){return {rotationSelectionRound:this.rotationSelectionRound,letterSpacing:this.letterSpacing,lineSpacing:this.lineSpacing,flowActive:!!this.flowActive,width:this.width,height:this.height,time:this.time,motionTime:this.motionTime,rotationTimeline:this.rotationTimeline,layout:this.layout,particles:this.particles.map(s=>({...s}))};}
 restore(s){Object.assign(this,s,{particles:s.particles.map(p=>({...p}))});}
}
const api={STEP,defaults,ranges,colors,validateConfig,letters,rgb,mixColor,interpolate,radius,hitTest,moveParticle,sampleSegment,rotatingIndices,rotationProfile,rotationRate,World};
root.BalloonEngine=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
