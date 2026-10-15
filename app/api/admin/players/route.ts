import { NextRequest, NextResponse } from "next/server"
import type { UserRecord } from "firebase-admin/auth"
import { adminDb, adminAuth } from "@/lib/firebase-admin"
import { verifyAdmin } from "@/lib/adminAuth.server"
import type { AdminPlayer } from "@/lib/adminPlayers"


async function listAllAuthUsers(): Promise<Map<string, UserRecord>> {
  const map = new Map<string, UserRecord>()
  let pageToken: string | undefined
  do {
    const page = await adminAuth.listUsers(1000, pageToken)
    page.users.forEach(u => map.set(u.uid, u))
    pageToken = page.pageToken
  } while (pageToken)
  return map
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const [usersSnap, lbSnap, bansSnap, authUsers] = await Promise.all([
      adminDb.collection("users").get(),
      adminDb.collection("rrLeaderboard").get(),
      adminDb.collection("adminBans").get(),
      listAllAuthUsers(),
    ])
    const lb = new Map(lbSnap.docs.map(d => [d.id, d.data()]))
    const bans = new Map(bansSnap.docs.map(d => [d.id, d.data()]))

    const players: AdminPlayer[] = []
    usersSnap.forEach(d => {
      const u = d.data()
      if (u.role === "store" || d.id.startsWith("temp_")) return
      const a = authUsers.get(d.id)
      const r = lb.get(d.id)
      const ban = bans.get(d.id)
      const banned = u.banned === true
      const rating = typeof r?.rrRating === "number" && r.rrRating > 0 && !banned ? r.rrRating : null
      const created = a?.metadata.creationTime ? Date.parse(a.metadata.creationTime) : null
      players.push({
        uid: d.id,
        name: typeof u.name === "string" ? u.name : "",
        playerId: typeof u.playerId === "string" ? u.playerId : null,
        email: a?.email ?? null,
        iconUrl: typeof u.iconUrl === "string" ? u.iconUrl : null,
        createdAt: Number.isFinite(created) ? created : null,
        rrRating: rating,
        plays: Number(r?.plays ?? 0),
        banned,
        banReason: typeof ban?.reason === "string" && ban.reason ? ban.reason : null,
        bannedAt: ban?.bannedAt?.toMillis?.() ?? null,
      })
    })
    return NextResponse.json({ players })
  } catch (e) {
    console.error("admin players failed", e)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}
