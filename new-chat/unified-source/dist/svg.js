/* Standalone vector snapshot. Glyph alpha contours are traced, never embedded as bitmaps. */
(function(root){
'use strict';
const num=n=>Number(n.toFixed(4)),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
function paperSize(resolution){const paper={'9933x14043':[841,1189],'7016x9933':[594,841],'4960x7016':[420,594],'3508x4960':[297,420],'2480x3508':[210,297]};if(paper[resolution])return paper[resolution];const p=paper[(resolution||'').split('x').reverse().join('x')];return p?[...p].reverse():null;}
function evaluate(points,t){let a=points.map(p=>[...p]);while(a.length>1)a=a.slice(1).map((p,i)=>p.map((v,j)=>a[i][j]*(1-t)+v*t));return a[0];}
function clip(poly,fn){const out=[];if(!poly.length)return out;let a=poly.at(-1),av=fn(a);for(const b of poly){const bv=fn(b);if((av>=0)!==(bv>=0)){const t=av/(av-bv);out.push(a.map((v,i)=>v+(b[i]-v)*t));}if(bv>=0)out.push(b);a=b;av=bv;}return out;}
function warpedLoop(loop,project){const pieces=[];
 function fit(curve,a,b,depth){const f=t=>project(evaluate(curve,t)),p=f(a),q=f(b),e=(b-a)*.0001,pa=f(a+e),qb=f(b-e),c1=p.slice(0,2).map((v,i)=>v+(pa[i]-v)/.0003),c2=q.slice(0,2).map((v,i)=>v-(v-qb[i])/.0003),controls=[p.slice(0,2),c1,c2,q.slice(0,2)];
  const error=Math.max(...[.25,.5,.75].map(t=>{const x=f(a+(b-a)*t),y=evaluate(controls,t);return Math.hypot(x[0]-y[0],x[1]-y[1]);}));
  if(depth<12&&(error>.035||Math.abs(b-a)>.125)){const m=(a+b)/2;fit(curve,a,m,depth+1);fit(curve,m,b,depth+1);}else pieces.push({controls,p,q});
 }for(const curve of loop)fit(curve,0,1,0);return pieces;
}
function build({world,config:c,engine:E,outlineCurves,overrides={},inkOverrides={},gradientStops,resolution,transparent=false}){
 const W=world.width,H=world.height,defs=['<clipPath id="page"><rect width="'+W+'" height="'+H+'"/></clipPath>'],parts=[],cache=new Map();
 const r=E.radius(c,W,H,world.sourceCount||world.particles.length),letterScale=r/(c.typeSizeReferenceRadius||10.4);
 function gradient(kind,id,cx,cy,rx,ry,fallback){
  return fallback;
 }
 if(!transparent)parts.push('<rect width="'+W+'" height="'+H+'" fill="'+gradient('background','bg',W/2,H/2,W/2,H/2,c.background)+'"/>');
 for(const [idx,s] of [...world.particles].sort((a,b)=>a.z-b.z).entries()){
  const pose=c.wallBounce?E.wallPose(c,s,W,H,r):{x:s.x,y:s.y,z:s.z,radius:r*E.particleScale(c,s)},R=pose.radius;
  const cx=W/2+pose.x,cy=H/2-pose.y,q=c.softness===0?0:(s.squash||0),axial=1-q,trans=1/Math.sqrt(axial),axis=[s.squashAxisX||0,s.squashAxisY===undefined?1:s.squashAxisY,s.squashAxisZ||0];
  const source=s.sourceIndex??s.index,profile=E.rotationProfile(s.index),turn=s.turn||0;
  const rotAxis=[s.turnAxisX??0,s.turnAxisY??1,s.turnAxisZ??0],len=Math.hypot(...rotAxis)||1;rotAxis.forEach((v,i)=>rotAxis[i]=v/len);
  if(c.visible){const t=trans*trans,d=axial*axial-t,xx=t+d*axis[0]**2,xy=-d*axis[0]*axis[1],yy=t+d*axis[1]**2,L=Math.sqrt(xx),M=xy/L,N=Math.sqrt(Math.max(0,yy-M*M));const k=.5522847498307936,point=(u,v)=>num(cx+R*L*u)+' '+num(cy+R*(M*u+N*v));const path='M'+point(1,0)+'C'+point(1,k)+' '+point(k,1)+' '+point(0,1)+'C'+point(-k,1)+' '+point(-1,k)+' '+point(-1,0)+'C'+point(-1,-k)+' '+point(-k,-1)+' '+point(0,-1)+'C'+point(k,-1)+' '+point(1,-k)+' '+point(1,0);parts.push('<path d="'+path+'Z" fill="'+gradient('sphere','sphere'+idx,cx,cy,R,R,overrides[source]||c.color)+'"/>');}
  function project(point){const u=(point[0]/1024-.5)/letterScale+.5,v=(point[1]/512-.5)/letterScale+.5,lon=(u-.5)*Math.PI*2,lat=(.5-v)*Math.PI;let p=[Math.sin(lon)*Math.cos(lat),Math.sin(lat),Math.cos(lon)*Math.cos(lat)];
   if(c.freeRotation){const [x,y,z]=p,[a,b,d]=rotAxis,C=Math.cos(turn),S=Math.sin(turn),D=dot(p,rotAxis);p=[x*C+(b*z-d*y)*S+a*D*(1-C),y*C+(d*x-a*z)*S+b*D*(1-C),z*C+(a*y-b*x)*S+d*D*(1-C)];}
   else{let [x,y,z]=p,a=Math.sin(turn)*profile.tilt,C=Math.cos(a),S=Math.sin(a);[y,z]=[C*y-S*z,S*y+C*z];C=Math.cos(turn);S=Math.sin(turn);[x,z]=[C*x+S*z,-S*x+C*z];a=Math.sin(turn)*profile.roll;C=Math.cos(a);S=Math.sin(a);p=[C*x-S*y,S*x+C*y,z];}
   const D=dot(p,axis),normal=p[2]/trans+(1/axial-1/trans)*D*axis[2];return [cx+R*(p[0]*trans+(axial-trans)*D*axis[0]),cy-R*(p[1]*trans+(axial-trans)*D*axis[1]),normal,u,v];
  }
  let lettering='';
  for(const loop of outlineCurves.get(s.char)||[]){const pieces=warpedLoop(loop,project);if(!pieces.length)continue;
   const pts=pieces.map(p=>p.p),valid=p=>p[3]>=0&&p[3]<=1&&p[4]>=0&&p[4]<=1;
   if(pts.every(valid)&&(!c.visible||pts.every(p=>p[2]>=0))){lettering+='M'+pieces[0].p.slice(0,2).map(num).join(' ')+pieces.map(p=>'C'+p.controls.slice(1).map(p=>p.map(num).join(' ')).join(' ')).join('')+'Z';}
   else {let poly=clip(clip(clip(clip(pts,p=>p[3]),p=>1-p[3]),p=>p[4]),p=>1-p[4]);if(c.visible)poly=clip(poly,p=>p[2]);if(poly.length>2)lettering+=poly.map((p,i)=>(i?'L':'M')+num(p[0])+' '+num(p[1])).join('')+'Z';}
  }
  if(lettering)parts.push('<path fill="'+(inkOverrides[source]||c.ink)+'" fill-rule="nonzero" d="'+lettering+'"/>');
 }

 const mm=paperSize(resolution)||[W/96*25.4,H/96*25.4];
 return '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="'+(mm?mm[0]+'mm':W)+'" height="'+(mm?mm[1]+'mm':H)+'" viewBox="0 0 '+W+' '+H+'"><title>Balloon typography — vector snapshot</title><desc>RGB vector artwork. Typography from font outlines, adaptively projected to the sphere; sphere silhouettes use four cubic Bezier segments.</desc><defs>'+defs.join('')+'</defs><g clip-path="url(#page)">'+parts.join('')+'</g></svg>';
}
const api={build,paperSize};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.BalloonSVG=api;
})(typeof globalThis!=='undefined'?globalThis:this);
