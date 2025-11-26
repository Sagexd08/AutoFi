"use client"

import { Card } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface StatsCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color: "primary" | "success" | "accent" | "destructive"
  delay?: number
  loading?: boolean
}

function AnimatedCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (typeof value !== "number") return

    let startTime: number
    let animationFrame: number

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)

      setDisplayValue(Math.floor(value * progress))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [value, duration])

  return <span>{displayValue}</span>
}

export function StatsCard({ label, value, icon: Icon, color, delay = 0, loading = false }: StatsCardProps) {
  const colorMap = {
    primary: "border-l-primary text-primary",
    success: "border-l-success text-success",
    accent: "border-l-accent text-accent",
    destructive: "border-l-destructive text-destructive",
  }

  const numericValue = typeof value === "string" ? Number.parseInt(value.match(/\d+/)?.[0] || "0") : value

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
    >
      <Card className={`p-6 border-l-4 glass hover:glass-dark transition-smooth hover-lift group ${colorMap[color]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{label}</p>
            {loading ? (
              <div className="h-8 w-24 bg-muted rounded mt-2 animate-shimmer" />
            ) : (
              <p className="text-3xl font-bold text-foreground mt-2 group-hover:text-current transition-smooth">
                {typeof value === "string" && value.includes("CELO") ? (
                  value
                ) : typeof numericValue === "number" ? (
                  <AnimatedCounter value={numericValue} />
                ) : (
                  value
                )}
              </p>
            )}
          </div>
          <motion.div whileHover={{ scale: 1.15, rotate: 8 }} transition={{ type: "spring", stiffness: 300 }}>
            <Icon className="group-hover:scale-110 transition-smooth" size={32} />
          </motion.div>
        </div>
      </Card>
    </motion.div>
  )
}
