"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

const categories = [
  { id: "all", label: "All Tools" },
  { id: "transaction", label: "Transactions" },
  { id: "swap", label: "Swaps" },
  { id: "nft", label: "NFTs" },
  { id: "dao", label: "DAO" },
  { id: "refi", label: "ReFi" },
  { id: "alerts", label: "Alerts" },
]

interface ToolsFilterProps {
  selectedCategory: string
  setSelectedCategory: (category: string) => void
}

export default function ToolsFilter({ selectedCategory, setSelectedCategory }: ToolsFilterProps) {
  return (
    <motion.div
      className="flex flex-wrap gap-2 mb-8"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {categories.map((category, index) => (
        <motion.div
          key={category.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
        >
          <Button
            onClick={() => setSelectedCategory(category.id)}
            variant={selectedCategory === category.id ? "default" : "outline"}
            className={`transition-smooth ${selectedCategory === category.id ? "bg-primary hover:bg-primary/90" : "hover:bg-muted"}`}
          >
            {category.label}
          </Button>
        </motion.div>
      ))}
    </motion.div>
  )
}
