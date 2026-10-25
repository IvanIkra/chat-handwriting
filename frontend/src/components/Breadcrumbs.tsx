import { Link } from 'react-router-dom'

type Crumb = { label: string; to?: string }

/** Навигационная цепочка вложенных страниц: «Чат › Автор › Проверка». Последний пункт — текущая страница */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Навигация">
      <ol className="breadcrumbs">
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`}>
            {item.to && i < items.length - 1 ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
