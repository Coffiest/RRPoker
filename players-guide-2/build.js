// RRST #2 プレイヤーズガイド(PDF/PNG): node players-guide-2/build.js
// 中身は data.js / blinds.txt。見た目の基本は players-guide/build.js の <style> を引き継ぐ
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
const D = require('./data');

const n = (v) => v.toLocaleString('en-US');
const addMin = (t, m) => {
  const [h, mm] = t.split(':').map(Number);
  const x = h * 60 + mm + m;
  return `${Math.floor(x / 60) % 24}:${String(x % 60).padStart(2, '0')}`;
};
const img = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, f)).toString('base64');
const QR = img(D.event.app.qr);

// レジクロ = RC ブレイクの終わり(前回と同じ考え方)
const rcTime = (t) => {
  if (!t.levels) return '-';
  let time = t.start;
  for (const l of t.levels) {
    time = addMin(time, Array.isArray(l) ? l[3] : l.m);
    if (!Array.isArray(l) && l.rc) return time;
  }
  return '-';
};
const entryText = (e) => (e.all != null ? `${n(e.all)}` : `${n(e.student)} / ${n(e.adult)}`);
const day = (k) => `${D.days[k].label} ${D.days[k].dow}`;

const logo = (size) => `
<div class="logo" style="font-size:${size}px">
  <div><b>R</b>UNNER <b>R</b>UNNER</div>
  <div><b>S</b>UPER <b>T</b>OURNAMENT <b class="ed">${D.event.edition}</b></div>
  <div class="city">${D.event.city} 2027</div>
</div>`;
const header = (title, sub) => `
<header class="head">
  <div><h1>${title}</h1><div class="sub">${sub}</div></div>
  <div class="mark">${logo(13)}</div>
</header>`;

// 表紙はチラシ(#2)の要素で組む: キャッチ・タイトル・FUKUOKA 2027・日付・縦書きコピー・波線
const WAVES = '<path d="M0 40 C 200 10, 380 90, 600 40 S 820 0, 900 50"/><path d="M0 49 C 200 19, 380 99, 600 49 S 820 9, 900 59"/><path d="M0 58 C 200 28, 380 108, 600 58 S 820 18, 900 68"/><path d="M0 67 C 200 37, 380 117, 600 67 S 820 27, 900 77"/><path d="M0 76 C 200 46, 380 126, 600 76 S 820 36, 900 86"/><path d="M0 85 C 200 55, 380 135, 600 85 S 820 45, 900 95"/><path d="M0 94 C 200 64, 380 144, 600 94 S 820 54, 900 104"/><path d="M0 103 C 200 73, 380 153, 600 103 S 820 63, 900 113"/><path d="M0 112 C 200 82, 380 162, 600 112 S 820 72, 900 122"/><path d="M0 121 C 200 91, 380 171, 600 121 S 820 81, 900 131"/><path d="M0 130 C 200 100, 380 180, 600 130 S 820 90, 900 140"/><path d="M0 139 C 200 109, 380 189, 600 139 S 820 99, 900 149"/><path d="M0 148 C 200 118, 380 198, 600 148 S 820 108, 900 158"/><path d="M0 157 C 200 127, 380 207, 600 157 S 820 117, 900 167"/><path d="M0 166 C 200 136, 380 216, 600 166 S 820 126, 900 176"/><path d="M0 175 C 200 145, 380 225, 600 175 S 820 135, 900 185"/><path d="M0 184 C 200 154, 380 234, 600 184 S 820 144, 900 194"/><path d="M0 193 C 200 163, 380 243, 600 193 S 820 153, 900 203"/><path d="M0 202 C 200 172, 380 252, 600 202 S 820 162, 900 212"/><path d="M0 211 C 200 181, 380 261, 600 211 S 820 171, 900 221"/><path d="M0 220 C 200 190, 380 270, 600 220 S 820 180, 900 230"/><path d="M0 229 C 200 199, 380 279, 600 229 S 820 189, 900 239"/><path d="M0 238 C 200 208, 380 288, 600 238 S 820 198, 900 248"/><path d="M0 247 C 200 217, 380 297, 600 247 S 820 207, 900 257"/><path d="M0 256 C 200 226, 380 306, 600 256 S 820 216, 900 266"/><path d="M0 265 C 200 235, 380 315, 600 265 S 820 225, 900 275"/><path d="M0 274 C 200 244, 380 324, 600 274 S 820 234, 900 284"/><path d="M0 283 C 200 253, 380 333, 600 283 S 820 243, 900 293"/><path d="M0 292 C 200 262, 380 342, 600 292 S 820 252, 900 302"/><path d="M0 301 C 200 271, 380 351, 600 301 S 820 261, 900 311"/><path d="M0 310 C 200 280, 380 360, 600 310 S 820 270, 900 320"/><path d="M0 319 C 200 289, 380 369, 600 319 S 820 279, 900 329"/><path d="M0 328 C 200 298, 380 378, 600 328 S 820 288, 900 338"/><path d="M0 337 C 200 307, 380 387, 600 337 S 820 297, 900 347"/>';
// 表紙: 上はチラシ(cover-top.png: キャッチ・RRST #2 の文字・FUKUOKA 2027)、下は FST 型の PLAYER'S GUIDE / 日付 / QR
// 表紙: 第1回の表紙の組み方 + チラシの「RUNNER RUNNER SUPER TOURNAMET #2」文字(title.png)
const cover = `
<section class="page c7">
  <div class="c7-tag">- 己の才能を証明せよ -</div>
  <div class="c7-pg">PLAYER'S GUIDE</div>
  <div class="c7-date">2027.01.30-31 <span>SAT-SUN</span></div>
  <div class="c7-title"><img src="${img('title.png')}" alt=""><div class="city">FUKUOKA</div></div>
  <div class="c7-foot"><div><span class="pill">VENUE</span>${D.event.venue}<small>${D.event.address}</small></div><div class="org">${D.event.org}</div></div>
</section>`;

const schedRows = (k) => D.tournaments.filter((t) => t.day === k).map((t) => `
  <tr class="${t.main ? 'hl' : ''}"><td>${t.start}</td><td>${t.schedOnly ? '-' : rcTime(t)}</td><td>${t.no}</td>
  <td class="nm">${t.name}${t.sub ? ` <em>${t.sub}</em>` : ''}</td>
  <td>${t.schedOnly ? '-' : entryText(t.entry)}${t.entryNote ? `<small class="cap">${t.entryNote}</small>` : ''}</td>
  <td>${t.schedOnly ? '-' : n(t.chips)}${t.cap ? `<small class="cap">${t.cap}</small>` : ''}</td></tr>`).join('');

const schedule = `
<section class="page">
  ${header('EVENT SCHEDULE', `${D.event.date} &nbsp;FUKUOKA`)}
  <table class="sched">
    <thead><tr><th>START</th><th>CLOSE</th><th>NO</th><th>TOURNAMENT</th><th>ENTRY 学生/一般</th><th>STACK</th></tr></thead>
  </table>
  ${Object.keys(D.days).map((k, i) => `
  <div class="day">DAY${i + 1} &nbsp;${D.days[k].label} <span>${D.days[k].dow}</span>${i === 0 ? '<em class="max">ALL TABLES 8-MAX<small>全席固定 8人テーブル(ディーラー含む)</small></em>' : ''}</div>
  <table class="sched"><tbody>${schedRows(k)}</tbody></table>`).join('')}
  <p class="note">ENTRY は 学生 / 一般 の参加費です。CLOSE はレイトレジストレーション(参加受付)締切の目安です。進行により前後する場合があります。</p>
  <div class="notice">
    <div class="fee"><span class="pill">FEE</span>施設利用料として、お一人様 <b>${n(D.event.facilityFee)}</b> をいただきます(参加費とは別)。</div>
    <div class="app"><img src="${QR}" alt="">
      <div><span class="pill">APP</span><b>${D.event.app.name}</b> の登録が必須です。<br><small>当日スムーズに参加できるよう、事前に登録をお済ませください。</small><span class="url">${D.event.app.url}</span></div>
    </div>
  </div>
  <div class="venue-box"><div><span class="pill">VENUE</span><b>${D.event.venue}</b><small>${D.event.address}</small></div></div>
</section>`;

const blindRows = (t) => {
  let time = t.start, lv = 0;
  return t.levels.map((l) => {
    if (!Array.isArray(l)) {
      const extra = [l.rc && 'Registration Close', l.note].filter(Boolean).join(' &nbsp;/&nbsp; ');
      const row = `<tr class="brk ${l.rc ? 'rc' : ''}"><td>${time}</td><td colspan="4">Break ${l.m}min${extra ? ' &nbsp;/&nbsp; ' + extra : ''}</td></tr>`;
      time = addMin(time, l.m);
      return row;
    }
    lv++;
    const row = `<tr><td>${time}</td><td>${lv}</td><td>${n(l[0])}-${n(l[1])}</td><td>${n(l[2])}</td><td>${l[3]}</td></tr>`;
    time = addMin(time, l[3]);
    return row;
  }).join('');
};

const prizeBlock = (p) => !p ? `
  <table class="prize"><tr><th>Total</th><td>TBD</td></tr><tr><th>In Money</th><td>TBD</td></tr></table>
  <p class="tbd">プライズは決まり次第お知らせします。</p>` : `
  <table class="prize"><tr><th>Total</th><td>${n(p.total)}</td></tr><tr><th>In Money</th><td>${typeof p.inMoney === 'number' ? p.inMoney + (['', 'st', 'nd', 'rd'][p.inMoney] || 'th') : p.inMoney}</td></tr></table>
  <table class="places">${p.places.map((r) => `<tr><th>${r[0]}</th><td>${r[1].replace(/PokerART Platinum 1ヶ月/, '<span class="plat">PokerART Platinum 1ヶ月</span>')}${r[2] ? '<span class="tro">+ Trophy</span>' : ''}${(r[3] || []).map((x) => `<span class="tkt">+ ${x}</span>`).join('')}</td></tr>`).join('')}</table>`;

const tPage = (t) => {
  const rows = t.levels.length;
  const dense = rows > 46 ? 'dense xdense' : rows > 36 ? 'dense' : '';
  return `
<section class="page">
  ${header(`${t.no} ${t.name}`, `${day(t.day)} ${t.start} START${t.sub ? ' &nbsp;/&nbsp; ' + t.sub : ''}${t.note && !t.main ? ' &nbsp;/&nbsp; ' + t.note : ''}`)}
  <div class="grid">
    <table class="blind fit" style="--rh:${Math.min(19, Math.floor(880 / (rows + 1) * 10) / 10)}px">
      <thead><tr><th>Time</th><th>Lv</th><th>Blind</th><th>Ante</th><th>Min</th></tr></thead>
      <tbody>${blindRows(t)}</tbody>
    </table>
    <aside>
      <div class="big">Entry${t.entryNote ? `<small> (${t.entryNote})</small>` : ''}</div>
      <table class="prize entry">${t.entry.all != null ? `<tr><th>All</th><td>${n(t.entry.all)}</td></tr>` : `<tr><th>学生</th><td>${n(t.entry.student)}</td></tr><tr><th>一般</th><td>${n(t.entry.adult)}</td></tr>`}</table>
      <dl>
        <dt>Starting Chips</dt><dd>${n(t.chips)}${t.chipsNote ? ` <small>(${t.chipsNote})</small>` : ''}</dd>
        <dt>Late Reg</dt><dd>${rcTime(t)}</dd>${t.cap ? `<dt>Cap</dt><dd>${t.cap}</dd>` : ''}
      </dl>
      ${t.main ? `<div class="mnote">${t.note}</div>` : ''}
      ${t.rules ? '<div class="mnote">ルールは協賛企業ページの前のページをご覧ください。</div>' : ''}
      <div class="big">Prize</div>
      ${prizeBlock(t.prize)}
    </aside>
  </div>
</section>`;
};

// 軍団戦ルール(図解)
const TABLE = img('table.png');
const rules = `
<section class="page">
  ${header('SIX TEAM MATCH RULES', '軍団戦のルール &nbsp;/&nbsp; 1/31 sun 11:00 START')}
  <div class="flow">
    <div class="st"><div class="no">STEP 1</div><div class="pile big"><i style="bottom:0px"></i><i style="bottom:7px"></i><i style="bottom:14px"></i><i style="bottom:21px"></i><i style="bottom:28px"></i><i style="bottom:35px"></i><i style="bottom:42px"></i><i style="bottom:49px"></i><i style="bottom:56px"></i></div><div class="v">15,000</div><div class="t">チームスタック<br><small>6人の共有財産</small></div></div>
    <div class="ar"><div>引き出す</div><b>10BB以上</b><span>→</span></div>
    <div class="st"><div class="no">STEP 2</div><div class="pile"><i style="bottom:0px"></i><i style="bottom:7px"></i><i style="bottom:14px"></i></div><div class="v">10BB〜</div><div class="t">好きな量を持って<br>テーブルへ</div></div>
    <div class="ar"><div>置いて</div><b>戦う</b><span>→</span></div>
    <div class="st tb"><div class="no">STEP 3</div><img src="${TABLE}" alt=""><div class="t">チームメンバーが<br>各テーブルでプレイ</div></div>
  </div>
  <div class="loop">バストしたら? → <b>もう一度 STEP 1 へ</b>。チームスタックからチップを引き出してリエントリー(何度でも・いつでも)</div>
  <div class="tm-time">
    <div class="tm-bar"><span class="s">START 11:00</span><span class="r">RC</span></div>
    <div class="tm-lab"><div class="ok">RCまで: いつでも引き出してOK</div><div class="ng">RC以降: 引き出し不可</div></div>
  </div>
  <div class="tm-rules">
    <div class="r"><span>01</span><div>6人で1チーム。各チームに、チーム全員の共有財産である<b>チームスタック 15,000点</b>を付与します。</div></div>
    <div class="r"><span>02</span><div>プレイヤーはチームスタックから<b>10BB以上</b>のチップを引き出し、テーブルに置いて戦います。何BBで入るかは自由です。エントリー・リエントリー・アドオンはすべてこのチームスタックでやりくりします。</div></div>
    <div class="r"><span>03</span><div>チップの追加は<b>いつでも可能</b>。バストしたプレイヤーは、好きなタイミングでチームスタックから引き出してリエントリーできます。</div></div>
    <div class="r warn"><span>04</span><div>チームスタックは<b>RC以降は引き出せません</b>。RCまでにすべてテーブルに置いてください。また、一度テーブルに置いたチップを<b>チームスタックへ戻すことはできません</b>。</div></div>
    <div class="r"><span>05</span><div>チームスタックが<b>0</b>になったチームは敗退です。<b>最後に残った1チーム</b>がインマネとなり、メンバー<b>6名全員</b>がプライズを獲得します。</div></div>
  </div>
  <div class="tm-talk">
    <div class="ok"><div class="k">OK</div><div>ハンドを持っていないチームメンバー同士の相談</div></div>
    <div class="ng"><div class="k">NG</div><div>ハンドを持っているプレイヤーへの話しかけ・相談</div></div>
    <div class="ok"><div class="k">OK</div><div>同じチーム同士がポストフロップ以降ヘッズアップになった時のみ、<b>ショットクロック30秒以内</b>なら相談・チップダンピング(任意の額のチップを渡す)可</div></div>
  </div>
</section>`;

const sp = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'sponsors', f)).toString('base64');
const thanks = `
<section class="page">
  ${header('SPECIAL THANKS', 'OFFICIAL SPONSORS &nbsp;/&nbsp; 協賛企業一覧')}
  <p class="thx-lead">本大会の開催にあたり、ご協賛いただいた皆様に心より感謝申し上げます。</p>
  <div class="splist">${D.sponsors.map((s) => `
    <div class="sp2"><div class="ic ${s.dark ? 'dark' : ''} ${s.photo ? 'photo' : ''}"><img src="${sp(s.logo)}" alt=""></div><div class="nm">${s.name} 様</div></div>`).join('')}</div>
  <div class="thx-foot">${logo(26)}</div>
</section>`;

const base = fs.readFileSync(path.join(__dirname, '..', 'players-guide', 'build.js'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0];
const style = base.replace('</style>', `
.logo .ed { color: #fff; background: var(--dark); padding: 0 .2em; border-radius: .1em; }
.page { background: linear-gradient(160deg, #E8782A 0%, #CC5212 42%, #8A300A 82%, #4A1704 100%); }
.page::before { opacity: .12; background: repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,.7) 22px 23px); }
.sched td { padding: 9px 4px; font-size: 14.5px; }
.sched td.nm em { font-style: normal; font-size: 11px; background: var(--dark); color: var(--cream); padding: 1px 6px; border-radius: 4px; margin-left: 4px; }
.day { font-size: 30px; margin: 4mm 0 1mm; }
.notice { margin-top: 5mm; }
.mnote { font-family: 'Noto Sans JP'; font-size: 11.5px; font-weight: 700; background: rgba(36,16,10,.5); border-radius: 8px; padding: 8px 10px; margin-bottom: 5mm; line-height: 1.55; }
.tbd { font-family: 'Noto Sans JP'; font-size: 11.5px; font-weight: 700; margin-top: 3mm; }
.big small { font-family: 'Noto Sans JP'; font-size: 12px; }
.blind.xxdense td { font-size: 9.6px; padding: 0; line-height: 1.12; }
.blind.xxdense tr.brk td { font-size: 8.5px; }
/* cover (flyer top + FST body) */
.c6 { padding: 0; }
.c6-top { position: relative; height: 105mm; overflow: hidden; }
.c6-top img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.c6-top::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 22mm; background: linear-gradient(180deg, rgba(229,104,31,0), #E2641A); }
.c6-body { padding: 10mm 18mm 0; position: static !important; }
.c6-pg { font-family: Anton; font-size: 96px; line-height: 1.05; border-top: 3px solid #fff; padding-top: 4mm; }
.c6-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 3mm; }
.c6-date { font-family: Anton; font-size: 78px; line-height: 1; color: #3A1205; }
.c6 .c6-foot { position: absolute; left: 18mm; right: 18mm; bottom: 14mm; font-family: 'Noto Sans JP'; font-weight: 700; font-size: 16px; }
.c6-foot small { display: block; font-size: 11.5px; font-weight: 500; margin: 3px 0 0 76px; }
.c6-foot .org { margin-top: 5mm; font-size: 12px; }
.blind.fit td { height: var(--rh); padding: 0; line-height: 1; font-size: calc(var(--rh) * .66); }
.blind.fit tr.brk td { font-size: calc(var(--rh) * .55); }
/* cover #2 (第1回の組み方) */
.c7 { text-align: center; }
.c7-tag { font-family: 'Noto Sans JP'; letter-spacing: .4em; font-size: 16px; margin-top: 2mm; }
.c7-pg { font-family: Anton; font-size: 92px; line-height: 1; margin: 8mm 6mm 0; border-top: 3px solid #fff; border-bottom: 3px solid #fff; padding: 4mm 0; }
.c7-date { font-family: Anton; font-size: 56px; color: #2A1006; margin-top: 8mm; }
.c7-date span { font-size: 22px; background: #fff; color: #C2531A; border-radius: 999px; padding: 4px 14px; vertical-align: middle; }
.c7-title { margin: 18mm auto 0; width: 165mm; text-align: left; }
.c7-title img { width: 100%; display: block; }
.c7-title .city { font-family: Anton; font-size: 24px; letter-spacing: .3em; margin-top: 3mm; }
.c7 .c7-foot { position: absolute; left: 12mm; right: 12mm; bottom: 14mm; text-align: left; font-family: 'Noto Sans JP'; font-weight: 700; font-size: 18px; }
.c7-foot small { display: block; font-size: 12px; margin: 4px 0 0 76px; font-weight: 500; }
.c7-foot .org { margin-top: 6mm; font-size: 12px; }
/* cover (FST style) */
.c6 .c6-mark { margin: 12mm auto 0; } .c6-mark .big { font-size: 150px; } .c6-mark .big span { transform: translateY(17mm); } .c6-mark .words { font-size: 13px; margin-top: 3mm; }
.c5 { padding: 22mm 22mm; }
.c5-top { font-family: Anton; font-size: 40px; color: #3A1205; letter-spacing: .02em; border-bottom: 3px solid #fff; padding-bottom: 3mm; white-space: nowrap; }
.c5-pg { font-family: Anton; font-size: 92px; line-height: 1.1; margin-top: 5mm; letter-spacing: .01em; }
.c5-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2mm; }
.c5-date { font-family: Anton; font-size: 74px; color: #3A1205; line-height: 1; }
.c5-qr { text-align: center; font-family: Oswald; font-weight: 700; font-size: 9px; letter-spacing: .05em; }
.c5-qr img { width: 64px; height: 64px; background: #fff; padding: 3px; display: block; image-rendering: pixelated; }
.c5-mark { position: relative; margin: 42mm auto 0; width: fit-content; }
.c5-mark .big { font-family: Anton; font-size: 200px; line-height: .9; white-space: nowrap; letter-spacing: -.01em; }
.c5-mark .big span { display: inline-block; transform: translateY(24mm); }
.c5-mark .words { margin-top: 6mm; font-family: Oswald; font-weight: 700; font-size: 17px; letter-spacing: .35em; line-height: 1.7; }
/* cover #2 (flyer based) */
.c4 { padding: 12mm; }
.c4::before { content: none; }
.c4-wave { position: absolute; left: 0; top: 0; width: 100%; height: 150mm; fill: none; stroke: rgba(90,30,6,.45); stroke-width: 1.3; }
.c4-tag { text-align: center; font-family: 'Noto Sans JP'; font-weight: 500; letter-spacing: .5em; font-size: 22px; margin-top: 6mm; }
.c4-title { position: relative; font-family: Anton; font-size: 66px; line-height: .98; margin-top: 8mm; letter-spacing: .01em; }
.c4-title b { color: #3A1205; font-weight: 400; }
.c4-num { position: absolute; right: 0; top: 4px; font-size: 140px; line-height: .95; color: #3A1205; }
.c4-year { display: flex; align-items: baseline; gap: 10mm; margin-top: 10mm; font-family: Anton; }
.c4-year span { font-size: 54px; }
.c4-year .y { font-size: 80px; letter-spacing: .5em; }
.c4-pg { display: inline-block; margin-top: 8mm; font-family: Anton; font-size: 36px; letter-spacing: .2em; border: 3px solid #fff; padding: 2mm 6mm; }
.c4-date { position: absolute; left: 12mm; top: 168mm; font-family: Oswald; font-weight: 700; font-size: 120px; line-height: 1; }
.c4-date sup { font-size: 48px; vertical-align: top; }
.c4-date .dw { display: inline-block; font-family: 'Noto Sans JP'; font-weight: 900; font-size: 22px; background: #fff; color: #C2531A; border-radius: 50%; width: 64px; height: 64px; line-height: 64px; text-align: center; vertical-align: middle; margin-left: 8px; }
.c4-who { position: absolute; left: 14mm; top: 214mm; font-family: 'Noto Sans JP'; font-weight: 900; font-size: 20px; letter-spacing: .2em; line-height: 1.6; }
.c4-v { position: absolute; right: 12mm; top: 150mm; display: flex; gap: 4mm; writing-mode: vertical-rl; font-family: 'Noto Serif JP', 'Noto Sans JP'; }
.c4-v .b { font-size: 64px; font-weight: 500; letter-spacing: .1em; }
.c4-v .s { font-size: 22px; letter-spacing: .25em; margin-top: 18mm; }
.c4-foot { position: absolute; left: 12mm; right: 60mm; bottom: 10mm; font-family: 'Noto Sans JP'; font-weight: 700; font-size: 15px; display: grid; gap: 3mm; }
.c4-foot small { display: block; font-size: 11px; font-weight: 500; margin: 2px 0 0 76px; }
.c4-foot .org { font-family: Oswald; letter-spacing: .2em; font-size: 16px; }
/* cover = flyer */
.cover3 { padding: 0; }
.cover3::before { content: none; }
.cover3 .fly { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.c3-pg { position: absolute; left: 39%; top: 70%; font-family: Anton; font-size: 38px; letter-spacing: .06em; color: #fff; border-top: 3px solid #F68B45; border-bottom: 3px solid #F68B45; padding: 4px 4px 2px; line-height: 1.05; }
.c3-pg span { display: block; font-family: Oswald; font-weight: 700; font-size: 12px; letter-spacing: .5em; color: #F68B45; }
/* cover #2 */
.cover2 { display: flex; flex-direction: column; align-items: center; text-align: center; }
.c2-top { width: 100%; display: flex; justify-content: space-between; font-family: Oswald; font-weight: 700; letter-spacing: .25em; font-size: 12px; color: var(--dark); border-bottom: 2px solid var(--dark); padding-bottom: 6px; }
.c2-num { font-family: Anton; font-size: 330px; line-height: .85; color: var(--dark); margin-top: 10mm; letter-spacing: -.02em; }
.c2-title { margin-top: 4mm; }
.c2-title .logo { text-align: center; }
.c2-pg { margin-top: 6mm; font-family: Anton; font-size: 40px; letter-spacing: .22em; border: 3px solid #fff; padding: 2mm 8mm; }
.c2-band { position: absolute; left: 0; right: 0; bottom: 58mm; background: var(--dark); color: #fff; padding: 6mm 0 5mm; transform: skewY(-3deg); }
.c2-date { font-family: Anton; font-size: 64px; line-height: 1; transform: skewY(3deg); }
.c2-date span { font-family: Oswald; font-size: 22px; color: #FFB347; margin: 0 10px 0 6px; vertical-align: middle; }
.c2-year { font-family: Oswald; font-weight: 700; letter-spacing: .4em; color: var(--cream); font-size: 14px; margin-top: 6px; transform: skewY(3deg); }
.c2-copy { position: absolute; bottom: 30mm; left: 0; right: 0; font-family: 'Noto Sans JP'; font-weight: 900; font-size: 30px; letter-spacing: .3em; }
.c2-copy small { display: block; font-size: 13px; letter-spacing: .2em; margin-top: 4px; color: var(--dark); }
.c2-foot { position: absolute; left: 12mm; right: 12mm; bottom: 12mm; text-align: left; font-family: 'Noto Sans JP'; font-weight: 700; font-size: 15px; }
.c2-foot small { display: block; font-size: 11px; margin: 3px 0 0 76px; font-weight: 500; }
/* team match */
.tm-hero { display: grid; grid-template-columns: 1fr 26px 1fr 26px 1.25fr; align-items: center; gap: 2mm; margin-top: 2mm; }
.tm-team, .tm-stack, .tm-table { background: rgba(36,16,10,.5); border-radius: 12px; padding: 10px; text-align: center; font-family: 'Noto Sans JP'; height: 190px; display: flex; flex-direction: column; justify-content: center; }
.tm-k { font-family: Oswald; font-weight: 700; letter-spacing: .2em; font-size: 12px; color: var(--cream); }
.tm-people { display: grid; grid-template-columns: repeat(3, 22px); gap: 6px; justify-content: center; margin: 8px 0; }
.tm-people i { width: 22px; height: 22px; border-radius: 50%; background: #fff; display: block; box-shadow: 0 10px 0 -4px #fff; }
.tm-v { font-family: Anton; font-size: 52px; line-height: 1.1; color: #fff; }
.tm-c { font-size: 12px; font-weight: 700; line-height: 1.4; }
.tm-arrow { font-family: Anton; font-size: 28px; text-align: center; }
.tm-table { background: #fff; color: var(--dark); }
.tm-table img { width: 100%; height: 120px; object-fit: contain; }
.tm-time { margin-top: 8mm; }
.tm-bar { position: relative; height: 28px; border-radius: 999px; background: linear-gradient(90deg, #fff 0 64%, var(--dark) 64% 100%); font-family: Oswald; font-weight: 700; font-size: 12px; letter-spacing: .1em; }
.tm-bar .s { position: absolute; left: 12px; top: 6px; color: var(--dark); }
.tm-bar .r { position: absolute; left: 64%; top: -6px; transform: translateX(-50%); background: #C2531A; color: #fff; border: 2px solid #fff; border-radius: 6px; padding: 6px 10px; }
.tm-lab { display: grid; grid-template-columns: 64% 36%; font-family: 'Noto Sans JP'; font-size: 11px; font-weight: 700; margin-top: 4px; }
.tm-lab .ng { color: var(--cream); padding-left: 8px; }
.tm-rules { margin-top: 7mm; display: grid; gap: 3.5mm; }
.tm-rules .r { display: grid; grid-template-columns: 36px 1fr; gap: 8px; align-items: start; background: rgba(36,16,10,.42); border-radius: 10px; padding: 12px 14px; font-family: 'Noto Sans JP'; font-size: 14px; font-weight: 500; line-height: 1.65; }
.tm-rules .r span { font-family: Anton; font-size: 24px; line-height: 1.05; color: var(--cream); }
.tm-rules .r b { color: var(--cream); font-weight: 900; }
.tm-rules .r.warn { border: 2px solid var(--cream); }
.tm-talk { margin-top: 7mm; display: grid; grid-template-columns: 1fr 1fr; gap: 3.5mm; font-family: 'Noto Sans JP'; font-size: 13.5px; font-weight: 700; line-height: 1.55; }
.tm-talk > div { border-radius: 10px; padding: 12px 14px; display: flex; gap: 10px; align-items: flex-start; }
.tm-talk > div:last-child { grid-column: 1 / -1; }
.tm-talk .ok { background: #fff; color: var(--dark); }
.tm-talk .ng { background: var(--dark); color: #fff; }
.tm-talk .k { font-family: Anton; font-size: 18px; border-radius: 6px; padding: 0 8px; flex: none; }
.tm-talk .ok .k { background: #1F8A4C; color: #fff; }
.tm-talk .ng .k { background: #D93025; color: #fff; }
/* sponsors list */
.thx-lead { font-family: 'Noto Sans JP'; font-weight: 700; font-size: 14px; margin: 1mm 0 7mm; }
.splist { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-flow: column; grid-template-rows: repeat(5, auto); gap: 4mm 6mm; }
.sp2 { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,.45); padding-bottom: 4mm; }
.sp2 .ic { width: 64px; height: 64px; flex: none; border-radius: 8px; background: #fff; display: flex; align-items: center; justify-content: center; padding: 5px; overflow: hidden; }
.sp2 .ic.dark { background: #0b0b0b; }
.sp2 .ic.photo { padding: 0; }
.sp2 .ic img { width: 100%; height: 100%; object-fit: contain; }
.sp2 .ic.photo img { object-fit: cover; }
.sp2 .nm { font-family: Anton, 'Noto Sans JP'; font-size: 17px; letter-spacing: .03em; }
.thx-foot { position: absolute; bottom: 14mm; left: 0; right: 0; display: flex; justify-content: center; }

/* #2: 黒い面に文字を載せない。面は白か半透明の白にする */
.pill { background: #fff !important; color: #C2531A !important; }
.logo b, .logo .ed { color: #FFE2B8; background: none; }
.sched tr.hl td { background: rgba(255,255,255,.22); }
.sched td.nm em { background: #fff; color: #C2531A; }
.max { background: #fff !important; color: #C2531A !important; }
.max small { color: #6b3a1c; }
.blind { background: rgba(255,255,255,.12); }
.blind tr.brk.rc td { background: #fff; color: #C2531A; }
.prize th { background: rgba(255,255,255,.2) !important; }
.mnote, .notice .fee, .notice .app { background: rgba(255,255,255,.18) !important; }
.tm-rules .r { background: rgba(255,255,255,.18) !important; }
.tm-talk .ng { background: #fff !important; color: #24100A !important; }
.tm-bar { background: linear-gradient(90deg, #fff 0 64%, rgba(255,255,255,.35) 64% 100%) !important; }
.tm-lab .ng { color: #fff !important; }
.flow { display: grid; grid-template-columns: 1fr 70px 1fr 70px 1.3fr; align-items: stretch; gap: 2mm; margin-top: 2mm; }
.flow .st { background: #fff; color: #24100A; border-radius: 12px; padding: 10px 8px; text-align: center; font-family: 'Noto Sans JP'; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 215px; }
.flow .no { font-family: Oswald; font-weight: 700; letter-spacing: .2em; font-size: 11px; color: #C2531A; margin-bottom: auto; }
.flow .pile { position: relative; width: 70px; height: 80px; }
.flow .pile i { position: absolute; left: 0; width: 70px; height: 14px; border-radius: 50%; background: #F07A22; border: 2px solid #9C3A0C; box-shadow: inset 0 0 0 4px #FFD7A8; }
.flow .pile:not(.big) { height: 40px; width: 50px; } .flow .pile:not(.big) i { width: 50px; height: 11px; }
.flow .v { font-family: Anton; font-size: 30px; line-height: 1.1; margin-top: 4px; }
.flow .t { font-size: 11.5px; font-weight: 700; line-height: 1.4; }
.flow .t small { font-size: 10px; color: #6b3a1c; }
.flow .tb img { width: 100%; height: 110px; object-fit: contain; }
.flow .ar { display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: 'Noto Sans JP'; font-weight: 900; font-size: 11px; text-align: center; }
.flow .ar b { font-size: 13px; color: #FFE2B8; } .flow .ar span { font-family: Anton; font-size: 34px; line-height: 1; }
.loop { margin-top: 4mm; background: rgba(255,255,255,.18); border: 2px dashed #fff; border-radius: 10px; padding: 9px 12px; font-family: 'Noto Sans JP'; font-weight: 700; font-size: 13px; }
.loop b { color: #FFE2B8; }
</style>`);

const pages = [cover, schedule];
const num = (t) => Number(t.no.replace('#', ''));
for (const t of D.tournaments.filter((x) => !x.schedOnly).sort((x, y) => num(x) - num(y))) pages.push(tPage(t));
pages.push(rules, thanks);

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;700&family=Noto+Sans+JP:wght@500;700;900&family=Noto+Serif+JP:wght@500&display=swap" rel="stylesheet">
${style}</head><body>${pages.join('')}</body></html>`;

(async () => {
  const out = path.join(__dirname, 'out');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const pdf = path.join(out, 'RRST2_プレイヤーズガイド.pdf');
  await p.pdf({ path: pdf, format: 'A4', printBackground: true });
  await b.close();
  for (const f of fs.readdirSync(out)) if (f.endsWith('.png')) fs.unlinkSync(path.join(out, f));
  execSync(`pdftoppm -r 400 -png "${pdf}" "${path.join(out, 'RRST2_プレイヤーズガイド')}"`, { stdio: 'ignore' });
  console.log('ok', pages.length, 'pages');
})();
