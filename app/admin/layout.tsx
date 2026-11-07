/** 管理者画面は暗い配色なので、全画面の入力欄の見た目(globals.css)を外す印を付ける */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-scope">{children}</div>
}
