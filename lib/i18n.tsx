'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'

export type Language = 'ja' | 'en'

const STORAGE_KEY = 'rrpoker_language'

const dict = {
  ja: {
    'common.save': '保存する',
    'common.cancel': 'キャンセル',
    'common.back': '戻る',
    'common.close': '閉じる',
    'common.loading': '読み込み中…',
    'common.language': '言語',
    'common.japanese': '日本語',
    'common.english': 'English',
    'common.privacyPolicy': 'プライバシーポリシー',
    'common.allow': '許可する',
    'common.notNow': '今はしない',
    'common.optional': '任意',
    'common.required': '必須',

    'login.title': 'Login',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.forgotPassword': 'Forgot Password?',
    'login.createAccount': 'Create Account',
    'login.storeOwner': '店舗の方はこちら',
    'login.emptyError': 'メールアドレスとパスワードを入力してください',
    'login.wrongCredentials': 'メールまたはパスワードが違います',
    'login.unverified': 'メール認証が完了していません',
    'login.checkInbox': 'メール受信ボックスをご確認ください',
    'login.googleFailed': 'Googleログインに失敗しました',
    'login.appleFailed': 'Appleログインに失敗しました',
    'login.popupBlocked': 'ポップアップがブロックされています。ブラウザの設定をご確認ください。',
    'login.networkError': 'ネットワークエラーが発生しました。',
    'login.unsupportedBrowser': 'このブラウザではGoogleログインをご利用いただけません。SafariまたはChromeで開いてお試しください。',
    'login.homePreview': 'ログイン後のホーム画面',
    'login.previewNote': '※ ログイン後、実際の残高が表示されます',

    'register.title': '新規登録',
    'register.email': 'Email',
    'register.password': 'Password',
    'register.confirmPassword': 'Confirm Password',
    'register.submit': '登録する',
    'register.hasAccount': 'すでにアカウントをお持ちの方',
    'register.login': 'ログイン',
    'register.privacyNotice': '登録すると、',
    'register.privacyNoticeSuffix': 'に同意したものとみなされます。プレイヤー登録に住所や電話番号などの個人情報は不要です。',

    'storeRegister.title': '店舗登録',
    'storeRegister.privacyNotice': '登録すると、',
    'storeRegister.privacyNoticeSuffix': 'に同意したものとみなされます。',

    'storeOnboarding.addressOptionalNote': '住所情報は任意です。入力すると、プレイヤーのスケジュール画面で近い順に店舗が表示されるようになります（未入力でも登録・利用できます）。',

    'privacy.title': 'プライバシーポリシー',

    'geo.title': '位置情報の利用について',
    'geo.body': '近くの店舗を見つけやすくするため、現在地を一度だけ取得して距離順に並び替えに利用します。位置情報が取得できない場合でも、通常どおりご利用いただけます。位置情報を保存することはありません。',
    'geo.allow': '位置情報を許可する',
    'geo.decline': '許可しない',
    'geo.changeInSettings': 'この設定はいつでも「設定」画面から変更できます。',

    'tourneyStat.pendingNote': 'トーナメントに1回参加し、店舗側で大会結果が確定すると表示されます',

    'settings.language': '表示言語',
    'settings.languageNote': 'アプリの表示言語を切り替えます',
  },
  en: {
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.loading': 'Loading…',
    'common.language': 'Language',
    'common.japanese': '日本語',
    'common.english': 'English',
    'common.privacyPolicy': 'Privacy Policy',
    'common.allow': 'Allow',
    'common.notNow': 'Not now',
    'common.optional': 'Optional',
    'common.required': 'Required',

    'login.title': 'Login',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.forgotPassword': 'Forgot Password?',
    'login.createAccount': 'Create Account',
    'login.storeOwner': 'For store owners',
    'login.emptyError': 'Please enter your email and password',
    'login.wrongCredentials': 'Incorrect email or password',
    'login.unverified': 'Email verification is not complete',
    'login.checkInbox': 'Please check your inbox',
    'login.googleFailed': 'Google sign-in failed',
    'login.appleFailed': 'Apple sign-in failed',
    'login.popupBlocked': 'The popup was blocked. Please check your browser settings.',
    'login.networkError': 'A network error occurred.',
    'login.unsupportedBrowser': "Google sign-in isn't available in this browser. Please open the page in Safari or Chrome.",
    'login.homePreview': 'Home screen after login',
    'login.previewNote': '※ Your actual balance will be shown after logging in',

    'register.title': 'Sign Up',
    'register.email': 'Email',
    'register.password': 'Password',
    'register.confirmPassword': 'Confirm Password',
    'register.submit': 'Sign Up',
    'register.hasAccount': 'Already have an account?',
    'register.login': 'Login',
    'register.privacyNotice': 'By signing up, you agree to our ',
    'register.privacyNoticeSuffix': '. No address or phone number is required to register as a player.',

    'storeRegister.title': 'Store Sign Up',
    'storeRegister.privacyNotice': 'By signing up, you agree to our ',
    'storeRegister.privacyNoticeSuffix': '.',

    'storeOnboarding.addressOptionalNote': 'Address details are optional. If provided, players will see your store sorted by distance on their schedule screen (you can still register and use the app without it).',

    'privacy.title': 'Privacy Policy',

    'geo.title': 'About location access',
    'geo.body': "We use your current location once to sort nearby stores by distance, to make them easier to find. The app works normally even if location isn't available, and we never store your location.",
    'geo.allow': 'Allow location',
    'geo.decline': "Don't allow",
    'geo.changeInSettings': 'You can change this anytime from Settings.',

    'tourneyStat.pendingNote': 'This appears once you’ve entered a tournament and the store finalizes the results',

    'settings.language': 'Display language',
    'settings.languageNote': 'Switch the app display language',
  },
} as const

export type TranslationKey = keyof typeof dict.ja

type LanguageContextValue = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ja')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'en' || stored === 'ja') setLanguageState(stored)
    } catch {}
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    try { window.localStorage.setItem(STORAGE_KEY, lang) } catch {}
    const user = auth.currentUser
    if (user) {
      void setDoc(doc(db, 'users', user.uid), { language: lang }, { merge: true }).catch(() => {})
    }
  }, [])

  const t = useCallback((key: TranslationKey) => {
    return dict[language][key] ?? dict.ja[key] ?? key
  }, [language])

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
