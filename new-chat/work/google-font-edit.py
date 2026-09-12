from pathlib import Path
p=Path('dist/index.html');s=p.read_text();needle='<label class="file-label">내 폰트 불러오기';s=s.replace(needle,'''<label class="range-label" for="google-family">Google Fonts 연결</label><div class="inline"><input id="google-family" type="text" list="google-font-list" placeholder="예: Noto Sans KR" maxlength="80" aria-label="Google Fonts 폰트 이름"><button id="google-connect">연결</button></div><datalist id="google-font-list"><option value="Noto Sans KR"><option value="Noto Serif KR"><option value="Gowun Dodum"><option value="Gowun Batang"><option value="Black Han Sans"><option value="Jua"></datalist><p class="hint">영문 폰트 이름을 입력하세요. 온라인 연결이 필요해요.</p>
<label class="file-label">외부 폰트 파일 불러오기''');p.write_text(s)
p=Path('dist/style.css');p.write_text(p.read_text()+'\n#google-family{width:100%;min-width:0;font:inherit;font-size:14px;padding:9px 8px;border:1px solid #d1d3c8;border-radius:5px;background:white}.inline #google-connect{flex-shrink:0}\n')
p=Path('dist/engine.js');s=p.read_text().replace("'brush','custom'].includes(value)","'brush','custom','google'].includes(value)");p.write_text(s)
p=Path('dist/app.js');s=p.read_text().replace('let exportController=null;', 'let googleFont=null,googleLink=null,fontBusy=false;\nlet exportController=null;')
idx=s.index('async function installFont(')
s=s[:idx]+'''function validGoogleFamily(name){return typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9 -]{0,79}$/.test(name);}
function fontSample(){return Array.from(new Set(textValue()+$('brush-text').value+'가나다ABC')).join('');}
async function loadGoogleFont(family){
 if(!validGoogleFamily(family))throw Error('Google Fonts의 영문 폰트 이름을 입력해주세요.');
 const link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(family)+'&display=swap';
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('폰트 연결 시간이 초과됐어요. 네트워크를 확인해주세요.')),15000);link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);reject(Error('폰트를 찾지 못했어요. 이름과 인터넷 연결을 확인해주세요.'));};document.head.append(link);});
  const loaded=await Promise.race([document.fonts.load('400 32px '+JSON.stringify(family),fontSample()),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('폰트 다운로드 시간이 초과됐어요.')),20000);document.fonts.ready.finally(()=>clearTimeout(timer));})]);
  if(!loaded.length)throw Error('이름에 해당하는 폰트를 불러오지 못했어요.');
  googleLink?.remove();googleLink=link;googleFont={family};fonts.google=JSON.stringify(family)+', sans-serif';
  let option=$('font').querySelector('option[value="google"]');if(!option){option=document.createElement('option');option.value='google';$('font').append(option);}option.textContent=family+' · Google';$('google-family').value=family;renderer?.clearTextures();
 }catch(e){link.remove();throw e;}
}
async function applyGoogle(){if(fontBusy||exporting)return;fontBusy=true;$('google-connect').disabled=true;$('google-connect').textContent='연결 중';try{await loadGoogleFont($('google-family').value.trim());state.font='google';edited();$('font-note').textContent=googleFont.family+' · Google Fonts 연결됨';notice('Google 폰트를 적용했어요. 설정 파일에는 연결 이름이 저장돼요.');}catch(e){notice(e.message,true);}finally{fontBusy=false;$('google-connect').disabled=false;$('google-connect').textContent='연결';}}
$('google-connect').onclick=applyGoogle;$('google-family').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyGoogle();}});
function refreshGoogleGlyphs(){if(!googleFont)return;document.fonts.load('400 32px '+JSON.stringify(googleFont.family),fontSample()).then(()=>renderer?.clearTextures()).catch(()=>notice('추가 글자의 폰트를 불러오지 못했어요. 인터넷 연결을 확인해주세요.',true));}
''' +s[idx:]
s=s.replace('function onText(){initialPositions=', 'function onText(){refreshGoogleGlyphs();initialPositions=')
s=s.replace("$('font-file').onchange=async()=>{const file=", "$('font-file').onchange=async()=>{if(fontBusy||exporting)return;const file=")
s=s.replace('fps:Number($(\'fps\').value),customFont,','fps:Number($(\'fps\').value),customFont,googleFont,')
s=s.replace("p.config=E.validateConfig(p.config);", "if(p.googleFont!==undefined&&p.googleFont!==null&&(!p.googleFont||!validGoogleFamily(p.googleFont.family)))throw Error('Google 폰트 정보를 확인해주세요.');\n p.config=E.validateConfig(p.config);")
s=s.replace("if(!p.customFont&&(p.config.font==='custom'", "if(!p.googleFont&&(p.config.font==='google'||p.keyframes.some(k=>k.config.font==='google')))throw Error('Google 폰트 연결 정보가 빠져 있어요.');\n if(!p.customFont&&(p.config.font==='custom'")
s=s.replace("const p=validateProject(JSON.parse(await file.text()));if(p.customFont)", "const p=validateProject(JSON.parse(await file.text()));if(p.googleFont)await loadGoogleFont(p.googleFont.family);if(p.customFont)")
s=s.replace('if(!renderer||exporting||gesture)return;', "if(fontBusy){notice('폰트 연결이 끝난 뒤 저장해주세요.',true);return;}if(!renderer||exporting||gesture)return;")
s=s.replace('await document.fonts.ready;\n  if(kind', "if(googleFont)await document.fonts.load('400 32px '+JSON.stringify(googleFont.family),fontSample());\n  await document.fonts.ready;\n  if(kind")
s=s.replace("if(next.font==='custom'&&!customFont)","if(next.font==='google'&&!googleFont)throw Error('먼저 Google 폰트를 연결해주세요.');if(next.font==='custom'&&!customFont)")
p.write_text(s)
