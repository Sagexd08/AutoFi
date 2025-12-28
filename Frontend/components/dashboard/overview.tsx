"use client"

import { useStore } from "@/lib/store"
import { Wallet, TrendingUp, Zap, AlertCircle } from "lucide-react"
import { StatsCard } from "./stats-card"
import { motion } from "framer-motion"

export default function DashboardOverview() {
  // ⚡ Performance: Use granular selectors to prevent unnecessary re-renders
  // when unrelated parts of the store change (e.g., error, specific wallet tokens)
  const automations = useStore((state) => state.automations)
  const walletBalance = useStore((state) => state.wallet.balance)
  const totalProcessed = useStore((state) => state.totalProcessed)
  const pendingAlerts = useStore((state) => state.pendingAlerts)
  const loading = useStore((state) => state.loading)

  const activeCount = automations.filter((a) => a.status === "active").length

  return (
    <motion.div className="mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <StatsCard
          label="Active Automations"
          value={activeCount}
          icon={Zap}
          color="primary"
          delay={0}
          loading={loading}
        />
        <StatsCard
          label="Total Processed"
          value={totalProcessed}
          icon={TrendingUp}
          color="success"
          delay={0.1}
          loading={loading}
        />
        <StatsCard
          label="Wallet Balance"
          value={walletBalance ? `${walletBalance} CELO` : "0 CELO"}
          icon={Wallet}
          color="accent"
          delay={0.2}
          loading={loading}
        />
        <StatsCard
          label="Pending Alerts"
          value={pendingAlerts}
          icon={AlertCircle}
          color="destructive"
          delay={0.3}
          loading={loading}
        />
      </div>
    </motion.div>
  )
}
