import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { CheckVerdict } from '../api/types'
import ScoreMeter from './ScoreMeter'

test('неизвестный вердикт показывается как «Не уверены», страница не падает', () => {
  render(<ScoreMeter verdict={'suspicious' as CheckVerdict} score={0.5} />)

  expect(screen.getByText('Не уверены')).toBeInTheDocument()
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '50')
})
