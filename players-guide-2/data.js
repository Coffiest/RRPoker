// RRST #2 プレイヤーズガイドの中身。ここを直して node players-guide-2/build.js
// ブラインドは blinds.txt(== キー ごと)。賞金は未定なので prize: null は「TBD」と表示する
const fs = require('fs');
const path = require('path');

const PLAT = 'PokerART Platinum 1ヶ月';
const ord = (i) => i + (['th', 'st', 'nd', 'rd'][i % 10 > 3 || [11, 12, 13].includes(i % 100) ? 0 : i % 10]);
const places = (cash, plat, trophy = false, extra = {}) => {
  const rows = [];
  for (let i = 1; i <= Math.max(cash.length, plat); i++) {
    const c = cash[i - 1];
    rows.push([ord(i), [c ? c.toLocaleString('en-US') : '', i <= plat ? PLAT : ''].filter(Boolean).join(' + '), trophy && i === 1, extra[i] || []]);
  }
  return rows;
};

// blinds.txt を読む。行 "SB/BB/Ante/分"、ブレイク行 "B 分 [RC / 補足]"
const blinds = {};
let cur;
for (const line of fs.readFileSync(path.join(__dirname, 'blinds.txt'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t) continue;
  if (t.startsWith('==')) { cur = t.slice(2).trim(); blinds[cur] = []; continue; }
  if (t.startsWith('B ')) {
    const [, m, ...rest] = t.split(' ');
    let note = rest.join(' ');
    const rc = note.startsWith('RC');
    note = note.replace(/^RC\s*\/?\s*/, '');
    blinds[cur].push({ m: Number(m), rc, note });
  } else blinds[cur].push(t.split('/').map(Number));
}

const days = { d1: { label: '1/30', dow: 'sat' }, d2: { label: '1/31', dow: 'sun' } };
const sf = (student, adult) => ({ student, adult });

module.exports = {
  event: {
    edition: '#2',
    city: 'FUKUOKA',
    date: '2027.01.30-31',
    venue: 'eスタジアムコミュニティハウス福岡', // 会場未定。決まったらここを直す
    address: '福岡県福岡市中央区薬院4丁目2-11',
    facilityFee: 1000,
    app: { name: 'RRPoker', url: 'https://rrpoker.vercel.app/', qr: 'app-qr.png' },
    org: 'RR -Runner Runner- ポーカーサークル(旧九工大ポーカー研究会)',
  },
  days,
  sponsors: [
    { name: 'SPADIE', logo: 'spadie.png' },
    { name: 'XPT', logo: 'xpt.png', dark: true },
    { name: 'FST', logo: 'fst.png', dark: true },
    { name: 'Runner Runner', logo: 'rr.png' },
    { name: 'こうだい(仮)', logo: 'koudai.png', photo: true },
  ],
  // schedule 表示順 = この並び。chips はスタート点数、prize: null は未定
  tournaments: [
    { no: '#2', name: 'SUPER HIGH ROLLER', day: 'd1', start: '11:00', entry: { all: 50000 }, chips: 20000, cap: '30名限定', levels: blinds.shr, prize: { total: 900000, inMoney: 3, places: places([600000, 200000, 100000], 8) } },
    { no: '#1', name: 'MAIN EVENT', sub: 'Day1', day: 'd1', start: '11:00', entry: sf(300, 1500), chips: 500, levels: blinds.main, prize: { total: 50000, inMoney: 8, places: places([20000, 8000, 7000, 5000, 3000, 3000, 2000, 2000], 8, true) }, main: true,
      note: 'Day1 は残り8名まで。Day2(1/31 16:30〜)は中断したレベルのタイマー続きから再開' },
    { no: '#3', name: 'TAG TEAM', day: 'd1', start: '17:30', entry: sf(300, 1500), entryNote: '1人あたり', chips: 300, levels: blinds.tag, prize: { total: 25000, inMoney: 4, places: places([10000, 7000, 5000, 3000], 8) } },
    { no: '#4', name: 'SIX TEAM MATCH', sub: '軍団戦', day: 'd2', start: '11:00', entry: sf(1000, 3000), entryNote: '1人あたり', chips: 15000, chipsNote: 'チームスタック', levels: blinds.team, prize: { total: 18000, inMoney: '1 team', places: [['WIN TEAM', '各 3,000 + ' + PLAT + '<br><small>(6名全員)</small>', false, []]] }, rules: true },
    { no: '#5', name: 'CHAMPIONSHIP', day: 'd2', start: '11:00', entry: sf(300, 1500), chips: 500, levels: blinds.champ, prize: { total: 35000, inMoney: 6, places: places([15000, 7000, 5000, 3000, 3000, 2000], 8) } },
    { no: '#1', name: 'MAIN EVENT', sub: 'Day2', day: 'd2', start: '16:30', schedOnly: true, main: true },
    { no: '#6', name: 'RR SUPER TURBO', day: 'd2', start: '17:30', entry: sf(300, 1500), chips: 300, levels: blinds.turbo, prize: { total: 10000, inMoney: 4, places: places([5000, 2500, 1500, 1000], 8) } },
    { no: '#7', name: 'RR DOUBLE STACK AoF', day: 'd2', start: '20:30', entry: { all: 300 }, chips: 30000, note: 'All-in or Fold', levels: blinds.aof,
      prize: { total: 3000, inMoney: 2, places: places([2000, 1000], 5) } },
  ],
};
