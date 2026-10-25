import { useParams } from 'react-router-dom'

// Заглушка, наполняется в #14
export default function CheckPage() {
  const params = useParams()
  return (
    <section>
      <h2>Проверка сообщения</h2>
      <pre>{JSON.stringify(params)}</pre>
    </section>
  )
}
