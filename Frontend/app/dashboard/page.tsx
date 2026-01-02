"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import Navbar from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { AutomationCard } from "@/components/automation-card"

export default function Dashboard() {
  const router = useRouter()

  // Optimize selector with useShallow
  const {
    automations,
    loadAutomations,
    pauseAutomation,
    resumeAutomation,
    deleteAutomation
  } = useStore(
    useShallow((state) => ({
      automations: state.automations,
      loadAutomations: state.loadAutomations,
      pauseAutomation: state.pauseAutomation,
      resumeAutomation: state.resumeAutomation,
      deleteAutomation: state.deleteAutomation,
    }))
  )

  useEffect(() => {
    loadAutomations()
  }, [loadAutomations])

  // Memoize handlers to prevent re-creation on every render
  const handlePause = useCallback((id: string) => pauseAutomation(id), [pauseAutomation])
  const handleResume = useCallback((id: string) => resumeAutomation(id), [resumeAutomation])
  const handleDelete = useCallback((id: string) => deleteAutomation(id), [deleteAutomation])

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button onClick={() => router.push('/create')}>
            <Plus className="mr-2 h-4 w-4" />
            New Automation
          </Button>
        </div>

        <div className="grid gap-6">
          {automations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No automations found</p>
                <Button onClick={() => router.push('/create')}>Create your first automation</Button>
              </CardContent>
            </Card>
          ) : (
            automations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onPause={handlePause}
                onResume={handleResume}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </main>
  )
}
