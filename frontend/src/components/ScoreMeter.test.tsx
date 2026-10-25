import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { CheckVerdict } from '../api/types'
import ScoreMeter from './ScoreMeter'

test('not_enough_data: без reason — мало данных об авторе, no_style_text — нет почерка в тексте', () => {
  const { rerender } = render(<ScoreMeter verdict="not_enough_data" score={null} />)
  expect(screen.getByText('Мало данных об авторе')).toBeInTheDocument()

  rerender(<ScoreMeter verdict="not_enough_data" score={null} reason="few_messages" />)
  expect(screen.getByText('Мало данных об авторе')).toBeInTheDocument()

  rerender(<ScoreMeter verdict="not_enough_data" score={null} reason="no_style_text" />)
  expect(screen.getByText('В тексте нет почерка')).toBeInTheDocument()
  expect(screen.queryByRole('meter')).not.toBeInTheDocument()
})

test('неизвестный вердикт показывается как «Не уверены», страница не падает', () => {
  render(<ScoreMeter verdict={'suspicious' as CheckVerdict} score={0.5} />)

  expect(screen.getByText('Не уверены')).toBeInTheDocument()
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '50')
})
