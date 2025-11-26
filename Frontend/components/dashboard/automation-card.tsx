"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Pause, Play } from "lucide-react"
import { motion } from "framer-motion"
import type { Automation } from "@/lib/store"

interface AutomationCardProps {
  automation: Automation
  onPause: (id: string) => void
  onResume: (id: string) => void
  onViewDetails: (id: string) => void
  delay?: number
}

export function AutomationCard({ automation, onPause, onResume, onViewDetails, delay = 0 }: AutomationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
    >
      <Card className="p-6 glass hover:glass-dark transition-smooth hover-lift group cursor-pointer border-border/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-foreground group-hover:text-primary transition-smooth">{automation.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">{automation.type}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-smooth ${
              automation.status === "active"
                ? "bg-success/20 text-success"
                : automation.status === "paused"
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/20 text-primary"
            }`}
          >
            {automation.status.charAt(0).toUpperCase() + automation.status.slice(1)}
          </span>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="text-sm font-semibold text-foreground">{automation.progress}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${automation.progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{automation.nextRun}</p>
          <div className="flex gap-2">
            {automation.status === "active" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onPause(automation.id)}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                <Pause size={16} />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onResume(automation.id)}
                className="hover:bg-success/10 hover:text-success"
              >
                <Play size={16} />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onViewDetails(automation.id)}
              className="group-hover:translate-x-1 transition-smooth"
            >
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
