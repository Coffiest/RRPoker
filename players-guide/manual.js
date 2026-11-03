// ディーラーマニュアルPDF/PNGを作る: node players-guide/manual.js
// 文言は sections を直す。見た目はプレイヤーズガイド(build.js)の <style> をそのまま使う
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const D = require('./data');

// [見出し, 中身の行]。行頭 '→' は字下げ、'1.' などは手順として表示
const sections = [
  ['フロアの呼び方', ['<b>必ず手を挙げて、大きな声で叫ぶ。</b>',
    'オールインでコールが入った時', '→「<b>オールインコール!!</b>」',
    'プレイヤーが飛んで席が空いた時', '→「<b>プレイヤーアウト!</b>」/「<b>ワンシートオープン!</b>」',
    'プレイングディーラーが飛んでリエントリーする時', '→手を挙げてフロアを呼ぶ',
    '作業中に分からなくなった時', '→手を挙げてフロアを呼ぶ(<b>自己判断は絶対にしない</b>)']],
  ['デック', ['ワンデック運用。', 'ブレイク中はデックをソートして待機する。']],
  ['ブラインドが上がるタイミング', ['タイマーで次のレベルが表示された時点で、レベルが上がる。', '新しいブラインドは「<b>次のハンド</b>」から適用する。',
    'ハンドの開始 = シャッフルの<b>最初のリフル</b>。', 'リフルを始めた瞬間にレベルが上がっていれば、新しいブラインドで配る。']],
  ['カラーアップ(チップレース)', ['カラーアップは事前に告知された時だけ行う。', '手順:',
    '1. 外す額面の細かいチップを、各プレイヤーの前で集める。', '2. 上の額面に両替できる分は、そのまま両替する。',
    '3. 両替しきれない端数のチップだけを、レースにかける。', '4. 端数チップ1枚につきカードを1枚表向きで配る(シート1から)。',
    '5. 一番強いカード(数字→スートの順)の人が、上の額面1枚を受け取る。<b>1人1枚まで</b>。',
    '6. ハイカードまで終えたら、<b>確定させずにフロアを待つ</b>。',
    'レースでチップがゼロになる人は出さない。最低1枚は残す。', 'やり方が分からない人は、事前に運営へ聞く。']],
  ['新規卓のアサイン', ['ピットで初期スタック(素点)を組み、デックと一緒に卓へ持っていく。', '事前に、自分が担当するイベントの<b>初期スタック</b>を把握しておく。']],
  ['シートカード', ['ブレイク中にシートカードが合っているか確認し、見える位置に置く。']],
  ['プレイングディーラーの交代', ['交代の方法は、交代する本人から聞く。', '本人も分からない場合は、<b>必ず一度運営に聞きに来る</b>。']],
  ['#4 RR Double Stack AoF の裁定', ['プレイヤーが飛んだらフロアを呼び、2スタック目を渡す。', '2スタック目は<b>レジクロまでに必ず出し切る</b>。',
    'レジクロの時点で残っていれば、強制的に渡す。', '分からない場合は、事前に必ず聞いておく。']],
  ['テーブルブレイク(卓が閉じた時)', ['デックをピット(運営)に返す。', 'テーブルの上に残すのは<b>オールインマーカーだけ</b>。']],
];

const line = (t) => t.startsWith('→') ? `<li class="sub">${t}</li>` : /^\d\./.test(t) ? `<li class="step"><span>${t[0]}</span>${t.slice(2).trim()}</li>` : `<li>${t}</li>`;
const card = ([h, ls], i) => `<section class="sec"><h3><span>${String(i + 1).padStart(2, '0')}</span>${h}</h3><ul>${ls.map(line).join('')}</ul></section>`;

const style = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0]
  .replace('</style>', `
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.sec { break-inside: avoid; background: rgba(36,16,10,.38); border-radius: 8px; padding: 10px 12px 8px; margin-bottom: 4.5mm; font-family: 'Noto Sans JP'; }
.sec h3 { font-size: 14.5px; font-weight: 900; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,.5); padding-bottom: 6px; margin-bottom: 6px; }
.sec h3 span { font-family: Anton; font-weight: 400; font-size: 20px; color: var(--cream); }
.sec ul { list-style: none; }
.sec li { font-size: 11.6px; font-weight: 500; line-height: 1.6; padding: 1.5px 0 1.5px 12px; position: relative; }
.sec li::before { content: '·'; position: absolute; left: 2px; color: var(--cream); font-weight: 900; }
.sec li.sub { padding-left: 24px; } .sec li.sub::before { content: none; }
.sec li.step { padding-left: 26px; } .sec li.step::before { content: none; }
.sec li.step span { position: absolute; left: 8px; top: 3px; width: 14px; height: 14px; border-radius: 50%; background: var(--cream); color: var(--dark); font-family: Oswald; font-weight: 700; font-size: 10px; line-height: 14px; text-align: center; }
.sec b { font-weight: 900; color: var(--cream); }
</style>`);

const logo = `<div class="logo" style="font-size:13px"><div><b>R</b>UNNER <b>R</b>UNNER</div><div><b>S</b>UPER <b>T</b>OURNAMENT</div><div class="city">${D.event.city}</div></div>`;
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;700&family=Noto+Sans+JP:wght@500;700;900&display=swap" rel="stylesheet">
${style}</head><body>
<section class="page">
  <header class="head"><div><h1>DEALER MANUAL</h1><div class="sub">RUNNER RUNNER SUPER TOURNAMENT &nbsp;${D.event.date} &nbsp;/&nbsp; STAFF ONLY</div></div><div class="mark">${logo}</div></header>
  <div class="cols"><div>${[0,1,2,4,5].map((i) => card(sections[i], i)).join('')}</div><div>${[3,6,7,8].map((i) => card(sections[i], i)).join('')}</div></div>
</section></body></html>`;

(async () => {
  const out = path.join(__dirname, 'out');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2.5 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(out, 'ディーラーマニュアル.pdf'), format: 'A4', printBackground: true });
  await p.screenshot({ path: path.join(out, 'ディーラーマニュアル.png'), clip: { x: 0, y: 0, width: 794, height: 1123 } });
  await b.close();
  console.log('ok');
})();
