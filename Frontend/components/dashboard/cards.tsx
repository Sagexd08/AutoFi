"use client"

import { useStore } from "@/lib/store"
import { AutomationCard } from "./automation-card"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"

export default function DashboardCards() {
  const { automations, pauseAutomation, resumeAutomation } = useStore()
  const router = useRouter()

  const handleViewDetails = (id: string) => {
    console.log("[v0] View details for automation:", id)
    // Navigate to automation details page
    router.push(`/dashboard/automation/${id}`)
  }

  if (automations.length === 0) {
    return (
      <motion.div
        className="mb-8 text-center py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-bold text-foreground mb-2 hover:text-white transition-smooth">No Automations Yet</h2>
        <p className="text-muted-foreground hover:text-white/80 transition-smooth">Create your first automation to get started</p>
      </motion.div>
    )
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-foreground mb-4 hover:text-white transition-smooth">Your Automations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automations.map((automation, index) => (
          <AutomationCard
            key={automation.id}
            automation={automation}
            onPause={pauseAutomation}
            onResume={resumeAutomation}
            onViewDetails={handleViewDetails}
            delay={index * 0.1}
          />
        ))}
      </div>
    </div>
  )
}
