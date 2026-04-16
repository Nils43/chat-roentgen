import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  duration?: number
  decimals?: number
  suffix?: string
  format?: (n: number) => string
}

// Scroll-triggered count-up. Starts animating when the element enters viewport.
export function CountUp({ value, duration = 900, decimals = 0, suffix = '', format }: Props) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          const tick = (t: number) => {
            const p = Math.min(1, (t - start) / duration)
            const eased = 1 - Math.pow(1 - p, 3)
            setDisplay(value * eased)
            if (p < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value, duration])

  const shown = format ? format(display) : display.toFixed(decimals)
  return (
    <span ref={ref} className="metric-num tabular-nums">
      {shown}
      {suffix}
    </span>
  )
}
