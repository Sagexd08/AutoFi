"use client"

import { Card } from "@/components/ui/card"
import { Zap, Coins, Gift, Users, Leaf, Bell } from "lucide-react"
import { motion } from "framer-motion"

interface Feature {
  icon: typeof Zap
  title: string
  description: string
  color: string
  gradient: string
}

const features: Feature[] = [
  {
    icon: Zap,
    title: "Auto-Payments",
    description: "Schedule recurring payments and salary distributions on Celo",
    color: "text-primary",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    icon: Coins,
    title: "Smart Swaps",
    description: "Automate token swaps based on price triggers and conditions",
    color: "text-secondary",
    gradient: "from-secondary/20 to-secondary/5",
  },
  {
    icon: Gift,
    title: "NFT Rewards",
    description: "Automatically send NFTs and create dynamic badge systems",
    color: "text-accent",
    gradient: "from-accent/20 to-accent/5",
  },
  {
    icon: Users,
    title: "DAO Tools",
    description: "Manage payroll, treasury, and proposals for DAOs",
    color: "text-success",
    gradient: "from-success/20 to-success/5",
  },
  {
    icon: Leaf,
    title: "ReFi Impact",
    description: "Track donations and create proof-of-impact NFTs",
    color: "text-primary",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    description: "Get notified via Telegram, Discord, Email, or Webhooks",
    color: "text-destructive",
    gradient: "from-destructive/20 to-destructive/5",
  },
]

export default function Features() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  }

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        className="text-center mb-20"
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6"
          whileHover={{ scale: 1.05 }}
        >
          <Zap size={16} className="text-primary" />
          <span className="text-sm font-semibold text-primary">Features</span>
        </motion.div>
        <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 tracking-tight hover:text-white transition-smooth">
          Powerful Automation Tools
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium hover:text-white/80 transition-smooth">
          Everything you need to automate your Web3 workflows on Celo
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <motion.div key={index} variants={itemVariants}>
              <Card
                className={`p-7 glass hover:glass-dark transition-smooth hover-lift group cursor-pointer border-border/40 h-full bg-gradient-to-br ${feature.gradient} backdrop-blur-sm`}
              >
                <motion.div
                  className={`w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5 group-hover:from-primary/30 group-hover:to-primary/10 transition-smooth ${feature.color}`}
                  whileHover={{ scale: 1.15, rotate: 8 }}
                >
                  <Icon size={28} className="stroke-[1.5]" />
                </motion.div>
                <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-white transition-smooth">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground group-hover:text-white/80 transition-smooth font-medium leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}
