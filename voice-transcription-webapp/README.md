# VoiceNote - 音声文字起こしWebアプリ

## 機能
- リアルタイム音声文字起こし（Web Speech API）
- Google / メール+パスワード認証
- 文字起こし履歴の保存・閲覧
- テキストファイル（.txt）のダウンロード

> **注意**: Web Speech API は Chrome / Edge のみ対応。

## セットアップ

### 1. Firebase プロジェクトの作成
[Firebase Console](https://console.firebase.google.com/) で新規プロジェクトを作成し、以下を有効化：
- **Authentication** → メール/パスワード + Google プロバイダー
- **Firestore Database** → 本番モードで作成

### 2. 環境変数の設定
```bash
cp .env.local.example .env.local
```
Firebase コンソールから設定値を `.env.local` に入力。

### 3. Firestore セキュリティルール
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/transcriptions/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. 起動
```bash
npm install
npm run dev
```
