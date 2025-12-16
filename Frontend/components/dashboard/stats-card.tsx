"use client"

import { Card } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { useEffect } from "react"

interface StatsCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color: "primary" | "success" | "accent" | "destructive"
  delay?: number
  loading?: boolean
}

function AnimatedCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.floor(latest))

  useEffect(() => {
    const controls = animate(count, value, { duration })
    return controls.stop
  }, [count, value, duration])

  return <motion.span>{rounded}</motion.span>
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
