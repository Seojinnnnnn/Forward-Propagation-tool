(function(root){
const cache=new Map();
async function load({config,customFont,googleFont,text}){
 let url;
 if(config.font==='pretendard')url='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/variable/PretendardVariable.ttf';
 else if(config.font==='custom'&&customFont)url=customFont.data;
 else if(config.font==='google'&&googleFont){const q='https://fonts.googleapis.com/css2?family='+encodeURIComponent(googleFont.family)+':wght@'+Math.round(config.weight)+'&text='+encodeURIComponent([...new Set(text)].join(''));const response=await fetch(q);if(!response.ok)throw Error('Google 폰트 윤곽을 불러오지 못했어요. 같은 폰트의 TTF·OTF를 불러와주세요.');const css=await response.text();url=css.match(/src:\s*url\(([^)]+)\)/)?.[1];}
 else throw Error('이 기기 폰트의 윤곽을 읽으려면 같은 폰트의 OTF·TTF 파일을 불러와주세요. Pretendard도 사용할 수 있어요.');
 if(!url)throw Error('폰트 파일 주소를 찾지 못했어요.');
 if(!cache.has(url)){const res=await fetch(url);if(!res.ok)throw Error('폰트 파일 다운로드에 실패했어요.');cache.set(url,fontkit.create(new Uint8Array(await res.arrayBuffer())));}
 let font=cache.get(url);if(font.variationAxes?.wght)font=font.getVariation({wght:config.weight});
 try{font.layout(text.replace(/\s/g,''));}catch(e){throw Error('이 압축 폰트의 가변 윤곽을 읽지 못했어요. 같은 폰트의 TTF·OTF 파일을 불러와주세요.');}
 return font;
}
function curves(text,c,font){
 const measure=str=>font.layout(str).glyphs.reduce((sum,g)=>sum+g.advanceWidth,0)/font.unitsPerEm;
 const lines=text.split(/\r?\n/),base=c.textMode==='letters'?Math.round(c.typeSize*4/3):c.typeSize*4/3;
 const size=c.textMode==='letters'?Math.min(base,500/Math.max(.001,measure(text))):base*Math.min(1,900/Math.max(1,...lines.map(l=>measure(l)*base)),400/(lines.length*base*1.2));
 const scale=size/font.unitsPerEm,tracking=c.textMode==='letters'?0:c.typeTracking||0,leading=c.typeLeading||0,all=[];
 lines.forEach((line,i)=>{
  const run=font.layout(line);if(run.glyphs.some(g=>g.id===0&&g.codePoints?.some(n=>n>32)))throw Error('폰트에 없는 글자가 있어요. 해당 글자를 지원하는 폰트를 불러와주세요.');
  let x=512-(measure(line)*size+Math.max(0,run.glyphs.length-1)*tracking)/2;
  let baseline=256+(i-(lines.length-1)/2)*(size*1.2+leading)+(font.ascent+font.descent)*scale/2;
  if(c.textMode==='letters'){const b=run.bbox;x=512-(b.minX+b.maxX)*scale/2;baseline=256+(b.minY+b.maxY)*scale/2;}
  run.glyphs.forEach((g,j)=>{const pos=run.positions[j],at=(a,k)=>[x+(a[k]+pos.xOffset)*scale,baseline-(a[k+1]+pos.yOffset)*scale];let loop=[],p,start;
   function add(points){loop.push(points);p=points.at(-1);}
   for(const cmd of g.path.commands){const a=cmd.args;
    if(cmd.command==='moveTo'){if(loop.length)all.push(loop);loop=[];p=at(a,0);start=p;}
    else if(cmd.command==='lineTo')add([p,at(a,0)]);
    else if(cmd.command==='quadraticCurveTo')add([p,at(a,0),at(a,2)]);
    else if(cmd.command==='bezierCurveTo')add([p,at(a,0),at(a,2),at(a,4)]);
    else if(cmd.command==='closePath'){if(p&&start&&(p[0]!==start[0]||p[1]!==start[1]))add([p,start]);if(loop.length)all.push(loop);loop=[];p=start;}
   }if(loop.length)all.push(loop);x+=g.advanceWidth*scale+tracking;
  });
 });return all;
}
const api={load,curves};root.BalloonFontOutline=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
