import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

test('показывает статус бэкенда из /api/health', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok', llm: false })),
  )
  vi.stubGlobal('fetch', fetchMock)

  renderAt('/')

  expect(await screen.findByText('Бэкенд: ok, LLM: нет')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith('/api/health', undefined)
})

test('сообщает, если бэкенд недоступен', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

  renderAt('/')

  expect(await screen.findByText('Бэкенд недоступен')).toBeInTheDocument()
})

test.each([
  ['/', 'Загрузка экспорта'],
  ['/chats/c_7f3a9b', 'Чат и авторы'],
  ['/chats/c_7f3a9b/authors/user2002', 'Паспорт почерка'],
  ['/chats/c_7f3a9b/authors/user2002/check', 'Проверка сообщения'],
  ['/chats/c_19ab42/twins', 'Двойники'],
  ['/chats/c_19ab42/twins/user3003/user3004', 'Сравнение пары'],
  ['/nope', 'Такой страницы нет'],
])('маршрут %s открывает «%s»', async (path, heading) => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

  renderAt(path)

  expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
  await screen.findByText('Бэкенд недоступен')
})
