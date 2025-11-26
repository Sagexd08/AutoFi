"use client"

import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"

export default function AnalyticsCharts() {
  const chartData = [40, 60, 45, 75, 55, 80, 65]
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Transaction Volume Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="p-6 glass border-border/50">
          <h3 className="text-lg font-bold text-foreground mb-4">Transaction Volume</h3>
          <div className="h-64 bg-gradient-to-b from-primary/10 to-transparent rounded-lg flex items-end justify-around p-4 gap-2">
            {chartData.map((height, i) => (
              <motion.div
                key={i}
                className="flex-1 bg-gradient-to-t from-primary to-secondary rounded-t transition-all hover:opacity-80 cursor-pointer"
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: "easeOut" }}
                whileHover={{ scale: 1.05 }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-4">
            {days.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Success vs Failed Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <Card className="p-6 glass border-border/50">
          <h3 className="text-lg font-bold text-foreground mb-4">Success vs Failed</h3>
          <div className="flex items-center justify-center h-64">
            <div className="relative w-48 h-48">
              <motion.svg
                viewBox="0 0 100 100"
                className="w-full h-full"
                initial={{ rotate: -90 }}
                animate={{ rotate: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="8"
                  className="opacity-10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="282.6 314"
                  transform="rotate(-90 50 50)"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="8"
                  strokeDasharray="4.71 314"
                  transform="rotate(193.6 50 50)"
                />
              </motion.svg>
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">98.5%</p>
                  <p className="text-xs text-muted-foreground">Success</p>
                </div>
              </motion.div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
