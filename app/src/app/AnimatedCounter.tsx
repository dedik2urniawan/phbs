'use client'

import { useState, useEffect, useRef } from 'react'

export default function AnimatedCounter({ value, duration = 2000 }: { value: string, duration?: number }) {
  const [displayValue, setDisplayValue] = useState(value) // Server render with final value, no mismatch
  const [hasAnimated, setHasAnimated] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const countRef = useRef<HTMLSpanElement>(null)

  // After mount, reset to '0' for animation
  useEffect(() => {
    setIsMounted(true)
    setDisplayValue('0')
  }, [])

  useEffect(() => {
    if (!isMounted) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
        }
      },
      { threshold: 0.1 }
    )
    if (countRef.current) observer.observe(countRef.current)
    return () => observer.disconnect()
  }, [isMounted, hasAnimated])

  useEffect(() => {
    if (!hasAnimated) return

    const isRange = value.includes('-')
    const isPercentage = value.includes('%')

    if (isRange) {
      const parts = value.split('-').map(p => parseInt(p.replace(/[^0-9]/g, '')))
      let startTimestamp: number | null = null

      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp
        const progress = Math.min((timestamp - startTimestamp) / duration, 1)
        const v1 = Math.floor(progress * parts[0])
        const v2 = Math.floor(progress * parts[1])
        setDisplayValue(`${v1}-${v2}${isPercentage ? '%' : ''}`)
        if (progress < 1) window.requestAnimationFrame(step)
      }
      window.requestAnimationFrame(step)
    } else {
      const cleanValue = value.replace(/[.%]/g, '')
      const target = parseInt(cleanValue)
      let startTimestamp: number | null = null

      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp
        const progress = Math.min((timestamp - startTimestamp) / duration, 1)
        const current = Math.floor(progress * target)
        const formatted = value.includes('.')
          ? current.toLocaleString('id-ID')
          : current.toString()
        setDisplayValue(formatted + (isPercentage ? '%' : ''))
        if (progress < 1) window.requestAnimationFrame(step)
      }
      window.requestAnimationFrame(step)
    }
  }, [hasAnimated, value, duration])

  return <span ref={countRef} suppressHydrationWarning>{displayValue}</span>
}
