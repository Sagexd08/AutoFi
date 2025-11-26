"use client"

import { Card } from "@/components/ui/card"
import { CheckCircle, AlertCircle, Clock } from "lucide-react"
import { motion } from "framer-motion"

interface Log {
  type: "success" | "alert" | "pending"
  automation: string
  action: string
  amount: string
  time: string
  icon: typeof CheckCircle
}

const logs: Log[] = [
  {
    type: "success",
    automation: "Weekly Payroll",
    action: "Executed successfully",
    amount: "+$5,000",
    time: "2 hours ago",
    icon: CheckCircle,
  },
  {
    type: "success",
    automation: "NFT Airdrop",
    action: "Sent 100 NFTs",
    amount: "100 NFTs",
    time: "4 hours ago",
    icon: CheckCircle,
  },
  {
    type: "alert",
    automation: "Price Alert",
    action: "Threshold reached",
    amount: "$2.50",
    time: "6 hours ago",
    icon: AlertCircle,
  },
  {
    type: "pending",
    automation: "DAO Treasury",
    action: "Pending execution",
    amount: "$12,500",
    time: "1 day ago",
    icon: Clock,
  },
]

export default function AnalyticsLogs() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>
      <Card className="p-6 glass border-border/50">
        <h3 className="text-lg font-bold text-foreground mb-4">Execution Logs</h3>
        <div className="space-y-4">
          {logs.map((log, index) => {
            const Icon = log.icon
            const colorClass =
              log.type === "success" ? "text-success" : log.type === "alert" ? "text-destructive" : "text-primary"
            return (
              <motion.div
                key={index}
                className="flex items-center gap-4 pb-4 border-b border-border last:border-b-0 hover:bg-muted/30 px-2 py-1 rounded transition-smooth group cursor-pointer"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                whileHover={{ x: 4 }}
              >
                <Icon className={`${colorClass} flex-shrink-0 group-hover:scale-110 transition-smooth`} size={20} />
                <div className="flex-1">
                  <p className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                    {log.automation}
                  </p>
                  <p className="text-sm text-muted-foreground">{log.action}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{log.amount}</p>
                  <p className="text-xs text-muted-foreground">{log.time}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </Card>
    </motion.div>
  )
}
