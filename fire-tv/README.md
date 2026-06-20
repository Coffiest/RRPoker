# RRPoker Fire TV Timer App

Amazon Fire Stick 用のタイマー表示アプリケーション。

## 機能

- **ログイン**: Firebase Authentication（メール・パスワード、スマホでのコードペアリング）
  - Fire Stick にはカメラがないため、TV に表示された6桁コードをスマホの RRPoker サイト（`/home/pair`）で入力してログインする方式
- **トナメリスト**: Firestore から開催中のトーナメント一覧を取得・表示
- **タイマー表示**: リアルタイムでタイマーを表示、自動調整
- **リモコン対応**: Fire TV リモコンでの操作（↑↓OK、戻る）
- **レスポンシブ**: TV サイズ（55～85inch）に自動対応

## セットアップ

```bash
cd fire-tv
npm install
```

## 開発環境での実行

```bash
npm run start
```

その後、Expo アプリで QR コードをスキャン、またはエミュレータで起動。

## ビルド & デプロイ

### APK ビルド（Fire Stick 向け）

```bash
npm run build:apk
```

### Amazon Appstore へのアップロード

1. Amazon Developer Console にログイン
2. 新しいアプリを登録（パッケージ名：`com.rrpoker.timer`）
3. APK ファイルをアップロード
4. スクリーンショット・説明を記入
5. 審査待ち

## ディレクトリ構造

```
fire-tv/
├── src/
│  ├── screens/
│  │  ├── LoginScreen.tsx
│  │  ├── TournamentListScreen.tsx
│  │  └── TimerScreen.tsx
│  ├── hooks/
│  │  ├── useFirebaseAuth.ts
│  │  ├── useTournamentList.ts
│  │  └── useTimerSync.ts
│  ├── lib/
│  │  ├── firebase.ts
│  │  └── firetvUtils.ts
│  └── constants/
├── App.tsx
├── app.json
├── package.json
└── tsconfig.json
```

## 環境変数

`.env.local` に Firebase の認証情報を記入：

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

## テスト端末

- Fire Stick 4K（推奨）
- Fire Stick Max
- Fire Tablet

## トラブルシューティング

### ログインできない
- Firebase のセキュリティルールを確認
- `.env.local` の認証情報が正しいか確認

### トナメリストが表示されない
- Firestore のデータ構造を確認（`stores/{storeId}/tournaments/`）
- ユーザーの `storeId` が存在するか確認

### タイマーが表示されない
- Firestore の `tournament` ドキュメントに `timeRemaining` フィールドがあるか確認
- リアルタイム更新が有効か確認

## 参考

- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Fire TV Development Guide](https://developer.amazon.com/docs/fire-tv/getting-started.html)
