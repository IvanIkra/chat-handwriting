import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import ProfilePage from './ProfilePage'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  const { createMockApi } = await import('../api/mocks')
  return { ...actual, api: createMockApi({ delayMs: 0 }) }
})

function renderProfile(chatId: string, authorId: string) {
  const { container } = render(
    <MemoryRouter initialEntries={[`/chats/${chatId}/authors/${authorId}`]}>
      <Routes>
        <Route path="/chats/:chatId/authors/:authorId" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
  return container
}

test('паспорт: черты, слова, эмодзи и ссылка на проверку', async () => {
  renderProfile('c_7f3a9b', 'user2002')

  expect(await screen.findByRole('heading', { name: 'Паспорт почерка: Саша' })).toBeInTheDocument()
  expect(screen.getByText('Пишет с маленькой буквы')).toBeInTheDocument()
  expect(screen.getByText('94% сообщений начинаются со строчной буквы')).toBeInTheDocument()
  expect(screen.getByText('кста')).toBeInTheDocument()
  expect(screen.getByText('×374')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Проверить сообщение' })).toHaveAttribute(
    'href',
    '/chats/c_7f3a9b/authors/user2002/check',
  )
  expect(screen.queryByText(/мало собственных сообщений/)).not.toBeInTheDocument()
})

test('часы активности: 24 столбца, пик подписан, подсказка при наведении', async () => {
  const container = renderProfile('c_7f3a9b', 'user2002')
  await screen.findByRole('heading', { name: 'Паспорт почерка: Саша' })

  expect(container.querySelectorAll('.hours-chart__bar')).toHaveLength(24)
  // В примере контракта максимум 0.08 впервые в 18:00
  expect(screen.getByRole('img', { name: /пик в 18:00 UTC/ })).toBeInTheDocument()

  fireEvent.pointerEnter(screen.getByLabelText('03:00 UTC — 0% сообщений'))
  expect(screen.getByRole('tooltip')).toHaveTextContent('03:00 0%')

  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('row')).toHaveLength(25)
})

test('автор с малым числом сообщений — предупреждение', async () => {
  renderProfile('c_19ab42', 'user3005')

  expect(await screen.findByText(/мало собственных сообщений/)).toBeInTheDocument()
})

test('неизвестный автор — предлагает загрузить заново', async () => {
  renderProfile('c_7f3a9b', 'user0')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('нет такого автора')
  expect(within(alert).getByRole('link', { name: 'Загрузить файл заново' })).toBeInTheDocument()
})
