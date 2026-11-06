import { describe, it, expect } from 'vitest'
import { isAllowedGuideUrl, guideFilesOf, isGuideType } from '../lib/playerGuide'

const B = 'rrpoker-8f2af.firebasestorage.app'
const url = (p: string) => `https://firebasestorage.googleapis.com/v0/b/${B}/o/${encodeURIComponent(p)}?alt=media&token=x`

describe('プレイヤーズガイド', () => {
  it('保存の中継は、このアプリの Storage の店舗のガイドだけ通す', () => {
    expect(isAllowedGuideUrl(url('stores/st1/guides/a.pdf'), B)).toBe(true)
    expect(isAllowedGuideUrl(url('users/u1/avatar'), B)).toBe(false)
    expect(isAllowedGuideUrl(url('stores/st1/guides/../../x'), B)).toBe(false)
    expect(isAllowedGuideUrl(url('stores/st1/guides/a.pdf'), 'other-bucket')).toBe(false)
    expect(isAllowedGuideUrl('https://example.com/v0/b/' + B + '/o/stores%2Fst1%2Fguides%2Fa.pdf', B)).toBe(false)
    expect(isAllowedGuideUrl('http://firebasestorage.googleapis.com/v0/b/' + B + '/o/stores%2Fst1%2Fguides%2Fa.pdf', B)).toBe(false)
  })
  it('受け付けるのは PDF と画像', () => {
    expect(isGuideType('application/pdf')).toBe(true)
    expect(isGuideType('image/png')).toBe(true)
    expect(isGuideType('application/msword')).toBe(false)
  })
  it('一覧は最大 5 つ、壊れた行は捨てる', () => {
    const f = { id: 'a', name: 'a.pdf', url: 'u', path: 'p', contentType: 'application/pdf', size: 1 }
    expect(guideFilesOf([f, f, f, f, f, f, null, { name: 1 }])).toHaveLength(5)
    expect(guideFilesOf('x')).toEqual([])
  })
})
