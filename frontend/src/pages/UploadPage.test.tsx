import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api'
import { rememberChat } from '../utils/recentChats'
import UploadPage from './UploadPage'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  const { createMockApi } = await import('../api/mocks')
  return { ...actual, api: createMockApi({ delayMs: 0 }) }
})

afterEach(() => {
  localStorage.clear()
})

function renderUpload() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/chats/:chatId" element={<p>страница чата</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return screen.getByLabelText('Файл экспорта result.json')
}

function choose(input: HTMLElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } })
}

test('после загрузки открывается страница чата', async () => {
  choose(renderUpload(), new File(['{}'], 'result.json'))

  expect(await screen.findByText('страница чата')).toBeInTheDocument()
})

test('не экспорт Telegram — понятное сообщение', async () => {
  choose(renderUpload(), new File(['x'], 'photo.png'))

  expect(await screen.findByRole('alert')).toHaveTextContent('Это не экспорт Telegram')
})

test('файл больше 50 МБ не отправляется', async () => {
  const spy = vi.spyOn(api, 'uploadChat')
  const big = new File(['{}'], 'result.json')
  Object.defineProperty(big, 'size', { value: 51 * 1024 * 1024 })

  choose(renderUpload(), big)

  expect(await screen.findByRole('alert')).toHaveTextContent('больше 50 МБ')
  expect(spy).not.toHaveBeenCalled()
})

test('без истории блока «Недавние чаты» нет', () => {
  renderUpload()
  expect(screen.queryByRole('heading', { name: 'Недавние чаты' })).not.toBeInTheDocument()
})

test('недавние чаты: ссылки на чаты и на сравнение', async () => {
  rememberChat(await api.getChat('c_7f3a9b'))
  rememberChat(await api.getChat('c_19ab42'))
  renderUpload()

  expect(screen.getByRole('link', { name: 'Двор на Лесной' })).toHaveAttribute('href', '/chats/c_19ab42')
  expect(screen.getByRole('link', { name: 'Саша' })).toHaveAttribute('href', '/chats/c_7f3a9b')
  expect(screen.getByRole('link', { name: 'Сравнить два чата →' })).toHaveAttribute('href', '/compare')
})
