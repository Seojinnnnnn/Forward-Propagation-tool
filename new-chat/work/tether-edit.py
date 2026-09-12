from pathlib import Path
p=Path('dist/app.js');s=p.read_text()
s=s.replace('const char=gesture.chars[gesture.added%gesture.chars.length];', 'if(gesture.added>=gesture.chars.length)return false;\n const char=gesture.chars[gesture.added];')
s=s.replace('E.moveParticle(world,state,letter.index,point.x,point.y);selected=letter.index;', '''E.moveParticle(world,state,letter.index,point.x,point.y);
 const added=world.particles[letter.index];
 if(gesture.added===0){gesture.anchor=letter.index;added.pinned=true;}
 else{const root=world.particles[gesture.anchor];added.anchor=gesture.anchor;added.offsetX=added.x-root.x;added.offsetY=added.y-root.y;added.offsetZ=added.z-root.z;}
 selected=letter.index;''')
s=s.replace('드래그한 경로에 위 글자를 반복해서 추가해요. Escape로 취소할 수 있어요.', '첫 구는 고정되고 이어진 구들이 흔들려요. 입력한 글자를 한 번만 생성하며, 손을 떼면 다시 그릴 수 있어요.')
s=s.replace("+' 이 배치에서 타임라인과 영상이 시작돼요.'", "+' 첫 구는 고정했어요. 손을 떼고 다시 그리면 글자가 처음부터 생성돼요.'")
s=s.replace('E.moveParticle(sim,config,i,point.x*width,point.y*height);', 'E.moveParticle(sim,config,i,point.x*width,point.y*height);p.pinned=!!point.pinned;p.anchor=point.anchor??undefined;p.offsetX=(point.offsetX||0)*width;p.offsetY=(point.offsetY||0)*height;p.offsetZ=(point.offsetZ||0)*Math.max(width,height);')
s=s.replace('z:p.z/Math.max(width,height)}', 'z:p.z/Math.max(width,height),pinned:!!p.pinned,anchor:p.anchor??null,offsetX:(p.offsetX||0)/width,offsetY:(p.offsetY||0)/height,offsetZ:(p.offsetZ||0)/Math.max(width,height)}')
needle="for(const point of origin.points)if(!point||['x','y','z'].some"
s=s.replace(needle,"for(const [index,point]of origin.points.entries()){if(point?.pinned!==undefined&&typeof point.pinned!=='boolean')throw Error('고정 설정을 확인해주세요.');if(point?.anchor!==undefined&&point.anchor!==null&&(!Number.isInteger(point.anchor)||point.anchor<0||point.anchor>=index||!origin.points[point.anchor].pinned))throw Error('풍선 연결을 확인해주세요.');for(const key of ['offsetX','offsetY','offsetZ'])if(point?.[key]!==undefined&&(typeof point[key]!=='number'||!Number.isFinite(point[key])||Math.abs(point[key])>1))throw Error('풍선 간격을 확인해주세요.');}\n for(const point of origin.points)if(!point||['x','y','z'].some")
p.write_text(s)
p=Path('dist/engine.js');s=p.read_text()
s=s.replace('p.tx=p.x;p.ty=p.y;p.vx=p.vy=p.vz=0;', 'p.tx=p.x;p.ty=p.y;p.vx=p.vy=p.vz=0;\n if(Number.isInteger(p.anchor)&&world.particles[p.anchor]){const root=world.particles[p.anchor];p.offsetX=p.x-root.x;p.offsetY=p.y-root.y;p.offsetZ=p.z-root.z;}')
s=s.replace('ps.forEach((s,i)=>{s.x=', 'ps.forEach((s,i)=>{s.pinned=false;delete s.anchor;s.x=')
s=s.replace('for(const s of ps){\n   const p=s.index', '''for(const s of ps){
   if(s.pinned){s.vx=s.vy=s.vz=0;continue;}
   const anchor=Number.isInteger(s.anchor)?ps[s.anchor]:null;
   if(anchor){s.vx+=(anchor.x+s.offsetX-s.x)*1.1*d;s.vy+=(anchor.y+s.offsetY-s.y)*1.1*d;s.vz+=(anchor.z+s.offsetZ-s.z)*1.1*d;}
   const p=s.index''')
s=s.replace('const a=ps[i],b=ps[j];let dx=', 'const a=ps[i],b=ps[j];const wa=a.pinned?0:1,wb=b.pinned?0:1,total=wa+wb;if(!total)continue;let dx=')
s=s.replace('a.x-=nx*penetration;a.y-=ny*penetration;a.z-=nz*penetration;b.x+=nx*penetration;b.y+=ny*penetration;b.z+=nz*penetration;', 'a.x-=nx*penetration*2*wa/total;a.y-=ny*penetration*2*wa/total;a.z-=nz*penetration*2*wa/total;b.x+=nx*penetration*2*wb/total;b.y+=ny*penetration*2*wb/total;b.z+=nz*penetration*2*wb/total;')
s=s.replace('*relative*.5;', '*relative/total;').replace('a.vx-=impulse*nx;a.vy-=impulse*ny;a.vz-=impulse*nz;b.vx+=impulse*nx;b.vy+=impulse*ny;b.vz+=impulse*nz;', 'a.vx-=impulse*nx*wa;a.vy-=impulse*ny*wa;a.vz-=impulse*nz*wa;b.vx+=impulse*nx*wb;b.vy+=impulse*ny*wb;b.vz+=impulse*nz*wb;')
p.write_text(s)
p=Path('dist/index.html');s=p.read_text().replace('입력한 글자를 반복하며','입력한 글자를 한 번씩');p.write_text(s)
