"use client"
import { CreditCardIcon, TicketIcon } from 'lucide-react'

import HomeHeader from "@/components/HomeHeader"
import PlayerBottomNav from "@/components/PlayerBottomNav"
import { useRouter } from "next/navigation"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, getDocs, getDoc, doc, updateDoc, serverTimestamp, addDoc, setDoc } from "firebase/firestore"

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
  createdAt?: any
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[dots.slice(0, 6), dots.slice(6, 12)].map((row, r) => (
        <div key={r} style={{ display: "flex", gap: 8 }}>
          {row.map((filled, i) => (
            <div
              key={i}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "transparent",
                border: filled ? "none" : "1.5px solid #D1D1D6",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: filled ? "0 2px 6px rgba(0,0,0,0.18)" : "none",
                flexShrink: 0, overflow: "hidden",
                transition: "transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              {filled ? (
                iconUrl ? (
                  <img src={iconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "linear-gradient(145deg, #995C00, #995C00)" }} />
                )
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── チケット風クーポンカード ────────────────────────────────────────────────
function CouponCard({ coupon, onUse, isUsed }: { coupon: Coupon; onUse: () => void; isUsed: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        background: isUsed ? "#EDECE6" : "#fff",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: isUsed ? "none" : "0 2px 12px rgba(0,0,0,0.08)",
        opacity: isUsed ? 0.6 : 1,
        display: "flex",
      }}
    >
      {/* 左側ゴールドストライプ */}
      <div style={{
        width: 8,
        background: isUsed ? "#C7C7CC" : "#F9B318",
        flexShrink: 0,
      }} />

      {/* ミシン目区切り */}
      <div style={{
        width: 1,
        background: "repeating-linear-gradient(180deg, transparent 0px, transparent 6px, #E5E5EA 6px, #E5E5EA 10px)",
        flexShrink: 0,
        margin: "0 0",
      }} />

      {/* コンテンツ */}
      <div style={{ flex: 1, padding: "16px 16px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: isUsed ? "var(--label3)" : "#995C00", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              {isUsed ? "USED" : "COUPON"}
            </p>
            <p style={{
              fontSize: 15, fontWeight: 700,
              color: isUsed ? "var(--label3)" : "#1C1C1E",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {coupon.name}
            </p>
            {coupon.expiresAt && !isUsed && (
              <p style={{ fontSize: 11, color: "var(--label3)", marginTop: 3 }}>
                期限: {coupon.expiresAt.toDate().toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" })}
              </p>
            )}
          </div>
          {!isUsed && (
            <button
              onClick={onUse}
              style={{
                height: 44, padding: "0 16px", borderRadius: 99, border: "none",
                background: "#F9B318",
                color: "#1C1C1E", fontSize: 12, fontWeight: 700,
                cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
              }}
            >
              使用する
            </button>
          )}
          {isUsed && (
            <div style={{ padding: "8px 8px", borderRadius: 99, background: "#E5E5EA" }}>
              <p style={{ fontSize: 11, color: "var(--label3)", fontWeight: 600 }}>使用済み</p>
            </div>
          )}
        </div>
      </div>
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
  const [couponTab, setCouponTab] = useState<"active" | "used">("active")
  const [claiming, setClaiming] = useState<string | null>(null) // storeId being claimed

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

  // スタンプ12個 → クーポン取得
  const claimCoupon = async (card: StampCard) => {
    if (!userId || !card.couponName) return
    setClaiming(card.storeId)
    try {
      // tickets コレクションにクーポン追加
      const ticketRef = await addDoc(collection(db, "users", userId, "tickets"), {
        name: card.couponName,
        storeId: card.storeId,
        isUsed: false,
        createdAt: serverTimestamp(),
      })
      // スタンプをリセット
      await setDoc(doc(db, "users", userId, "storeStamp", card.storeId), { stampCount: 0 }, { merge: true })
      // ローカル state 更新
      setStampCards(prev => prev.map(c => c.storeId === card.storeId ? { ...c, stampCount: 0 } : c))
      setCoupons(prev => [...prev, { id: ticketRef.id, name: card.couponName, storeId: card.storeId, isUsed: false }])
      setCouponTab("active")
    } finally {
      setClaiming(null)
    }
  }

  const activeCoupons = coupons.filter(c => !c.isUsed && !isExpired(c.expiresAt))
  const usedCoupons = coupons.filter(c => c.isUsed || isExpired(c.expiresAt))

  return (
    <main className="min-h-screen pb-32" style={{ background: "#EDECE6" }}>
      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        showNotifications
        menuItems={getCommonMenuItems(router, "user")}
      />

      <div className="mx-auto max-w-sm px-4 pt-6 space-y-6">

        {/* ── スタンプカード ──────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-semibold tracking-wide uppercase mb-4" style={{ color: "var(--label3)" }}>
            Stamp Card
          </h2>

          {loading ? (
            <div style={{ background: "#fff", borderRadius: 20, padding: "24px 0", textAlign: "center" }}>
              <p className="term-comment" style={{ fontSize: 13, color: "var(--label3)" }}>LOADING...</p>
            </div>
          ) : stampCards.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 20, padding: "32px 24px", textAlign: "center" }}>
              <div style={{ marginBottom: 8, color: "var(--label3)", display: "flex", justifyContent: "center" }}><TicketIcon size={40} /></div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", marginBottom: 8 }}>スタンプカードがありません</p>
              <p style={{ fontSize: 12, color: "var(--label3)", lineHeight: 1.5 }}>店舗に入店するとスタンプが貯まります</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {stampCards.map((card) => {
                const pct = Math.min(card.stampCount / STAMP_GOAL, 1)
                const done = card.stampCount >= STAMP_GOAL
                return (
                  <div key={card.storeId} style={{ background: "#fff", borderRadius: 20, padding: "16px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                    {/* 店舗名 + バッジ/カウント */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E", letterSpacing: -0.2, lineHeight: 1.3, marginBottom: 2 }}>
                          {card.storeName}
                        </p>
                        {card.couponName && (
                          <p style={{ fontSize: 11, color: "#995C00", fontWeight: 500, lineHeight: 1.3 }}>
                            {STAMP_GOAL}スタンプで {card.couponName}
                          </p>
                        )}
                      </div>
                      {done ? (
                        <button
                          onClick={() => claimCoupon(card)}
                          disabled={claiming === card.storeId}
                          style={{
                            background: "#F9B318",
                            borderRadius: 10, border: "none", cursor: "pointer",
                            paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
                            flexShrink: 0, opacity: claiming === card.storeId ? 0.6 : 1,
                          }}
                        >
                          <p style={{ fontSize: 11, color: "#1C1C1E", fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                            {claiming === card.storeId ? "取得中…" : "クーポンを獲得する"}
                          </p>
                        </button>
                      ) : (
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1E", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                            {card.stampCount}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--label3)" }}>/{STAMP_GOAL}</span>
                        </div>
                      )}
                    </div>

                    {/* スタンプグリッド */}
                    <StampGrid count={card.stampCount} iconUrl={card.iconUrl} />

                    {/* プログレスバー + 最終入店 */}
                    <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 99, background: "#EDECE6", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${pct * 100}%`, borderRadius: 99,
                          background: "#F9B318",
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                      {card.lastStampAt && (
                        <p style={{ fontSize: 11, color: "var(--label3)", whiteSpace: "nowrap", flexShrink: 0 }}>
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
            <h2 className="text-[13px] font-semibold tracking-wide uppercase mb-4" style={{ color: "var(--label3)" }}>
              クーポン
            </h2>

            {/* タブ */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {([{ key: "active", label: `未使用 ${activeCoupons.length > 0 ? `(${activeCoupons.length})` : ""}` }, { key: "used", label: "使用済み" }] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setCouponTab(tab.key)}
                  style={{
                    flex: 1, height: 44, borderRadius: 99, border: "none", cursor: "pointer",
                    background: couponTab === tab.key ? "#1C1C1E" : "#E5E5EA",
                    color: couponTab === tab.key ? "#fff" : "var(--label2)",
                    fontSize: 13, fontWeight: 600,
                    transition: "transform 0.15s, opacity 0.15s, background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {couponTab === "active" ? (
              activeCoupons.length === 0 ? (
                <div style={{ background: "#fff", borderRadius: 20, padding: "24px 24px", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "var(--label3)" }}>未使用のクーポンはありません</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeCoupons.map(coupon => (
                    <CouponCard
                      key={coupon.id}
                      coupon={coupon}
                      isUsed={false}
                      onUse={() => { setSelectedCoupon(coupon); setIsChecked(false) }}
                    />
                  ))}
                </div>
              )
            ) : (
              usedCoupons.length === 0 ? (
                <div style={{ background: "#fff", borderRadius: 20, padding: "24px 24px", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "var(--label3)" }}>使用済みのクーポンはありません</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {usedCoupons.map(coupon => (
                    <CouponCard key={coupon.id} coupon={coupon} isUsed={true} onUse={() => {}} />
                  ))}
                </div>
              )
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
            background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
          onClick={() => setSelectedCoupon(null)}
        >
          <div
            style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "32px 24px 40px", width: "100%", maxWidth: 420 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "#D1D1D6", margin: "0 auto 24px" }} />

            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(249,179,24,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CreditCardIcon size={26} color="#995C00" />
            </div>
            <p className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E", textAlign: "center", marginBottom: 8 }}>
              {selectedCoupon.name}
            </p>
            <p className="term-comment" style={{ fontSize: 13, color: "var(--label3)", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
              スタッフにこの画面を見せてください
            </p>

            <label style={{ display: "flex", alignItems: "center", gap: 16, background: "#EDECE6", borderRadius: 14, padding: "16px 16px", cursor: "pointer", marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={e => setIsChecked(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: "#995C00" }}
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
                background: isChecked ? "#F9B318" : "#E5E5EA",
                color: isChecked ? "#1C1C1E" : "var(--label3)",
                fontSize: 16, fontWeight: 700,
                boxShadow: isChecked ? "0 4px 14px rgba(153,92,0,0.30)" : "none",
                transition: "transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              使用済みにする
            </button>
            <button
              onClick={() => setSelectedCoupon(null)}
              style={{ width: "100%", height: 44, background: "transparent", border: "none", fontSize: 15, color: "var(--label3)", marginTop: 8, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
