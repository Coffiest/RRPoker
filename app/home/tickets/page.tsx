"use client"

import HomeHeader from "@/components/HomeHeader"
import PlayerBottomNav from "@/components/PlayerBottomNav"
import { useRouter } from "next/navigation"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, getDocs, getDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { FiCreditCard } from "react-icons/fi"

const STAMP_GOAL = 12

type StampCard = {
  storeId: string
  storeName: string
  stampCount: number
  lastStampAt: Date | null
  couponName: string
  iconUrl?: string
}

type Coupon = {
  id: string
  name: string
  isUsed?: boolean
  expiresAt?: any
  storeId?: string
}

function formatDate(d: Date | null): string {
  if (!d) return ""
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return "今日"
  if (diffDays === 1) return "昨日"
  if (diffDays < 7) return `${diffDays}日前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isExpired(expiresAt: any): boolean {
  if (!expiresAt) return false
  if (typeof expiresAt.toDate === "function") return expiresAt.toDate() < new Date()
  return false
}

// ── Stamp dots: 6 per row × 2 rows ──────────────────────────────────────────
function StampGrid({ count, iconUrl }: { count: number; iconUrl?: string }) {
  const dots = Array.from({ length: STAMP_GOAL }, (_, i) => i < count)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {[dots.slice(0, 6), dots.slice(6, 12)].map((row, r) => (
        <div key={r} style={{ display: "flex", gap: 6 }}>
          {row.map((filled, i) => (
            <div
              key={i}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: filled ? "transparent" : "transparent",
                border: filled ? "none" : "1.5px solid #D1D1D6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: filled ? "0 2px 6px rgba(0,0,0,0.18)" : "none",
                flexShrink: 0,
                overflow: "hidden",
                transition: "all 0.15s ease",
              }}
            >
              {filled ? (
                iconUrl ? (
                  <img
                    src={iconUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "linear-gradient(145deg, #D4910A, #C8820A)" }} />
                )
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function TicketsPage() {
  const router = useRouter()
  const [stampCards, setStampCards] = useState<StampCard[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  const [isChecked, setIsChecked] = useState(false)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) { setLoading(false); return }
      const uid = user.uid
      setUserId(uid)

      // ── スタンプカード ──────────────────────────────────────
      const stampSnap = await getDocs(collection(db, "users", uid, "storeStamp"))
      const cards: StampCard[] = []
      await Promise.all(
        stampSnap.docs.map(async (d) => {
          const storeId = d.id
          const { stampCount = 0, lastStampAt } = d.data()
          const storeDoc = await getDoc(doc(db, "stores", storeId))
          const storeName = storeDoc.data()?.name ?? storeId
          const couponName = storeDoc.data()?.checkinBonusCouponName ?? ""
          const iconUrl = storeDoc.data()?.iconUrl ?? ""
          const lastDate = lastStampAt?.toDate?.() ?? null
          cards.push({ storeId, storeName, stampCount, lastStampAt: lastDate, couponName, iconUrl })
        })
      )
      // 最近入店した順
      cards.sort((a, b) => (b.lastStampAt?.getTime() ?? 0) - (a.lastStampAt?.getTime() ?? 0))
      setStampCards(cards)

      // ── クーポン ────────────────────────────────────────────
      const couponSnap = await getDocs(collection(db, "users", uid, "tickets"))
      const list: Coupon[] = couponSnap.docs.map(d => ({ id: d.id, ...d.data() } as Coupon))
      setCoupons(list)

      setLoading(false)
    })
    return () => unsub()
  }, [])

  const activeCoupons = coupons.filter(c => !c.isUsed && !isExpired(c.expiresAt))
  const usedCoupons = coupons.filter(c => c.isUsed || isExpired(c.expiresAt))

  return (
    <main className="min-h-screen pb-32" style={{ background: "#F2F2F7" }}>
      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        showNotifications
        menuItems={getCommonMenuItems(router, "user")}
      />

      <div className="mx-auto max-w-sm px-4 pt-6 space-y-6">

        {/* ── スタンプカード ──────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-semibold tracking-widest uppercase mb-3" style={{ color: "#8E8E93" }}>
            スタンプカード
          </h2>

          {loading ? (
            <div style={{ background: "#fff", borderRadius: 20, padding: "24px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#8E8E93" }}>読み込み中…</p>
            </div>
          ) : stampCards.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 20, padding: "28px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🎫</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", marginBottom: 4 }}>
                スタンプカードがありません
              </p>
              <p style={{ fontSize: 12, color: "#8E8E93", lineHeight: 1.5 }}>
                店舗に入店するとスタンプが貯まります
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {stampCards.map((card) => {
                const pct = Math.min(card.stampCount / STAMP_GOAL, 1)
                const done = card.stampCount >= STAMP_GOAL
                return (
                  <div
                    key={card.storeId}
                    style={{
                      background: "#fff",
                      borderRadius: 20,
                      padding: "16px 18px",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                    }}
                  >
                    {/* 店舗名 + スタンプ数 */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E", letterSpacing: -0.2, lineHeight: 1.3, marginBottom: 2 }}>
                          {card.storeName}
                        </p>
                        {card.couponName && (
                          <p style={{ fontSize: 11, color: "#C8820A", fontWeight: 500, lineHeight: 1.3 }}>
                            {STAMP_GOAL}スタンプで {card.couponName}
                          </p>
                        )}
                      </div>
                      {/* 達成バッジ or カウント */}
                      {done ? (
                        <div style={{ background: "linear-gradient(135deg,#D4910A,#C8820A)", borderRadius: 10, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, flexShrink: 0 }}>
                          <p style={{ fontSize: 11, color: "#fff", fontWeight: 700, letterSpacing: 0.3 }}>クーポン獲得済み</p>
                        </div>
                      ) : (
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1E", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                            {card.stampCount}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#8E8E93" }}>
                            /{STAMP_GOAL}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* スタンプグリッド */}
                    <StampGrid count={card.stampCount} iconUrl={card.iconUrl} />

                    {/* フッター: プログレスバー + 最終入店 */}
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 99, background: "#F2F2F7", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${pct * 100}%`,
                            borderRadius: 99,
                            background: done
                              ? "linear-gradient(90deg,#D4910A,#C8820A)"
                              : "linear-gradient(90deg,#D4910A,#C8820A)",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      {card.lastStampAt && (
                        <p style={{ fontSize: 11, color: "#8E8E93", whiteSpace: "nowrap", flexShrink: 0 }}>
                          最終入店 {formatDate(card.lastStampAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── クーポン ────────────────────────────────────────── */}
        {!loading && (
          <section>
            <h2 className="text-[13px] font-semibold tracking-widest uppercase mb-3" style={{ color: "#8E8E93" }}>
              クーポン
            </h2>

            {coupons.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 20, padding: "22px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "#8E8E93" }}>クーポンはまだありません</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* 未使用 */}
                {activeCoupons.map(coupon => (
                  <button
                    key={coupon.id}
                    onClick={() => { setSelectedCoupon(coupon); setIsChecked(false) }}
                    style={{
                      background: "#fff",
                      border: "none",
                      borderRadius: 16,
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textAlign: "left",
                      cursor: "pointer",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                      width: "100%",
                    }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(200,130,10,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FiCreditCard size={18} color="#C8820A" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", marginBottom: 2 }}>{coupon.name}</p>
                      {coupon.expiresAt && (
                        <p style={{ fontSize: 11, color: "#8E8E93" }}>
                          期限: {coupon.expiresAt.toDate().toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                        </p>
                      )}
                    </div>
                    <div style={{ background: "linear-gradient(135deg,#D4910A,#C8820A)", borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, flexShrink: 0 }}>
                      <p style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>使用する</p>
                    </div>
                  </button>
                ))}

                {/* 使用済み (折りたたみ表示) */}
                {usedCoupons.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {usedCoupons.map(coupon => (
                      <div
                        key={coupon.id}
                        style={{
                          background: "#fff",
                          borderRadius: 16,
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          opacity: 0.5,
                        }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F2F2F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <FiCreditCard size={16} color="#8E8E93" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "#3C3C43" }}>{coupon.name}</p>
                          <p style={{ fontSize: 11, color: "#8E8E93", marginTop: 1 }}>使用済み</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

      </div>

      <PlayerBottomNav />

      {/* ── クーポン使用モーダル ─────────────────────────────── */}
      {selectedCoupon && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
          onClick={() => setSelectedCoupon(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "24px 24px 0 0",
              padding: "28px 24px 40px",
              width: "100%",
              maxWidth: 420,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ハンドル */}
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "#D1D1D6", margin: "0 auto 20px" }} />

            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(200,130,10,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <FiCreditCard size={26} color="#C8820A" />
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E", textAlign: "center", marginBottom: 6 }}>
              {selectedCoupon.name}
            </p>
            <p style={{ fontSize: 13, color: "#8E8E93", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
              スタッフにこの画面を見せてください
            </p>

            <label style={{ display: "flex", alignItems: "center", gap: 12, background: "#F2F2F7", borderRadius: 14, padding: "14px 16px", cursor: "pointer", marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={e => setIsChecked(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: "#C8820A" }}
              />
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1C1C1E" }}>スタッフが確認しました</span>
            </label>

            <button
              disabled={!isChecked}
              onClick={async () => {
                if (!selectedCoupon || !userId) return
                await updateDoc(doc(db, "users", userId, "tickets", selectedCoupon.id), {
                  isUsed: true, usedAt: serverTimestamp()
                })
                setCoupons(prev => prev.map(c => c.id === selectedCoupon.id ? { ...c, isUsed: true } : c))
                setSelectedCoupon(null)
              }}
              style={{
                width: "100%", height: 52, borderRadius: 14, border: "none", cursor: isChecked ? "pointer" : "default",
                background: isChecked ? "linear-gradient(135deg,#D4910A,#C8820A)" : "#E5E5EA",
                color: isChecked ? "#fff" : "#8E8E93",
                fontSize: 16, fontWeight: 700,
                boxShadow: isChecked ? "0 4px 14px rgba(200,130,10,0.30)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              使用済みにする
            </button>
            <button
              onClick={() => setSelectedCoupon(null)}
              style={{ width: "100%", height: 44, background: "transparent", border: "none", fontSize: 15, color: "#8E8E93", marginTop: 6, cursor: "pointer" }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
