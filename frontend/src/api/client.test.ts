import { afterEach, expect, test, vi } from 'vitest'
import { ApiError, httpApi } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

test('ошибка по контракту превращается в ApiError с кодом', async () => {
  stubFetch(404, { error: { code: 'not_found', message: 'Нет такого чата' } })

  const err = await httpApi.getChat('c_missing').catch((e: unknown) => e)

  expect(err).toBeInstanceOf(ApiError)
  expect(err).toMatchObject({ status: 404, code: 'not_found', message: 'Нет такого чата' })
})

test('ответ без тела ошибки — код unknown', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })))

  await expect(httpApi.getHealth()).rejects.toMatchObject({ status: 500, code: 'unknown' })
})

test('502 от прокси без тела по контракту — код network', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } })),
  )

  await expect(httpApi.getHealth()).rejects.toMatchObject({ status: 502, code: 'network' })
})

test('503 с телом по контракту сохраняет код бэкенда', async () => {
  stubFetch(503, { error: { code: 'http_error', message: 'Занято' } })

  await expect(httpApi.getHealth()).rejects.toMatchObject({ status: 503, code: 'http_error' })
})

test('сетевой сбой — код network', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  await expect(httpApi.getHealth()).rejects.toMatchObject({ status: 0, code: 'network' })
})

test('загрузка отправляет файл в поле file', async () => {
  const fetchMock = stubFetch(201, { id: 'c_1' })
  const file = new File(['{}'], 'result.json', { type: 'application/json' })

  await httpApi.uploadChat(file)

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/chats')
  expect(init.method).toBe('POST')
  expect((init.body as FormData).get('file')).toBeInstanceOf(File)
})

test('проверка шлёт JSON на путь автора', async () => {
  const fetchMock = stubFetch(200, { verdict: 'match' })

  await httpApi.checkMessage('c_1', 'user2002', { text: 'прив' })

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/chats/c_1/authors/user2002/check')
  expect(JSON.parse(init.body)).toEqual({ text: 'прив' })
})
