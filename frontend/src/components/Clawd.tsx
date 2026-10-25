import book from '../assets/clawd/book.gif'
import bookStill from '../assets/clawd/book.png'
import crabWalking from '../assets/clawd/crab-walking.gif'
import crabWalkingStill from '../assets/clawd/crab-walking.png'
import dancing from '../assets/clawd/dancing.gif'
import dancingStill from '../assets/clawd/dancing.png'
import laptop from '../assets/clawd/laptop.gif'
import laptopStill from '../assets/clawd/laptop.png'
import lurking from '../assets/clawd/lurking.gif'
import lurkingStill from '../assets/clawd/lurking.png'
import logo from '../assets/clawd/logo.gif'
import logoStill from '../assets/clawd/logo.png'
import magnifier from '../assets/clawd/magnifier.gif'
import magnifierStill from '../assets/clawd/magnifier.png'
import pointing from '../assets/clawd/pointing.gif'
import pointingStill from '../assets/clawd/pointing.png'
import waving from '../assets/clawd/waving.gif'
import wavingStill from '../assets/clawd/waving.png'

/** Гифка, статичный кадр и исходный размер в пикселях: Clawd во всех позах одного масштаба */
const POSES = {
  book: [book, bookStill, 349, 251],
  'crab-walking': [crabWalking, crabWalkingStill, 262, 185],
  dancing: [dancing, dancingStill, 262, 185],
  laptop: [laptop, laptopStill, 371, 251],
  // Логотип: та же лупа, но кадр поуже и пиксели по родной сетке — чётко в маленьком размере
  logo: [logo, logoStill, 108, 81],
  lurking: [lurking, lurkingStill, 142, 185],
  magnifier: [magnifier, magnifierStill, 393, 294],
  pointing: [pointing, pointingStill, 305, 229],
  waving: [waving, wavingStill, 262, 229],
} as const

export type ClawdPose = keyof typeof POSES

type Props = {
  pose: ClawdPose
  /** Доля от исходного размера; 0.5 — тело Clawd около 70 px в ширину */
  scale?: number
  className?: string
}

/** Маскот Clawd. Декоративный: читалки экрана его пропускают. При «уменьшить движение» — статичный кадр */
export default function Clawd({ pose, scale = 0.5, className }: Props) {
  const [gif, still, width, height] = POSES[pose]
  return (
    <picture className={className ? `clawd ${className}` : 'clawd'} aria-hidden="true">
      <source media="(prefers-reduced-motion: reduce)" srcSet={still} />
      <img
        src={gif}
        alt=""
        width={Math.round(width * scale)}
        height={Math.round(height * scale)}
        draggable={false}
      />
    </picture>
  )
}
