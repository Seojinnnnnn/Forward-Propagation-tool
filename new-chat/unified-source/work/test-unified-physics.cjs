const E=require('../dist/engine.js'),assert=require('assert');
let c={...E.defaults,textMode:'words',wallBounce:true,depth:60,depthScale:90,size:450,softness:100},w=new E.World('어랏 어랏',720,900,c),lo=Infinity,hi=0;
for(let i=0;i<2400;i++){w.step(E.STEP,c);for(const p of w.particles){const pose=E.wallPose(c,p,720,900,E.radius(c,720,900,w.sourceCount)),a=1-(p.squash||0),t=1/a,d=a*a-t,rx=pose.radius*Math.sqrt(t+d*(p.squashAxisX||0)**2),ry=pose.radius*Math.sqrt(t+d*(p.squashAxisY===undefined?1:p.squashAxisY)**2);assert(Math.abs(pose.x)+rx<=360.001);assert(Math.abs(pose.y)+ry<=450.001);lo=Math.min(lo,pose.radius);hi=Math.max(hi,pose.radius);}}
assert(hi>lo*1.2);
c={...E.defaults,startMode:'filled',flowThrough:true,repeatFlight:true,collision:false,float:0};w=new E.World('가나',720,900,c);assert(w.particles.some(p=>Math.abs(p.y)<450));for(let i=0;i<1200;i++)w.step(E.STEP,c);const copy=new E.World('가나',720,900,c);copy.restore(w.snapshot());w.step(E.STEP,c);copy.step(E.STEP,c);assert.deepStrictEqual(w.snapshot(),copy.snapshot());
console.log('PASS depth-varying wall fit, prefilled continuous flow, deterministic replay');
