import { resizeImageToDataUrl } from '@/lib/image'

/**
 * トーナメントのチラシ画像を、端末の中で縮めて文字列(data URL)にする。
 *
 * 以前は Firebase Storage の tournaments/ に上げていたが、Storage のルールにその場所の許可が無く、
 * 上げる段階で断られて保存できなかった(店舗・プレイヤーのアイコンも data URL で持っている)。
 * 大会の文書に入れるので、Firestore の 1 文書 1MB の上限より十分小さく(既定 350KB 以下)する。
 * 写真のままでも端末の中で縮めるので、通信を待たずにすぐ入る。
 */
export const FLYER_MAX_BYTES = 350_000

export async function flyerToDataUrl(file: File, maxBytes = FLYER_MAX_BYTES): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選んでください')
  const tries: Array<[number, number]> = [[1280, 0.82], [1080, 0.76], [960, 0.7], [800, 0.64], [640, 0.6]]
  let last = ''
  for (const [edge, q] of tries) {
    last = await resizeImageToDataUrl(file, edge, q)
    if (dataUrlBytes(last) <= maxBytes) return last
  }
  if (dataUrlBytes(last) <= maxBytes) return last
  throw new Error('画像が大きすぎます。別の画像を選んでください')
}

/** data URL の中身のおおよその大きさ(バイト)。 */
export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.floor((b64.length * 3) / 4)
}
