import { useEffect, useState } from 'react'
import { useWindowDimensions } from 'react-native'

// Fire TV / Android TV のスクリーンサイズ別スケーリング
// 55inch, 65inch, 75inch, 85inch などに自動対応

export interface TVDimensions {
  width: number
  height: number
  scale: number  // フォントサイズの倍率
  baseFontSize: number  // 基準フォントサイズ（32px）
}

export function useTVDimensions(): TVDimensions {
  const { width, height } = useWindowDimensions()
  const [dims, setDims] = useState<TVDimensions>({
    width,
    height,
    scale: 1,
    baseFontSize: 32,
  })

  useEffect(() => {
    // 対角線サイズで大体の TV インチを判定
    // TV の DPI は通常 60-100 DPI（スマートフォンは 300+ DPI）
    // Fire TV のターゲット最小解像度：720p, 1080p, 4K

    const calculateScale = (): number => {
      // 最小高さ 720px の場合、通常スケール
      // 最大高さ 2160px（4K）の場合、スケール up

      if (height < 720) return 0.7  // 小型（おそらく設定ミス）
      if (height < 1080) return 1.0  // HD（55-65 inch ターゲット）
      if (height < 1440) return 1.3  // FHD（65 inch）
      if (height < 2160) return 1.5  // QHD / 高解像度（75 inch）
      return 2.0  // 4K（85 inch 以上）
    }

    const scale = calculateScale()
    const baseFontSize = 32

    setDims({
      width,
      height,
      scale,
      baseFontSize,
    })
  }, [width, height])

  return dims
}

// ヘルパー: フォントサイズを自動計算
export function getFontSize(baseSize: number, scale: number): number {
  return Math.round(baseSize * scale)
}

// リモコンキーマッピング
export enum RemoteKey {
  Up = 'ArrowUp',
  Down = 'ArrowDown',
  Left = 'ArrowLeft',
  Right = 'ArrowRight',
  OK = 'Enter',
  Back = 'Backspace',
  Home = 'Home',
}

export function useRemoteControl(
  handlers: Partial<Record<RemoteKey, () => void>>
) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key as RemoteKey
      if (handlers[key]) {
        e.preventDefault()
        handlers[key]?.()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handlers])
}

// QR コード用のカメラアクセス（Fire TV では LL でカメラ使用不可の場合が多いため、メール/パスの方がメイン）
export function supportsCamera(): boolean {
  // Fire TV が カメラサポートしているか確認
  // ほとんどの Fire Stick はカメラなし
  return false
}
