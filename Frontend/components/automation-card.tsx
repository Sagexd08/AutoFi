"use client"

import { memo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Play, Pause, Trash2, ExternalLink } from "lucide-react"
import { Automation } from "@/lib/store"

interface AutomationCardProps {
  automation: Automation
  onPause: (id: string) => void
  onResume: (id: string) => void
  onDelete: (id: string) => void
}

export const AutomationCard = memo(function AutomationCard({
  automation,
  onPause,
  onResume,
  onDelete,
}: AutomationCardProps) {
  const router = useRouter()

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
            <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/${automation.id}`)}>
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
