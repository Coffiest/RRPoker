# 引き継ぎ(2026-11-02)

## いまの状態
- main は本番(Vercel)に反映済み。この日マージした PR: #47(リエントリーでバスト自動+1を削除)、#48(タイマー合体の拡大・ロゴ左上・賞金自動スクロール・プレイヤー側タイマー・QR・退店制限)、#49(店舗の権限)。
- ルールは `CLAUDE.md` にすべて書いてある。最初に必ず読むこと(デザイン・文字色・「ブレイク」・カード上端の線禁止・+画面は触らない・プレイヤーはタイマーを操作できない など)。

## オーナーの手作業が要るもの(未完了)
1. ~~Firestore ルールと Cloud Functions の本番反映~~ → 2026-11-03 にオーナーが Mac から実施済み(Functions は Node.js 22 に上げて全 11 個を更新)。以後 functions を変えたら `cd ~/RRPoker && git pull` → `cd functions && npm install && npm run build && cd .. && firebase deploy --only functions`。
2. **偏差値の再計算**: 管理者の rr-recompute API を一度叩く(または次の大会確定で更新される)。

## 次にやる作業
### #28 ハンド記録の PokerART 化(2026-11-05 済み)
- 卓は `components/HandTable.tsx`(記録・履歴のリプレイ・共有ページ /hand/[id] の3か所で共通)。PokerART と同じ縦長の卓、フェルト白・レール金、Hero を一番下。
- 卓中央のロゴ・ディーラーボタン・チップ・オールインの印は PokerART の画像をそのまま使用(オーナー指定)。`public/table/`。ロゴは PokerART の卓画像から切り出して黒文字にしたもの。
- 保存形式(handHistories の文書)は変えていない。過去のハンドもそのまま新しい卓で再生できる。リプレイのポットは lib/handReplay.ts で計算。

## 手元での確認の仕方
- エミュレーター: `/tmp/claude-0/emu`(コンテナが変わると消える)。firebase.json の rules は**同じフォルダに置いた firestore.rules を相対パスで**指定すること(絶対パスだと読まれず、全部許可になる)。ルールを変えたらコピーし直して再起動。
- 起動: `NEXT_PUBLIC_FIREBASE_EMULATOR=1 npx next dev -p 3000`。テスト用アカウント store@test.com / player@test.com / player2@test.com(パスワード password123)。
- エミュレーターでは iframe が多いと(ブラウザの同時接続 6 本の制限で)タイマーが Loading のままになることがある。本番の不具合ではない。
- `pkill -f "next dev"` などを、起動コマンドと同じ行で実行しない(自分のシェルが落ちる)。

## この日に入れた仕組みのメモ
- タイマー画面 `?store=<id>&view=1`: 見るだけの埋め込み(書き込みなし)。プレイヤー側のホームで使う。
- 合体タイマーの拡大: 店舗ホームの合体カード、TIMER·SPLIT の右のボタン。横向き全画面、タップで各タイマーの操作。
- 退店の許可: `stores/{id}.allowPlayerCheckout`(既定 true)。false ならプレイヤーのホームに「退店する」を出さない。別の店舗が QR で入店させれば、そのまま移る(currentStoreId が上書きされる)。
- 店舗の権限: `stores/{id}.managerUids`。仕組みは `lib/storeAccess.ts` の冒頭と CLAUDE.md。
