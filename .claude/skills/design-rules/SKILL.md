---
name: "design-rules"
description: "UI・アプリ・Web・スライド・資料など、見た目のあるものを開発・生成する時に必ず使う。絵文字禁止・Lucideアイコン・Apple HIG準拠のデザインルール。"
---

# デザインルール（全開発・全生成に適用）

## 1. 絵文字の完全禁止
- UI、コード、コメント、README、コミットメッセージ、スライド、資料のすべてで絵文字を使わない。
- アイコンが必要な箇所は、すべてLucideアイコンで置き換える。
- 出力前に、成果物の中に絵文字が残っていないか必ず検査する（例: Pythonで Unicode の絵文字範囲を検索）。

## 2. アイコンはLucideのみ
- 公式: https://lucide.dev
- React: npm install lucide-react → import { Menu } from 'lucide-react'
- React Native: lucide-react-native（react-native-svg が必要）
- Vue: lucide-vue-next / 素のJS: npm install lucide
- 素のHTML（CDN）:
  <script src="https://unpkg.com/lucide@latest"></script>
  <i data-lucide="menu"></i>
  <script>lucide.createIcons();</script>
- 使うアイコンだけを個別にimportする（全部importしない）。
- 線の太さ（strokeWidth）とサイズは画面内で統一する。デフォルトは size 24 / strokeWidth 2。
- アイコン名は https://lucide.dev/icons で実在を確認してから使う。

## 3. デザインの基準（優先順位）
1. Apple Human Interface Guidelines（最優先・必須）
   https://developer.apple.com/design/human-interface-guidelines
2. デジタル庁デザインシステム（ダッシュボード・社内向けアプリ・業務画面で、HIGに書かれていない部分を補う）
   https://www.digital.go.jp/policies/servicedesign/designsystem
3. Google Material Design 3（上の2つに無い部分だけ参考にする。HIGと矛盾したらHIGに従う）
   https://m3.material.io/

## 4. HIGの必須ルール
- タップできる部分は最小 44x44pt（Webなら44x44px以上）。小さいアイコンは余白で押せる範囲を広げる。
- 余白・サイズは8の倍数（8, 16, 24, 32, 40, 48）でそろえる。
- 文字の大きさは最小 9px(RRPoker のオーナー指定。小さな英字ラベルは 9〜11px、本文は 14px 前後)。書体は RRPoker ではコンソール風の JetBrains Mono / Space Grotesk(CLAUDE.md の絶対ルール。システムフォントに置き換えない)。
- 文字と背景のコントラストは4.5:1以上。
- ダークモードは RRPoker では作らない(CLAUDE.md のルール)。
- 画面上部のステータスバーや下部のホームバーの裏に、ボタンや大事な情報を置かない（セーフエリアを守る）。
- 装飾は控えめにする。色は意味（操作できる・警告・成功）を伝える時だけ使う。

## 5. 仕上げのチェック
- 絵文字ゼロ
- アイコンはすべてLucide
- タップ領域44以上、余白は8の倍数、コントラスト4.5:1以上
- 文字は最小 9px、コンソール風の書体と装飾を保つ