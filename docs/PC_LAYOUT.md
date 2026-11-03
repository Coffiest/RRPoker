# PC 版のレイアウト(2026-11-03)

## 何をしたか
- PC で開いたときだけ、自動で PC 用の配置に切り替える。スマホ・タブレットの見た目は変えない。
- 左に常に見えるメニュー(サイドバー)を置き、下に浮かぶフッターは隠す。
- 中身の幅を広げる。店舗ホームは大会カードを横に並べ(1 枚 360px 以上、画面幅に応じて 2〜3 列)、プレイヤーホームは 2 列。一覧の画面は 880px、入力の画面は 640px。
- 色(金と白)・書体(JetBrains Mono / Space Grotesk)・コンソール風の装飾はそのまま。カード上端の線は使わない。
- トーナメント作成画面(`app/home/store/tournaments/page.tsx`)と `BlindLevelEditor` には手を入れていない(CLAUDE.md)。タイマー画面は全画面のままで、サイドバーも出さない。

## PC の判定
`app/layout.tsx` の小さなスクリプトで、次の 3 つがすべて当てはまるとき `<html class="pc">` を付ける。
- 画面の幅が 1024px 以上
- `hover: hover`(マウスを乗せられる)
- `pointer: fine`(マウスやトラックパッドのように細かく指せる)

幅だけで決めると大きなタブレットも PC になってしまう。入力の種類も見るのはそのため。ウィンドウの幅を変えると付け外しされる。

## 変えたファイル
- `components/PcSidebar.tsx`(新規): サイドバー本体。店舗用とプレイヤー用がある。入店 QR、インマネ確率予測、ハンド記録もここから開ける。
- `app/home/layout.tsx`: サイドバーを置く。
- `app/globals.css` の末尾: PC 用のルール。すべて `html.pc` の下にあるので、スマホには効かない。
- 各画面の外枠: `pc-wide`(ダッシュボード)/ `pc-page`(一覧)/ `pc-form`(入力)の印を付けた。
- `components/TutorialOverlay.tsx`: 同じ印が 2 つあるとき、見えているほうを指すようにした。

## 参考にしたもの(どこを、なぜ)

| 参考元 | 参考にした部分 | どう使ったか・なぜ |
| --- | --- | --- |
| Apple HIG「Sidebars」 https://developer.apple.com/design/human-interface-guidelines/sidebars | 項目が多いときはサイドバーのほうが速く移動できる。iPhone ではタブバー、広い画面ではサイドバー。初期状態で隠さない。背景は半透明。 | 広い画面ではフッターを左のサイドバーに替えた。常に表示し、半透明の白(すりガラス)にした。 |
| Material Design 3 のウィンドウサイズ区分(要約: https://dev.to/tkuenneth/about-window-size-class-libraries-5c5m) | 幅 840 以上を「Expanded」とし、下のナビゲーションバーをやめて左のレール/ドロワーにする。 | 切り替えの幅を、ノート PC の最小的な幅である 1024px にした。840 で切ると大きめのタブレットの縦向きまで入るため。 |
| SAP Fiori for Android(M3 の Navigation rail / drawer の使い方) https://www.sap.com/design-system/fiori-design-android/v26-4/components/m3-standard-components/navigation-rail/usage | 標準のドロワーは大きい画面向け。レールは狭い画面では使わない。 | 文字のラベル付きの、幅 248px のメニューにした(アイコンだけのレールより、英字と日本語の両方が読める)。 |
| NN/g「Breakpoints in Responsive Design」 https://www.nngroup.com/articles/breakpoints-in-responsive-design/ | 区切りは端末名ではなく画面の幅で決める。 | 幅で判定し、入力の種類(マウスかどうか)で補った。 |
| 英国議会デザインシステム「Layout」 https://designsystem.parliament.uk/foundations/layout/ | 区切りはブラウザの幅を基準にする。決まった数の列のグリッドを使う。 | ホームは自動で列数が決まるグリッド(1 枚 360px 以上)にした。 |
| ダンディー大学のブランドガイド(レイアウト) https://brgr.dundee.ac.uk/documentation/styles/layout/ | ノート PC 1024px、デスクトップ 1440px。中身の最大幅を決めておく。 | 1024px を PC の始まりにし、中身の最大幅を 1280px / 880px / 640px に決めた。 |
| スキル `apple-design`(§1 Response、§12 Materials、§16 Flexibility・Wayfinding) | 押した瞬間に反応させる。メニューなどは半透明の層にする。PC では細かく指せる前提の、深い作業向けの配置にする。今どこにいるかを常に示す。 | メニューは押した瞬間に少し縮み、乗せると色が変わる。選んでいる画面は淡い金の面と金の文字で示す。 |
| スキル `design-rules`(Lucide のみ、押せる範囲 44px 以上、余白は 8 の倍数、コントラスト 4.5:1) | 同左 | アイコンは lucide-react(20px・太さ 2 にそろえた)。各項目の高さは 48px、余白は 8 / 16 / 24 / 32。灰色の文字は `--label2` / `--label3` だけ。 |
| `CLAUDE.md`(オーナーのルール) | 白基調、金一色、コンソール風の書体と装飾、カード上端の線は禁止、作成画面は触らない、プレイヤーはタイマーを操作できない。 | どれも守った。白い面の上の金の文字はブランドの金(#D4910A)のまま。 |

デジタル庁デザインシステムのレイアウトの値も探したが、検索では公式の値を確認できなかった。そのため根拠には使っていない。

## 確かめたこと
- 手元のエミュレーターで、1600×900 の PC 幅と 390×844 のスマホ幅を撮って比べた(店舗ホーム、店舗マイページ、店舗設定、プレイヤーのホーム、マイページ、大会、履歴)。スマホの見た目は変わっていない。
- 型チェックとテスト(160 件)はすべて通った。
