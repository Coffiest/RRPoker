'use client'

import packageJson from '../../../package.json'

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white px-5">
      <div className="mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="text-[24px] font-semibold text-gray-900">このアプリについて</h1>
        </div>
        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <p className="text-[14px] text-gray-900">製作者: なおゆき</p>
          <p className="mt-2 text-[13px] text-gray-500">バージョン: {packageJson.version}</p>
        </div>
      </div>
    </main>
  )
}
