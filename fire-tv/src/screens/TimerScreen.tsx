import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Image, Animated, Easing, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTimerSync, getCurrentElapsedSeconds, getDisplayTime } from '@/hooks/useTimerSync'
import { useRemoteControl, RemoteKey } from '@/lib/firetvUtils'

// TimerClient.tsx (app/home/store/timer/[tournamentId]/TimerClient.tsx) と同一のデザイン。
// 固定デザイン 1440x900 を viewport に収まるよう scale するアルゴリズムも同一。
const DESIGN_W = 1440
const DESIGN_H = 900
const GOLD = '#C8820A'
const GOLD_DARK = '#A06500'

type BlindLevel = { type: 'level'; smallBlind: number | null; bigBlind: number | null; ante: number | null; duration: number | null; comment?: string | null }
type BreakLevel = { type: 'break'; duration: number | null; comment?: string | null }
type Level = BlindLevel | BreakLevel

interface TimerScreenProps {
  storeId: string
  tournamentId: string
  tournamentName: string
  onBack: () => void
}

function fmt2(n: number) {
  return n.toString().padStart(2, '0')
}

function GradientLine({ direction, style }: { direction: 'right' | 'left'; style?: any }) {
  return (
    <LinearGradient
      colors={direction === 'right' ? ['transparent', '#E8E8E8'] : ['#E8E8E8', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[{ height: 1, flex: 1 }, style]}
    />
  )
}

export function TimerScreen({ storeId, tournamentId, onBack }: TimerScreenProps) {
  const { width: winW, height: winH } = useWindowDimensions()
  const scale = Math.min(winW / DESIGN_W, winH / DESIGN_H)
  const offsetX = Math.max(0, (winW - DESIGN_W * scale) / 2)
  const offsetY = Math.max(0, (winH - DESIGN_H * scale) / 2)

  const timerState = useTimerSync(storeId, tournamentId)
  const [tickNow, setTickNow] = useState(Date.now())
  const [colonOn, setColonOn] = useState(true)

  useRemoteControl({ [RemoteKey.Back]: onBack })

  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!timerState.timerRunning) { setColonOn(true); return }
    const id = setInterval(() => setColonOn(v => !v), 500)
    return () => clearInterval(id)
  }, [timerState.timerRunning])

  // ── ニュースティッカー（newsFlash 10s ループ）─────────────────────────
  const tickerProgress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!timerState.comment) return
    tickerProgress.setValue(0)
    const anim = Animated.loop(
      Animated.timing(tickerProgress, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true })
    )
    anim.start()
    return () => anim.stop()
  }, [timerState.comment])
  const tickerTranslateX = tickerProgress.interpolate({
    inputRange: [0, 0.08, 0.16, 0.62, 0.72, 1],
    outputRange: [-DESIGN_W, -DESIGN_W, 0, 0, DESIGN_W, DESIGN_W],
  })
  const tickerOpacity = tickerProgress.interpolate({
    inputRange: [0, 0.08, 0.16, 0.62, 0.72, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  })

  void tickNow
  const elapsed = getCurrentElapsedSeconds(timerState.levelStartedAt, timerState.timerRunning)
  const displaySeconds = timerState.timerRunning
    ? getDisplayTime(timerState.levelStartedRemaining, elapsed)
    : timerState.timeRemaining
  const minutes = Math.floor(displaySeconds / 60)
  const seconds = displaySeconds % 60

  const levelsToUse: Level[] = Array.isArray(timerState.customBlindLevels) ? timerState.customBlindLevels : []
  const currentLevelIndex = timerState.currentLevelIndex
  const level = levelsToUse[currentLevelIndex] ?? null
  const nextLevel = currentLevelIndex < levelsToUse.length - 1 ? levelsToUse[currentLevelIndex + 1] : level
  const isPresetSelected = levelsToUse.length > 0 && level !== null
  const totalLevelSeconds = level && typeof level.duration === 'number' ? level.duration * 60 : 1
  const progress = totalLevelSeconds > 0 ? (displaySeconds / totalLevelSeconds) * 100 : 0

  const nextBreakSeconds = (() => {
    let total = displaySeconds
    for (let i = currentLevelIndex + 1; i < levelsToUse.length; i++) {
      const lv = levelsToUse[i]
      if (lv.type === 'break') break
      if (typeof lv.duration === 'number') total += lv.duration * 60
    }
    return total
  })()
  const nextBreakMin = Math.floor(nextBreakSeconds / 60)
  const nextBreakSec = nextBreakSeconds % 60
  const hasNextBreak = levelsToUse.slice(currentLevelIndex + 1).some(lv => lv.type === 'break')

  const totalPlayers = timerState.totalEntry + timerState.totalReentry
  const alivePlayers = totalPlayers - timerState.bustCount
  const totalChips =
    timerState.totalEntry * timerState.entryStack +
    timerState.totalReentry * timerState.reentryStack +
    timerState.totalAddon * timerState.addonStack
  const averageStack = alivePlayers > 0 ? Math.floor(totalChips / alivePlayers) : 0
  const totalPrize = Object.values(timerState.prizePool).reduce((a, b) => a + (Number(b?.amount) || 0), 0)

  const allNums = [
    ...(level?.type === 'level' ? [level.smallBlind, level.bigBlind, level.ante] : []),
    ...(nextLevel?.type === 'level' ? [nextLevel.smallBlind, nextLevel.bigBlind, nextLevel.ante] : []),
  ].filter((n): n is number => n !== null && n !== undefined)
  const maxDigits = allNums.length > 0 ? Math.max(...allNums.map(n => n.toString().length)) : 1
  const infoColGap = maxDigits >= 6 ? 4 : maxDigits >= 5 ? 12 : maxDigits >= 4 ? 24 : 40
  const rowGap = 48
  const labelColWidth = 170

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          left: offsetX,
          top: offsetY,
          width: DESIGN_W,
          height: DESIGN_H,
          transform: [{ scale }],
          transformOrigin: 'top left',
          flexDirection: 'row',
          backgroundColor: '#fff',
        } as any}
      >
        {/* ── Left Panel ──────────────────────────────────────────────── */}
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'column', backgroundColor: '#fff', overflow: 'hidden' }}>

          {/* TOURNAMENT NAME */}
          <View style={{ paddingTop: 18, paddingHorizontal: 56, paddingBottom: 12 }}>
            <Text style={{ fontSize: 56, fontWeight: '900', letterSpacing: 56 * 0.18, textTransform: 'uppercase', color: '#111827', textAlign: 'center' }}>
              {timerState.name || ' '}
            </Text>
          </View>

          {/* LEVEL DIVIDER */}
          <View style={{ paddingHorizontal: 56 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <GradientLine direction="right" />
              {level?.type === 'level' && (
                <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: 22 * 0.45, textTransform: 'uppercase', color: GOLD }}>
                  LEVEL {currentLevelIndex + 1}
                </Text>
              )}
              {level?.type === 'break' && (
                <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: 22 * 0.45, textTransform: 'uppercase', color: '#9CA3AF' }}>
                  BREAK
                </Text>
              )}
              {!level && <Text style={{ fontSize: 22, opacity: 0 }}>LEVEL 0</Text>}
              <GradientLine direction="left" />
            </View>
          </View>

          {/* TIMER */}
          <View style={{ paddingHorizontal: 56, paddingTop: 8 }}>
            {isPresetSelected ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 200, fontWeight: '300', lineHeight: 200, color: GOLD, fontVariant: ['tabular-nums'] }}>
                  {fmt2(minutes)}
                </Text>
                <Text style={{ fontSize: 140, fontWeight: '300', lineHeight: 140, color: GOLD, marginHorizontal: 8, opacity: timerState.timerRunning ? (colonOn ? 1 : 0.2) : 0.2 }}>
                  :
                </Text>
                <Text style={{ fontSize: 200, fontWeight: '300', lineHeight: 200, color: GOLD, fontVariant: ['tabular-nums'] }}>
                  {fmt2(seconds)}
                </Text>
              </View>
            ) : timerState.loaded ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 80, fontWeight: '200', letterSpacing: 80 * 0.25, color: '#E5E7EB' }}>WELCOME</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 40, fontWeight: '200', letterSpacing: 40 * 0.25, color: '#E5E7EB' }}>Loading...</Text>
              </View>
            )}

            {!timerState.timerRunning && isPresetSelected && (
              <View
                style={{
                  position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.86)',
                }}
              >
                <Text
                  style={{
                    fontSize: 86, fontWeight: '900', letterSpacing: 86 * 0.18, color: GOLD,
                    textShadowColor: 'rgba(200,130,10,0.28)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 24,
                  }}
                >
                  PAUSE
                </Text>
              </View>
            )}

            {isPresetSelected && (
              <View style={{ width: '100%', height: 3, borderRadius: 99, backgroundColor: '#F0F0F0', marginTop: 4, overflow: 'hidden' }}>
                <LinearGradient
                  colors={[GOLD_DARK, GOLD]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: '100%', width: `${Math.max(0, Math.min(100, progress))}%`, borderRadius: 99 }}
                />
              </View>
            )}
          </View>

          {/* INFO BLOCK */}
          <View style={{ paddingHorizontal: 48, paddingVertical: 32 }}>
            {isPresetSelected && level?.comment && (
              <Text style={{ textAlign: 'center', fontSize: 28, fontWeight: '900', letterSpacing: 28 * 0.4, textTransform: 'uppercase', color: GOLD, marginBottom: 16 }}>
                {level.comment}
              </Text>
            )}

            {level?.type === 'break' ? (
              <View>
                <Text style={{ fontSize: 60, fontWeight: '700', letterSpacing: 60 * 0.5, color: GOLD, textAlign: 'center' }}>
                  — B R E A K —
                </Text>
                <View style={{ height: 1, backgroundColor: '#C4C4C4', marginTop: rowGap, marginBottom: rowGap }} />
                {isPresetSelected && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ width: labelColWidth, fontSize: 22, fontWeight: '900', letterSpacing: 22 * 0.15, textTransform: 'uppercase', color: '#4B5563' }}>NEXT</Text>
                    {nextLevel?.type === 'break'
                      ? <Text style={{ fontSize: 54, fontWeight: '500', color: '#6B7280' }}>Break</Text>
                      : <Text style={{ fontSize: 54, fontWeight: '500', color: '#4B5563', fontVariant: ['tabular-nums'] }}>
                          {nextLevel?.smallBlind?.toLocaleString()} / {nextLevel?.bigBlind?.toLocaleString()}
                          <Text style={{ fontSize: 40, fontWeight: '500', color: '#9CA3AF' }}>  ({nextLevel?.ante?.toLocaleString()})</Text>
                        </Text>
                    }
                    <View style={{ flex: 1 }} />
                    <View style={{ width: 1, height: 40, backgroundColor: '#D8D8D8', marginHorizontal: infoColGap }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                      <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: 22 * 0.15, textTransform: 'uppercase', color: '#4B5563', textAlign: 'center' }}>NEXT{'\n'}BREAK</Text>
                      {hasNextBreak
                        ? <Text style={{ fontSize: 72, fontWeight: '700', color: GOLD, fontVariant: ['tabular-nums'] }}>{fmt2(nextBreakMin)}:{fmt2(nextBreakSec)}</Text>
                        : <Text style={{ fontSize: 36, fontWeight: '500', color: '#9CA3AF' }}>None.</Text>
                      }
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ width: labelColWidth, fontSize: 32, fontWeight: '900', letterSpacing: 32 * 0.15, textTransform: 'uppercase', color: '#4B5563' }}>BLIND</Text>
                  <Text style={{ fontSize: 68, fontWeight: '600', color: '#1F2937', fontVariant: ['tabular-nums'] }}>
                    {level?.smallBlind?.toLocaleString() ?? '—'} / {level?.bigBlind?.toLocaleString() ?? '—'}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <View style={{ width: 1, height: 52, backgroundColor: '#D8D8D8', marginHorizontal: infoColGap }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                    <Text style={{ fontSize: 32, fontWeight: '900', letterSpacing: 32 * 0.15, textTransform: 'uppercase', color: '#4B5563' }}>ANTE</Text>
                    <Text style={{ fontSize: 68, fontWeight: '600', color: '#1F2937', fontVariant: ['tabular-nums'] }}>
                      {level?.ante?.toLocaleString() ?? '—'}
                    </Text>
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: '#C4C4C4', marginTop: rowGap, marginBottom: rowGap }} />

                {isPresetSelected && currentLevelIndex < levelsToUse.length - 1 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ width: labelColWidth, fontSize: 30, fontWeight: '900', letterSpacing: 30 * 0.15, textTransform: 'uppercase', color: '#4B5563', textAlign: 'center' }}>NEXT{'\n'}BLIND</Text>
                    {nextLevel?.type === 'break'
                      ? <Text style={{ fontSize: 54, fontWeight: '500', color: '#6B7280' }}>Break</Text>
                      : <Text style={{ fontSize: 54, fontWeight: '500', color: '#4B5563', fontVariant: ['tabular-nums'] }}>
                          {nextLevel?.smallBlind?.toLocaleString()} / {nextLevel?.bigBlind?.toLocaleString()}
                        </Text>
                    }
                    <View style={{ flex: 1 }} />
                    <View style={{ width: 1, height: 40, backgroundColor: '#D8D8D8', marginHorizontal: infoColGap }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                      <Text style={{ fontSize: 30, fontWeight: '900', letterSpacing: 30 * 0.15, textTransform: 'uppercase', color: '#4B5563', textAlign: 'center' }}>NEXT{'\n'}BREAK</Text>
                      {hasNextBreak
                        ? <Text style={{ fontSize: 72, fontWeight: '700', color: GOLD, fontVariant: ['tabular-nums'] }}>{fmt2(nextBreakMin)}:{fmt2(nextBreakSec)}</Text>
                        : <Text style={{ fontSize: 36, fontWeight: '500', color: '#9CA3AF' }}>None.</Text>
                      }
                    </View>
                  </View>
                )}

                {isPresetSelected && currentLevelIndex >= levelsToUse.length - 1 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: 22 * 0.15, textTransform: 'uppercase', color: '#4B5563', textAlign: 'center' }}>NEXT{'\n'}BREAK</Text>
                    {hasNextBreak
                      ? <Text style={{ fontSize: 72, fontWeight: '700', color: GOLD, fontVariant: ['tabular-nums'] }}>{fmt2(nextBreakMin)}:{fmt2(nextBreakSec)}</Text>
                      : <Text style={{ fontSize: 36, fontWeight: '500', color: '#9CA3AF' }}>None.</Text>
                    }
                  </View>
                )}
              </View>
            )}
          </View>

          {/* SEPARATOR */}
          <View style={{ marginHorizontal: 56 }}>
            <LinearGradient colors={['transparent', '#C4C4C4', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1 }} />
          </View>

          {/* STATS */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 56, paddingVertical: 16 }}>
            {[
              { label: 'PLAYERS', value: `${alivePlayers} / ${totalPlayers}` },
              { label: 'AVERAGE', value: averageStack.toLocaleString() },
              ...(timerState.totalAddon > 0 ? [{ label: 'ADD-ON', value: String(timerState.totalAddon) }] : []),
            ].map((stat, i, arr) => (
              <View key={stat.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
                  <Text style={{ fontSize: 30, fontWeight: '900', letterSpacing: 30 * 0.4, textTransform: 'uppercase', color: '#374151', marginBottom: 4 }}>{stat.label}</Text>
                  <Text style={{ fontSize: 68, fontWeight: '600', color: '#374151', fontVariant: ['tabular-nums'] }}>{stat.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={{ height: 40, width: 1, backgroundColor: '#EBEBEB' }} />}
              </View>
            ))}
          </View>

          {/* NEWS TICKER */}
          {timerState.comment && (
            <View style={{ height: 60, borderTopWidth: 1, borderTopColor: '#EBEBEB', overflow: 'hidden', backgroundColor: '#fff' }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.Text
                  style={{
                    color: '#1F2937', fontWeight: '700', fontSize: 28, letterSpacing: 28 * 0.06,
                    transform: [{ translateX: tickerTranslateX }], opacity: tickerOpacity,
                  }}
                  numberOfLines={1}
                >
                  {timerState.comment}
                </Animated.Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Right Panel: Prize Pool ──────────────────────────────────── */}
        <View style={{ width: 220, borderLeftWidth: 1, borderLeftColor: '#F0F0F0', backgroundColor: '#fff' }}>
          <View style={{ paddingTop: 20, paddingHorizontal: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' }}>
            <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: 22 * 0.4, textTransform: 'uppercase', color: '#374151', marginBottom: 8 }}>
              Prize Pool
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '900', letterSpacing: 14 * 0.3, textTransform: 'uppercase', color: '#374151' }}>TOTAL</Text>
              <Text style={{ fontSize: 34, fontWeight: '400', color: GOLD, fontVariant: ['tabular-nums'] }}>
                {totalPrize.toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={{ flex: 1, justifyContent: 'space-evenly', paddingTop: 8, paddingHorizontal: 14, paddingBottom: 60 }}>
            {Object.entries(timerState.prizePool).map(([place, data], idx, arr) => {
              const hasText = Boolean(data?.text)
              return (
                <View
                  key={place}
                  style={{
                    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                    paddingVertical: 4,
                    borderBottomWidth: idx !== arr.length - 1 ? 1 : 0,
                    borderBottomColor: '#F8F8F8',
                  }}
                >
                  <Text style={{ width: 48, fontSize: 26, fontWeight: '900', color: '#1F2937', paddingTop: 4 }}>
                    {place}<Text style={{ fontSize: 15 }}>th</Text>
                  </Text>
                  <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 0 }}>
                    <Text style={{ fontSize: hasText ? 26 : 32, fontWeight: '400', color: '#1F2937', textAlign: 'right' }} numberOfLines={1}>
                      {data?.amount?.toLocaleString() ?? 0}
                    </Text>
                    {hasText && (
                      <Text style={{ fontSize: 18, fontWeight: '300', color: '#9CA3AF', textAlign: 'right' }}>
                        +{data.text}
                      </Text>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </View>

      {/* ── Glass Logo ───────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute', bottom: 32 * scale, right: 32 * scale,
          flexDirection: 'row', alignItems: 'center', gap: 16 * scale,
          paddingVertical: 12 * scale, paddingHorizontal: 20 * scale,
          borderRadius: 16 * scale,
          backgroundColor: 'rgba(255,255,255,0.55)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
        }}
      >
        <View
          style={{
            height: 48 * scale, width: 48 * scale, borderRadius: 12 * scale,
            backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}
        >
          <Image source={require('../../assets/logo.png')} style={{ height: 36 * scale, width: 36 * scale }} resizeMode="contain" />
        </View>
        <Text style={{ fontSize: 22 * scale, fontWeight: '700', letterSpacing: 22 * scale * 0.1, color: '#111827' }}>
          RRPOKER
        </Text>
      </View>
    </View>
  )
}
