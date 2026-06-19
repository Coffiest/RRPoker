import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTimerSync, getCurrentElapsedSeconds, getDisplayTime, formatTime } from '@/hooks/useTimerSync'
import { useTVDimensions, useRemoteControl, RemoteKey, getFontSize } from '@/lib/firetvUtils'

const COLORS = {
  gold: '#F2A900',
  dark: '#1C1C1E',
  light: '#FAFAFA',
  lightGray: '#F2F2F7',
  green: '#34C759',
  lightGreen: '#D1FADF',
}

interface TimerScreenProps {
  storeId: string
  tournamentId: string
  tournamentName: string
  onBack: () => void
}

export function TimerScreen({ storeId, tournamentId, tournamentName, onBack }: TimerScreenProps) {
  const tvDims = useTVDimensions()
  const timerState = useTimerSync(storeId, tournamentId)
  const [displayTime, setDisplayTime] = useState(0)

  // リアルタイム時刻更新
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = getCurrentElapsedSeconds(timerState.levelStartedAt, timerState.timerRunning)
      const time = getDisplayTime(timerState.levelStartedRemaining, elapsed)
      setDisplayTime(time)
    }, 100)

    return () => clearInterval(interval)
  }, [timerState.levelStartedAt, timerState.timerRunning, timerState.levelStartedRemaining])

  useRemoteControl({
    [RemoteKey.Back]: onBack,
  })

  // フォントサイズ計算（TV インチに応じて自動調整）
  const mainTimeFontSize = getFontSize(200, tvDims.scale)  // 大きな時間表示
  const levelFontSize = getFontSize(64, tvDims.scale)
  const labelFontSize = getFontSize(32, tvDims.scale)
  const smallFontSize = getFontSize(24, tvDims.scale)

  const currentLevel = timerState.customBlindLevels?.[timerState.currentLevelIndex]
  const nextLevel = timerState.customBlindLevels?.[timerState.currentLevelIndex + 1]

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.light,
        justifyContent: 'space-between',
        paddingVertical: 60,
        paddingHorizontal: 60,
      }}
    >
      {/* ヘッダー */}
      <View>
        <Text style={{ fontSize: labelFontSize, fontWeight: '700', color: COLORS.dark, marginBottom: 12 }}>
          {tournamentName}
        </Text>
        <Text style={{ fontSize: smallFontSize, color: '#666' }}>
          {timerState.timerRunning ? '進行中' : '停止中'}
        </Text>
      </View>

      {/* メイン時間表示 */}
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            fontSize: mainTimeFontSize,
            fontWeight: '700',
            color: COLORS.gold,
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatTime(displayTime)}
        </Text>
      </View>

      {/* レベル情報 */}
      <View style={{ alignItems: 'center', gap: 40 }}>
        {/* 現在のレベル */}
        {currentLevel && (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: labelFontSize, color: COLORS.dark, fontWeight: '600', marginBottom: 16 }}>
              現在のレベル
            </Text>

            {currentLevel.type === 'level' ? (
              <View
                style={{
                  backgroundColor: COLORS.lightGray,
                  borderRadius: 12,
                  paddingVertical: 20,
                  paddingHorizontal: 40,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 60, alignItems: 'center' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: smallFontSize, color: '#666', marginBottom: 8 }}>
                      SB
                    </Text>
                    <Text style={{ fontSize: levelFontSize, fontWeight: '700', color: COLORS.dark }}>
                      {currentLevel.smallBlind}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: smallFontSize, color: '#666', marginBottom: 8 }}>
                      BB
                    </Text>
                    <Text style={{ fontSize: levelFontSize, fontWeight: '700', color: COLORS.dark }}>
                      {currentLevel.bigBlind}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: smallFontSize, color: '#666', marginBottom: 8 }}>
                      Ante
                    </Text>
                    <Text style={{ fontSize: levelFontSize, fontWeight: '700', color: COLORS.dark }}>
                      {currentLevel.ante}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text style={{ fontSize: levelFontSize, fontWeight: '700', color: COLORS.dark }}>
                休憩
              </Text>
            )}
          </View>
        )}

        {/* 次のレベル */}
        {nextLevel && (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: labelFontSize, color: COLORS.dark, fontWeight: '600', marginBottom: 16 }}>
              次のレベル
            </Text>

            {nextLevel.type === 'level' ? (
              <View
                style={{
                  backgroundColor: '#E8E8E8',
                  borderRadius: 12,
                  paddingVertical: 16,
                  paddingHorizontal: 32,
                  opacity: 0.7,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 60, alignItems: 'center' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: smallFontSize - 4, color: '#999' }}>
                      SB
                    </Text>
                    <Text style={{ fontSize: levelFontSize - 20, fontWeight: '700', color: COLORS.dark }}>
                      {nextLevel.smallBlind}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: smallFontSize - 4, color: '#999' }}>
                      BB
                    </Text>
                    <Text style={{ fontSize: levelFontSize - 20, fontWeight: '700', color: COLORS.dark }}>
                      {nextLevel.bigBlind}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: smallFontSize - 4, color: '#999' }}>
                      Ante
                    </Text>
                    <Text style={{ fontSize: levelFontSize - 20, fontWeight: '700', color: COLORS.dark }}>
                      {nextLevel.ante}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text style={{ fontSize: levelFontSize - 20, fontWeight: '700', color: '#999' }}>
                休憩
              </Text>
            )}
          </View>
        )}
      </View>

      {/* フッター */}
      <View style={{ alignItems: 'center' }}>
        <TouchableOpacity
          onPress={onBack}
          style={{
            backgroundColor: COLORS.lightGray,
            borderRadius: 8,
            paddingVertical: 12,
            paddingHorizontal: 32,
          }}
        >
          <Text style={{ fontSize: smallFontSize, color: COLORS.dark, fontWeight: '600' }}>
            ← トーナメント一覧に戻る
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
