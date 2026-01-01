"use client"

import { useStore } from "@/lib/store"
import { Wallet, TrendingUp, Zap, AlertCircle } from "lucide-react"
import { StatsCard } from "./stats-card"
import { motion } from "framer-motion"
import { useShallow } from "zustand/react/shallow"

export default function DashboardOverview() {
  // ⚡ Bolt Optimization: Use granular selectors to prevent re-renders when unrelated store parts update
  // Previously: const { automations, wallet, totalProcessed, pendingAlerts, loading } = useStore()
  const { automations, walletBalance, totalProcessed, pendingAlerts, loading } = useStore(
    useShallow((state) => ({
      automations: state.automations,
      walletBalance: state.wallet.balance,
      totalProcessed: state.totalProcessed,
      pendingAlerts: state.pendingAlerts,
      loading: state.loading,
    }))
  )

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
