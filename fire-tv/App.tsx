import React, { useState } from 'react'
import { SafeAreaView, View } from 'react-native'
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth'
import { LoginScreen } from '@/screens/LoginScreen'
import { TournamentListScreen } from '@/screens/TournamentListScreen'
import { TimerScreen } from '@/screens/TimerScreen'

type ScreenName = 'login' | 'tournament-list' | 'timer'

interface TimerScreenParams {
  storeId: string
  tournamentId: string
  tournamentName: string
}

export default function App() {
  const { user, logout } = useFirebaseAuth()
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('login')
  const [timerParams, setTimerParams] = useState<TimerScreenParams | null>(null)

  const handleLoginSuccess = () => {
    setCurrentScreen('tournament-list')
  }

  const handleSelectTournament = (storeId: string, tournamentId: string) => {
    // Firestore から tournamentName を取得（簡略化のため、ここでは tournamentId を使用）
    setTimerParams({ storeId, tournamentId, tournamentName: tournamentId })
    setCurrentScreen('timer')
  }

  const handleBackToList = () => {
    setCurrentScreen('tournament-list')
  }

  const handleLogout = async () => {
    await logout()
    setCurrentScreen('login')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      {currentScreen === 'login' && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}

      {currentScreen === 'tournament-list' && user && (
        <TournamentListScreen
          user={user}
          onSelectTournament={handleSelectTournament}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'timer' && timerParams && (
        <TimerScreen
          storeId={timerParams.storeId}
          tournamentId={timerParams.tournamentId}
          tournamentName={timerParams.tournamentName}
          onBack={handleBackToList}
        />
      )}
    </SafeAreaView>
  )
}
