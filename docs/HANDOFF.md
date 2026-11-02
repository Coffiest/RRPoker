# 引き継ぎ(2026-11-02)

## いまの状態
- main は本番(Vercel)に反映済み。この日マージした PR: #47(リエントリーでバスト自動+1を削除)、#48(タイマー合体の拡大・ロゴ左上・賞金自動スクロール・プレイヤー側タイマー・QR・退店制限)、#49(店舗の権限)。
- ルールは `CLAUDE.md` にすべて書いてある。最初に必ず読むこと(デザイン・文字色・「ブレイク」・カード上端の線禁止・+画面は触らない・プレイヤーはタイマーを操作できない など)。

## オーナーの手作業が要るもの(未完了)
1. **Firestore ルールと Cloud Functions の本番反映**: `firebase deploy --only firestore:rules,functions`
   - 店舗の権限(#49)はこれが終わるまで本番で効かない(ルールと functions がオーナーしか許さないまま)。
   - 大会の自動スタート(lib/autoStart.ts 関連の functions)も同じ。
   - `deploy.log` に「Blaze プランが必要」というエラーが残っている。functions のデプロイには Firebase を Blaze プランにする必要がある可能性が高い。ルールだけなら `--only firestore:rules` で出せる。
2. **偏差値の再計算**: 管理者の rr-recompute API を一度叩く(または次の大会確定で更新される)。

## 次にやる作業
### #28 ハンド記録を PokerART から移植(未着手)
- 依頼: プレイヤーのフッター「＋ツール → ハンド記録」に、PokerART(Coffiest/Meta---GEO)のハンド記録 UI を移す。テーブル・席の配置/トランプの絵/アクション入力/リプレイの全部。色は RRPoker の金(#F2A900)と白に合わせる。
- 移植元: `apps/web/src/components/PokerTable.tsx`(731 行)、`apps/web/src/components/GameHandHistorySheet.tsx`(446 行)、`apps/web/src/lib/replay.ts`(258 行)、`apps/web/src/app/review/`。元はダーク基調・差し色 #26c2a3。
- 移植先: `app/home/HandHistoryModal.tsx`(1279 行)と公開ページ `app/hand/[handId]/page.tsx`、`components/PlayingCard.tsx`。
- 進め方の案: (1) replay.ts をそのまま lib に移しテストを書く (2) 今の保存形式(handHistories の文書)を読んで replay の入力に変換する関数を作る(既存データを壊さない) (3) PokerTable を金/白・JetBrains Mono で描き直す (4) 入力 UI を差し替える (5) /hand の公開ページも同じ表示に。
- 着手前にオーナーへ確認すること: 既存のハンド記録データをそのまま読めるようにするか / 保存形式を変えてよいか。

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
