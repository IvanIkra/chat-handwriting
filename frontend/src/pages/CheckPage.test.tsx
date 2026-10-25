import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { api } from '../api'
import { localToUtcIso } from '../utils/format'
import CheckPage from './CheckPage'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  const { createMockApi } = await import('../api/mocks')
  return { ...actual, api: createMockApi({ delayMs: 0 }) }
})

const FAKE = 'Привет! срочно займи 5000 на карту, потом объясню'

async function renderCheck(chatId: string, authorId: string) {
  render(
    <MemoryRouter initialEntries={[`/chats/${chatId}/authors/${authorId}/check`]}>
      <Routes>
        <Route path="/chats/:chatId/authors/:authorId/check" element={<CheckPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function check(text: string) {
  fireEvent.change(await screen.findByLabelText('Сообщение'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Проверить' }))
}

test('фейк: «не похоже», «срочно» подсвечено, улики и контрольный вопрос', async () => {
  await renderCheck('c_7f3a9b', 'user2002')
  expect(await screen.findByRole('heading', { name: 'Это точно Саша?' })).toBeInTheDocument()

  await check(FAKE)

  expect(await screen.findByText('Не похоже')).toBeInTheDocument()
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '12')
  const marks = document.querySelectorAll('mark')
  expect([...marks].map((m) => m.textContent)).toEqual(['П', 'ривет!', 'срочно'])
  // Улика без span — в списке с пометкой
  const time = screen.getByText('Время отправки').closest('li')!
  expect(within(time).getByText('не в тексте')).toBeInTheDocument()
  expect(screen.getByText('Задайте контрольный вопрос')).toBeInTheDocument()
  expect(screen.getByText('Объяснение')).toBeInTheDocument()
})

test('наведение на подсветку выделяет улику в списке', async () => {
  await renderCheck('c_7f3a9b', 'user2002')
  await check(FAKE)
  await screen.findByText('Не похоже')

  fireEvent.pointerEnter(screen.getByText('срочно', { selector: 'mark' }))

  expect(screen.getByText('Нетипичные слова').closest('li')).toHaveClass('signal--active')
})

test('фрагмент под несколькими уликами выделяет их все', async () => {
  await renderCheck('c_7f3a9b', 'user2002')
  await check(FAKE)
  await screen.findByText('Не похоже')

  // «П» входит и в «Привет!», и в заглавную букву
  fireEvent.pointerEnter(screen.getByText('П', { selector: 'mark' }))

  expect(screen.getByText('Приветствие').closest('li')).toHaveClass('signal--active')
  expect(screen.getByText('Заглавная буква в начале').closest('li')).toHaveClass('signal--active')
  expect(screen.getByText('Нетипичные слова').closest('li')).not.toHaveClass('signal--active')
})

test('улику из списка можно выбрать с клавиатуры — фрагмент подсвечивается', async () => {
  await renderCheck('c_7f3a9b', 'user2002')
  await check(FAKE)
  await screen.findByText('Не похоже')

  const item = screen.getByText('Нетипичные слова').closest('li')!
  expect(item).toHaveAttribute('tabindex', '0')
  fireEvent.focus(item)

  expect(item).toHaveClass('signal--active')
  expect(screen.getByText('срочно', { selector: 'mark' })).toHaveClass('hl--active')
  expect(screen.getByText('ривет!', { selector: 'mark' })).not.toHaveClass('hl--active')

  fireEvent.blur(item)
  expect(screen.getByText('срочно', { selector: 'mark' })).not.toHaveClass('hl--active')
})

test('настоящее сообщение: «похоже», блоков LLM нет', async () => {
  await renderCheck('c_7f3a9b', 'user2002')
  await check('го в кино)')

  expect(await screen.findByText('Похоже на автора')).toBeInTheDocument()
  expect(screen.queryByText('Объяснение')).not.toBeInTheDocument()
  expect(screen.queryByText('Задайте контрольный вопрос')).not.toBeInTheDocument()
})

test('автор без данных: «мало данных», без шкалы', async () => {
  await renderCheck('c_19ab42', 'user3005')
  await check('привет')

  expect(await screen.findByText('Мало данных об авторе')).toBeInTheDocument()
  expect(screen.queryByRole('meter')).not.toBeInTheDocument()
})

test('текст из одних ссылок и упоминаний: «нет почерка», а не «мало данных об авторе»', async () => {
  await renderCheck('c_7f3a9b', 'user2002')
  await check('https://t.me/x @sasha')

  expect(await screen.findByText('В тексте нет почерка')).toBeInTheDocument()
  expect(screen.queryByText('Мало данных об авторе')).not.toBeInTheDocument()
})

test('длиннее 4096 символов: не обрезаем, счётчик в кодовых точках, отправка заблокирована', async () => {
  const spy = vi.spyOn(api, 'checkMessage')
  await renderCheck('c_7f3a9b', 'user2002')
  const field = await screen.findByLabelText('Сообщение')

  // 4096 эмодзи — ровно лимит, хотя text.length = 8192
  fireEvent.change(field, { target: { value: '🔥'.repeat(4096) } })
  expect(screen.getByText('4096 / 4096')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Проверить' })).toBeEnabled()

  fireEvent.change(field, { target: { value: '🔥'.repeat(4097) } })
  expect(field).toHaveValue('🔥'.repeat(4097))
  expect(screen.getByText('4097 / 4096')).toBeInTheDocument()
  expect(screen.getByText('Слишком длинное сообщение')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Проверить' })).toBeDisabled()
  expect(spy).not.toHaveBeenCalled()
})

test('пустой текст не отправляется, время уходит в UTC', async () => {
  const spy = vi.spyOn(api, 'checkMessage')
  await renderCheck('c_7f3a9b', 'user2002')

  expect(await screen.findByRole('button', { name: 'Проверить' })).toBeDisabled()

  fireEvent.change(screen.getByLabelText(/Когда отправлено/), { target: { value: '2026-10-26T03:12' } })
  await check('прив')

  await screen.findByText('Похоже на автора')
  expect(spy).toHaveBeenCalledWith('c_7f3a9b', 'user2002', {
    text: 'прив',
    sent_at: new Date('2026-10-26T03:12').toISOString(),
  })
  spy.mockRestore()
})

test('серия: поля на каждое сообщение, «Добавить» копирует время, улика подсвечена в своём сообщении', async () => {
  const spy = vi.spyOn(api, 'checkMessage')
  await renderCheck('c_7f3a9b', 'user2002')
  fireEvent.click(await screen.findByRole('radio', { name: 'Несколько подряд' }))

  const submit = screen.getByRole('button', { name: 'Проверить' })
  fireEvent.change(screen.getByLabelText('Сообщение 1'), { target: { value: 'ну что' } })
  expect(submit).toBeDisabled()
  fireEvent.change(screen.getAllByLabelText(/Когда отправлено/)[1], { target: { value: '2026-10-26T03:12' } })
  fireEvent.click(screen.getByRole('button', { name: '+ Добавить сообщение' }))
  expect(screen.getAllByLabelText(/Когда отправлено/)[2]).toHaveValue('2026-10-26T03:12')

  fireEvent.change(screen.getByLabelText('Сообщение 2'), { target: { value: FAKE } })
  // Третье поле пустое — не отправляется
  fireEvent.click(submit)

  expect(await screen.findByText('Не похоже')).toBeInTheDocument()
  expect(spy).toHaveBeenCalledWith('c_7f3a9b', 'user2002', {
    messages: [{ text: 'ну что' }, { text: FAKE, sent_at: new Date('2026-10-26T03:12').toISOString() }],
  })
  const [first, second] = within(screen.getByRole('heading', { name: 'Сообщения' }).nextElementSibling as HTMLElement)
    .getAllByRole('listitem')
  expect(first.querySelectorAll('mark')).toHaveLength(0)
  expect(within(second).getByText('срочно', { selector: 'mark' })).toBeInTheDocument()
  const rare = screen.getByText('Нетипичные слова').closest('li')!
  expect(within(rare).getByText('сообщение 2')).toBeInTheDocument()
  spy.mockRestore()
})

test('серия: «Убрать» есть, только когда сообщений больше двух', async () => {
  await renderCheck('c_7f3a9b', 'user2002')
  fireEvent.click(await screen.findByRole('radio', { name: 'Несколько подряд' }))

  expect(screen.queryByRole('button', { name: /Убрать/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '+ Добавить сообщение' }))
  fireEvent.click(screen.getByRole('button', { name: 'Убрать сообщение 2' }))

  expect(screen.getAllByRole('textbox')).toHaveLength(2)
})

test('localToUtcIso: пустое и мусор — без времени', () => {
  expect(localToUtcIso('')).toBeUndefined()
  expect(localToUtcIso('не дата')).toBeUndefined()
  expect(localToUtcIso('2026-10-26T03:12')).toMatch(/^2026-10-2\dT\d\d:12:00\.000Z$/)
})

test('неизвестный автор — предлагает загрузить заново', async () => {
  await renderCheck('c_7f3a9b', 'user0')

  const alert = await screen.findByRole('alert')
  expect(within(alert).getByRole('link', { name: 'Загрузить файл заново' })).toBeInTheDocument()
})
