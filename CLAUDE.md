# RRPoker 開発ルール

## 文字の色(必ず守る)

- 画面は白基調の明るい表示だけで作っている。**端末のダークモードで色を変える指定(`prefers-color-scheme: dark`)を足さない。** 以前 `globals.css` に「ダークなら文字色を #ededed」が残っていて、色を指定していない文字が白い面の上でほぼ白になり読めなかった。
- 灰色の文字は `app/globals.css` の3段だけを使う: `var(--label)`(#1C1C1E)/ `var(--label2)`(#545458)/ `var(--label3)`(#6E6E73)。Tailwind では `text-label2` / `text-label3`。どれも白地で 4.5:1 以上。
- これより薄い灰色(`#8E8E93`、`#AEAEB2`、`#C7C7CC`、`rgba(60,60,67,0.3〜0.6)`、`text-gray-300/400` など)を文字に使わない。ページごとに `--label2` / `--label3` を再定義しない。
- `test/textContrast.test.ts` がこれを検査し、`npm run build` の前(`prebuild`)にも走る。暗い面の上の文字など意図して薄い色を使う行には `contrast-ok` と理由を書く。管理者画面(`app/admin`)は暗い配色なので対象外。
- 白い面の上の金色の文字は `var(--gold-text)`(#9A6A00、白地 4.7:1)。ブランドの金(#F2A900 / #D4910A)は面・枠・アイコンに使い、小さな文字には使わない。金の面の上の文字は白ではなく墨色(#1C1C1E)にする(白は金の上で 2.0:1)。

## 手元での動作確認

- `NEXT_PUBLIC_FIREBASE_EMULATOR=1` で起動すると、本番ではなくローカルの Firebase エミュレーター(Auth: 9099 / Firestore: 8080)につながる(`lib/firebase.ts`)。本番の環境変数には設定しない。
