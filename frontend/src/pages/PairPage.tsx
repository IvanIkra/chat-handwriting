import { useParams } from 'react-router-dom'

// Заглушка, наполняется в #16
export default function PairPage() {
  const params = useParams()
  return (
    <section>
      <h2>Сравнение пары</h2>
      <pre>{JSON.stringify(params)}</pre>
    </section>
  )
}
