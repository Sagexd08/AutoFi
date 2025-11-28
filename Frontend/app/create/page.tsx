"use client"

import { useState, useEffect } from "react"
import Navbar from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, AlertCircle, Wallet } from "lucide-react"
import axios from "axios"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"

export default function CreateAutomation() {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<any>(null)
  const [error, setError] = useState("")
  const [executionStatus, setExecutionStatus] = useState("")
  const [mounted, setMounted] = useState(false)
  const { address, chainId, isConnected } = useAccount()

  useEffect(() => {
    setMounted(true)
  }, [])

  const generatePlan = async () => {
    if (!prompt) return
    setLoading(true)
    setError("")
    setPlan(null)
    
    try {
      const response = await axios.post("http://localhost:3000/api/ai/plan", {
        prompt,
        walletAddress: address || "0x0000000000000000000000000000000000000000",
      })
      
      if (response.data.success) {
        setPlan(response.data.data.plan)
      } else {
        setError(response.data.error || "Failed to generate plan")
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const executePlan = async () => {
    if (!plan) return
    setLoading(true)
    
    try {
      const response = await axios.post("http://localhost:3000/api/ai/execute", {
        plan,
        chainId: chainId || 42220
      })
      
      if (response.data.success) {
        setExecutionStatus("queued")
        alert(`Plan execution queued! Job ID: ${response.data.jobId}`)
      } else {
        setError(response.data.error || "Failed to execute plan")
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  // Show loading skeleton before mount to avoid hydration issues
  if (!mounted) {
    return (
      <main className="min-h-screen bg-background">
        <div className="h-16 bg-muted/20 animate-pulse" />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="h-8 w-48 bg-muted/20 animate-pulse rounded mb-6" />
          <div className="h-64 bg-muted/20 animate-pulse rounded" />
        </div>
      </main>
    )
  }

  // Show connect wallet prompt if not connected
  if (!isConnected) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Create Automation</h1>
          <Card className="mb-8">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Connect your wallet to create automations and interact with the Celo blockchain.
              </p>
              <ConnectButton />
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Create Automation</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Describe your intent</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="e.g. Swap 10 CELO for cUSD and deposit into Moola Market"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px] mb-4"
            />
            <Button onClick={generatePlan} disabled={loading || !prompt}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate Plan
            </Button>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-8 flex items-center">
            <AlertCircle className="mr-2 h-5 w-5" />
            {error}
          </div>
        )}

        {plan && (
          <Card>
            <CardHeader>
              <CardTitle>Execution Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-md mb-4 overflow-auto max-h-[400px]">
                <pre className="text-sm">{JSON.stringify(plan, null, 2)}</pre>
              </div>
              
              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={() => setPlan(null)}>Cancel</Button>
                <Button onClick={executePlan} disabled={loading || executionStatus === 'queued'}>
                  {executionStatus === 'queued' ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Queued
                    </>
                  ) : (
                    "Approve & Execute"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
