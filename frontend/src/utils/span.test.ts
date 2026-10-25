import { expect, test } from 'vitest'
import { sliceSpan } from './span'

test('режет по span из контракта', () => {
  expect(sliceSpan('Привет! срочно займи', [8, 14])).toBe('срочно')
  expect(sliceSpan('Привет! срочно займи', [0, 7])).toBe('Привет!')
})

test('эмодзи считаются одной кодовой точкой', () => {
  const text = '🔥🔥 ну ща'
  // text.slice(3, 5) вернул бы обрывок суррогатной пары
  expect(sliceSpan(text, [3, 5])).toBe('ну')
})
