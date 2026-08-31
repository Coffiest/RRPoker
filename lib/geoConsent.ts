import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * 位置情報を使ってよいかの同意。
 *
 * 以前は端末の localStorage にしか持っていなかった。iOS は一定期間で
 * スクリプトから書ける保存領域を消すため、そのたびに同意が失われ、
 * ログインし直すたびに同じ確認が出ていた。端末を変えても聞き直しになる。
 *
 * そこで正本はアカウント(users/{uid}.geoConsent)に置く。localStorage は
 * 初回描画で待たせないための控えとして残すだけで、判断の根拠にはしない。
 */

export type GeoConsent = 'granted' | 'declined'

const CACHE_KEY = 'rrpoker_geo_consent'

function isConsent(v: unknown): v is GeoConsent {
  return v === 'granted' || v === 'declined'
}

/** 端末に残っている控え。無ければ null。 */
export function readCachedGeoConsent(): GeoConsent | null {
  try {
    const v = window.localStorage.getItem(CACHE_KEY)
    return isConsent(v) ? v : null
  } catch {
    return null
  }
}

function writeCache(value: GeoConsent): void {
  try { window.localStorage.setItem(CACHE_KEY, value) } catch {}
}

/**
 * このアカウントの同意を読む。アカウント側に答えがあればそれを正とし、
 * 端末の控えも合わせておく。読めなければ控えで代用する(オフライン等)。
 */
export async function loadGeoConsent(uid: string): Promise<GeoConsent | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const stored = snap.data()?.geoConsent
    if (isConsent(stored)) {
      writeCache(stored)
      return stored
    }
    // アカウント側がまだ空で、端末に答えが残っているなら、それを引き継いで保存する
    // (この仕組みを入れる前に一度答えてくれた人へ、もう一度聞かないため)。
    const cached = readCachedGeoConsent()
    if (cached) {
      await setDoc(doc(db, 'users', uid), { geoConsent: cached }, { merge: true })
      return cached
    }
    return null
  } catch {
    return readCachedGeoConsent()
  }
}

/** 同意を保存する。アカウント側が正本、端末側は控え。 */
export async function saveGeoConsent(uid: string, value: GeoConsent): Promise<void> {
  writeCache(value)
  try {
    await setDoc(doc(db, 'users', uid), { geoConsent: value }, { merge: true })
  } catch {
    // 書けなくても控えは残る。次に開いたときに引き継がれる。
  }
}
