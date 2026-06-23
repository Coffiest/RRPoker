import Link from "next/link"
import { FiChevronLeft } from "react-icons/fi"

export const metadata = {
  title: "プライバシーポリシー | RRPoker",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 mb-6 -ml-1 transition-colors"
        >
          <FiChevronLeft size={18} />
          戻る
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">プライバシーポリシー</h1>
        <p className="text-xs text-gray-400 mb-8">最終更新日: 2026年6月21日</p>

        <div className="space-y-8 text-sm leading-7 text-gray-700">
          <section>
            <p>
              RRPoker（以下「当サービス」）は、利用者の個人情報を以下の方針に基づき適切に取り扱います。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">1. 取得する情報</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>メールアドレス、氏名、プロフィール画像等のアカウント情報</li>
              <li>店舗情報、トーナメント・チップ管理に関する利用データ</li>
              <li>決済処理に必要な情報（Stripe または Apple In-App Purchase 経由で処理され、カード番号等は当サービスのサーバーには保存されません）</li>
              <li>アプリの利用状況・アクセスログ</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">2. 利用目的</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>本人確認およびログイン認証（Firebase Authentication）</li>
              <li>サービスの提供・運営・改善</li>
              <li>サブスクリプション決済の処理および管理</li>
              <li>利用者からのお問い合わせへの対応</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">3. 第三者への提供・委託先</h2>
            <p>
              当サービスは、以下の外部サービスを利用してデータを処理しています。各サービスのプライバシーポリシーが適用されます。
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Google Firebase（認証・データベース・ホスティング）</li>
              <li>Stripe, Inc.（Web版の決済処理）</li>
              <li>Apple Inc.（iOS版のApp内課金処理）</li>
              <li>RevenueCat, Inc.（iOS版のサブスクリプション管理）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">4. データの保管・削除</h2>
            <p>
              利用者は、アカウント設定からアカウントおよび関連データの削除を申請できます。法令上保存が必要な情報を除き、合理的な期間内に削除します。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">5. お問い合わせ</h2>
            <p>
              本ポリシーに関するお問い合わせは、運営者の連絡先までご連絡ください。
              {/* TODO: 事業者名・連絡先メールアドレスを記載してください */}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
