"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"

const categories = [
  { id: "all", label: "All Templates" },
  { id: "dao", label: "DAO" },
  { id: "refi", label: "ReFi" },
  { id: "nft", label: "NFT" },
  { id: "defi", label: "DeFi" },
]

interface TemplatesFilterProps {
  selectedCategory: string
  setSelectedCategory: (category: string) => void
}

export default function TemplatesFilter({ selectedCategory, setSelectedCategory }: TemplatesFilterProps) {
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
            className={`transition-smooth ${selectedCategory === category.id ? "bg-primary hover:bg-primary/90 " : "hover:bg-white/90 hover:text-white "}`}
          >
            {category.label}
          </Button>
        </motion.div>
      ))}
    </motion.div>
  )
}
