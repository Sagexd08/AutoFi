"use client"

import { useEffect } from "react"
import { useStore, type Automation } from "@/lib/store"
import { useWallet } from "@/hooks/use-wallet"
import Navbar from "@/components/navbar"
import DashboardOverview from "@/components/dashboard/overview"
import DashboardCards from "@/components/dashboard/cards"
import RecentActivity from "@/components/dashboard/recent-activity"
import { TokenDisplay } from "@/components/token-display"
import { motion } from "framer-motion"

export default function Dashboard() {
  const { wallet, automations, loadAutomations, setLoading, setError } = useStore()
  const { wallet: walletState ,connect} = useWallet()

  useEffect(() => {
    connect();
    // Load automations from API when wallet is connected
    if (wallet.isConnected && automations.length === 0) {
      loadAutomations()
    }
  }, [wallet.isConnected, automations.length, loadAutomations])

  if (!wallet.isConnected) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <motion.div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-foreground mb-4">Welcome to Your Dashboard</h1>
          <p className="text-muted-foreground mb-8">
            Connect your wallet to view and manage your automations
          </p>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your automation overview.</p>
        </div>

        <DashboardOverview />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <DashboardCards />
          </div>
          <div>
            <TokenDisplay />
          </div>
        </div>
        <RecentActivity />
      </motion.div>
    </main>
  )
}
