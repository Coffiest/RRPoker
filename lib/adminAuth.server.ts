import type { NextRequest } from "next/server"

/** 管理者パスワードの確認。既存の /api/admin/* と同じ方式。 */
export function verifyAdmin(req: NextRequest): boolean {
  const expected = (process.env.ADMIN_PASSWORD ?? "").trim()
  if (!expected) return false
  return (req.headers.get("x-admin-password") ?? "").trim() === expected
}
