'use client'

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore"
import { FiArrowLeft, FiArrowDownCircle, FiArrowUpCircle, FiHome, FiCreditCard, FiUser, FiAlertCircle, FiCheckCircle } from "react-icons/fi"
import { BsQrCodeScan } from "react-icons/bs"
import { QRCodeSVG } from "qrcode.react"

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["backspace", "0", ""],
]

const CSS = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sheetUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes qr-scan-line {
    0%   { top: 8px; opacity: 1; }
    90%  { top: calc(100% - 8px); opacity: 1; }
    100% { top: 8px; opacity: 0; }
  }
  .tx-slide { animation: slideUp 0.32s cubic-bezier(0.22,1,0.36,1) both; }
  .tx-slide-2 { animation: slideUp 0.32s 0.06s cubic-bezier(0.22,1,0.36,1) both; }
  .tx-slide-3 { animation: slideUp 0.32s 0.12s cubic-bezier(0.22,1,0.36,1) both; }
  .tx-sheet { animation: sheetUp 0.36s cubic-bezier(0.32,0.72,0,1) both; }
  .tx-key {
    background: #fff;
    border: none;
    border-radius: 14px;
    height: 58px;
    font-size: 22px;
    font-weight: 600;
    color: #111;
    box-shadow: 0 1px 4px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.06);
    transition: transform 0.1s, box-shadow 0.1s;
    cursor: pointer;
  }
  .tx-key:active { transform: scale(0.93); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
  .glass-nav {
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  .qr-scan-line {
    position: absolute; left: 4px; right: 4px; height: 2px;
    background: linear-gradient(90deg, transparent, #F2A900, transparent);
    animation: qr-scan-line 2.2s ease-in-out infinite;
    border-radius: 2px;
  }
`

export default function TransactionsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = searchParams.get("mode") === "withdraw" ? "withdraw" : "deposit"
  const [mode, setMode] = useState<"deposit" | "withdraw">(initialMode)
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [storeId, setStoreId] = useState<string | null | undefined>(undefined) // undefined = loading
  const [balance, setBalance] = useState(0)
  const [unitLabel, setUnitLabel] = useState("")
  const [chipUnitBefore, setChipUnitBefore] = useState(true)
  const [blindBb, setBlindBb] = useState<number | null>(null)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const [uid, setUid] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [userIconUrl, setUserIconUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return
      setUid(user.uid)
      const userSnap = await getDoc(doc(db, "users", user.uid))
      const data = userSnap.data()
      setUserName(data?.name ?? "")
      setUserIconUrl(data?.iconUrl ?? undefined)
      const currentStoreId = data?.currentStoreId ?? null
      setStoreId(currentStoreId)
      if (!currentStoreId) return

      const storeSnap = await getDoc(doc(db, "stores", currentStoreId))
      const storeData = storeSnap.data()
      const label = storeData?.chipUnitLabel
      setUnitLabel(label === "単位なし" ? "" : (label ?? ""))
      setChipUnitBefore(storeData?.chipUnitBefore !== false)
      setBlindBb(typeof storeData?.ringBlindBb === "number" ? storeData.ringBlindBb : null)

      const balanceSnap = await getDoc(doc(db, "users", user.uid, "storeBalances", currentStoreId))
      const balanceData = balanceSnap.data()
      setBalance(typeof balanceData?.balance === "number" ? balanceData.balance : 0)
    })
    return () => unsub()
  }, [])

  const fmtChip = (value: number) => {
    if (!unitLabel) return value.toLocaleString()
    return chipUnitBefore ? `${unitLabel}${value.toLocaleString()}` : `${value.toLocaleString()}${unitLabel}`
  }

  const formattedAmount = useMemo(() => {
    const value = amount ? Number(amount) : 0
    if (!unitLabel) return `${value}`
    return chipUnitBefore ? `${unitLabel}${value}` : `${value}${unitLabel}`
  }, [amount, unitLabel, chipUnitBefore])

  const useBb = typeof blindBb === "number" && blindBb > 0

  const formatBbValue = (value: number) => {
    if (!blindBb) return "0"
    const raw = value / blindBb
    const rounded = Number.isInteger(raw) ? raw : Math.round(raw * 10) / 10
    return rounded.toLocaleString()
  }

  const appendDigit = (digit: string) => {
    if (digit === "backspace") {
      setAmount(prev => prev.slice(0, -1))
      return
    }
    if (amount === "0") {
      setAmount(digit)
      return
    }
    setAmount(prev => `${prev}${digit}`)
  }

  const clearAmount = () => setAmount("")

  const submit = async () => {
    if (!uid || !storeId) return
    const numeric = Number(amount)

    if (!numeric || numeric < 1) {
      setError("数字は1以上で入力してください")
      return
    }

    if (mode === "withdraw" && numeric > balance) {
      setError("残高が不足しています")
      return
    }

    setError("")

    if (mode === "deposit") {
      await setDoc(doc(collection(db, "depositRequests")), {
        storeId,
        playerId: uid,
        amount: numeric,
        comment: "",
        status: "pending",
        createdAt: serverTimestamp(),
      })
      setMessage("申請を行いました")
      setTimeout(() => router.replace("/home"), 1200)
      return
    }

    setIsWithdrawModalOpen(true)
  }

  const confirmWithdraw = async () => {
    if (!uid || !storeId) return
    const numeric = Number(amount)

    if (!numeric || numeric < 1) {
      setError("数字は1以上で入力してください")
      return
    }

    const balanceRef = doc(db, "users", uid, "storeBalances", storeId)
    const balanceSnap = await getDoc(balanceRef)
    const current = balanceSnap.data()?.balance ?? 0

    if (!balanceSnap.exists() || current < numeric) {
      setError("残高が不足しています")
      return
    }

    await setDoc(doc(collection(db, "withdrawRequests")), {
      storeId,
      playerId: uid,
      amount: numeric,
      comment: "",
      status: "pending",
      createdAt: serverTimestamp(),
    })

    setIsWithdrawModalOpen(false)
    router.replace("/home")
  }

  const BottomNav = () => (
    <nav className="glass-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 80, borderTop: '0.5px solid rgba(0,0,0,0.12)' }}>
      <div style={{ maxWidth: 390, margin: '0 auto', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 40px 18px' }}>
        <button type="button" onClick={() => router.push("/home")} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#8E8E93', cursor: 'pointer' }}>
          <FiHome size={22} />
          <span style={{ fontSize: 11 }}>ホーム</span>
        </button>
        <button
          type="button"
          onClick={() => router.push("/home/transactions")}
          style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%, -50%)', width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg,#F2A900,#C97D00)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(242,169,0,0.45)', cursor: 'pointer' }}
          aria-label="Bank Roll"
        >
          {storeId ? <FiCreditCard size={26} /> : <BsQrCodeScan size={24} />}
        </button>
        <button type="button" onClick={() => router.push("/home/mypage")} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#8E8E93', cursor: 'pointer' }}>
          <FiUser size={22} />
          <span style={{ fontSize: 11 }}>マイページ</span>
        </button>
      </div>
    </nav>
  )

  // Loading state
  if (storeId === undefined) {
    return (
      <main style={{ minHeight: '100svh', background: '#F2F2F7' }}>
        <style>{CSS}</style>
        <HomeHeader homePath="/home" myPagePath="/home/mypage" />
        <BottomNav />
      </main>
    )
  }

  // Not in a store — show QR check-in
  if (storeId === null) {
    const qrValue = uid ? `rrpoker:checkin:${uid}` : ""
    return (
      <main style={{ minHeight: '100svh', background: '#F2F2F7', paddingBottom: 100 }}>
        <style>{CSS}</style>
        <HomeHeader homePath="/home" myPagePath="/home/mypage" />
        <div style={{ maxWidth: 390, margin: '0 auto', padding: '0 20px' }}>
          {/* Header row */}
          <div className="tx-slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, marginBottom: 28 }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', cursor: 'pointer', color: '#3C3C43' }}
            >
              <FiArrowLeft size={18} />
            </button>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E' }}>入店QRコード</h1>
            <div style={{ width: 36 }} />
          </div>

          {/* QR card */}
          <div className="tx-slide-2" style={{ background: '#fff', borderRadius: 22, padding: '28px 24px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(242,169,0,0.1)', border: '1px solid rgba(242,169,0,0.25)', borderRadius: 99, padding: '5px 14px', marginBottom: 24 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F2A900', display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#D4910A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>入店QRコード</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ position: 'relative', padding: 14, background: '#fff', borderRadius: 18, border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', display: 'inline-block' }}>
                {qrValue ? (
                  <QRCodeSVG
                    value={qrValue}
                    size={210}
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#000000"
                    style={{ display: 'block' }}
                  />
                ) : (
                  <div style={{ width: 210, height: 210, background: '#F2F2F7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BsQrCodeScan size={48} color="#C7C7CC" />
                  </div>
                )}
                <div className="qr-scan-line" />
              </div>
            </div>

            {/* Player info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F2F2F7', borderRadius: 16, padding: '12px 16px', textAlign: 'left' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid #F2A900', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {userIconUrl
                  ? <img src={userIconUrl} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 18 }}>👤</span>
                }
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.2px' }}>{userName || 'プレイヤー'}</p>
                <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>このQRを店舗スタッフに見せてください</p>
              </div>
            </div>
          </div>

          <p className="tx-slide-3" style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 16 }}>
            QRコードをスキャンすることで入店できます
          </p>
        </div>
        <BottomNav />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100svh', background: '#F2F2F7', paddingBottom: 100 }}>
      <style>{CSS}</style>
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />

      <div style={{ maxWidth: 390, margin: '0 auto', padding: '0 16px' }}>

        {/* Header row */}
        <div className="tx-slide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', cursor: 'pointer', color: '#3C3C43' }}
          >
            <FiArrowLeft size={18} />
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E' }}>入出金</h1>
          <div style={{ width: 36 }} />
        </div>

        {/* iOS Segmented Control */}
        <div className="tx-slide-2" style={{ display: 'flex', background: '#E5E5EA', borderRadius: 11, padding: 3, marginBottom: 16 }}>
          {(['deposit', 'withdraw'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError("") }}
              style={{
                flex: 1, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: mode === m ? '#fff' : 'transparent',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.04)' : 'none',
                fontSize: 14, fontWeight: 600,
                color: mode === m ? '#1C1C1E' : '#6C6C70',
                transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {m === 'deposit' ? <><FiArrowDownCircle size={14} />あずける</> : <><FiArrowUpCircle size={14} />ひきだす</>}
            </button>
          ))}
        </div>

        {/* Main Card */}
        <div className="tx-slide-3" style={{ background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

          {/* Amount display */}
          <div style={{ padding: '24px 20px 16px', borderBottom: '0.5px solid #F2F2F7', textAlign: 'center' }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#8E8E93', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {mode === 'deposit' ? 'あずける金額' : 'ひきだす金額'}
            </p>
            <p style={{ fontSize: 48, fontWeight: 800, color: amount ? '#1C1C1E' : '#C7C7CC', letterSpacing: '-1px', lineHeight: 1.1 }}>
              {formattedAmount || (chipUnitBefore ? `${unitLabel}0` : `0${unitLabel}`)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 13, color: '#8E8E93' }}>残高</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43' }}>{fmtChip(balance)}</span>
              {useBb && <span style={{ fontSize: 12, color: '#AEAEB2' }}>({formatBbValue(balance)}BB)</span>}
            </div>
          </div>

          {/* Keypad */}
          <div style={{ padding: '16px 16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {KEYPAD_ROWS.flat().map((key, i) => {
                if (!key) return <div key={i} />
                return (
                  <button key={i} type="button" onClick={() => appendDigit(key)} className="tx-key">
                    {key === 'backspace' ? '⌫' : key}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={clearAmount}
              style={{ marginTop: 10, width: '100%', height: 44, borderRadius: 12, background: '#F2F2F7', border: 'none', fontSize: 14, fontWeight: 500, color: '#6C6C70', cursor: 'pointer' }}
            >
              クリア
            </button>
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8, background: '#FFF2F2', borderRadius: 12, padding: '10px 14px' }}>
              <FiAlertCircle color="#FF3B30" size={16} style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 13, fontWeight: 500, color: '#FF3B30' }}>{error}</p>
            </div>
          )}
          {message && (
            <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(242,169,0,0.10)', borderRadius: 12, padding: '10px 14px' }}>
              <FiCheckCircle color="#D4910A" size={16} style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 13, fontWeight: 500, color: '#D4910A' }}>{message}</p>
            </div>
          )}

          {/* Submit */}
          <div style={{ padding: '0 16px 24px' }}>
            <button
              type="button"
              onClick={submit}
              style={{ width: '100%', height: 54, borderRadius: 16, background: 'linear-gradient(135deg,#F2A900,#C97D00)', border: 'none', fontSize: 16, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(242,169,0,0.40)', letterSpacing: '0.3px' }}
            >
              {mode === 'deposit' ? 'あずける（申請）' : 'ひきだす（申請）'}
            </button>
          </div>
        </div>
      </div>

      <BottomNav />

      {/* Withdraw bottom-sheet modal */}
      {isWithdrawModalOpen && (
        <>
          <div
            onClick={() => setIsWithdrawModalOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', zIndex: 998 }}
          />
          <div
            className="tx-sheet"
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999, background: '#fff', borderRadius: '24px 24px 0 0', padding: '8px 20px 48px' }}
          >
            {/* Handle bar */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D1D6', margin: '8px auto 20px' }} />

            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', textAlign: 'center', marginBottom: 20 }}>引き出し確認</h2>

            <div style={{ background: '#F9F9FB', borderRadius: 18, padding: '20px', textAlign: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: '#8E8E93', marginBottom: 8, fontWeight: 500 }}>ディーラーに見せてください</p>
              <p style={{ fontSize: 52, fontWeight: 800, color: '#F2A900', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
                {fmtChip(Number(amount || 0))}
              </p>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF2F2', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
                <FiAlertCircle color="#FF3B30" size={16} style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 13, fontWeight: 500, color: '#FF3B30' }}>{error}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                style={{ flex: 1, height: 52, borderRadius: 16, background: '#F2F2F7', border: 'none', fontSize: 15, fontWeight: 600, color: '#3C3C43', cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button
                onClick={confirmWithdraw}
                style={{ flex: 1, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#F2A900,#C97D00)', border: 'none', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(242,169,0,0.38)' }}
              >
                確認完了
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
