'use client'

import { useRouter } from 'next/navigation'

export default function TopPage() {
  const router = useRouter()

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#ffffff',
        padding: 24,
        textAlign: 'center',
      }}
    >
      {/* ロゴ */}
      <h1
        style={{
          fontSize: 40,
          fontWeight: 700,
          marginBottom: 16,
          letterSpacing: -0.5,
          color: '#111',
        }}
      >
        RRPoker
      </h1>

      {/* キャッチコピー */}
      <p
        style={{
          fontSize: 16,
          color: '#666',
          marginBottom: 40,
        }}
      >
        チップ管理を、もっと速く。
      </p>

      {/* ログインボタン */}
      <button
        onClick={() => router.push('/login')}
        style={{
          padding: '14px 32px',
          borderRadius: 16,
          border: 'none',
          background: '#ffb703', // 目がチカチカしないオレンジ寄り黄色
          color: '#000',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        OPEN
      </button>

       <div className="pt-[50px] text-center">
    
               <p className="mt-2 text-[10px] text-gray-500">ver 1.3.5np2</p>
                <p className="mt-2 text-[10px] text-gray-500">RRPoker by Runner Runner</p>
                <p className="mt-2 text-[10px] text-gray-500">製作者 : なおゆき</p>
        </div>
        
    </main>
  )
}
