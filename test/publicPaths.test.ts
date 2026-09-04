import { describe, expect, it } from "vitest";
import { isPublicPath, PUBLIC_PREFIXES } from "../lib/publicPaths";

/**
 * AuthGuard が「Firebase のログインを求めない」と判断する画面。
 *
 * ここを取りこぼすと、その画面は開いた直後に /login へ弾き返される。実際に
 * 管理画面(/admin)がそうなっていた。正しいパスワードで入っても、画面が
 * 一瞬見えたあと戻される、という状態だった。原因は、管理画面が Firebase Auth を
 * 使わない別の仕組み(ADMIN_PASSWORD)で入るのに、その存在が一覧に無かったこと。
 *
 * 逆に緩めすぎると、ログインしていない人に本来の画面を見せてしまう。両側を固定する。
 */
describe("isPublicPath", () => {
  it("管理画面はログイン不要として扱う（Firebase のユーザーが存在しないため）", () => {
    expect(isPublicPath("/admin")).toBe(true);
  });

  it("管理画面の下位ページも、一覧に足さなくても通る", () => {
    expect(isPublicPath("/admin/migrate-player-ids")).toBe(true);
    // まだ存在しない下位ページでも同じであること（追記漏れで再発させない）
    expect(isPublicPath("/admin/anything/deeper")).toBe(true);
  });

  it("前方一致で別の画面を巻き込まない", () => {
    // '/admin' で始まるだけの無関係な画面を、うっかり公開にしない
    expect(isPublicPath("/administrator")).toBe(false);
    expect(isPublicPath("/admin-tools")).toBe(false);
  });

  it("従来の公開ページは公開のまま", () => {
    for (const p of ["/", "/login", "/register", "/store-register", "/forgot-password",
                     "/verify-code", "/password-reset-verify", "/verify-email",
                     "/privacy", "/terms"]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it("ログインが要る画面は締め出したまま", () => {
    for (const p of ["/home", "/home/store", "/home/mypage", "/home/transactions",
                     "/onboarding", "/home/store/timer/abc"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });

  it("前方一致に載せるのは、別の認証で入口を守っている画面だけに限る", () => {
    // 増やすときは、その画面自身とAPIがサーバー側で認証しているかを必ず確かめる。
    // 気軽に足せないよう、ここで数を固定しておく。
    expect(PUBLIC_PREFIXES).toEqual(["/admin"]);
  });
});
