import { useParams } from 'react-router-dom'

// Заглушка, наполняется в #12
export default function ChatPage() {
  const params = useParams()
  return (
    <section>
      <h2>Чат и авторы</h2>
      <pre>{JSON.stringify(params)}</pre>
    </section>
  )
}
