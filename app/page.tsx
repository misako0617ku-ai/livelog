import Link from 'next/link'
import { CalendarDays, Music, Star } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="mb-6 flex items-center justify-center w-20 h-20 bg-pink-100 rounded-full">
        <CalendarDays className="w-10 h-10 text-pink-600" />
      </div>

      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        ライブログ
      </h1>
      <p className="text-lg text-gray-600 mb-10 max-w-md">
        推しアーティストのライブ・イベントを一か所で記録・管理。見逃さないために。
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mb-16">
        <Link
          href="/auth/signup"
          className="flex items-center justify-center gap-2 px-8 py-3 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-colors"
        >
          無料で始める
        </Link>
        <Link
          href="/calendar"
          className="flex items-center justify-center gap-2 px-8 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
        >
          カレンダーを見る
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
        {[
          { icon: Star, title: 'アーティストをフォロー', desc: '好きなアーティストを登録して、イベントを自動で集める' },
          { icon: CalendarDays, title: 'カレンダーで一覧管理', desc: '月・週・リスト表示でイベントをわかりやすく確認' },
          { icon: Music, title: '手動でもイベント追加', desc: '自分で見つけたイベントもすぐに登録できる' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left">
            <div className="flex items-center justify-center w-10 h-10 bg-pink-50 rounded-xl mb-3">
              <Icon className="w-5 h-5 text-pink-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
