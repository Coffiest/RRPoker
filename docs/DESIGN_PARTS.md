# RRPoker の部品とデザイン案(オーナー指定・2026-11-10)

オーナーが選んだ Uiverse.io の部品の一覧。
- 「使っている」部品は、新しい画面でも必ずこれを使う(統一のルール。CLAUDE.md の「共通の部品」)。
- 「案として保存」の部品は、まだ使っていない。いつか使えるように、元の CSS をそのまま残す。
- 色は金(#F2A900 / 濃い金 #D4910A・#B57F00)・白・黒(#1C1C1E)に合わせる。金の面の上の文字とアイコンは白にする。
- 文字の灰は `--label2` / `--label3` まで。元の CSS にある薄い灰(#9e9ea7 など)は文字には使わない。

## 一覧

| 用途 | 作者 | アプリでの名前 | 使っている所 |
| --- | --- | --- | --- |
| 文字のボタン(アニメの無いボタンはすべて) | Gaurav-WebDev | `.rr-btn`(`is-gold` / `is-solid` / `is-danger` / `is-danger-solid` / `is-green` / `is-mute` / `is-on-dark`、`is-block` / `is-sm`) | 店舗の各画面・モーダルの確定・キャンセル・保存・承認・却下・詳細 など |
| 丸いアイコンのボタン(戻る・閉じる) | karthik092726122003 | `components/BackButton.tsx`(戻る)と `RingButton`(閉じる・編集などのアイコン) | 全画面の戻る、モーダル・シートの閉じる、店舗マイページの編集 |
| トップの「今すぐはじめる」 | AatreyuShau | `.rr-hand`(`app/page.tsx`) | トップページのヒーローの一番上 |
| 開く・たたむの印 | AbanoubMagdy1 | `components/ExpandIcon.tsx`(`.rr-expand`) | 店舗ホームの大会カードの開閉 |
| 足すボタン(丸の +) | mRcOol7 | `components/AddButton.tsx`(`AddButton` / 行の中は `AddIcon`) | 系列店の追加、新しいブラインドを作る |
| チェックボックス | Tsiangana | `components/RrCheckbox.tsx`(`RrCheckbox` / 行の中は `CheckMark`) | 純増する、無期限、SPLIT VIEW の大会選び |
| お気に入り | andrew-demchenk0 | `.rr-fav` | プレイヤーの店舗詳細の星 |
| トグルスイッチ(すべて) | ErzenXz | `.a-switch`(緑 #05c46b・52×28 に縮小) | 全画面のスイッチ |
| 読み込み中(すべて) | PriyanshuGupta28 | `components/Loader.tsx`(`.rr-loader` / `.rr-spin`。金、`light` で白) | 全画面の読み込み |
| テキストボックス(すべて) | alexruix | `globals.css` の input / textarea / select(薄い灰、乗せる・押すと白と金の輪) | 全画面の入力欄(管理者画面と `.rr-input-plain` を除く) |
| テキストボックス(暗い案) | Jaareet | 案として保存 | まだ使っていない(暗い面の上の入力欄に使える) |
| 2〜4 択の切り替え | Yaya12085 | `.rr-seg`(選んだものに `aria-pressed` / `aria-selected`) | 在店中/退店済、TIME/BLIND、曜日、表示言語、単位の位置、スタンプの並び、月払い/年払い |
| 水玉の下地 | Yaya12085 | `.rr-dots`(白黒を薄くした) | 空の状態(プレイヤーがいない、ブラインド・終了した大会がない) |

ほかに足した小さな動き(元の部品ではない):
- `.rr-row`: 一覧の行のボタン。乗せると薄い金、押すと少し縮む。
- `.rr-ok`: 見出しの右の緑の ✓(確定)。乗せると少し大きく光り、押すと縮む。
- `.rr-ctl`: タイマー全画面の暗い操作バーの丸いボタン。乗せると金の輪。

## 元の CSS(そのまま保存)

### Gaurav-WebDev(文字のボタン)
```css
.button { height: 50px; width: 200px; position: relative; background-color: transparent; cursor: pointer; border: 2px solid #252525; overflow: hidden; border-radius: 30px; color: #333; transition: all 0.5s ease-in-out; }
.btn-txt { z-index: 1; font-weight: 800; letter-spacing: 4px; }
.type1::after { content: ""; position: absolute; left: 0; top: 0; transition: all 0.5s ease-in-out; background-color: #333; border-radius: 30px; visibility: hidden; height: 10px; width: 10px; z-index: -1; }
.button:hover { box-shadow: 1px 1px 200px #252525; color: #fff; border: none; }
.type1:hover::after { visibility: visible; transform: scale(100) translateX(2px); }
```

### karthik092726122003(丸いアイコンのボタン)
```css
.styled-wrapper .button { display: block; position: relative; width: 76px; height: 76px; margin: 0; overflow: hidden; outline: none; background-color: transparent; cursor: pointer; border: 0; }
.styled-wrapper .button:before { content: ""; position: absolute; border-radius: 50%; inset: 7px; border: 3px solid black; transition: opacity 0.4s cubic-bezier(0.77, 0, 0.175, 1) 80ms, transform 0.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) 80ms; }
.styled-wrapper .button:after { content: ""; position: absolute; border-radius: 50%; inset: 7px; border: 4px solid #599a53; transform: scale(1.3); transition: opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1), transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94); opacity: 0; }
.styled-wrapper .button:hover:before, .styled-wrapper .button:focus:before { opacity: 0; transform: scale(0.7); transition: opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1), transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.styled-wrapper .button:hover:after, .styled-wrapper .button:focus:after { opacity: 1; transform: scale(1); transition: opacity 0.4s cubic-bezier(0.77, 0, 0.175, 1) 80ms, transform 0.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) 80ms; }
.styled-wrapper .button-box { display: flex; position: absolute; top: 0; left: 0; }
.styled-wrapper .button-elem { display: block; width: 30px; height: 30px; margin: 24px 18px 0 22px; transform: rotate(360deg); fill: #f0eeef; }
.styled-wrapper .button:hover .button-box, .styled-wrapper .button:focus .button-box { transition: 0.4s; transform: translateX(-69px); }
```

### AatreyuShau(手描き風のボタン)
```css
.button { text-align: center; transition: 0.3s ease-in-out; cursor: pointer; background-color: transparent; filter: url(#handDrawnNoise); display: inline-flex; align-items: center; user-select: none; font-family: "Courier New", monospace; font-size: 1.5rem; font-weight: bold; padding: 1em; border-width: 0px; border-radius: 2rem; box-shadow: #33333366 4px 4px 0 1px; animation: idle 1s infinite ease-in-out; }
.highlight { position: absolute; top: 0; left: 0; width: 100%; height: 100%; fill: rgba(255, 225, 0, 0.5); stroke: rgba(255, 225, 0, 0.5); stroke-width: 10; stroke-linecap: round; pointer-events: none; stroke-dasharray: 1000; stroke-dashoffset: 1000; transition: stroke-dashoffset 0.5s ease-in-out; }
@keyframes idle { 0% { filter: url(#handDrawnNoise); } 50% { rotate: 2.5deg; filter: url(#handDrawnNoise2); } 100% { filter: url(#handDrawnNoise); } }
.button-cosm { fill: #33333366; transition: 0.3s ease-out; scale: 0.5; position: absolute; translate: calc(-100% + 24px) 1.5rem; }
.button:hover { font-weight: bold; border-width: 0px; border-radius: 2rem; rotate: -2.5deg; animation: hover 2.5s infinite ease-in-out; }
.button:hover .highlight { stroke-dashoffset: 0; }
.button:active .highlight { stroke-dashoffset: 1000; animation: highlight 5s infinite, col 0.5s forwards; stroke: #bc4e2666; }
@keyframes col { 0% { stroke: rgba(255, 225, 0, 0.5); } 100% { stroke: #1c98eb66; } }
@keyframes highlight { 0% { stroke-dashoffset: 0; } 25% { stroke-dashoffset: 1000; } 50% { stroke-dashoffset: 1000; } 100% { stroke-dashoffset: 0; } }
@keyframes hover { 0% { rotate: 0deg; filter: url(#handDrawnNoise); translate: 0 0px; } 25% { rotate: -1deg; filter: url(#handDrawnNoise2); translate: 0 -2px; } 50% { rotate: 0deg; filter: url(#handDrawnNoise); translate: 0 2px; } 75% { rotate: -1deg; filter: url(#handDrawnNoise2); translate: 0 -2px; } 100% { rotate: 0deg; filter: url(#handDrawnNoise); translate: 0 0px; } }
.button:hover .button-cosm { rotate: -15deg; translate: calc(-100% + 22px) 1.9rem; }
.button:active .button-cosm { fill: #333333f1; rotate: -135deg; translate: calc(-100% + 55px) 1.6rem; animation: none; }
.button:active { font-weight: bold; border-width: 0px; border-radius: 2rem; box-shadow: inset #333333f1 4px 4px 0 1px; rotate: -2.5deg; animation: active 1s infinite ease-in-out; }
@keyframes active { 0% { filter: url(#handDrawnNoiset); translate: 0 -1px; } 25% { rotate: -3deg; } 50% { filter: url(#handDrawnNoiset2); translate: 0 1px; } 66% { rotate: 1.5deg; } 100% { filter: url(#handDrawnNoiset); translate: 0 -1px; } }
```
アプリでは、SVG のフィルター(handDrawnNoise など)を `app/page.tsx` に feTurbulence + feDisplacementMap で置いている。書体はアプリの等幅(JetBrains Mono)、蛍光ペンは金。

### AbanoubMagdy1(開く・たたむ)
```css
.container input { opacity: 0; cursor: pointer; width: 0; height: 0; }
.container { display: block; position: relative; cursor: pointer; font-size: 20px; user-select: none; width: 30px; height: 30px; border-radius: 3px; background: rgba(216, 216, 216, 0.603); }
.container:hover { background: rgba(197, 197, 197, 0.527); }
.line { width: calc(100% - 8px); height: 3px; left: 4px; background: rgb(58, 58, 58); position: absolute; top: 50%; transform: translateY(-50%); transition: .7s transform cubic-bezier(0,1,.33,1.2), background .4s; }
.line-indicator { transform: translateY(-50%) rotate(90deg); }
.container input:checked ~ .line-indicator { transform: translateY(-50%); }
```

### mRcOol7(丸の +)
```html
<button class="group cursor-pointer outline-none hover:rotate-90 duration-300" title="Add New">
  <svg class="stroke-teal-500 fill-none group-hover:fill-teal-800 group-active:stroke-teal-200 group-active:fill-teal-600 group-active:duration-0 duration-300" viewBox="0 0 24 24" height="50px" width="50px" xmlns="http://www.w3.org/2000/svg">
    <path stroke-width="1.5" d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z"></path>
    <path stroke-width="1.5" d="M8 12H16"></path>
    <path stroke-width="1.5" d="M12 16V8"></path>
  </svg>
</button>
```

### Tsiangana(チェックボックス)
```css
.checkbox-container { display: flex; gap: 20px; padding: 10px; background: #f8fafc; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05); }
.ios-checkbox { --checkbox-size: 28px; --checkbox-color: #3b82f6; --checkbox-bg: #dbeafe; --checkbox-border: #93c5fd; position: relative; display: inline-block; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
.ios-checkbox input { display: none; }
.checkbox-wrapper { position: relative; width: var(--checkbox-size); height: var(--checkbox-size); border-radius: 8px; transition: transform 0.2s ease; }
.checkbox-bg { position: absolute; inset: 0; border-radius: 8px; border: 2px solid var(--checkbox-border); background: white; transition: all 0.2s ease; }
.checkbox-icon { position: absolute; inset: 0; margin: auto; width: 80%; height: 80%; color: white; transform: scale(0); transition: all 0.2s ease; }
.check-path { stroke-dasharray: 40; stroke-dashoffset: 40; transition: stroke-dashoffset 0.3s ease 0.1s; }
.ios-checkbox input:checked + .checkbox-wrapper .checkbox-bg { background: var(--checkbox-color); border-color: var(--checkbox-color); }
.ios-checkbox input:checked + .checkbox-wrapper .checkbox-icon { transform: scale(1); }
.ios-checkbox input:checked + .checkbox-wrapper .check-path { stroke-dashoffset: 0; }
.ios-checkbox:hover .checkbox-wrapper { transform: scale(1.05); }
.ios-checkbox:active .checkbox-wrapper { transform: scale(0.95); }
.ios-checkbox input:focus + .checkbox-wrapper .checkbox-bg { box-shadow: 0 0 0 4px var(--checkbox-bg); }
.ios-checkbox.red { --checkbox-color: #ef4444; --checkbox-bg: #fee2e2; --checkbox-border: #fca5a5; }
@keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
.ios-checkbox input:checked + .checkbox-wrapper { animation: bounce 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
```

### andrew-demchenk0(お気に入り)
```css
.container input { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }
.container { display: block; position: relative; cursor: pointer; user-select: none; }
.container svg { position: relative; top: 0; left: 0; height: 50px; width: 50px; transition: all 0.3s; fill: #666; }
.container svg:hover { transform: scale(1.1); }
.container input:checked ~ svg { fill: #ffeb49; }
```

### ErzenXz(トグルスイッチ)
```css
.toggle-switch { position: relative; display: inline-block; width: 80px; height: 40px; cursor: pointer; }
.toggle-switch input[type="checkbox"] { display: none; }
.toggle-switch-background { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: #ddd; border-radius: 20px; box-shadow: inset 0 0 0 2px #ccc; transition: background-color 0.3s ease-in-out; }
.toggle-switch-handle { position: absolute; top: 5px; left: 5px; width: 30px; height: 30px; background-color: #fff; border-radius: 50%; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); transition: transform 0.3s ease-in-out; }
.toggle-switch::before { content: ""; position: absolute; top: -25px; right: -35px; font-size: 12px; font-weight: bold; color: #aaa; text-shadow: 1px 1px #fff; transition: color 0.3s ease-in-out; }
.toggle-switch input[type="checkbox"]:checked + .toggle-switch-handle { transform: translateX(45px); box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2), 0 0 0 3px #05c46b; }
.toggle-switch input[type="checkbox"]:checked + .toggle-switch-background { background-color: #05c46b; box-shadow: inset 0 0 0 2px #04b360; }
.toggle-switch input[type="checkbox"]:checked + .toggle-switch:before { content: "On"; color: #05c46b; right: -15px; }
.toggle-switch input[type="checkbox"]:checked + .toggle-switch-background .toggle-switch-handle { transform: translateX(40px); }
```

### PriyanshuGupta28(読み込み中)
```css
.spinner { position: absolute; width: 9px; height: 9px; }
.spinner div { position: absolute; width: 50%; height: 150%; background: #000000; transform: rotate(calc(var(--rotation) * 1deg)) translate(0, calc(var(--translation) * 1%)); animation: spinner-fzua35 1s calc(var(--delay) * 1s) infinite ease; }
.spinner div:nth-child(1) { --delay: 0.1; --rotation: 36; --translation: 150; }
.spinner div:nth-child(2) { --delay: 0.2; --rotation: 72; --translation: 150; }
.spinner div:nth-child(3) { --delay: 0.3; --rotation: 108; --translation: 150; }
.spinner div:nth-child(4) { --delay: 0.4; --rotation: 144; --translation: 150; }
.spinner div:nth-child(5) { --delay: 0.5; --rotation: 180; --translation: 150; }
.spinner div:nth-child(6) { --delay: 0.6; --rotation: 216; --translation: 150; }
.spinner div:nth-child(7) { --delay: 0.7; --rotation: 252; --translation: 150; }
.spinner div:nth-child(8) { --delay: 0.8; --rotation: 288; --translation: 150; }
.spinner div:nth-child(9) { --delay: 0.9; --rotation: 324; --translation: 150; }
.spinner div:nth-child(10) { --delay: 1; --rotation: 360; --translation: 150; }
@keyframes spinner-fzua35 { 0%, 10%, 20%, 30%, 50%, 60%, 70%, 80%, 90%, 100% { transform: rotate(calc(var(--rotation) * 1deg)) translate(0, calc(var(--translation) * 1%)); } 50% { transform: rotate(calc(var(--rotation) * 1deg)) translate(0, calc(var(--translation) * 1.5%)); } }
```

### Jaareet(テキストボックス・暗い案。案として保存)
```css
.input { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Roboto","Oxygen","Ubuntu","Cantarell","Fira Sans","Droid Sans","Helvetica Neue",sans-serif; font-weight: 500; font-size: .8vw; color: #fff; background-color: rgb(28,28,30); box-shadow: 0 0 .4vw rgba(0,0,0,0.5), 0 0 0 .15vw transparent; border-radius: 0.4vw; border: none; outline: none; padding: 0.4vw; max-width: 190px; transition: .4s; }
.input:hover { box-shadow: 0 0 0 .15vw rgba(135, 207, 235, 0.186); }
.input:focus { box-shadow: 0 0 0 .15vw skyblue; }
```

### alexruix(テキストボックス・明るい案。全画面で使っている)
```css
.group { display: flex; line-height: 28px; align-items: center; position: relative; max-width: 190px; }
.input { width: 100%; height: 40px; line-height: 28px; padding: 0 1rem; padding-left: 2.5rem; border: 2px solid transparent; border-radius: 8px; outline: none; background-color: #f3f3f4; color: #0d0c22; transition: .3s ease; }
.input::placeholder { color: #9e9ea7; }
.input:focus, input:hover { outline: none; border-color: rgba(234,76,137,0.4); background-color: #fff; box-shadow: 0 0 0 4px rgb(234 76 137 / 10%); }
.icon { position: absolute; left: 1rem; fill: #9e9ea7; width: 1rem; height: 1rem; }
```
アプリではピンクを金(rgba(242,169,0,0.45) と 0.12)に、プレースホルダーは `--label2` にした。

### Yaya12085(切り替え)
```css
.radio-inputs { position: relative; display: flex; flex-wrap: wrap; border-radius: 0.5rem; background-color: #EEE; box-sizing: border-box; box-shadow: 0 0 0px 1px rgba(0, 0, 0, 0.06); padding: 0.25rem; width: 300px; font-size: 14px; }
.radio-inputs .radio { flex: 1 1 auto; text-align: center; }
.radio-inputs .radio input { display: none; }
.radio-inputs .radio .name { display: flex; cursor: pointer; align-items: center; justify-content: center; border-radius: 0.5rem; border: none; padding: .5rem 0; color: rgba(51, 65, 85, 1); transition: all .15s ease-in-out; }
.radio-inputs .radio input:checked + .name { background-color: #fff; font-weight: 600; }
```

### Yaya12085(水玉の下地)
```css
.container { width: 100%; height: 100%; background: repeating-radial-gradient(circle, #fff, #fff 5px, #000 6px); background-size: 50px 100px; }
```
アプリでは黒を rgba(28,28,30,0.07) に薄め、空の状態の枠の中だけに使う(画面の背景は TechBackdrop のまま)。

### 以前の部品(置き換え済み。案として保存)
- 読み込み: david-mohseni の 12 本の棒(2026-11-06〜11-10)。
- 入力欄: ercnersoy の立体の欄(灰 #e8e8e8・影 8px・押すとへこむ。2026-11-06〜11-10)。
