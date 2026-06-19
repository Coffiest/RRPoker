import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useTournamentList, Tournament } from '@/hooks/useTournamentList'
import { useTVDimensions, useRemoteControl, RemoteKey, getFontSize } from '@/lib/firetvUtils'

const COLORS = {
  gold: '#F2A900',
  dark: '#1C1C1E',
  light: '#FAFAFA',
  lightGray: '#F2F2F7',
  border: '#E5E5EA',
}

interface TournamentListScreenProps {
  user: User
  onSelectTournament: (storeId: string, tournamentId: string) => void
  onLogout: () => void
}

export function TournamentListScreen({ user, onSelectTournament, onLogout }: TournamentListScreenProps) {
  const tvDims = useTVDimensions()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  const { tournaments, loading: listLoading, error } = useTournamentList(user, storeId)

  // ユーザーの storeId を取得
  useEffect(() => {
    if (!user) return
    const loadStoreId = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        setStoreId(snap.data()?.storeId ?? null)
        setLoading(false)
      } catch {
        setLoading(false)
      }
    }
    loadStoreId()
  }, [user])

  useRemoteControl({
    [RemoteKey.Up]: () => setSelectedIdx(Math.max(0, selectedIdx - 1)),
    [RemoteKey.Down]: () => setSelectedIdx(Math.min(tournaments.length - 1, selectedIdx + 1)),
    [RemoteKey.OK]: () => {
      if (tournaments[selectedIdx] && storeId) {
        onSelectTournament(storeId, tournaments[selectedIdx].id)
      }
    },
    [RemoteKey.Back]: onLogout,
  })

  const fontSize = getFontSize(32, tvDims.scale)
  const itemFontSize = getFontSize(28, tvDims.scale)
  const smallFontSize = getFontSize(20, tvDims.scale)

  if (loading || listLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.light }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.light }}>
      {/* ヘッダー */}
      <View
        style={{
          paddingTop: 40,
          paddingHorizontal: 40,
          paddingBottom: 20,
          backgroundColor: COLORS.lightGray,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSize, fontWeight: 'bold', color: COLORS.dark }}>
            開催中のトーナメント
          </Text>
          <TouchableOpacity onPress={onLogout}>
            <Text style={{ fontSize: smallFontSize, color: COLORS.gold, fontWeight: '600' }}>
              ログアウト
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* トナメリスト */}
      {tournaments.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: smallFontSize, color: '#999' }}>
            開催中のトーナメントはありません
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 40, paddingTop: 20 }}
          scrollEnabled={false}
        >
          {tournaments.map((t, idx) => (
            <TournamentItem
              key={t.id}
              tournament={t}
              isSelected={idx === selectedIdx}
              fontSize={itemFontSize}
              smallFontSize={smallFontSize}
            />
          ))}
        </ScrollView>
      )}

      {/* フッター */}
      <View
        style={{
          padding: 20,
          backgroundColor: COLORS.lightGray,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: smallFontSize, color: COLORS.dark }}>
          リモコン ▲▼ で選択、OK で確定
        </Text>
      </View>

      {error && (
        <View style={{ padding: 16, backgroundColor: '#ffebee' }}>
          <Text style={{ fontSize: smallFontSize, color: '#d32f2f' }}>
            {error}
          </Text>
        </View>
      )}
    </View>
  )
}

interface TournamentItemProps {
  tournament: Tournament
  isSelected: boolean
  fontSize: number
  smallFontSize: number
}

function TournamentItem({ tournament, isSelected, fontSize, smallFontSize }: TournamentItemProps) {
  return (
    <View
      style={{
        backgroundColor: isSelected ? COLORS.gold : '#fff',
        borderRadius: 12,
        padding: 24,
        marginBottom: 16,
        borderWidth: isSelected ? 0 : 1,
        borderColor: COLORS.border,
      }}
    >
      <Text
        style={{
          fontSize: fontSize,
          fontWeight: isSelected ? '700' : '600',
          color: isSelected ? COLORS.dark : COLORS.dark,
          marginBottom: 8,
        }}
      >
        {tournament.name}
      </Text>

      <View style={{ flexDirection: 'row', gap: 40 }}>
        <View>
          <Text style={{ fontSize: smallFontSize - 4, color: isSelected ? '#333' : '#666' }}>
            ステータス
          </Text>
          <Text style={{ fontSize: fontSize - 4, fontWeight: '600', color: isSelected ? COLORS.dark : COLORS.gold }}>
            {tournament.timerRunning ? '進行中' : '停止中'}
          </Text>
        </View>

        <View>
          <Text style={{ fontSize: smallFontSize - 4, color: isSelected ? '#333' : '#666' }}>
            経過時間
          </Text>
          <Text style={{ fontSize: fontSize - 4, fontWeight: '600', color: isSelected ? COLORS.dark : COLORS.dark }}>
            {formatSecondsToMMSS(tournament.timeRemaining)}
          </Text>
        </View>
      </View>
    </View>
  )
}

function formatSecondsToMMSS(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
