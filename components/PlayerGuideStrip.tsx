'use client'

/**
 * プレイヤーのホーム「入店中」のカードの中に出す「プレイヤーズガイドはこちら」(lib/playerGuide.ts)。
 * 店舗が ON にしてファイルを入れているときだけ出す。サムネイルを押すとアプリの中で開き、保存もできる。
 */

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { BookOpen, Download, ExternalLink } from 'lucide-react'
import { db } from '@/lib/firebase'
import AppleSheet from '@/components/AppleSheet'
import { GuideThumb } from '@/components/PlayerGuideSettings'
import { type GuideFile, guideDownloadHref, guideFilesOf, isPdf } from '@/lib/playerGuide'

export default function PlayerGuideStrip({ storeId }: { storeId: string }) {
  const [files, setFiles] = useState<GuideFile[]>([])
  const [open, setOpen] = useState<GuideFile | null>(null)

  useEffect(() => {
    if (!storeId) return
    return onSnapshot(doc(db, 'stores', storeId), snap => {
      const d = snap.data()
      setFiles(d?.playerGuideEnabled === true ? guideFilesOf(d?.playerGuideFiles) : [])
    }, () => setFiles([]))
  }, [storeId])

  if (files.length === 0) return null
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--sep)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <p style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--label)' }}>
        <BookOpen size={14} strokeWidth={2} color="#D4910A" aria-hidden style={{ flexShrink: 0 }} />
        プレイヤーズガイドはこちら
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {files.map(f => (
          <button key={f.id} type="button" onClick={() => setOpen(f)} aria-label={`${f.name}を開く`}
            style={{ minWidth: 44, minHeight: 44, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GuideThumb f={f} size={44} />
          </button>
        ))}
      </div>

      <AppleSheet open={!!open} onClose={() => setOpen(null)} maxWidth={720} maxHeightVh={94}
        title={<span className="tech-label" style={{ fontSize: 11, color: 'var(--label)', letterSpacing: '0.14em' }}>PLAYER&apos;S GUIDE</span>}
        footer={open && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <a href={open.url} target="_blank" rel="noopener noreferrer" 
              style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, background: 'var(--fill)', color: 'var(--label)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <ExternalLink size={16} strokeWidth={2} aria-hidden /> 全画面で開く
            </a>
            <a href={guideDownloadHref(open)} download={open.name} 
              style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, background: 'linear-gradient(135deg,#F2A900,#D4910A)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              <Download size={16} strokeWidth={2} aria-hidden /> 保存
            </a>
          </div>
        )}>
        {open && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)', margin: '0 0 12px', overflowWrap: 'anywhere' }}>{open.name}</p>
            {isPdf(open)
              ? <iframe src={open.url} title={open.name} style={{ width: '100%', height: '62vh', border: 'none', borderRadius: 12, background: '#F2F2F7' }} />
              // eslint-disable-next-line @next/next/no-img-element -- Storage の画像
              : <img src={open.url} alt={open.name} style={{ width: '100%', height: 'auto', borderRadius: 12, display: 'block' }} />}
          </div>
        )}
      </AppleSheet>
    </div>
  )
}
