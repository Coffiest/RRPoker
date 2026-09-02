import Link from "next/link"
import { FiChevronLeft } from "react-icons/fi"

export const metadata = {
  title: "利用規約 | RRPoker",
}

export default function TermsPage() {
  return (
    <div className="tech-grid min-h-screen bg-[#FAFAFA] px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 mb-6 -ml-1 transition-colors"
        >
          <FiChevronLeft size={18} />
          戻る
        </Link>

        <h1 className="font-display term-prompt-arrow text-2xl font-bold text-gray-900 mb-2">利用規約</h1>
        <p className="text-xs text-gray-400 mb-8">最終更新日: 2026年8月31日</p>

        <div className="space-y-8 text-sm leading-7 text-gray-700">
          <section>
            <p>
              本利用規約（以下「本規約」）は、RRPoker（以下「当サービス」）の利用条件を定めるものです。利用者は本規約に同意の上、当サービスを利用するものとします。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">1. サービス内容</h2>
            <p>
              当サービスは、ポーカー店舗向けのトーナメント・チップ管理ツール、およびプレイヤー向けの成績管理・店舗連携機能を提供します。当サービスは賭博場・賭博アプリではなく、現金・金銭的価値のある物品を賭けるいかなる機能も提供しません。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">2. チップの性質</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>当サービス上の「チップ」（バイイン・キャッシュアウト・プライズ等の表示を含む）は、店舗内でのゲーム進行・成績を記録するための、店舗が独自に発行するポイントです。</li>
              <li>チップは現金その他の金銭的価値を有さず、当サービス上で現金・金券・仮想通貨その他の対価と交換・換金することはできません。</li>
              <li>利用者は、チップを金銭的価値のあるものとして第三者と売買・譲渡してはならないものとします。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">3. サブスクリプション・料金</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>店舗アカウントの利用には有料サブスクリプションが必要です。料金プランはアプリ内の料金ページに表示されます。</li>
              <li>Web版はStripeを通じて決済され、いつでもキャンセル可能です。</li>
              <li>iOS版はApple In-App Purchaseを通じて決済され、自動更新されます。解約はiOSの「設定」アプリの サブスクリプション管理から行えます。</li>
              <li>サブスクリプションは契約期間終了時に自動更新されます。更新前にキャンセルしない限り課金が継続します。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">4. 禁止事項</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>法令または公序良俗に違反する行為</li>
              <li>不正アクセス、当サービスの運営を妨害する行為</li>
              <li>他の利用者・店舗に対する詐欺・不正行為</li>
              <li>当サービス上のチップを現金・金券・仮想通貨その他の金銭的価値のあるものと交換・換金・売買する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">5. 免責事項</h2>
            <p>
              当サービスは、利用者間または利用者と店舗間で発生したトラブルについて、可能な範囲で対応しますが、一切の責任を負うものではありません。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">6. 規約の変更</h2>
            <p>
              当サービスは、必要に応じて本規約を変更することがあります。変更後の規約は本ページに掲載した時点で効力を生じます。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">7. お問い合わせ</h2>
            <p>
              本規約に関するお問い合わせは、運営者の連絡先までご連絡ください。
              {/* TODO: 事業者名・連絡先メールアドレスを記載してください */}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
