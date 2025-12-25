"use client"

import { useEffect, memo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import Navbar from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Play, Pause, Trash2, ExternalLink } from "lucide-react"
import { type Automation } from "@/lib/store"

// Memoized Automation Item Component to prevent unnecessary re-renders
const AutomationItem = memo(function AutomationItem({
  automation,
  onPause,
  onResume,
  onDelete,
  onViewDetails
}: {
  automation: Automation
  onPause: (id: string) => void
  onResume: (id: string) => void
  onDelete: (id: string) => void
  onViewDetails: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">{automation.name}</CardTitle>
        <Badge variant={automation.status === 'active' ? 'default' : 'secondary'}>
          {automation.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-muted-foreground">
            Type: <span className="capitalize">{automation.type}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onViewDetails(automation.id)}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            {automation.status === 'active' ? (
              <Button variant="outline" size="sm" onClick={() => onPause(automation.id)}>
                <Pause className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => onResume(automation.id)}>
                <Play className="h-4 w-4" />
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => onDelete(automation.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export default function Dashboard() {
  const router = useRouter()

  // OPTIMIZATION: Use selectors to prevent unnecessary re-renders
  // Previously: const { automations, ... } = useStore() caused re-renders on ANY store change
  const automations = useStore((state) => state.automations)
  const loadAutomations = useStore((state) => state.loadAutomations)
  const pauseAutomation = useStore((state) => state.pauseAutomation)
  const resumeAutomation = useStore((state) => state.resumeAutomation)
  const deleteAutomation = useStore((state) => state.deleteAutomation)

  useEffect(() => {
    loadAutomations()
  }, [loadAutomations])

  const handleViewDetails = useCallback((id: string) => {
    router.push(`/dashboard/${id}`)
  }, [router])

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
              <AutomationItem
                key={automation.id}
                automation={automation}
                onPause={pauseAutomation}
                onResume={resumeAutomation}
                onDelete={deleteAutomation}
                onViewDetails={handleViewDetails}
              />
            ))
          )}
        </div>
      </div>
    </main>
  )
}
