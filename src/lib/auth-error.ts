export function getAuthErrorMessage(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "このメールアドレスは既に登録されています"
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません"
    case "auth/user-not-found":
      return "アカウントが存在しません"
    case "auth/wrong-password":
      return "パスワードが正しくありません"
    case "auth/weak-password":
      return "パスワードは6文字以上で入力してください"
    case "auth/too-many-requests":
      return "試行回数が多すぎます。しばらくしてから再度お試しください"
    default:
      return "認証中にエラーが発生しました"
  }
}
