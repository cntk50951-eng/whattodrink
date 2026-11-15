/** Additional real app features. Shared drawing primitives keep all three sets identical. */
export function featureBuilders(c) {
  const { t, txt, wrap, rect, circle, path, icon, pic, pill, tag, button, top, back, close, photo, cityMap, dock, C, language } = c;
  const L = (tc,sc,en) => language() === 'en' ? en : language() === 'zh-Hans' ? sc : tc;
  const avatar = (x,y,r=19,letter='N') => circle(x,y,r,'url(#brand)')+txt(x,y+5,letter,14,C.onAmber,700,'text-anchor="middle"');
  const header = (key) => top()+back()+txt(195,79,t(key),18,C.ink,700,'text-anchor="middle"',230);
  const venue = 'Amber Room';
  const note = () => L('想慢慢聊天，分享喜歡的音樂。','想慢慢聊天，分享喜欢的音乐。','Good music. A little conversation.');
  const partyCover = (x,y,w,h) => pic(photo,x,y,w,h,22)+rect(x,y,w,h,'url(#topFade)',22);
  function party(d) {
    return header('party.board.title')+txt(20,137,t('party.board.title'),34,C.ink,700)+txt(20,166,t('party.board.tonightSummary',1).replaceAll('**',''),11,C.muted,500,'',350)
      +rect(16,190,358,47,C.card,18,C.line)+pill(20,194,173,t('partyx.tab.explore'),true,14,39)+txt(283,219,t('partyx.tab.mine'),14,C.muted,600,'text-anchor="middle"')
      +rect(16,253,270,45,C.card,23,C.line)+icon('filter',29,267,18,C.muted)+txt(58,281,t('party.board.searchPrompt'),12,C.muted,500,'',212)+pill(297,253,77,t('party.filter.title'),false,12,45)
      +pill(16,314,72,t('party.hub.seg.all'),true)+pill(98,314,75,t('party.board.today'))+pill(184,314,92,t('party.cond.seat'))+pill(287,314,87,t('party.map.aa'))
      +txt(20,388,t('party.hub.group.tonight'),24,C.ink,700)+rect(16,410,358,341,C.card,23,C.line)+partyCover(17,411,356,160)+pill(30,424,123,`${t('party.board.today')} 21:00`,false,12,29)
      +txt(32,528,venue,27,C.ink,700)+txt(32,551,`${d.place} · 150 m`,11,C.ink)+avatar(48,606)+txt(77,611,L('海岸筆記','海岸笔记','Harbour Notes'),15,C.ink,700)
      +wrap(32,649,note(),14,315,C.muted,500,1.6)+pill(31,694,108,t('party.hint.gathering'),true,12,32)+txt(355,715,t('party.seatsLeft',2),12,C.amber,600,'text-anchor="end"',180)
      +pill(54,768,100,t('party.board.map'),false,14,40)+pill(164,768,173,t('party.board.start'),true,14,40);
  }
  function partyDetail(d) {
    return partyCover(0,45,390,314)+top()+close()+txt(21,268,venue,34,C.ink,700)+txt(21,300,`${d.place} · 150 m`,12,C.ink)+pill(20,321,112,t('party.hint.gathering'),true,12,29)
      +['party.detail.cheersTime','party.detail.seats','party.filter.bill'].map((k,i)=>rect(16+i*124,380,110,91,C.card,18,C.line)+txt(27+i*124,406,t(k),11,C.muted,600,'',91)+txt(27+i*124,444,['21:00','2 / 4','AA'][i],24,C.ink,700)).join('')
      +path('M20 497H370',C.line)+txt(21,536,t('party.detail.host'),21,C.ink,700)+avatar(44,578,23)+txt(82,580,L('海岸筆記','海岸笔记','Harbour Notes'),18,C.ink,700)+rect(17,622,356,73,C.card,20)+wrap(34,650,note(),14,320,C.muted)
      +txt(20,728,t('party.detail.quitAnytime'),11,C.muted)+button(17,755,356,t('party.detail.joinBtn'));
  }
  function trail(d) {
    const heights=[5,5,5,5,5,31,5,5,31,5,5,31];
    return top()+txt(18,76,t('我的微醺足跡'),23,C.ink,700,'',290)+close(354,74)+txt(18,104,t('profile.trail.setting.off'),11,C.muted)
      +pill(17,126,68,t('全部'),true,12,57)+[7,10,14].map((n,i)=>pill(102+i*93,126,84,`11 / ${n}`,i===2,13,57)).join('')
      +rect(16,209,358,273,C.card,25,C.line)+txt(34,240,t('累計微醺夜數'),12,C.muted,600)+txt(31,317,'3',72,C.amber,700)+txt(89,311,t('晚'),18,C.muted)+txt(35,346,L('累計 4 次打卡','累计 4 次打卡','4 check-ins in total'),12,C.muted)
      +rect(248,229,106,114,'#392a25',20,'#674439')+icon('spark',265,244,23,C.amber)+txt(265,298,'1',36,C.ink,700)+txt(265,324,t('連續週數'),10,C.muted,600,'',77)
      +heights.map((h,i)=>rect(33+i*27,415-h,20,h,i===11?'url(#brand)':'#34353b',4)).join('')+txt(34,451,t('最近 12 週 · 每週微醺夜'),10,C.muted,500,'',318)
      +txt(20,528,'11 / 14',23,C.ink,700)+pill(273,502,100,t('回放'),false,13,38)+rect(16,551,358,249,C.card,22,C.line)+pic(photo,17,552,356,151,21)+pill(275,563,83,t('share.mode.post'),true,11,27)
      +txt(34,730,'20:18',13,C.amber,700)+txt(34,759,d.place,17,C.ink,700)+txt(34,783,d.caption,12,C.muted,500,'',315)+pill(237,744,119,t('足跡地圖'),true,12,39);
  }
  function meet() {
    return top()+close()+txt(195,78,t('map.home.meet'),19,C.ink,700,'text-anchor="middle"')+pill(268,60,106,t('meet.quota.left',9),false,10,30)
      +rect(45,127,329,76,C.soft,21)+wrap(61,154,L('想找喜歡威士忌、會說廣東話的朋友','想找喜欢威士忌、会说广东话的朋友','Find friends who like whisky and speak Cantonese'),15,294,C.ink,600,1.5)
      +icon('spark',18,230,23,C.amber)+txt(56,249,t('meet.understood'),16,C.amber,700)+tag(19,272,116,t('bar.menu.whisky'))+tag(148,272,173,L('語言 · 粵語','语言 · 粤语','Language · Cantonese'))
      +txt(21,346,t('meet.block.people'),22,C.ink,700)+rect(17,369,356,314,C.card,25,C.line)+avatar(63,416,27,'H')+txt(105,412,L('海岸筆記','海岸笔记','Harbour Notes'),19,C.ink,700)+txt(105,439,'28',12,C.muted)+pill(258,395,99,t('meet.score',86),false,11,32)
      +txt(35,481,t('meet.result.why'),12,C.muted,600)+wrap(35,508,L('同樣喜歡威士忌，也會說廣東話。','同样喜欢威士忌，也会说广东话。','A shared taste for whisky, and a shared language.'),15,315,C.ink,500,1.6)
      +tag(35,570,148,t('bar.menu.whisky'))+tag(195,570,146,L('粵語','粤语','Cantonese'))+pill(34,620,150,t('meet.card.add'),true,13,40)+pill(196,620,145,t('meet.card.chat'),false,13,40)
      +rect(17,728,356,80,C.card,24,C.line)+txt(33,759,t('meet.composer.again'),12,C.muted,500,'',286)+icon('mic',289,776,20)+circle(342,781,17,C.amber)+icon('arrow',331,770,22,C.onAmber);
  }
  function tonight() {
    return pic(photo,0,0,390,844,0)+rect(0,0,390,844,'url(#nightFade)',0)+top(false)+close(354,74)+txt(195,557,t('reveal.drink.cocktail.name'),38,C.ink,700,'text-anchor="middle"')
      +txt(195,592,t('reveal.drink.cocktail.tag'),16,C.ink,500,'text-anchor="middle"',340)+button(20,640,350,t('reveal.nearby'))+pill(20,709,169,t('reveal.again'),false,16,49)+pill(201,709,169,t('reveal.invite'),false,16,49);
  }
  function cheers(d) {
    const peer=L('海岸筆記','海岸笔记','Harbour Notes');
    return header('activity.kind.cheers')+txt(20,138,t('activity.kind.cheers'),34,C.ink,700)+txt(20,167,t('activity.view.cheersSub'),13,C.muted)
      +pill(17,196,111,t('全部'),false,12,36)+pill(139,196,111,t('activity.cheers.dir.received'),true,12,36)+pill(262,196,111,t('activity.cheers.dir.sent'),false,12,36)
      +txt(20,273,t('activity.view.newest'),11,C.muted)+pill(193,248,86,t('activity.view.byPerson'),true,11,32)+pill(287,248,86,t('activity.view.byTime'),false,11,32)
      +rect(17,302,356,323,C.card,23,C.line)+avatar(57,345,23,'H')+txt(94,344,peer,18,C.ink,700)+txt(94,367,t('pubstep.justnow'),11,C.muted)+tag(283,330,74,t('activity.view.badge.new'))
      +icon('wine',34,392,21,C.amber)+txt(64,411,t('activity.cheers.line.received').replace(' 🍻',''),16,C.ink,600,'',284)+pic(photo,35,434,62,77,10)+txt(111,463,t('activity.cheers.detail.on',d.place),12,C.muted,500,'',238)+txt(111,488,d.caption,13,C.ink,500,'',238)
      +pill(35,547,145,t('activity.action.cheersBack'),true,14,44)+pill(192,547,145,t('activity.action.chat'),false,14,44)
      +rect(17,646,356,122,C.card,23,C.line)+avatar(57,683,23,'C')+txt(94,680,L('城間小酌','城间小酌','City Sips'),17,C.ink,700)+txt(94,704,'20:02',11,C.muted)+txt(35,744,t('activity.cheers.state.mutual'),14,C.amber,600,'',300);
  }
  function home(d) {
    return cityMap()+top()+avatar(34,87,23)+rect(69,62,304,50,'#1b2429',25,C.line)+icon('spark',83,78,20,C.amber)+txt(114,85,t('map.home.meet'),15,C.ink,700)+txt(114,103,t('map.home.meet.sub'),10,C.muted,500,'',248)
      +circle(202,403,83,'#e8ae4b11', '#d8b16c44')+circle(202,403,48,'#e8ae4b16')+pic(photo,177,378,50,50,25)+path('M193 430L202 445L211 430','none',0,C.amber)+pill(120,331,165,d.caption,false,12,32)
      +circle(87,256,15,C.soft,C.line)+icon('wine',77,246,20,C.amber)+circle(310,469,15,C.soft,C.line)+icon('wine',300,459,20,C.amber)+circle(222,524,7,'#6fa6f4','#fff',3)
      +circle(43,687,27,'url(#brand)')+txt(43,693,'Ivy',14,C.onAmber,700,'text-anchor="middle"')+circle(347,675,22,C.soft,C.line)+icon('pin',336,664,22,C.amber)+dock();
  }
  function profile(d) {
    return header('profile.view.mine')+rect(16,112,358,402,C.card,26,C.line)+avatar(69,171,35)+txt(122,166,d.name,25,C.ink,700,'',224)+tag(122,185,65,'28')
      +txt(33,243,L('收集城市裡的好風景，和好味道。','收集城市里的好风景，和好味道。','City walks. Good flavours. Small moments.'),12,C.muted,500,'',321)
      +tag(31,263,113,t('bar.menu.whisky'))+tag(155,263,134,L('現場音樂','现场音乐','Live music'))+tag(31,309,139,t('profilex.vis.public'))
      +[ ['4','profile.tab.checkins'],['2','profile.stat.friends'],['3','profile.tab.saves'] ].map(([n,k],i)=>txt(83+i*112,391,n,29,C.ink,700,'text-anchor="middle"')+txt(83+i*112,418,t(k),12,C.muted,500,'text-anchor="middle"',102)).join('')
      +button(31,448,328,t('profile.edit.title'))+rect(16,534,358,48,C.soft,24)+['overview','checkins','trail','saves'].map((k,i)=>pill(20+i*89,538,84,t(`profile.tab.${k}`),i===0,12,40)).join('')
      +rect(16,603,358,197,C.card,24,C.line)+rect(17,604,356,104,'url(#taste)',23)+txt(34,635,t('profile.taste.my'),12,C.amber,600)+txt(34,675,t('profile.taste.headlineOther',t('bar.menu.whisky')),26,C.ink,700,'',315)+txt(34,741,t('profile.taste.card'),15,C.ink,700)+tag(34,756,130,'Highball');
  }
  return {party,'party-detail':partyDetail,trail,meet,tonight,cheers,home,profile};
}
