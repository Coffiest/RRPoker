# RRPoker 開発ルール

## 文字の色(必ず守る)

- 画面は白基調の明るい表示だけで作っている。**端末のダークモードで色を変える指定(`prefers-color-scheme: dark`)を足さない。** 以前 `globals.css` に「ダークなら文字色を #ededed」が残っていて、色を指定していない文字が白い面の上でほぼ白になり読めなかった。
- 灰色の文字は `app/globals.css` の3段だけを使う: `var(--label)`(#1C1C1E)/ `var(--label2)`(#545458)/ `var(--label3)`(#636368)。Tailwind では `text-label2` / `text-label3`。どれも白地・地のベージュ(#EDECE6)で 4.5:1 以上。
- これより薄い灰色(`#8E8E93`、`#AEAEB2`、`#C7C7CC`、`rgba(60,60,67,0.3〜0.6)`、`text-gray-300/400` など)を文字に使わない。ページごとに `--label2` / `--label3` を再定義しない。
- `test/textContrast.test.ts` がこれを検査し、`npm run build` の前(`prebuild`)にも走る。暗い面の上の文字など意図して薄い色を使う行には `contrast-ok` と理由を書く。管理者画面(`app/admin`)は暗い配色なので対象外。
- **デザイン(配色・意匠)は勝手に変えない(オーナー指示)。** 読みやすさの修正でも、見た目が変わるものは先にオーナーに確認する。ホームの偏差値カード・カレンダーの選択日・金のボタンなど、金の面の上の文字は白、白い面の上の黄色の文字は読める濃さの黄色(#8F5E00)にする(オーナー確定)。

## テーマ色(オーナー確定)

- 地(背景)は ウォームベージュ `#EDECE6`、主色は サンイエロー `#F9B318`、差し色は コバルトブルー `#1546D9`(`globals.css` の `--background` / `--sun` / `--cobalt`)。
- カード・一覧の面は白。黄色はボタン・強調・偏差値カードなど主の操作と見せ場に、青はリンク・文字ボタン・プロンプト記号($)・カーソルなど所々の差し色に使う。ほかの色を主色として足さない。

## テーマ: コンソール風デザインと書体(絶対ルール・オーナー確定)

- このアプリのテーマは「テック感・プログラマー感・コンソール感」。どんなデザイン改修(apple-design・design-rules など)でも、これを消さない。
- **書体は JetBrains Mono(本文・数字)と Space Grotesk(見出し・ロゴ)。** `app/layout.tsx` の next/font と `globals.css` の `--stack-mono` / `--stack-display` で読み込む。システムフォントに置き換えない。日本語だけ端末標準へフォールバックさせる。
- **コンソール風の装飾を残す。** `tech-label`(等幅・大文字)、`tech-label-bracket`([ ])、`term-prompt`($)、`term-prompt-arrow`(›)、`term-comment`(//)、`tech-caret`(点滅カーソル)、`tech-num`、`con-*` などを消したり `content: none` で隠したりしない。
- **おしゃれに英語で書ける所は英語にする。** 例: Login / Create account / Forgot Password? / Entry / Re-entry / Add-on / PLAYERS / PAY OUT / ADJUST / START / PAUSE / LIVE / RANK / TOURNAMENT HISTORY / BALANCE / LOADING。説明文・注意書き・確認ダイアログの本文など、意味を正確に伝える文章は日本語のまま。
- 読みやすさ(コントラスト・44px の押せる範囲・8 の倍数の余白)はこの上で守る。

## 手元での動作確認

- `NEXT_PUBLIC_FIREBASE_EMULATOR=1` で起動すると、本番ではなくローカルの Firebase エミュレーター(Auth: 9099 / Firestore: 8080)につながる(`lib/firebase.ts`)。本番の環境変数には設定しない。
