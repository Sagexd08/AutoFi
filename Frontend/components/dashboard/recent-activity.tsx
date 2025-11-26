"use client"

import { Card } from "@/components/ui/card"
import { CheckCircle, AlertCircle, Clock } from "lucide-react"
import { motion } from "framer-motion"

interface Activity {
  type: "success" | "alert" | "pending"
  title: string
  description: string
  time: string
  icon: typeof CheckCircle
}

const activities: Activity[] = [
  {
    type: "success",
    title: "Payment Sent",
    description: "Weekly payroll distributed to 5 team members",
    time: "2 hours ago",
    icon: CheckCircle,
  },
  {
    type: "alert",
    title: "Price Alert Triggered",
    description: "CELO/USD reached $2.50 threshold",
    time: "4 hours ago",
    icon: AlertCircle,
  },
  {
    type: "pending",
    title: "NFT Airdrop Scheduled",
    description: "Airdrop campaign queued for 100 recipients",
    time: "1 day ago",
    icon: Clock,
  },
]

export default function RecentActivity() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}>
      <h2 className="text-2xl font-bold text-foreground mb-4">Recent Activity</h2>
      <Card className="p-6 glass border-border/50">
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const Icon = activity.icon
            const colorClass =
              activity.type === "success"
                ? "text-success"
                : activity.type === "alert"
                  ? "text-destructive"
                  : "text-primary"
            return (
              <motion.div
                key={index}
                className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-b-0 hover:bg-muted/30 px-2 py-1 rounded transition-smooth group cursor-pointer"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                whileHover={{ x: 4 }}
              >
                <Icon
                  className={`${colorClass} flex-shrink-0 mt-1 group-hover:scale-110 transition-smooth`}
                  size={20}
                />
                <div className="flex-1">
                  <p className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                    {activity.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
              </motion.div>
            )
          })}
        </div>
      </Card>
    </motion.div>
  )
}
