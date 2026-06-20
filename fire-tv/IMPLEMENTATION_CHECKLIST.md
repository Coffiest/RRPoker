# Fire TV Timer App - 実装チェックリスト

## Phase 1: 機能完成 ✅ / 🔄 / ❌

### ログイン機能
- ✅ Firebase Authentication 統合
- ✅ メール・パスワード入力フォーム
- ✅ コードペアリング認証（Fire TV にカメラがないため QR スキャンではなくペアリングコード方式に変更）
  - ✅ `/api/pairing/create` `/status` `/confirm` API ルート（RRPoker 本体側）
  - ✅ `/home/pair` ページ（スマホでコード入力 → confirm）
  - ✅ usePairing Hook（コード発行・ポーリング・customToken でログイン）
  - ✅ LoginScreen にペアリングコード表示 UI
- [ ] エラーハンドリング完成（ネットワーク断・コード期限切れ時の再試行UX）

### トナメリスト画面
- ✅ Firestore リアルタイム取得（useTournamentList Hook）
- ✅ リモコン操作対応（↑↓OK）
- ✅ UI デザイン（既存と同様）
- [ ] 複数店舗対応（オプション）

### タイマー表示画面
- ✅ TimerScreen コンポーネント
- ✅ Firestore リアルタイム同期（useTimerSync Hook）
- ✅ TV サイズ自動調整（useTVDimensions Hook）
- ✅ デザイン（既存 TimerClient と同一）
- ✅ リモコン対応（戻るボタン）
- [ ] 音声通知（オプション）

### TV サイズ対応
- ✅ useTVDimensions Hook（55～85inch スケーリング）
- ✅ フォントサイズ自動調整
- ✅ レイアウト自動調整

---

## Phase 2: テスト

### ローカルテスト
- [ ] `npm start` で Expo 起動
- [ ] Expo エミュレータで動作確認
  - [ ] ログイン画面表示
  - [ ] メール・パスワード入力
  - [ ] QR コード読込機能
  - [ ] トナメリスト表示
  - [ ] タイマー画面表示
  - [ ] リアルタイム更新確認
  - [ ] リモコン操作確認

### Firestore Security Rules テスト
- [ ] ログイン後、stores/{storeId} 読取 OK
- [ ] tournaments/{tournamentId} 読取 OK
- [ ] 書込権限なし（表示のみ） OK

### UI / UX テスト
- [ ] TV 46inch 時のスケーリング確認
- [ ] TV 55inch 時のスケーリング確認
- [ ] TV 65inch 時のスケーリング確認
- [ ] TV 75inch 時のスケーリング確認
- [ ] TV 85inch 時のスケーリング確認
- [ ] フォント可読性確認
- [ ] ボタンクリック領域確認

---

## Phase 3: ビルド & デプロイ

### APK ビルド
- [ ] `npm run build:apk` 実行
- [ ] APK ファイル生成確認（build/ フォルダ内）
- [ ] APK ファイルサイズ確認（< 100MB 推奨）

### Amazon Developer Console
- [ ] 開発者アカウント登録
- [ ] 新しいアプリ登録
  - [ ] アプリ名: "RRPoker Timer"
  - [ ] パッケージ名: "com.rrpoker.timer"
  - [ ] カテゴリ: ユーティリティ / ビジネス
- [ ] スクリーンショット作成（5～8枚）
  - [ ] ログイン画面
  - [ ] トナメリスト画面
  - [ ] タイマー表示画面（複数 TV サイズ）
  - [ ] リモコン操作説明

### Appstore 申請
- [ ] APK ファイルアップロード
- [ ] メタデータ（説明・キーワード・プライバシーポリシー）
- [ ] テスト情報（テスト用メール・パスワード提供）
- [ ] コンテンツレーティング回答
- [ ] 申請実行
- [ ] 審査待ち（通常 3～7 日）

---

## 環境情報

| 項目 | 詳細 |
|---|---|
| **フレームワーク** | React Native + Expo 51.0 |
| **言語** | TypeScript 5 |
| **Firebase** | v12.9.0 |
| **対象デバイス** | Fire Stick 4K / Max, Fire Tablet |
| **最小 OS** | Android 8.0 |
| **Target API** | 33 以上 |

---

## トラブルシューティング

### npm install でエラーが出た場合
```bash
cd fire-tv
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Expo Emulator で起動しない場合
```bash
npm run android  # Android Emulator
npm run web      # Web ブラウザで試す
```

### Firestore に接続できない場合
- `.env.local` の Firebase キー確認
- Firestore Security Rules で `isSignedIn()` 確認
- Firebase Console のテスト モードか本番モードか確認

### リモコン操作が効かない場合
- `useRemoteControl` Hook の `RemoteKey` マッピング確認
- Android TV / Fire TV のキー設定確認

---

## 参考リンク

- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security)
- [Fire TV Development](https://developer.amazon.com/docs/fire-tv/)
- [Amazon Appstore](https://developer.amazon.com/apps-and-games/app-submission)
