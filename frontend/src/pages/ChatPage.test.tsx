import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import ChatPage from './ChatPage'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  const { createMockApi } = await import('../api/mocks')
  return { ...actual, api: createMockApi({ delayMs: 0 }) }
})

function renderChat(chatId: string) {
  render(
    <MemoryRouter initialEntries={[`/chats/${chatId}`]}>
      <Routes>
        <Route path="/chats/:chatId" element={<ChatPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('личный чат: карточка и авторы со ссылками, без двойников', async () => {
  renderChat('c_7f3a9b')

  expect(await screen.findByRole('heading', { name: 'Саша' })).toBeInTheDocument()
  expect(screen.getByText(/Личная переписка/)).toBeInTheDocument()
  expect(screen.queryByText('Найти двойников')).not.toBeInTheDocument()

  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(within(items[0]).getByText('Иван')).toBeInTheDocument()
  expect(within(items[1]).getByRole('link', { name: 'Проверить сообщение' })).toHaveAttribute(
    'href',
    '/chats/c_7f3a9b/authors/user2002/check',
  )
})

test('групповой чат: пометка «мало данных» и кнопка двойников', async () => {
  renderChat('c_19ab42')

  const lesha = (await screen.findByText('Лёша')).closest('li')!
  expect(within(lesha).getByText('мало данных')).toBeInTheDocument()
  expect(screen.getAllByText('мало данных')).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Найти двойников' })).toHaveAttribute(
    'href',
    '/chats/c_19ab42/twins',
  )
})

test('чат не найден — предлагает загрузить заново', async () => {
  renderChat('c_missing')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Чат не найден')
  expect(within(alert).getByRole('link', { name: 'Загрузить файл заново' })).toHaveAttribute(
    'href',
    '/',
  )
})
