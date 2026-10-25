import { useParams } from 'react-router-dom'

// Заглушка, наполняется в #15
export default function TwinsPage() {
  const params = useParams()
  return (
    <section>
      <h2>Двойники</h2>
      <pre>{JSON.stringify(params)}</pre>
    </section>
  )
}
