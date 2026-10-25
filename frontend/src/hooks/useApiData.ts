import { useEffect, useState } from 'react'

export type ApiData<T> =
  | { kind: 'loading' }
  | { kind: 'ok'; data: T }
  | { kind: 'error'; error: unknown }

/**
 * Загружает данные при смене key. Ответ помнит свой key: пока грузится новый,
 * старый не показывается, а запоздавший ответ на старый key отбрасывается.
 */
export function useApiData<T>(key: string, load: () => Promise<T>): ApiData<T> {
  const [loaded, setLoaded] = useState<{ key: string; state: ApiData<T> } | null>(null)

  useEffect(() => {
    let cancelled = false
    const done = (state: ApiData<T>) => !cancelled && setLoaded({ key, state })
    load()
      .then((data) => done({ kind: 'ok', data }))
      .catch((error: unknown) => done({ kind: 'error', error }))
    return () => {
      cancelled = true
    }
    // load пересоздаётся на каждом рендере, перезагрузку задаёт key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return loaded?.key === key ? loaded.state : { kind: 'loading' }
}
