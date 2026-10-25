import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

afterEach(() => {
  vi.restoreAllMocks()
})

function Broken(): never {
  throw new TypeError("Cannot read properties of undefined (reading 'v')")
}

test('падение страницы показывает ошибку с повтором и ссылкой на главную', () => {
  // React и сам ErrorBoundary пишут упавшую ошибку в консоль — в тестах это шум
  vi.spyOn(console, 'error').mockImplementation(() => {})

  render(
    <MemoryRouter>
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>
    </MemoryRouter>,
  )

  expect(screen.getByRole('alert')).toHaveTextContent('Что-то пошло не так')
  expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '← На главную' })).toHaveAttribute('href', '/')
})
