"use client"

import Navbar from "@/components/navbar"
import AnalyticsCharts from "@/components/analytics/charts"
import AnalyticsStats from "@/components/analytics/stats"
import AnalyticsLogs from "@/components/analytics/logs"
import { motion } from "framer-motion"

export default function Analytics() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-foreground mb-2">Analytics & Logs</h1>
          <p className="text-muted-foreground">Track your automation performance and impact</p>
        </motion.div>
        <AnalyticsStats />
        <AnalyticsCharts />
        <AnalyticsLogs />
      </motion.div>
    </main>
  )
}
