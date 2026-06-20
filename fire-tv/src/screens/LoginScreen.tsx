import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth'
import { usePairing } from '@/hooks/usePairing'
import { useTVDimensions, useRemoteControl, RemoteKey, getFontSize } from '@/lib/firetvUtils'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://rrpoker.vercel.app'

const COLORS = {
  gold: '#F2A900',
  dark: '#1C1C1E',
  light: '#FAFAFA',
  lightGray: '#F2F2F7',
  border: '#E5E5EA',
}

interface LoginScreenProps {
  onLoginSuccess: () => void
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { login, loading, error } = useFirebaseAuth()
  const { code: pairingCode, status: pairingStatus, error: pairingError, startPairing, stopPolling } = usePairing()
  const tvDims = useTVDimensions()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginMode, setLoginMode] = useState<'email' | 'pairing'>('email')
  const [focusedField, setFocusedField] = useState<'email' | 'password'>('email')

  useEffect(() => {
    if (loginMode === 'pairing') {
      startPairing()
    } else {
      stopPolling()
    }
  }, [loginMode])

  useEffect(() => {
    if (pairingStatus === 'confirmed') {
      onLoginSuccess()
    }
  }, [pairingStatus])

  const handleLogin = async () => {
    if (!email || !password) {
      alert('メールアドレスとパスワードを入力してください')
      return
    }

    const success = await login(email, password)
    if (success) {
      onLoginSuccess()
    }
  }

  useRemoteControl({
    [RemoteKey.Up]: () => {
      if (focusedField === 'password') setFocusedField('email')
    },
    [RemoteKey.Down]: () => {
      if (focusedField === 'email') setFocusedField('password')
    },
    [RemoteKey.OK]: () => {
      if (focusedField === 'password') handleLogin()
    },
  })

  const fontSize = getFontSize(32, tvDims.scale)
  const smallFontSize = getFontSize(24, tvDims.scale)
  const labelFontSize = getFontSize(20, tvDims.scale)

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.light,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      {/* ロゴ / タイトル */}
      <Text style={{ fontSize: fontSize * 1.5, fontWeight: 'bold', color: COLORS.dark, marginBottom: 60 }}>
        RRPoker Timer
      </Text>

      {loginMode === 'email' ? (
        <View style={{ width: '100%', maxWidth: 800 }}>
          {/* メールアドレス */}
          <View style={{ marginBottom: 40 }}>
            <Text style={{ fontSize: labelFontSize, fontWeight: '600', color: COLORS.dark, marginBottom: 12 }}>
              メールアドレス
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#999"
              style={{
                fontSize: smallFontSize,
                padding: 16,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: focusedField === 'email' ? COLORS.gold : COLORS.border,
                backgroundColor: '#fff',
                color: COLORS.dark,
              }}
            />
          </View>

          {/* パスワード */}
          <View style={{ marginBottom: 60 }}>
            <Text style={{ fontSize: labelFontSize, fontWeight: '600', color: COLORS.dark, marginBottom: 12 }}>
              パスワード
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#999"
              secureTextEntry
              style={{
                fontSize: smallFontSize,
                padding: 16,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: focusedField === 'password' ? COLORS.gold : COLORS.border,
                backgroundColor: '#fff',
                color: COLORS.dark,
              }}
            />
          </View>

          {/* エラーメッセージ */}
          {error && (
            <Text style={{ fontSize: smallFontSize, color: '#d32f2f', marginBottom: 40 }}>
              {error}
            </Text>
          )}

          {/* ログインボタン */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: COLORS.gold,
              borderRadius: 12,
              paddingVertical: 20,
              paddingHorizontal: 40,
              marginBottom: 20,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.dark} />
            ) : (
              <Text style={{ fontSize: smallFontSize, fontWeight: 'bold', color: COLORS.dark, textAlign: 'center' }}>
                ログイン
              </Text>
            )}
          </TouchableOpacity>

          {/* コード連携に切り替え */}
          <TouchableOpacity
            onPress={() => setLoginMode('pairing')}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: labelFontSize, color: COLORS.dark, textAlign: 'center' }}>
              スマホでコード連携してログイン
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ alignItems: 'center', width: '100%', maxWidth: 800 }}>
          <Text style={{ fontSize: smallFontSize, color: COLORS.dark, marginBottom: 32, textAlign: 'center' }}>
            スマホのカメラでQRコードを読み込むか、{'\n'}「TVと連携」からこのコードを入力してください
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 48, marginBottom: 32 }}>
            {/* QRコード */}
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 220,
                minWidth: 220,
              }}
            >
              {pairingStatus === 'waiting' && !pairingCode ? (
                <ActivityIndicator size="large" color={COLORS.gold} />
              ) : pairingCode ? (
                <QRCode value={`${API_BASE_URL}/home/pair?code=${pairingCode}`} size={180} />
              ) : null}
            </View>

            {/* ペアリングコード表示 */}
            <View
              style={{
                backgroundColor: COLORS.lightGray,
                borderRadius: 16,
                paddingVertical: 32,
                paddingHorizontal: 56,
                minWidth: 280,
                alignItems: 'center',
              }}
            >
              {pairingStatus === 'waiting' && !pairingCode ? (
                <ActivityIndicator size="large" color={COLORS.gold} />
              ) : (
                <Text style={{ fontSize: fontSize * 2, fontWeight: 'bold', color: COLORS.dark, letterSpacing: 12 }}>
                  {pairingCode ?? '------'}
                </Text>
              )}
            </View>
          </View>

          {pairingStatus === 'expired' && (
            <Text style={{ fontSize: smallFontSize, color: '#d32f2f', marginBottom: 24, textAlign: 'center' }}>
              コードの有効期限が切れました
            </Text>
          )}
          {pairingError && (
            <Text style={{ fontSize: smallFontSize, color: '#d32f2f', marginBottom: 24, textAlign: 'center' }}>
              {pairingError}
            </Text>
          )}

          {(pairingStatus === 'expired' || pairingStatus === 'error') && (
            <TouchableOpacity
              onPress={startPairing}
              style={{
                backgroundColor: COLORS.gold,
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 32,
                marginBottom: 24,
              }}
            >
              <Text style={{ fontSize: smallFontSize, fontWeight: 'bold', color: COLORS.dark, textAlign: 'center' }}>
                コードを再発行
              </Text>
            </TouchableOpacity>
          )}

          {/* メール入力に戻る */}
          <TouchableOpacity
            onPress={() => setLoginMode('email')}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: labelFontSize, color: COLORS.dark, textAlign: 'center' }}>
              メールアドレスでログイン
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}
