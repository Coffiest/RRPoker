/**
 * モジュール読み込み時ではなく最初のアクセス時に初期化する Proxy を返す。
 *
 * 環境変数を必要とする SDK クライアントをモジュールのトップレベルで生成すると、
 * next build のページデータ収集時にも評価されてしまい、環境変数が無い環境では
 * ビルド自体が失敗する。実際に使われるリクエスト時まで生成を遅らせる。
 */
export function lazy<T extends object>(resolve: () => T): T {
  let instance: T | undefined
  const get = () => (instance ??= resolve())
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const target = get()
      const value = Reflect.get(target as object, prop, receiver)
      return typeof value === "function" ? value.bind(target) : value
    },
    has: (_target, prop) => Reflect.has(get() as object, prop),
    getPrototypeOf: () => Reflect.getPrototypeOf(get() as object),
  })
}
