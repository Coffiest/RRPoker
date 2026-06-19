import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native'
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth'
import { useTVDimensions, useRemoteControl, RemoteKey, getFontSize } from '@/lib/firetvUtils'

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
  const tvDims = useTVDimensions()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginMode, setLoginMode] = useState<'email' | 'qr'>('email')
  const [focusedField, setFocusedField] = useState<'email' | 'password'>('email')

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

          {/* QR コード切り替え */}
          <TouchableOpacity
            onPress={() => setLoginMode('qr')}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: labelFontSize, color: COLORS.dark, textAlign: 'center' }}>
              QR コードでログイン
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: smallFontSize, color: COLORS.dark, marginBottom: 40 }}>
            以下の QR コードをスキャンしてください
          </Text>
          {/* QR コード表示エリア（実装時に qr-code ライブラリを使用） */}
          <View
            style={{
              width: 400,
              height: 400,
              backgroundColor: '#fff',
              borderRadius: 12,
              marginBottom: 40,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: labelFontSize, color: '#999' }}>QR コード</Text>
          </View>

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
            <Text style={{ fontSize: labelFontSize, color: COLORS.dark }}>
              メールアドレスでログイン
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}
