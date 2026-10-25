import { expect, test } from 'vitest'
import { sliceSpan } from '../utils/span'
import { createMockApi } from './mocks'

const api = createMockApi({ delayMs: 0 })

test('загрузка: group*.json — групповой чат, иначе личный', async () => {
  const personal = await api.uploadChat(new File(['{}'], 'result.json'))
  const group = await api.uploadChat(new File(['{}'], 'group_result.json'))

  expect(personal).toMatchObject({ id: 'c_7f3a9b', kind: 'personal' })
  expect(group).toMatchObject({ id: 'c_19ab42', kind: 'group' })
})

test('загрузка не-JSON — invalid_export', async () => {
  await expect(api.uploadChat(new File(['x'], 'photo.png'))).rejects.toMatchObject({
    status: 400,
    code: 'invalid_export',
  })
})

test('неизвестный чат или автор — not_found', async () => {
  await expect(api.getChat('c_missing')).rejects.toMatchObject({ status: 404, code: 'not_found' })
  await expect(api.getProfile('c_7f3a9b', 'user0')).rejects.toMatchObject({ code: 'not_found' })
})

test('паспорт почерка — по примеру контракта', async () => {
  const profile = await api.getProfile('c_7f3a9b', 'user2002')

  expect(profile.name).toBe('Саша')
  expect(profile.active_hours).toHaveLength(24)
  expect(profile.traits.length).toBeGreaterThan(0)
})

test('проверка: «срочно» — mismatch, обычный текст — match', async () => {
  const fake = await api.checkMessage('c_7f3a9b', 'user2002', {
    text: 'Привет! срочно займи 5000 на карту, потом объясню',
  })
  const real = await api.checkMessage('c_7f3a9b', 'user2002', { text: 'го в кино)' })

  expect(fake.verdict).toBe('mismatch')
  expect(fake.challenge_question).not.toBeNull()
  expect(real.verdict).toBe('match')
})

test('span в мок-ответе указывают на фрагменты текста из контракта', async () => {
  const text = 'Привет! срочно займи 5000 на карту, потом объясню'
  const res = await api.checkMessage('c_7f3a9b', 'user2002', { text })

  const fragments = res.signals.flatMap((s) => (s.span ? [sliceSpan(text, s.span)] : []))
  expect(fragments).toEqual(['Привет!', 'П', 'срочно'])
})

test('проверка автора без данных — not_enough_data', async () => {
  const res = await api.checkMessage('c_19ab42', 'user3005', { text: 'привет' })

  expect(res).toMatchObject({ verdict: 'not_enough_data', score: null, signals: [] })
})

test('пустой текст — validation', async () => {
  await expect(
    api.checkMessage('c_7f3a9b', 'user2002', { text: '  ' }),
  ).rejects.toMatchObject({ status: 422, code: 'validation' })
})

test('двойники и пара в любом порядке авторов', async () => {
  const twins = await api.getTwins('c_19ab42')
  const pair = await api.getPair('c_19ab42', 'user3004', 'user3003')

  expect(twins.pairs[0]).toMatchObject({ a: 'user3003', b: 'user3004', verdict: 'likely_same' })
  expect(pair.examples.length).toBeGreaterThan(0)
  await expect(api.getPair('c_19ab42', 'user3001', 'user3005')).rejects.toMatchObject({
    code: 'not_found',
  })
})

test('ответы — копии, правка не портит следующие', async () => {
  const first = await api.getChat('c_7f3a9b')
  first.authors.length = 0

  const second = await api.getChat('c_7f3a9b')
  expect(second.authors).toHaveLength(2)
})

test('сравнение двух чатов: пример контракта, shared и обратный порядок', async () => {
  const res = await api.compare('c_7f3a9b', 'c_51d0e2')
  expect(res.shared).toEqual(['user1001'])
  expect(res.pairs).toHaveLength(1)
  expect(res.pairs[0]).toMatchObject({ a: 'user2002', b: 'user7007', score: 0.81, verdict: 'likely_same' })

  const reversed = await api.compare('c_51d0e2', 'c_7f3a9b')
  expect(reversed.a.id).toBe('c_51d0e2')
  expect(reversed.pairs[0]).toMatchObject({ a: 'user7007', b: 'user2002', verdict: 'likely_same' })
})

test('сравнение: группа с личным чатом — без авторов с малым числом сообщений, по убыванию score', async () => {
  const res = await api.compare('c_19ab42', 'c_7f3a9b')
  expect(res.shared).toEqual([])
  expect(res.pairs).toHaveLength(6)
  expect(res.pairs.some((p) => p.a === 'user3005')).toBe(false)
})

test('сравнение: один и тот же чат — validation, неизвестный — not_found', async () => {
  await expect(api.compare('c_7f3a9b', 'c_7f3a9b')).rejects.toMatchObject({ status: 422, code: 'validation' })
  await expect(api.compare('c_7f3a9b', 'c_missing')).rejects.toMatchObject({ status: 404 })
})

test('загрузка alex*.json — второй личный чат', async () => {
  expect(await api.uploadChat(new File(['{}'], 'alex_result.json'))).toMatchObject({ id: 'c_51d0e2' })
})
