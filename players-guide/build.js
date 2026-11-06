// プレイヤーズガイドPDFを作る: node players-guide/build.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const D = require('./data');

const QR = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, D.event.app.qr)).toString('base64');
const n = (v) => v.toLocaleString('en-US');
const yen = (v) => n(v);
const addMin = (t, m) => {
  const [h, mm] = t.split(':').map(Number);
  const x = h * 60 + mm + m;
  return `${Math.floor(x / 60) % 24}:${String(x % 60).padStart(2, '0')}`;
};

// RRST ロゴ(ポスターの文字組みを再現。頭文字 R R S T を差し色に)
const logo = (size) => `
<div class="logo" style="font-size:${size}px">
  <div><b>R</b>UNNER <b>R</b>UNNER</div>
  <div><b>S</b>UPER <b>T</b>OURNAMENT</div>
  <div class="city">${D.event.city}</div>
</div>`;

const header = (title, sub) => `
<header class="head">
  <div>
    <h1>${title}</h1>
    <div class="sub">${sub}</div>
  </div>
  <div class="mark">${logo(13)}</div>
</header>`;

const cover = `
<section class="page cover">
  <div class="kicker">RUNNER RUNNER 2 YEARS</div>
  <div class="tag">- 己の才能を証明せよ -</div>
  <h2 class="pg">PLAYER'S GUIDE</h2>
  <div class="cdate">${D.event.date} <span>SAT</span></div>
  <div class="cover-logo">${logo(64)}</div>
  <div class="cover-foot">
    <div><span class="pill">VENUE</span>${D.event.venue}<small>${D.event.address}</small></div>
    <div class="org">${D.event.org}</div>
  </div>
</section>`;

const schedule = `
<section class="page">
  ${header('EVENT SCHEDULE', `${D.event.date} &nbsp;FUKUOKA`)}
  <table class="sched">
    <thead><tr><th>START</th><th>CLOSE</th><th>NO</th><th>TOURNAMENT</th><th>ENTRY 学生/一般</th><th>STACK</th></tr></thead>
  </table>
  <div class="day">${D.event.dayLabel} <span>${D.event.dow}</span><em class="max">ALL TABLES 8-MAX<small>全席固定 8人テーブル</small></em></div>
  <table class="sched">
    <tbody>${D.schedule.map((r) => `<tr class="${r.main ? 'hl' : ''}"><td>${r.start}</td><td>${r.close}</td><td>${r.no}</td><td class="nm">${r.name}</td><td>${r.entry}${r.note ? `<small class="cap">${r.note}</small>` : ''}</td><td>${r.stack}</td></tr>`).join('')}</tbody>
  </table>
  <p class="note">ENTRY は 学生 / 一般 の参加費です。CLOSE はレイトレジストレーション(参加受付)締切の目安です。進行により前後する場合があります。</p>
  <div class="notice">
    <div class="fee"><span class="pill">FEE</span>施設利用料として、お一人様 <b>${n(D.event.facilityFee)}</b> をいただきます(参加費とは別)。</div>
    <div class="app">
      <img src="${QR}" alt="">
      <div><span class="pill">APP</span><b>${D.event.app.name}</b> の登録が必須です。<br><small>当日スムーズに参加できるよう、事前に登録をお済ませください。</small><span class="url">${D.event.app.url}</span></div>
    </div>
  </div>
  <div class="venue-box">
    <div><span class="pill">VENUE</span><b>${D.event.venue}</b><small>${D.event.address}</small></div>
  </div>
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

const tPage = (t) => {
  const rcIdx = t.levels.findIndex((l) => !Array.isArray(l) && l.rc);
  let rcTime = t.start;
  t.levels.slice(0, rcIdx + 1).forEach((l) => { rcTime = addMin(rcTime, Array.isArray(l) ? l[3] : l.m); });
  const dense = t.levels.length > 46 ? 'dense xdense' : t.levels.length > 36 ? 'dense' : '';
  return `
<section class="page">
  ${header(`${t.no} ${t.name}`, `${D.event.dayLabel} ${D.event.dow} ${t.start} START${t.note ? ' &nbsp;/&nbsp; ' + t.note : ''}`)}
  <div class="grid">
    <table class="blind ${dense}">
      <thead><tr><th>Time</th><th>Lv</th><th>Blind</th><th>Ante</th><th>Min</th></tr></thead>
      <tbody>${blindRows(t)}</tbody>
    </table>
    <aside>
      <div class="big">Entry</div>
      <table class="prize entry">${t.entry.all ? `<tr><th>All</th><td>${yen(t.entry.all)}</td></tr>` : `<tr><th>学生</th><td>${yen(t.entry.student)}</td></tr><tr><th>一般</th><td>${yen(t.entry.adult)}</td></tr>`}</table>
      <dl>
        <dt>Starting Chips</dt><dd>${n(t.chips)} <small>(${t.stackBB})</small></dd>
        <dt>Late Reg</dt><dd>${rcTime}</dd>${t.cap ? `<dt>Cap</dt><dd>${t.cap}</dd>` : ''}
      </dl>
      <div class="big">Prize</div>
      <table class="prize">
        <tr><th>Total</th><td>${yen(t.prize.total)}</td></tr>
        <tr><th>In Money</th><td>${t.prize.inMoney}${['', 'st', 'nd', 'rd'][t.prize.inMoney] || 'th'}</td></tr>
      </table>
      <table class="places">${t.prize.places.map((p) => `<tr><th>${p[0]}</th><td>${p[1].replace(/PokerART Platinum 1ヶ月/, '<span class="plat">PokerART Platinum 1ヶ月</span>')}${p[2] ? '<span class="tro">+ Trophy</span>' : ''}${(p[3] || []).map((x) => `<span class="tkt">+ ${x}</span>`).join('')}</td></tr>`).join('')}</table>
    </aside>
  </div>
</section>`;
};

const img = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'sponsors', f)).toString('base64');
const thanks = `
<section class="page">
  ${header('SPECIAL THANKS', 'OFFICIAL SPONSORS &nbsp;/&nbsp; 協賛企業一覧')}
  <p class="thx-lead">本大会の開催にあたり、ご協賛いただいた皆様に心より感謝申し上げます。</p>
  <div class="thx">${D.sponsors.map((s, i) => `
    <div class="sp ${i === 0 ? 'wide' : ''}">
      <div class="lg ${s.dark ? 'dark' : ''} ${s.round ? 'round' : ''}"><img src="${img(s.logo)}" alt=""></div>
      <div class="nm">${s.name}</div>
    </div>`).join('')}</div>
  <div class="thx-foot">${logo(30)}</div>
</section>`;

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;700&family=Noto+Sans+JP:wght@500;700;900&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --ink:#fff; --dark:#24100A; --cream:#FFE2B8; }
body { font-family: Oswald, 'Noto Sans JP', sans-serif; color: var(--ink); }
.page { width: 210mm; height: 297mm; padding: 14mm 12mm; position: relative; overflow: hidden; page-break-after: always;
  background: radial-gradient(120% 70% at 20% 0%, #F7A048 0%, #E5701F 38%, #A8410E 72%, #4A1A06 100%); }
.page::before { content:''; position:absolute; inset:0; opacity:.18; pointer-events:none;
  background: repeating-radial-gradient(ellipse 140% 60% at 50% -10%, transparent 0 9px, rgba(255,255,255,.7) 9px 10px); }
.page > * { position: relative; }
.logo { font-family: Anton, sans-serif; line-height: .95; letter-spacing: .01em; text-align: left; }
.logo b { color: var(--dark); font-weight: 400; }
.logo .city { font-size: .42em; letter-spacing: .3em; margin-top: .25em; }
/* cover */
.cover { text-align: center; display: flex; flex-direction: column; align-items: center; }
.kicker { background: var(--dark); color: var(--cream); font-weight: 700; letter-spacing: .35em; padding: 8px 28px; font-size: 18px; margin-top: 6mm; }
.tag { font-family: 'Noto Sans JP'; letter-spacing: .4em; margin-top: 8mm; font-size: 16px; }
.pg { font-family: Anton; font-weight: 400; font-size: 92px; letter-spacing: .01em; margin-top: 10mm; line-height: 1; border-top: 3px solid #fff; border-bottom: 3px solid #fff; padding: 4mm 0; }
.cdate { font-family: Anton; font-size: 58px; color: var(--dark); margin-top: 7mm; }
.cdate span { font-size: 26px; background: #fff; color: #C2531A; border-radius: 999px; padding: 4px 14px; vertical-align: middle; }
.cover-logo { margin-top: 18mm; }
.cover-foot { position: absolute; left: 12mm; right: 12mm; bottom: 14mm; text-align: left; font-family: 'Noto Sans JP'; font-weight: 700; font-size: 18px; }
.cover-foot small, .venue-box small { display: block; font-size: 12px; margin: 4px 0 0 76px; font-weight: 500; }
.org { margin-top: 6mm; font-size: 12px; }
.pill { display: inline-block; width: 64px; text-align: center; background: var(--dark); color: var(--cream); border-radius: 999px; font-family: Oswald; font-size: 12px; letter-spacing: .15em; padding: 3px 0; margin-right: 12px; vertical-align: middle; }
/* header */
.head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid rgba(255,255,255,.8); padding-bottom: 4mm; margin-bottom: 5mm; }
.head h1 { font-family: Anton; font-weight: 400; font-size: 46px; line-height: 1; }
.head .sub { font-weight: 700; font-size: 16px; margin-top: 6px; color: var(--dark); letter-spacing: .05em; }
.mark { border-left: 2px solid rgba(255,255,255,.8); padding-left: 4mm; }
/* schedule */
table { border-collapse: collapse; width: 100%; }
.sched th { background: #fff; color: var(--dark); font-size: 14px; letter-spacing: .08em; padding: 6px 0; border: 3px solid transparent; background-clip: padding-box; }
.sched td { text-align: center; padding: 12px 4px; font-size: 16px; font-weight: 700; border-top: 1px solid rgba(255,255,255,.75); border-bottom: 1px solid rgba(255,255,255,.75); }
.sched td + td { border-left: 1px solid rgba(255,255,255,.35); }
.sched th:nth-child(1), .sched td:nth-child(1), .sched th:nth-child(2), .sched td:nth-child(2) { width: 12%; }
.sched th:nth-child(3), .sched td:nth-child(3) { width: 8%; }
.sched th:nth-child(5), .sched td:nth-child(5), .sched th:nth-child(6), .sched td:nth-child(6) { width: 14%; }
.sched tr.hl td { background: rgba(36,16,10,.55); }
.day { font-family: Anton; font-size: 40px; margin: 6mm 0 2mm; }
.max { float: right; font-style: normal; font-family: Oswald; font-weight: 700; font-size: 14px; letter-spacing: .12em; color: var(--cream); background: var(--dark); border-radius: 6px; padding: 6px 12px; margin-top: 10px; line-height: 1.2; text-align: center; }
.max small { display: block; font-family: 'Noto Sans JP'; font-size: 10px; letter-spacing: .05em; }
.day span { font-family: Oswald; font-size: 26px; color: var(--dark); }
.note { font-family: 'Noto Sans JP'; font-size: 11px; font-weight: 500; margin-top: 4mm; }
.notice { margin-top: 8mm; font-family: 'Noto Sans JP'; display: grid; gap: 4mm; }
.notice .fee, .notice .app { background: rgba(36,16,10,.5); border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 700; line-height: 1.6; }
.notice b { color: var(--cream); font-size: 16px; }
.notice .app { display: flex; gap: 16px; align-items: center; }
.notice .app img { width: 96px; height: 96px; background: #fff; border-radius: 6px; padding: 4px; image-rendering: pixelated; }
.notice .app small { font-size: 11.5px; font-weight: 500; }
.notice .url { display: block; font-family: Oswald; letter-spacing: .05em; font-size: 14px; color: var(--cream); margin-top: 4px; }
.thx-lead { font-family: 'Noto Sans JP'; font-weight: 700; font-size: 15px; margin: 2mm 0 8mm; }
.thx { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.sp { background: rgba(36,16,10,.45); border-radius: 12px; padding: 14px; text-align: center; }
.sp.wide { grid-column: 1 / -1; }
.sp .lg { height: 140px; border-radius: 8px; background: #fff; display: flex; align-items: center; justify-content: center; padding: 12px; }
.sp.wide .lg { height: 200px; }
.sp .lg.dark { background: #0b0b0b; }
.sp .lg img { max-width: 100%; max-height: 100%; object-fit: contain; }
.sp .lg.round { background: transparent; }
.sp .lg.round img { height: 130px; width: 130px; border-radius: 50%; border: 3px solid #fff; }
.sp .nm { font-family: Anton; font-size: 22px; letter-spacing: .04em; margin-top: 8px; }
.thx-foot { position: absolute; bottom: 14mm; left: 0; right: 0; display: flex; justify-content: center; }
.venue-box { position: absolute; left: 12mm; right: 12mm; bottom: 14mm; font-family: 'Noto Sans JP'; font-size: 18px; }
/* tournament */
.grid { display: grid; grid-template-columns: 58% 1fr; gap: 8mm; }
.blind { background: rgba(36,16,10,.42); }
.blind th { background: #fff; color: var(--dark); font-size: 12px; padding: 4px 0; }
.blind td { text-align: center; font-size: 12.5px; font-weight: 500; padding: 2.6px 0; border: 1px solid rgba(255,255,255,.4); font-variant-numeric: tabular-nums; }
.blind.dense td { font-size: 11.5px; padding: 1.6px 0; }
.blind.xdense td { font-size: 10.5px; padding: 0.4px 0; line-height: 1.25; }
.blind.xdense tr.brk td { padding: 0; font-size: 9.5px; }
.blind td:first-child { color: var(--cream); width: 16%; }
.blind td:nth-child(2) { width: 10%; }
.blind tr.brk td { background: rgba(255,255,255,.18); font-size: 10.5px; letter-spacing: .08em; padding: 1.5px 0; }
.blind tr.brk.rc td { background: var(--dark); color: var(--cream); }
aside .big { font-family: Anton; font-size: 26px; margin: 0 0 2mm; }
aside dl { margin-top: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 15px; font-weight: 700; margin-bottom: 5mm; }
aside dt { color: var(--dark); }
aside dd small { font-size: 12px; }
.prize th, .places th { text-align: left; font-size: 15px; padding: 7px 10px; background: rgba(36,16,10,.6); width: 40%; }
.prize td, .places td { font-size: 18px; font-weight: 700; padding: 7px 10px; border-bottom: 2px solid #fff; }
.prize tr:first-child td, .prize tr:first-child th { border-top: 3px solid #fff; }
.places { margin-top: 5mm; }
.places th { background: transparent; color: var(--cream); border-bottom: 1px solid rgba(255,255,255,.5); }
.places td { border-bottom: 1px solid rgba(255,255,255,.5); }
.entry { margin-bottom: 4mm; }
.entry th { font-family: 'Noto Sans JP'; }
.plat { display: inline-block; font-size: 11.5px; font-weight: 700; color: var(--dark); background: #fff; border-radius: 4px; padding: 1px 6px; }
.places td { font-size: 15px; }
.places th, .places td { padding: 3px 10px; }
.cap { display: block; font-size: 10px; color: var(--cream); font-family: 'Noto Sans JP'; }
.tkt { display: block; width: fit-content; margin-top: 2px; font-size: 9.5px; line-height: 1.3; font-weight: 700; color: #fff; background: #1546D9; border-radius: 4px; padding: 1px 6px; }
.tro { font-size: 11px; color: var(--dark); background: var(--cream); border-radius: 4px; padding: 1px 6px; margin-left: 8px; vertical-align: middle; }
</style></head><body>
${cover}${schedule}${D.tournaments.map(tPage).join('')}${thanks}
</body></html>`;

(async () => {
  const out = path.join(__dirname, 'out');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'players-guide.html'), html);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(out, 'プレイヤーズガイド.pdf'), format: 'A4', printBackground: true });
  await b.close();
  console.log('ok');
})();
