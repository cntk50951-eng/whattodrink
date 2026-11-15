/** UR M.1 — Faithful app UI compositions with curated demo photos and exact iOS copy.
 * node scripts/render-intro-artwork.mjs
 * No production data, no network, no changes to the original screenshots.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { featureBuilders } from './intro-feature-artwork.mjs';
import { cocktailTrailBuilders } from './intro-cocktail-trail-artwork.mjs';

const root = fileURLToPath(new URL('../public/intro-next/', import.meta.url));
const cocktailData = JSON.parse(await readFile(`${root}source-art/gin-fizz.json`, 'utf8'));
const labels = JSON.parse(await readFile(`${root}ios-ui-copy.json`, 'utf8'));
const imageData = async (file) => `data:image/jpeg;base64,${(await sharp(await readFile(file)).jpeg({ quality: 94 }).toBuffer()).toString('base64')}`;
const photo = await imageData(`${root}source-art/highball.png`);
const ivy = await imageData(`${root}source-art/ivy-bar.png`);
const cups = await imageData(`${root}captures/ivy-dice-cups.png`);
const peek = await imageData(`${root}captures/ivy-dice-peek.png`);
const C = { bg: '#0D0E12', card: '#15171D', soft: '#1D2028', line: '#37363a', ink: '#F4ECDD', muted: '#ABA595', amber: '#F5BC65', onAmber: '#2A1700' };
const demo = {
  'zh-Hant': { caption: '今晚，慢慢飲。', place: '香港 · 中環', highball: '威士忌 · Highball', demo: '功能展示 · 示範內容', name: '夜遊日記' },
  'zh-Hans': { caption: '今晚，慢慢喝。', place: '香港 · 中环', highball: '威士忌 · Highball', demo: '功能展示 · 示例内容', name: '夜游日记' },
  en: { caption: 'A little citrus. A good night.', place: 'Central · Hong Kong', highball: 'Whisky · Highball', demo: 'Product illustration · Demo content', name: 'Night Notes' },
};
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const widthOf = (s, size) => [...s].reduce((n,c)=>n+(c.charCodeAt(0)>255?1:.53),0)*size;
const txt = (x,y,text,size=14,fill=C.ink,weight=500,extra='',max=1000) => `<text x="${x}" y="${y}" fill="${fill}" font-size="${Math.min(size,max/Math.max(1,widthOf(text,1)))}" font-weight="${weight}" ${extra}>${esc(text)}</text>`;
const wrap = (x,y,text,size,maxWidth,fill=C.ink,weight=500,lineHeight=1.6) => {
  let lines=[],line='';
  for(const token of text.match(/[^\x00-\xff]|[A-Za-z0-9’.,:;!?%–—-]+\s*|./gu)||[]){if(widthOf(line+token,size)>maxWidth&&line){lines.push(line.trim());line=token;}else line+=token;}
  if(line)lines.push(line.trim());
  return lines.map((l,i)=>txt(x,y+i*size*lineHeight,l,size,fill,weight)).join('');
};
const rect = (x,y,w,h,fill=C.card,r=18,stroke='none') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const circle = (x,y,r,fill,stroke='none',sw=1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const path = (d,stroke=C.ink,sw=1.5,fill='none')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const icon = (name,x,y,size=20,color=C.ink) => {
 const shapes={close:'M5 5L19 19M19 5L5 19',back:'M15 4L7 12L15 20',camera:'M4 7H7L9 4H15L17 7H21V21H3V7ZM16 13A4 4 0 1 1 8 13A4 4 0 1 1 16 13',pin:'M18 9C18 16 12 21 12 21S6 16 6 9A6 6 0 0 1 18 9ZM14 9A2 2 0 1 1 10 9A2 2 0 1 1 14 9',image:'M3 3H21V21H3ZM3 17L9 11L15 17L18 14L21 17M17 8H17.1',wine:'M7 3H17L18 10Q18 15 12 15Q6 15 6 10ZM12 15V21M8 21H16',text:'M3 5H21M12 5V21M8 21H16',crop:'M6 2V18H22M2 6H18V22',filter:'M4 20L18 6M15 3L16 6L19 7L16 8L15 11L14 8L11 7L14 6ZM5 2V7M2.5 4.5H7.5',adjust:'M3 6H21M3 12H21M3 18H21M7 3V9M16 9V15M10 15V21',eye:'M2 12Q12 1 22 12Q12 23 2 12ZM15 12A3 3 0 1 1 9 12A3 3 0 1 1 15 12',mic:'M9 4A3 3 0 0 1 15 4V12A3 3 0 0 1 9 12ZM6 10V12A6 6 0 0 0 18 12V10M12 18V22M8 22H16',chat:'M3 4H21V17H10L5 21V17H3Z',heart:'M12 21L4 13C-2 6 7 0 12 7C17 0 26 6 20 13Z',bookmark:'M6 3H18V21L12 17L6 21Z',people:'M10 7A3 3 0 1 1 4 7A3 3 0 1 1 10 7M20 8A3 3 0 1 1 14 8A3 3 0 1 1 20 8M1 21V17Q7 11 13 17V21M13 15Q19 12 23 17V21',spark:'M12 2L14 9L21 12L14 15L12 22L9 15L2 12L9 9Z',arrow:'M5 12H20M14 6L20 12L14 18'};
 return `<g transform="translate(${x} ${y}) scale(${size/24})">${path(shapes[name]||shapes.spark,color,1.8)}</g>`;
};
const pic = (src,x,y,w,h,r=18,fromY=0) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><clipPath id="im-${x}-${y}">${rect(0,0,w,h,'white',r)}</clipPath></defs><image href="${src}" width="${w}" height="${h}" y="${fromY}" preserveAspectRatio="xMidYMid slice" clip-path="url(#im-${x}-${y})"/></svg>`;
const pill = (x,y,w,text,selected=false,size=12,h=33)=>rect(x,y,w,h,selected?'url(#brand)':C.soft,h/2,selected?'none':C.line)+txt(x+w/2,y+h*.66,text,size,selected?C.onAmber:C.ink,600,'text-anchor="middle"',w-14);
const button = (x,y,w,text)=>pill(x,y,w,text,true,18,51);
const die = (x,y,n,size=28,selected=false) => {
 const positions={1:[[12,12]],2:[[6,6],[18,18]],3:[[6,6],[12,12],[18,18]],4:[[6,6],[18,6],[6,18],[18,18]],5:[[6,6],[18,6],[12,12],[6,18],[18,18]],6:[[6,5],[18,5],[6,12],[18,12],[6,19],[18,19]]};
 return `<g transform="translate(${x} ${y}) scale(${size/24})">${rect(0,0,24,24,'url(#ivory)',5,selected?C.amber:'#b69b6d')}${positions[n].map(([a,b])=>circle(a,b,2.1,n===1?'#b53b30':'#291c12')).join('')}</g>`;
};
const top = (dark=true)=>rect(0,0,390,45,dark?'#0d0e12':'#17120ecc',0)+txt(27,30,'9:41',12,C.ink,700)+path('M319 24Q328 17 337 24M322 27Q328 22 334 27',C.ink,2)+rect(347,20,19,10,'none',3,C.ink)+rect(349,22,14,6,C.ink,1)+rect(367,23,2,4,C.ink,1);
const close=(x=34,y=73)=>circle(x,y,21,C.soft,C.line)+icon('close',x-9,y-9,18);
const back=(x=34,y=73)=>circle(x,y,21,C.soft,C.line)+icon('back',x-9,y-9,18);
const homeIndicator=()=>rect(149,829,92,4,C.ink,2);
const tag=(x,y,w,text)=>pill(x,y,w,text,false,11,28);
const cameraCorners=()=>path('M24 220V203H42M348 203H366V220M24 665V682H42M348 682H366V665',C.amber,2.2);
let used;
let language;
const t=(key,...args)=>{
 if(!labels[key]?.[language])throw new Error(`Missing iOS copy: ${key}/${language}`);
 used.add(key);let s=labels[key][language];
 for(const arg of args)s=s.replace(/%(?:\d+\$)?(?:lld|@)/,String(arg));
 return s.replaceAll('%%','%');
};
const mode=()=>rect(27,108,336,61,C.soft,31,C.line)+rect(199,111,160,55,'url(#brand)',28)+txt(279,136,t('share.mode.post'),16,C.onAmber,600,'text-anchor="middle"')+txt(112,136,t('share.mode.snapshot'),16,C.muted,600,'text-anchor="middle"',140)+txt(112,156,t('share.mode.snapshot.sub'),10,C.muted,500,'text-anchor="middle"')+txt(279,154,t('share.mode.post.sub'),10,C.onAmber,500,'text-anchor="middle"');
function camera(d){return top()+close()+txt(195,73,t('share.cam.title'),21,C.ink,700,'text-anchor="middle"',240)+mode()+txt(195,188,t('share.cam.note.post'),11,C.muted,500,'text-anchor="middle"',350)+pic(photo,12,200,366,507,23)+cameraCorners()+rect(87,636,216,32,'#161719d9',16)+icon('pin',97,643,17)+txt(195,657,d.place,12,C.ink,500,'text-anchor="middle"',170)+txt(36,692,t('share.flash.auto'),11)+txt(294,692,'0.5    1x    2.0',10)+circle(195,758,32,'url(#brand)',C.amber,3)+circle(195,758,26,'none',C.ink,1.5)+rect(27,735,38,38,C.soft,12)+icon('image',35,743,22)+rect(325,735,38,38,C.soft,12)+icon('camera',333,743,22);}
function editor(d){return pic(photo,0,45,390,662,0)+rect(0,45,390,105,'url(#topFade)',0)+top()+back()+pill(284,57,86,t('share.edit.next'),true,13,37)+txt(195,78,t('share.edit.title.editing'),12,C.ink,600,'text-anchor="middle"')+pill(107,108,176,`${t('share.mode.post')} · ${t('share.mode.post.sub')} · ${t('pubstep.who.opt.public')}`,false,10,27)+txt(195,506,d.caption,22,'#fff4dc',600,'text-anchor="middle"',340)+rect(0,636,390,160,'#0d0e12f0',0)+[ ['share.filter.none',photo],['share.filter.clear',photo],['share.filter.film',photo],['share.filter.mono',photo] ].map(([key,src],i)=>pic(src,28+i*91,647,64,57,9)+txt(60+i*91,719,t(key),10,i===2?C.amber:C.ink,500,'text-anchor="middle"',75)+(i===2?rect(207,645,68,61,'none',10,C.amber):'')).join('')+['filter','adjust','crop','text','tags','place'].map((key,i)=>icon(['filter','adjust','crop','text','wine','pin'][i],21+i*62,750,23,i===0?C.amber:C.ink)+txt(32+i*62,792,t(`share.edit.${key}`),9,i===0?C.amber:C.ink,500,'text-anchor="middle"',57)).join('');}
function preview(d){return top()+back()+txt(79,78,t('pubstep.preview'),16,C.ink,600)+pill(279,59,92,t('pubstep.expiry.forever'),false,11,31)+mode()+pic(photo,15,186,360,346,19)+txt(195,492,d.caption,21,'#fff6df',600,'text-anchor="middle"',330)+txt(20,554,t('pubstep.tags'),11,C.muted)+tag(113,536,247,d.highball)+rect(16,583,358,58,C.card,16,C.line)+icon('pin',30,601,20,C.amber)+txt(61,607,d.place,13,C.ink,600)+txt(61,628,t('pubstep.onmap'),10,C.muted)+txt(20,668,t('pubstep.who'),12,C.muted,600)+pill(17,681,113,t('pubstep.who.opt.public'),true,12,32)+pill(139,681,113,t('pubstep.who.opt.friends'),false,12,32)+pill(261,681,113,t('pubstep.who.opt.stealth'),false,12,32)+txt(195,741,t('pubstep.note.post'),11,C.muted,500,'text-anchor="middle"',350)+button(17,755,356,t('pubstep.publish.post'));}
const cityMap=()=>rect(0,45,390,766,'#14212a',0)+`<path d="M0 490Q145 421 254 496L390 448V844H0Z" fill="#163c46"/>`+[20,80,140,200,260,320,380].map((x,i)=>path(`M${x} 68L${x-65} 500`,'#2c3b43',i%2?8:4)).join('')+[125,195,265,335,405].map(y=>path(`M0 ${y}L390 ${y+63}`,'#2c3b43',5)).join('')+txt(38,206,language==='en'?'SHEUNG WAN':language==='zh-Hans'?'上环':'上環',12,'#789596',600)+txt(243,368,language==='en'?'CENTRAL':language==='zh-Hans'?'中环':'中環',12,'#789596',600)+txt(26,586,language==='en'?'VICTORIA HARBOUR':'維多利亞港',11,'#6d9ea8',500,'letter-spacing="2"');
function dock(){return rect(12,747,366,64,'#17191e',28,C.line)+['map.home.play','map.home.dock.party','map.home.shoot','map.home.dock.nearby','map.home.dock.tonight'].map((key,i)=>icon(['spark','people','camera','people','wine'][i],37+i*71,758,21,i===2?C.amber:C.ink)+txt(47+i*71,799,t(key),9,i===2?C.amber:C.muted,600,'text-anchor="middle"',64)).join('');}
function map(d){return cityMap()+top()+rect(17,61,356,55,'#191c20f2',28,C.line)+icon('spark',29,79,20,C.amber)+txt(60,84,t('map.home.meet'),15,C.ink,700)+txt(60,104,t('map.home.meet.sub'),10,C.muted,500,'',259)+circle(195,374,58,'#f5bc6522')+circle(195,374,43,'url(#brand)')+pic(photo,157,336,76,76,38)+path('M181 414L195 435L209 414','none',0,C.amber)+rect(115,291,160,33,'#111316e8',17,C.amber)+txt(195,313,d.caption,12,C.ink,600,'text-anchor="middle"',140)+rect(17,505,356,204,'#17191ef5',23,C.line)+pic(photo,30,519,112,160,13)+txt(158,544,t('post.you'),14,C.ink,700)+tag(215,524,134,t('share.mode.post'))+wrap(158,578,d.caption,18,190,C.ink,600,1.5)+txt(158,636,d.place,11,C.muted,500,'',190)+txt(158,661,t('pubstep.justnow'),10,C.muted)+dock();}
function detail(d){return pic(photo,0,45,390,400,0)+top()+back()+circle(354,73,20,'#14161ccc')+icon('bookmark',345,64,18)+rect(0,420,390,405,C.bg,25)+circle(42,462,20,'url(#brand)')+txt(42,468,'N',15,C.onAmber,700,'text-anchor="middle"')+txt(75,456,d.name,17,C.ink,700)+txt(75,480,t('pubstep.justnow'),11,C.muted)+tag(276,447,96,t('post.author'))+txt(21,526,d.caption,24,C.ink,700,'',348)+tag(21,547,206,d.highball)+rect(18,598,354,61,C.card,17,C.line)+icon('pin',30,617,21,C.amber)+txt(63,625,d.place,14,C.ink,600)+txt(349,625,t('post.navigate'),11,C.amber,600,'text-anchor="end"',90)+[ ['heart','post.like'],['wine','post.cheers.title'],['chat','post.comments.title'] ].map(([ic,key],i)=>rect(19+i*123,678,111,44,C.soft,22,C.line)+icon(ic,32+i*123,690,18,C.amber)+txt(76+i*123,706,t(key),12,C.ink,600,'text-anchor="middle"',58)).join('')+txt(21,753,t('post.comments.title'),15,C.ink,700)+txt(21,782,t('post.comments.empty'),12,C.muted);}
function ivyBar(){return pic(ivy,0,0,390,844,0)+rect(0,0,390,180,'url(#topFade)',0)+top(false)+rect(16,60,285,49,'#17181be6',25,C.line)+circle(34,84,3,'#78c8a4')+txt(47,81,'What to Drink Bar',17,C.ink,700)+txt(47,98,t('bar.chat.status.idle'),10,C.muted)+close(355,85)+rect(20,455,350,112,'#17191ef2',21,C.line)+txt(38,485,'Ivy',14,C.amber,700)+wrap(38,515,t('bar.welcome'),15,310,C.ink,500,1.5)+rect(17,590,356,52,'#2b2119ee',26,'#bca16f')+die(31,601,5,29)+txt(78,621,t('bar.dice.cta'),14,C.ink,700,'',269)+rect(17,655,356,52,'#2b2119ee',26,'#bca16f')+txt(45,690,'♠',25,C.ink,600,'text-anchor="middle"')+txt(78,687,t('bar.bj.cta'),14,C.ink,700,'',269)+rect(18,750,285,49,'#17191eee',25,C.line)+txt(34,780,t('bar.chat.placeholder'),14,C.muted,500,'',250)+circle(340,774,26,C.amber)+icon('mic',328,762,24,C.onAmber);}
function dice(peeking){return pic(peeking?peek:cups,0,0,390,844,0)+rect(0,0,390,104,C.bg,0)+top(false)+icon('close',10,65,16)+txt(195,75,t('bar.dice.title'),20,C.ink,500,'text-anchor="middle"')+txt(195,94,t('bar.dice.perPlayer',5),11,C.muted,500,'text-anchor="middle"')+rect(4,104,382,63,C.card,18,C.line)+txt(17,126,'Ivy',11,'#efb9a2',700)+txt(17,147,t('bar.dice.say.start.1',5),14,C.ink,500,'',357)+rect(0,574,390,270,C.bg,0)+rect(7,585,376,46,C.card,22,C.line)+txt(21,615,t('bar.dice.noBid'),20,C.ink,500,'',255)+pill(305,595,65,t('bar.dice.yourTurn'),true,10,25)+circle(31,666,21,C.soft,C.line)+txt(31,675,'−',28,C.ink,400,'text-anchor="middle"')+txt(76,677,'2',33,C.ink,400,'text-anchor="middle"')+circle(122,666,21,C.soft,C.line)+txt(122,675,'+',27,C.ink,400,'text-anchor="middle"')+txt(165,674,t('bar.dice.zhai.tag'),13,C.muted,600,'text-anchor="middle"')+[1,2,3,4,5,6].map((n,i)=>die(190+i*31,651,n,29,i===0)).join('')+pill(8,708,216,t('bar.dice.voice.hold'),false,12,43)+icon('mic',19,720,17)+pill(232,708,151,t(peeking?'bar.dice.peek.only':'bar.dice.peek'),peeking,12,43)+rect(8,766,175,47,C.card,24,C.line)+txt(95,797,t('bar.dice.challenge'),18,C.muted,600,'text-anchor="middle"')+button(201,765,182,t('bar.dice.bid'));}
const allBuilders={camera,editor,preview,map,detail,'ivy-bar':ivyBar,'dice-cups':()=>dice(false),'dice-peek':()=>dice(true),...featureBuilders({t,txt,wrap,rect,circle,path,icon,pic,pill,tag,button,top,back,close,photo,cityMap,dock,C,language:()=>language,demo}),...cocktailTrailBuilders({t,txt,wrap,rect,circle,path,icon,pic,pill,tag,button,top,back,close,photo,ivy,cityMap,C,language:()=>language},cocktailData)};
const screenOrder=["camera","editor","preview","map","detail","ivy-bar","cocktail-book","cocktail-recipe","cocktail-step","cocktail-done","dice-cups","dice-peek","party","party-detail","trail","trail-map","trail-replay","meet","tonight","cheers","home","profile"];
const builders=Object.fromEntries(screenOrder.map(name=>[name,allBuilders[name]]));
const manifest=[];
for(language of ['zh-Hant','zh-Hans','en']){
 await mkdir(`${root}artwork/${language}`,{recursive:true});
 for(const [name,builder] of Object.entries(builders)){
  used=new Set();
  const body=builder(demo[language]);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1170" height="2532" viewBox="0 0 390 844"><defs><linearGradient id="brand" x2="1" y2=".2"><stop stop-color="#F4B34F"/><stop offset="1" stop-color="#ED6680"/></linearGradient><linearGradient id="ivory" x2=".8" y2="1"><stop stop-color="#fff3d6"/><stop offset="1" stop-color="#d8bc86"/></linearGradient><linearGradient id="taste" x2="1" y2="1"><stop stop-color="#744027"/><stop offset="1" stop-color="#352722"/></linearGradient><linearGradient id="nightFade" x2="0" y2="1"><stop stop-color="#090a0f" stop-opacity=".15"/><stop offset=".52" stop-color="#090a0f" stop-opacity=".05"/><stop offset="1" stop-color="#090a0f" stop-opacity=".97"/></linearGradient><linearGradient id="topFade" x2="0" y2="1"><stop stop-color="#090a0f" stop-opacity=".9"/><stop offset="1" stop-color="#090a0f" stop-opacity="0"/></linearGradient></defs><g font-family="PingFang TC, PingFang SC, Arial, sans-serif">${rect(0,0,390,844,C.bg,0)}${body}${homeIndicator()}</g></svg>`;
  const png=new Resvg(svg,{font:{loadSystemFonts:true,defaultFontFamily:'PingFang TC',fontFiles:['/System/Library/Fonts/STHeiti Medium.ttc']}}).render().asPng();
  const version=name.startsWith("cocktail-")||name.startsWith("trail-")?4:3;
  const file=`${language}/${name}-v${version}.webp`;
  const webp=await sharp(png).webp({quality:94,effort:5}).toBuffer();
  await writeFile(`${root}artwork/${file}`,webp);
  manifest.push({locale:language,name,file,width:1170,height:2532,sha256:createHash('sha256').update(webp).digest('hex'),uiKeys:[...used],content:'Faithful UI reconstruction; curated photo/caption/author and schematic demo map.'});
 }
}
await writeFile(`${root}artwork/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.info(`Rendered ${manifest.length} full-resolution images: ${manifest.length/3} screens × 3 languages.`);
