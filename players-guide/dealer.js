// ディーラーリファレンスPDF/PNGを作る: node players-guide/dealer.js
// 文言は rules を直す。見た目はプレイヤーズガイド(build.js)の <style> をそのまま使う
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const D = require('./data');

const rules = [
  '当トーナメントは <b>2024 TDA</b> を採用。',
  'ディーラー(プレイングディーラー含む)は <b>クリアハンド</b> を徹底する。',
  'ブレイク後のディーラーに関しては、必ず <b>ウォッシュ</b> から始めること。',
  'クロック要求があった場合、フロアを呼び、フロアが <b>30秒間</b> のカウントを行う。30秒すぎた場合、<b>フォールド</b> となる。',
  '新規プレイヤー、既存プレイヤーが着席する際、<b>テーブルの番号、シートの場所</b> を確認すること。',
  '新規プレイヤー、テーブル移動してきたプレイヤーは、ボタン、SBの間に座った場合、<b>1ハンド休憩</b> になる。',
  '当該プレイヤーがオールインをした際、<b>カウント要求があるまでカウントしてはならない</b>。又、オールインマーカーはテーブル中央に置くこと。',
  'オールインコールがあった場合、<b>手を挙げてフロアを呼ぶ</b> こと。シートオープンした際、フロアに開いたシートを渡す。',
  'ハンドプレイ中のプレイヤーは電話、GTOなどの解析ソフトならびに、動画の視聴は <b>禁止</b> とする。又、テーブルの上に電話その他の機器は置いてはならない。',
  'OOT(アウトオブターン)に関しては、プリフロップ、フロップのフォールドはペナルティー対象にならないが、頻繁する場合はペナルティーが発生する。チップ投入を伴うOOTはアクションを巻き戻し、正しいアクションで行う。OOTで先にチップ投入したプレイヤーに関しては <b>次回のハンドはキル</b> になる。',
  'メインイベント、<b>残り10人から H4H(ハンドフォーハンド)</b> を採用。1ハンド毎に2分のタイマーが進む。ディーラーはオールインがあっても <b>フロアの指示があるまでハンドを公開してはいけない</b>。',
];
const closing = 'すべてのお客様が楽しかった、また来たいと思えるような接客を心がける。';

const style = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0]
  .replace('</style>', `
.rules { list-style: none; counter-reset: r; }
.rules li { counter-increment: r; display: grid; grid-template-columns: 34px 1fr; gap: 10px; padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,.45);
  font-family: 'Noto Sans JP'; font-size: 15px; font-weight: 500; line-height: 1.65; }
.rules li::before { content: counter(r, decimal-leading-zero); font-family: Anton; font-size: 24px; line-height: 1.1; color: var(--cream); }
.rules b { font-weight: 900; color: var(--dark); background: rgba(255,226,184,.85); padding: 0 3px; border-radius: 3px; white-space: nowrap; }
.closing { margin-top: 6mm; background: var(--dark); color: var(--cream); border-radius: 8px; padding: 12px 16px; font-family: 'Noto Sans JP'; font-weight: 700; font-size: 14px; text-align: center; }
.closing span { font-family: Oswald; letter-spacing: .2em; font-size: 11px; display: block; margin-bottom: 4px; }
</style>`);

const logo = `<div class="logo" style="font-size:13px"><div><b>R</b>UNNER <b>R</b>UNNER</div><div><b>S</b>UPER <b>T</b>OURNAMENT</div><div class="city">${D.event.city}</div></div>`;
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;700&family=Noto+Sans+JP:wght@500;700;900&display=swap" rel="stylesheet">
${style}</head><body>
<section class="page">
  <header class="head"><div><h1>DEALER REFERENCE GUIDE</h1><div class="sub">${D.event.date} &nbsp;FUKUOKA &nbsp;/&nbsp; STAFF ONLY</div></div><div class="mark">${logo}</div></header>
  <ol class="rules">${rules.map((r) => `<li><div>${r}</div></li>`).join('')}</ol>
  <div class="closing"><span>HOSPITALITY</span>${closing}</div>
</section></body></html>`;

(async () => {
  const out = path.join(__dirname, 'out');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2.5 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(out, 'ディーラーリファレンス.pdf'), format: 'A4', printBackground: true });
  await p.screenshot({ path: path.join(out, 'ディーラーリファレンス.png'), clip: { x: 0, y: 0, width: 794, height: 1123 } });
  await b.close();
  console.log('ok');
})();
