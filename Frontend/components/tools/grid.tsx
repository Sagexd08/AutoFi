"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Zap, Coins, Gift, Users, Leaf, Bell, Send, Shuffle, Layers, BarChart3, Heart, Webhook } from "lucide-react"
import { motion } from "framer-motion"

interface Tool {
  category: string
  icon: typeof Zap
  name: string
  description: string
  color: string
}

const tools: Tool[] = [
  {
    category: "transaction",
    icon: Send,
    name: "Auto-Pay",
    description: "Schedule recurring payments and salary distributions",
    color: "text-primary",
  },
  {
    category: "transaction",
    icon: Shuffle,
    name: "Payment Splitter",
    description: "Automatically split payments among multiple recipients",
    color: "text-secondary",
  },
  {
    category: "transaction",
    icon: Zap,
    name: "Conditional Send",
    description: "Send payments based on custom conditions and triggers",
    color: "text-accent",
  },
  {
    category: "transaction",
    icon: Layers,
    name: "Batch Transfers",
    description: "Execute multiple transfers in a single transaction",
    color: "text-success",
  },
  {
    category: "swap",
    icon: Coins,
    name: "Auto Swap",
    description: "Automatically swap tokens on a schedule",
    color: "text-primary",
  },
  {
    category: "swap",
    icon: BarChart3,
    name: "Price-Triggered Swap",
    description: "Swap when price reaches your target threshold",
    color: "text-secondary",
  },
  {
    category: "nft",
    icon: Gift,
    name: "Auto NFT Sender",
    description: "Automatically send NFTs to recipients",
    color: "text-accent",
  },
  {
    category: "nft",
    icon: Layers,
    name: "NFT Airdrop",
    description: "Launch mass NFT airdrops to communities",
    color: "text-success",
  },
  {
    category: "dao",
    icon: Users,
    name: "Payroll Manager",
    description: "Manage DAO member payments and distributions",
    color: "text-primary",
  },
  {
    category: "dao",
    icon: BarChart3,
    name: "Treasury Splitter",
    description: "Automatically split treasury funds",
    color: "text-secondary",
  },
  {
    category: "refi",
    icon: Leaf,
    name: "Auto Donation Router",
    description: "Route donations to multiple ReFi projects",
    color: "text-accent",
  },
  {
    category: "refi",
    icon: Heart,
    name: "Proof-of-Donation NFT",
    description: "Create NFTs as proof of donations",
    color: "text-success",
  },
  {
    category: "alerts",
    icon: Bell,
    name: "Telegram Alerts",
    description: "Get notifications via Telegram",
    color: "text-primary",
  },
  {
    category: "alerts",
    icon: Webhook,
    name: "Webhook Triggers",
    description: "Trigger external APIs and webhooks",
    color: "text-secondary",
  },
]

interface ToolsGridProps {
  selectedCategory: string
}

export default function ToolsGrid({ selectedCategory }: ToolsGridProps) {
  const filteredTools = selectedCategory === "all" ? tools : tools.filter((tool) => tool.category === selectedCategory)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredTools.map((tool, index) => {
        const Icon = tool.icon
        return (
          <motion.div
            key={`${tool.category}-${tool.name}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (index % 3) * 0.1, duration: 0.5 }}
            layout
          >
            <Card className="p-6 glass hover:glass-dark transition-smooth hover-lift group cursor-pointer border-border/50 h-full flex flex-col">
              <motion.div
                className={`w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-smooth ${tool.color}`}
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <Icon size={24} className="group-hover:scale-110 transition-smooth" />
              </motion.div>
              <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-smooth">
                {tool.name}
              </h3>
              <p className="text-muted-foreground text-sm mb-4 group-hover:text-foreground/80 transition-smooth flex-1">
                {tool.description}
              </p>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="sm"
                  className="w-full bg-primary hover:bg-primary/90 group-hover:translate-y-[-2px] transition-smooth"
                >
                  Activate
                </Button>
              </motion.div>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}
