/**
 * プレイヤーズガイド(オーナー指定・2026-11-06)。
 * 店舗の設定で ON にしてファイル(PDF・画像、最大 5 つ・1 つ 20MB まで)を入れておくと、
 * その店舗に入店中のプレイヤーのホームの「入店中」のカードに「プレイヤーズガイドはこちら」とサムネイルが出る。
 *
 * ファイルは Firebase Storage の stores/{店舗ID}/guides/ に置く(storage.rules で店舗のオーナー・権限のある人だけが書ける)。
 * 店舗の文書には一覧だけを持つ: stores/{id}.playerGuideEnabled / playerGuideFiles。
 * 保存はアプリのサーバー(app/api/guide-file)を通す。Storage のファイルは別のドメインなので、
 * そのままではブラウザの「保存」が効かない(ダウンロードの指定が無視される)。
 */

export type GuideFile = {
  id: string
  name: string
  /** Storage のダウンロード URL */
  url: string
  /** Storage の中の場所(消すときに使う) */
  path: string
  contentType: string
  size: number
}

export const GUIDE_MAX_FILES = 5
export const GUIDE_MAX_BYTES = 20 * 1024 * 1024
export const GUIDE_ACCEPT = 'application/pdf,image/*'

export function isGuideType(type: string): boolean {
  return type === 'application/pdf' || type.startsWith('image/')
}

export function isPdf(f: Pick<GuideFile, 'contentType' | 'name'>): boolean {
  return f.contentType === 'application/pdf' || /\.pdf$/i.test(f.name)
}

export function guideFilesOf(v: unknown): GuideFile[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is GuideFile => !!x && typeof x.url === 'string' && typeof x.path === 'string' && typeof x.name === 'string')
    .slice(0, GUIDE_MAX_FILES)
}

/** 保存用の URL(同じドメインのサーバーを通し、保存として返す) */
export function guideDownloadHref(f: Pick<GuideFile, 'url' | 'name'>): string {
  return `/api/guide-file?u=${encodeURIComponent(f.url)}&n=${encodeURIComponent(f.name)}`
}

/** サーバーで、通してよい URL かを確かめる(このアプリの Storage の、店舗のガイドの場所だけ) */
export function isAllowedGuideUrl(raw: string, buckets: string | undefined | (string | undefined)[]): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' || u.hostname !== 'firebasestorage.googleapis.com') return false
    const list = (Array.isArray(buckets) ? buckets : [buckets]).filter((b): b is string => !!b)
    for (const bucket of list) {
      const prefix = `/v0/b/${bucket}/o/`
      if (!u.pathname.startsWith(prefix)) continue
      const objectPath = decodeURIComponent(u.pathname.slice(prefix.length))
      if (/^stores\/[^/]+\/guides\/[^/]+$/.test(objectPath)) return true
    }
    return false
  } catch {
    return false
  }
}

/** このアプリの Storage の入れ物の名前(設定値。無ければプロジェクト ID から決まる既定の名前) */
export function appBuckets(): string[] {
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  return [process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, pid && `${pid}.firebasestorage.app`, pid && `${pid}.appspot.com`]
    .filter((b): b is string => !!b)
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.round(n / 1024))}KB`
}
