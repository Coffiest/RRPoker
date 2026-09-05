/**
 * Firebase のログインを求めない画面の一覧と、その判定。
 *
 * AuthGuard(components/AuthGuard.tsx)は「Firebase のユーザーがいなければ
 * /login へ飛ばす」という作りになっている。だが、それだけでは守れない画面がある。
 *
 * 管理画面(/admin)は Firebase Auth を一切使わない。ADMIN_PASSWORD を
 * サーバーへ送って照合し、通ったら sessionStorage に持つ、という別の仕組みで
 * 入る。つまり Firebase のユーザーは最初から最後までいない。ここを一覧に
 * 入れ忘れていたため、正しいパスワードで入っても、onAuthStateChanged が
 * user=null で返ってきた瞬間に /login へ弾き返されていた(画面が一瞬見えてから
 * 戻されるのは、この監視が非同期で後から走るため)。
 *
 * 管理画面が無防備になるわけではない。/admin 自身が sessionStorage の
 * パスワードを見て入口で弾き、app/api/admin/* の各ルートも x-admin-password を
 * サーバー側で毎回照合する。本当の関所はサーバーのほうで、AuthGuard は
 * ここでは何も守っていなかった。
 *
 * 再発防止として、/admin は前方一致で判定する。/admin/migrate-player-ids の
 * ような下位ページを新しく足したときに、一覧への追記を忘れても通るようにする。
 */

/** 完全一致で公開扱いにする画面。 */
export const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/store-register',
  '/forgot-password',
  '/verify-code',
  '/password-reset-verify',
  '/verify-email',
  '/privacy',
  '/terms',
  '/devpreview',
] as const

/**
 * 配下すべてを公開扱いにする画面。
 * Firebase Auth とは別の仕組みで入口を守っているものだけを置く。
 */
export const PUBLIC_PREFIXES = [
  // 管理画面。ADMIN_PASSWORD による認証で、Firebase のユーザーは存在しない。
  '/admin',
] as const

/** その画面が Firebase のログインを求めないかどうか。 */
export function isPublicPath(pathname: string): boolean {
  if ((PUBLIC_PATHS as readonly string[]).includes(pathname)) return true
  return (PUBLIC_PREFIXES as readonly string[]).some(
    // '/adminetc' のような別の画面を巻き込まないよう、境界まで見る。
    prefix => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
}
