"use client"

import { useState } from "react"
import Navbar from "@/components/navbar"
import ToolsGrid from "@/components/tools/grid"
import ToolsFilter from "@/components/tools/filter"
import { motion } from "framer-motion"

export default function Tools() {
  const [selectedCategory, setSelectedCategory] = useState("all")

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-foreground mb-2">Automation Tools</h1>
          <p className="text-muted-foreground">Choose from 50+ powerful automation tools for your Web3 workflows</p>
        </motion.div>
        <ToolsFilter selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />
        <ToolsGrid selectedCategory={selectedCategory} />
      </motion.div>
    </main>
  )
}
