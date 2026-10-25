import { useParams } from 'react-router-dom'

// Заглушка, наполняется в #13
export default function ProfilePage() {
  const params = useParams()
  return (
    <section>
      <h2>Паспорт почерка</h2>
      <pre>{JSON.stringify(params)}</pre>
    </section>
  )
}
