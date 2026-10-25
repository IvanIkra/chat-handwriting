type Props = {
  children: string
}

/** Состояние загрузки экрана: спиннер и подпись, читалки экрана слышат подпись */
export default function Loading({ children }: Props) {
  return (
    <p className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {children}
    </p>
  )
}
