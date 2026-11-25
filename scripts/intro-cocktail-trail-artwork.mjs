/** Real Gin Fizz assets and follow-along UI; footprint map based on the iOS replay. */
export function cocktailTrailBuilders(c, data) {
  const { t, txt, wrap, rect, circle, path, icon, pic, pill, tag, button, top, back, close, photo, ivy, C, language } = c;
  const local = (value) => value[{ 'zh-Hant':'zhHant', 'zh-Hans':'zhHans', en:'en' }[language()]];
  const drink = data.recipe;
  const artColor = (value) => ({line:'#FFC46B',ice:'#f4ecdd24',iceLine:'#f4ecdd80',hl:'#ffffffe6',none:'none'}[value] ?? value ?? 'none');
  const art = (value,x,y,size) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="-22 -10 185 185">${value.layers.map(l=>`<path d="${l.d}" fill="${artColor(l.f)}" stroke="${artColor(l.s)}" stroke-width="${l.w??0}" opacity="${l.o??1}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
  const name = (x,y,size=29,max=340) => txt(x,y,local(drink.name),size,C.ink,700,'',max);
  const ivyAvatar = (x,y) => pic(ivy,x,y,33,33,17);
  function book() {
    return top()+txt(20,77,t('cocktail.hub.eyebrow'),11,C.muted,500,'letter-spacing="1.8"')+txt(20,110,t('cocktail.hub.title'),30,C.ink,700)+close(353,84)
      +rect(18,134,354,46,C.card,23,C.line)+icon('filter',32,149,17,C.muted)+txt(62,162,t('cocktail.hub.search'),13,C.muted,500,'',290)
      +rect(18,203,354,478,C.card,28,'#8e693a')+txt(36,232,t('cocktail.series.iba'),12,C.muted,600)+txt(353,232,t('cocktail.hub.shakeHint'),11,C.amber,500,'text-anchor="end"',160)
      +art(drink.art,75,247,240)+txt(195,500,drink.name.en,20,C.amber,600,'text-anchor="middle"')+txt(195,536,local(drink.name),30,C.ink,700,'text-anchor="middle"',320)
      +txt(195,565,local(drink.tagline),12,C.muted,500,'text-anchor="middle"',320)+tag(68,584,70,t('cocktail.method.shake'))+tag(148,584,77,t('cocktail.chip.mins',drink.mins))+tag(236,584,86,t('cocktail.strength.1'))
      +button(35,625,263,t('cocktail.hub.start'))+circle(333,650,25,C.soft)+icon('arrow',322,639,22,C.amber)
      +pill(18,702,79,t('全部'),true)+pill(108,702,105,t('cocktail.base.gin'))+pill(224,702,148,t('bar.menu.whisky'))
      +txt(20,779,t('cocktail.hub.all'),18,C.ink,700)+txt(370,778,t('cocktail.hub.count',data.catalogCount),12,C.muted,500,'text-anchor="end"');
  }
  function recipe() {
    return top()+back()+txt(78,78,t('cocktail.series.iba'),12,C.muted,600)+txt(20,130,drink.name.en,19,C.amber,600)+name(20,170,31,229)+txt(20,201,local(drink.tagline),11,C.muted,500,'',222)+art(drink.art,248,101,124)
      +rect(18,242,354,111,C.card,20,C.line)+txt(32,272,t('cocktail.recipe.servings'),13,C.muted,600)+[0.5,1,2,4].map((n,i)=>pill(112+i*60,251,56,t(n===0.5?'cocktail.recipe.half':'cocktail.recipe.cups',n),i===1,11,35)).join('')
      +txt(32,327,t('cocktail.recipe.unit'),13,C.muted,600)+pill(236,303,57,'mL',true,12,34)+pill(300,303,57,'oz',false,12,34)
      +txt(20,393,t('cocktail.recipe.ingredients'),20,C.ink,700)+txt(370,392,t('cocktail.recipe.have',1,4),11,C.amber,600,'text-anchor="end"')
      +drink.ingredients.map((ing,i)=>txt(27,431+i*51,local(data.ingredients[ing.k]),15,C.ink,600)+txt(27,451+i*51,ing.a?`${ing.a} mL`:t('cocktail.amount.top'),12,C.amber)+pill(276,416+i*51,91,t(i===0?'cocktail.recipe.owned':'cocktail.recipe.own'),i===0,11,31)+path(`M20 ${465+i*51}H370`,C.line)).join('')
      +rect(18,643,354,66,C.card,18,C.line)+txt(32,668,t('cocktail.recipe.tools'),11,C.muted,600)+txt(32,694,t('cocktail.tools.shake'),13,C.ink,500,'',325)+button(18,755,354,t('cocktail.recipe.start'));
  }
  function step() {
    return top()+back()+name(77,70,18,290)+txt(77,94,t('cocktail.steps.progress',data.step.index,data.step.count),12,C.muted)
      +Array.from({length:8},(_,i)=>rect(20+i*44,119,39,4,i<5?C.amber:C.line,2)).join('')+rect(18,145,354,252,C.card,27,C.line)+art(data.stepArt.shake,85,155,230)+pill(284,158,74,t('cocktail.chip.sec',12),false,12,30)
      +txt(20,443,t('cocktail.step.shake.title'),29,C.ink,700,'',350)+wrap(20,481,t('cocktail.step.shake.body'),15,347,C.muted,500,1.7)
      +rect(18,577,354,144,C.card,23,'#795f3b')+ivyAvatar(32,593)+txt(77,609,t('cocktail.steps.ivyTip'),12,C.amber,700)+wrap(77,635,t('cocktail.tip.shake'),13,275,C.ink,500,1.6)
      +circle(43,781,25,C.soft,C.line)+icon('back',31,769,24)+button(82,755,290,t('cocktail.steps.next'));
  }
  function done() {
    return top()+close(354,74)+art(drink.art,72,113,246)+txt(195,399,t('cocktail.done.title'),33,C.ink,700,'text-anchor="middle"',350)+txt(195,438,drink.name.en,19,C.amber,600,'text-anchor="middle"')+txt(195,466,local(drink.name),18,C.ink,600,'text-anchor="middle"')
      +rect(18,500,354,152,C.card,23,'#795f3b')+ivyAvatar(32,517)+wrap(78,534,t('cocktail.done.ivy'),14,274,C.ink,500,1.7)+wrap(78,601,t('cocktail.done.postHint'),11,274,C.amber,500,1.7)
      +txt(195,686,t('cocktail.safety'),10,C.muted,500,'text-anchor="middle"',352)+button(18,714,354,t('cocktail.done.post'))+pill(18,778,354,t('cocktail.done.another'),false,16,40);
  }
  const stops=[{x:68,y:262,n:1},{x:285,y:327,n:2},{x:246,y:460,n:3},{x:88,y:518,n:4}];
  const curves=[[stops[0],{x:172,y:227},stops[1]],[stops[1],{x:331,y:423},stops[2]],[stops[2],{x:174,y:558},stops[3]]];
  function footprints(playing) {
    let output='';
    curves.forEach(([a,b,d],segment)=>{
      if(playing&&segment>1)return;
      for(let i=1;i<=11;i++){
        const f=i/12,x=(1-f)**2*a.x+2*(1-f)*f*b.x+f*f*d.x,y=(1-f)**2*a.y+2*(1-f)*f*b.y+f*f*d.y;
        const angle=Math.atan2(2*(1-f)*(b.y-a.y)+2*f*(d.y-b.y),2*(1-f)*(b.x-a.x)+2*f*(d.x-b.x))*180/Math.PI+90;
        output+=`<g transform="translate(${x} ${y}) rotate(${angle}) translate(${i%2?4:-4} 0) scale(.65)"><ellipse cx="0" cy="2" rx="3.4" ry="5" fill="${C.amber}"/>${[-2.4,0,2.4].map(dx=>circle(dx,dx===0?-6.6:-5.6,1.2,C.amber)).join('')}</g>`;
      }
    });return output;
  }
  // Keep the schematic walking route on land; this is a demo map, not navigation data.
  const trailBackground = () => rect(0,45,390,766,'#14212a',0)+`<path d="M0 585Q143 546 255 600L390 555V844H0Z" fill="#163c46"/>`
    +[20,80,140,200,260,320,380].map((x,i)=>path(`M${x} 68L${x-55} 561`,'#2c3b43',i%2?7:4)).join('')
    +[188,258,328,398,468,538].map(y=>path(`M0 ${y}L390 ${y+35}`,'#2c3b43',4)).join('')
    +txt(33,218,local({zhHant:'上環',zhHans:'上环',en:'SHEUNG WAN'}),11,'#789596',600)
    +txt(270,418,local({zhHant:'中環',zhHans:'中环',en:'CENTRAL'}),11,'#789596',600);
  function trailMap(playing) {
    return trailBackground()+top(false)+close(33,77)+rect(65,54,308,53,'#151d23ee',27,C.line)+txt(83,77,t('profilex.priv.trail'),18,C.ink,700)+txt(83,97,t('intro.trail.station',3,4,'11 / 14'),11,C.muted,500,'',273)
      +rect(18,126,354,43,'#152027ed',22,C.line)+pill(22,130,106,`${t('全部')} 4`,true,12,35)+pill(139,130,106,`${t('intro.trail.week')} 3`,false,12,35)+pill(256,130,111,`${t('intro.trail.night')} 2`,false,12,35)
      +footprints(playing)+stops.filter(p=>!playing||p.n<4).map(p=>circle(p.x,p.y,p.n===3?20:16,p.n===3?'url(#brand)':C.soft,C.amber,1.8)+txt(p.x,p.y+5,String(p.n),15,p.n===3?C.onAmber:C.ink,700,'text-anchor="middle"')).join('')
      +pill(195,491,149,'Amber Room',false,12,29)+rect(17,570,356,145,'#12181fee',23,C.line)+pic(photo,29,583,77,113,13)+txt(122,603,'20:18',12,C.amber,700)+txt(122,634,'Amber Room',21,C.ink,700,'',231)+txt(122,659,t('intro.trail.area'),12,C.muted,500,'',228)+txt(122,687,t('intro.trail.station',3,4,'11 / 14'),11,C.muted,500,'',228)
      +rect(0,731,390,91,'#141d25f5',0)+rect(20,747,350,4,C.line,2)+rect(20,747,239,4,C.amber,2)+circle(259,749,7,C.ink)
      +icon('back',52,776,22)+path('M51 778V795',C.ink,2)+circle(154,787,25,'url(#brand)')+(playing?path('M148 779V795M160 779V795',C.onAmber,3):path('M149 777L164 787L149 797Z',C.onAmber,1,C.onAmber))
      +icon('arrow',228,776,22)+path('M253 778V795',C.ink,2)+pill(293,769,68,'1×',false,13,35);
  }
  return {'cocktail-book':book,'cocktail-recipe':recipe,'cocktail-step':step,'cocktail-done':done,'trail-map':()=>trailMap(false),'trail-replay':()=>trailMap(true)};
}
