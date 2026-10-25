import type { Signal } from '../api/types'

export type Segment = {
  text: string
  /** Индексы улик из исходного массива signals, покрывающих этот кусок */
  signals: number[]
  /** Суммарный вес покрывающих улик, 0 — кусок без улик */
  weight: number
}

/**
 * Режет текст на куски по всем границам span. Span'ы могут перекрываться
 * («Привет!» [0, 7] и «П» [0, 1]), поэтому кусок знает все свои улики.
 * Индексы — в кодовых точках Unicode, как в контракте.
 */
export function segmentText(text: string, signals: Signal[]): Segment[] {
  const chars = Array.from(text)
  const spans = signals
    .map((s, i) => ({ i, weight: s.weight, span: s.span }))
    .filter((s): s is { i: number; weight: number; span: [number, number] } => s.span !== null)
    .map((s) => ({
      ...s,
      start: Math.max(0, Math.min(s.span[0], chars.length)),
      end: Math.max(0, Math.min(s.span[1], chars.length)),
    }))
    .filter((s) => s.end > s.start)

  const cuts = new Set([0, chars.length])
  for (const s of spans) {
    cuts.add(s.start)
    cuts.add(s.end)
  }
  const points = [...cuts].sort((a, b) => a - b)

  const segments: Segment[] = []
  for (let k = 0; k < points.length - 1; k++) {
    const from = points[k]
    const to = points[k + 1]
    const covering = spans.filter((s) => s.start <= from && s.end >= to)
    segments.push({
      text: chars.slice(from, to).join(''),
      signals: covering.map((s) => s.i),
      weight: covering.reduce((sum, s) => sum + s.weight, 0),
    })
  }
  return segments
}
