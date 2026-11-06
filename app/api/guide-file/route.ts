import { NextRequest } from "next/server"
import { appBuckets, isAllowedGuideUrl } from "@/lib/playerGuide"

/**
 * プレイヤーズガイドの「保存」(lib/playerGuide.ts)。
 * Storage のファイルを、このアプリのドメインから「保存するファイル」として返す。
 * 通すのはこのアプリの Storage の stores/{id}/guides/ だけ(何でも取ってくる中継にしない)。
 * 中身は流したまま返す(Vercel の関数は、流して返すなら 4.5MB の上限を受けない)。
 */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? ""
  const name = (req.nextUrl.searchParams.get("n") ?? "player-guide").replace(/[\r\n"\\/]/g, "_").slice(0, 120) || "player-guide"
  if (!isAllowedGuideUrl(u, appBuckets())) {
    return new Response("Not allowed", { status: 400 })
  }
  const upstream = await fetch(u)
  if (!upstream.ok || !upstream.body) return new Response("Not found", { status: 404 })
  const ascii = name.replace(/[^\x20-\x7E]/g, "_")
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, max-age=300",
    },
  })
}
