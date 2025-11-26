"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, Users, TrendingUp } from "lucide-react"
import { motion } from "framer-motion"

interface Template {
  category: string
  name: string
  description: string
  rating: number
  uses: number
  trending: boolean
}

const templates: Template[] = [
  {
    category: "dao",
    name: "Weekly DAO Payroll",
    description: "Automatically distribute weekly payments to DAO members",
    rating: 4.8,
    uses: 234,
    trending: true,
  },
  {
    category: "refi",
    name: "Carbon Credit Donation",
    description: "Route donations to carbon offset projects",
    rating: 4.9,
    uses: 156,
    trending: true,
  },
  {
    category: "nft",
    name: "Community NFT Airdrop",
    description: "Launch NFT rewards for community members",
    rating: 4.7,
    uses: 89,
    trending: false,
  },
  {
    category: "defi",
    name: "Price Alert & Swap",
    description: "Swap tokens when price hits target",
    rating: 4.6,
    uses: 412,
    trending: true,
  },
  {
    category: "dao",
    name: "Treasury Management",
    description: "Split and manage DAO treasury funds",
    rating: 4.8,
    uses: 178,
    trending: false,
  },
  {
    category: "refi",
    name: "Impact Tracking Dashboard",
    description: "Track ReFi donations and create proof NFTs",
    rating: 4.9,
    uses: 203,
    trending: true,
  },
]

interface TemplatesGridProps {
  selectedCategory: string
}

export default function TemplatesGrid({ selectedCategory }: TemplatesGridProps) {
  const filteredTemplates =
    selectedCategory === "all" ? templates : templates.filter((t) => t.category === selectedCategory)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredTemplates.map((template, index) => (
        <motion.div
          key={`${template.category}-${template.name}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: (index % 3) * 0.1, duration: 0.5 }}
          layout
        >
          <Card className="p-6 glass hover:glass-dark transition-smooth hover-lift group cursor-pointer border-border/50 relative overflow-hidden h-full flex flex-col">
            {template.trending && (
              <div className="absolute top-4 right-4 px-3 py-1 bg-destructive/20 text-destructive text-xs font-semibold rounded-full flex items-center gap-1">
                <TrendingUp size={12} /> Trending
              </div>
            )}

            <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-white transition-smooth">
              {template.name}
            </h3>
            <p className="text-muted-foreground text-sm mb-4 group-hover:text-white/80 transition-smooth flex-1">
              {template.description}
            </p>

            <div className="flex items-center justify-between mb-4 text-sm">
              <motion.div className="flex items-center gap-1 text-accent" whileHover={{ scale: 1.1 }}>
                <Star size={16} fill="currentColor" />
                <span className="font-semibold">{template.rating}</span>
              </motion.div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users size={16} />
                <span>{template.uses} uses</span>
              </div>
            </div>

            <div className="flex gap-2">
              <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button size="sm" className="w-full bg-primary hover:bg-primary/90">
                  Clone
                </Button>
              </motion.div>
              <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button size="sm" variant="outline" className="w-full bg-transparent hover:text-white">
                  Preview
                </Button>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
