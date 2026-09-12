const assert=require('node:assert/strict');
const fs=require('fs');
const E=require('../dist/engine.js'),X=require('../dist/export.js');
const base={...E.defaults,float:0,rotation:0,hold:false};
const evolve=(world,config,seconds)=>{for(let i=0;i<seconds/E.STEP;i++)world.step(E.STEP,config);return world;};
assert.equal(E.letters('오류 페스티벌').length,6);
assert.equal(E.letters('가 👨‍👩‍👧‍👦\n나').length,3);
for(const name of ['text','row','column','grid','circle']){
 const w=new E.World('오류 페스티벌',1280,720,{...base,layout:name});
 assert(w.particles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 if(name==='row')assert(w.particles.every(p=>p.y===0));
 if(name==='column')assert(w.particles.every(p=>p.x===0));
 if(name==='circle')assert(w.particles.every(p=>Math.abs(Math.hypot(p.x,p.y)-720*.36)<1e-8));
}
for(const [direction,axis,sign]of [['windLeft','x',1],['windRight','x',-1],['windTop','y',-1],['windBottom','y',1]]){
 const c={...base,[direction]:70},w=evolve(new E.World('가',1280,720,c),c,1);
 assert(w.particles[0][axis]*sign>30,direction);
}
const balanced={...base,windTop:60,windBottom:60,windLeft:40,windRight:40};
const quiet=evolve(new E.World('가',1280,720,balanced),balanced,1);
assert(Math.abs(quiet.particles[0].x)<1e-10&&Math.abs(quiet.particles[0].y)<1e-10);
const collide={...base,collision:true,bounce:100};
const w=new E.World('가나',1280,720,collide);w.particles[0].x=-50;w.particles[1].x=50;w.particles[0].vx=80;w.particles[1].vx=-80;
w.step(E.STEP,collide);
assert(w.particles[0].vx<0&&w.particles[1].vx>0,'Head-on collision must exchange momentum');
assert(Math.abs(w.particles[0].vx+w.particles[1].vx)<1e-8);
assert(Math.hypot(w.particles[1].x-w.particles[0].x,w.particles[1].y-w.particles[0].y,w.particles[1].z-w.particles[0].z)>=104-.1);
const c2={...collide,collision:false};const no=new E.World('가나',1280,720,c2);no.particles[0].x=-50;no.particles[1].x=50;no.particles[0].vx=80;no.particles[1].vx=-80;no.step(E.STEP,c2);assert(no.particles[0].vx>0);
const wind={...E.defaults,windLeft:100,windTop:75};
const a=evolve(new E.World('첨단주간 오류 페스티벌',1280,720,wind),wind,12),b=evolve(new E.World('첨단주간 오류 페스티벌',1280,720,wind),wind,12);
assert.deepEqual(a.snapshot(),b.snapshot(),'Fixed-step simulation must be repeatable');
const r=E.radius(wind,1280,720,a.particles.length);for(const p of a.particles){assert(Math.abs(p.x)<=640-r-24+1e-7);assert(Math.abs(p.y)<=360-r-24+1e-7);assert(Object.values(p).filter(v=>typeof v==='number').every(Number.isFinite));}
const keys=[{time:0,config:{...base,color:'#000000',windLeft:0}},{time:4,config:{...base,color:'#ffffff',windLeft:100,font:'serif'}}];
assert.equal(E.interpolate(keys,2,base).color,'#808080');assert.equal(E.interpolate(keys,2,base).windLeft,50);assert.equal(E.interpolate(keys,2,base).font,'gothic');assert.equal(E.interpolate(keys,4,base).font,'serif');
assert.throws(()=>E.validateConfig({size:999}));assert.throws(()=>E.validateConfig({windLeft:NaN}));assert.throws(()=>E.validateConfig({color:'red'}));assert.throws(()=>E.validateConfig({collision:'yes'}));
assert.equal(X.crc32(new TextEncoder().encode('123456789')),0xcbf43926);
(async()=>{const zip=new X.ZipWriter();await zip.add('frame_00000.png',new Blob([new Uint8Array([137,80,78,71])]));await zip.add('sequence.json',new Blob(['{"fps":30}']));fs.writeFileSync('work/test-frames.zip',Buffer.from(await zip.finish().arrayBuffer()));console.log('PASS: graphemes, five layouts, four winds, opposed winds, collision impulses, collision toggle, boundaries, repeatability, keyframe interpolation, validation, ZIP CRC.');})();
