'use client'

/**
 * 店舗の設定「プレイヤーズガイド」(lib/playerGuide.ts)。
 * ON/OFF と、ファイル(PDF・画像、最大 5 つ・1 つ 20MB まで)の追加・削除。
 * 追加は「ファイルを選ぶ」か、枠へのドラッグ&ドロップ。
 */

import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref as sref, uploadBytesResumable } from 'firebase/storage'
import { FileText, Trash2, Upload } from 'lucide-react'
import { db, storage } from '@/lib/firebase'
import { showToast } from '@/lib/toast'
import {
  GUIDE_ACCEPT, GUIDE_MAX_BYTES, GUIDE_MAX_FILES, type GuideFile,
  formatBytes, guideFilesOf, isGuideType, isPdf,
} from '@/lib/playerGuide'

export function GuideThumb({ f, size = 48 }: { f: GuideFile; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#F2F2F7', boxShadow: 'inset 0 0 0 1px rgba(60,60,67,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
      {isPdf(f)
        ? <>
            <FileText size={Math.round(size * 0.42)} strokeWidth={2} color="#C62828" aria-hidden />
            <span className="tech-label" style={{ fontSize: 9, color: '#C62828', lineHeight: 1 }}>PDF</span>
          </>
        // eslint-disable-next-line @next/next/no-img-element -- Storage の画像
        : <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    </span>
  )
}

export default function PlayerGuideSettings({ storeId }: { storeId: string }) {
  const [enabled, setEnabled] = useState(false)
  const [files, setFiles] = useState<GuideFile[]>([])
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null)
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<GuideFile[]>([])
  useEffect(() => { filesRef.current = files }, [files])

  useEffect(() => {
    if (!storeId) return
    return onSnapshot(doc(db, 'stores', storeId), snap => {
      const d = snap.data()
      setEnabled(d?.playerGuideEnabled === true)
      setFiles(guideFilesOf(d?.playerGuideFiles))
    }, () => {})
  }, [storeId])

  const toggle = async () => {
    const next = !enabled
    setEnabled(next)
    try { await updateDoc(doc(db, 'stores', storeId), { playerGuideEnabled: next }) }
    catch { setEnabled(!next); showToast('保存できませんでした') }
  }

  const addFiles = async (list: File[]) => {
    for (const file of list) {
      if (filesRef.current.length >= GUIDE_MAX_FILES) { showToast(`ファイルは ${GUIDE_MAX_FILES} つまでです`); break }
      if (!isGuideType(file.type)) { showToast(`${file.name}: PDF か画像を選んでください`); continue }
      if (file.size > GUIDE_MAX_BYTES) { showToast(`${file.name}: 20MB までです`); continue }
      const ext = (file.name.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? '').toLowerCase()
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const path = `stores/${storeId}/guides/${id}${ext}`
      setProgress({ name: file.name, pct: 0 })
      try {
        const task = uploadBytesResumable(sref(storage, path), file, { contentType: file.type })
        await new Promise<void>((resolve, reject) => {
          task.on('state_changed', s => setProgress({ name: file.name, pct: s.totalBytes ? Math.round((s.bytesTransferred / s.totalBytes) * 100) : 0 }), reject, () => resolve())
        })
        const url = await getDownloadURL(task.snapshot.ref)
        const next = [...filesRef.current, { id, name: file.name, url, path, contentType: file.type, size: file.size }]
        filesRef.current = next
        setFiles(next)
        await updateDoc(doc(db, 'stores', storeId), { playerGuideFiles: next })
      } catch {
        showToast(`${file.name} を保存できませんでした`)
      }
    }
    setProgress(null)
  }

  const remove = async (f: GuideFile) => {
    const next = filesRef.current.filter(x => x.id !== f.id)
    try {
      await updateDoc(doc(db, 'stores', storeId), { playerGuideFiles: next })
      setFiles(next)
      deleteObject(sref(storage, f.path)).catch(() => {})
    } catch { showToast('削除できませんでした') }
  }

  const full = files.length >= GUIDE_MAX_FILES
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[14px]" style={{ color: '#1D1D1F' }}>プレイヤーズガイドを出す</span>
        <button type="button" role="switch" aria-checked={enabled} onClick={() => void toggle()} className="a-switch" aria-label="プレイヤーズガイドを出す" />
      </div>

      {files.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map(f => (
            <li key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12, background: 'var(--fill)' }}>
              <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`${f.name}を開く`}><GuideThumb f={f} size={44} /></a>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span className="con-mono" style={{ fontSize: 11, color: 'var(--label3)' }}>{formatBytes(f.size)}</span>
              </span>
              <button type="button" onClick={() => void remove(f)} aria-label={`${f.name}を削除`}
                style={{ width: 44, height: 44, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Trash2 size={18} strokeWidth={2} color="#C62828" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); void addFiles(Array.from(e.dataTransfer.files)) }}
          onClick={() => !progress && inputRef.current?.click()}
          role="button" tabIndex={0} aria-label="プレイヤーズガイドのファイルを追加"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          style={{ marginTop: 16, minHeight: 96, borderRadius: 14, border: `1.5px dashed ${over ? '#D4910A' : 'rgba(60,60,67,0.25)'}`, background: over ? 'rgba(242,169,0,0.08)' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, cursor: progress ? 'default' : 'pointer', textAlign: 'center' }}>
          {progress
            ? <span className="con-mono" style={{ fontSize: 12, color: 'var(--label2)' }}>アップロード中 {progress.pct}% · {progress.name}</span>
            : <>
                <Upload size={20} strokeWidth={2} color="#D4910A" aria-hidden />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)' }}>ファイルを選ぶ / ここにドラッグ</span>
                <span style={{ fontSize: 11, color: 'var(--label3)' }}>PDF・画像 / 1 つ 20MB まで / あと {GUIDE_MAX_FILES - files.length} つ</span>
              </>}
        </div>
      )}
      <input ref={inputRef} type="file" accept={GUIDE_ACCEPT} multiple hidden
        onChange={e => { const l = Array.from(e.target.files ?? []); e.target.value = ''; if (l.length) void addFiles(l) }} />
    </div>
  )
}
