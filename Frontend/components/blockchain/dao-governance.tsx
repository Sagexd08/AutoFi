/**
 * DAO Governance Component
 * Allows users to participate in DAO governance
 */

"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { blockchainIntegration } from "@/lib/blockchain-integration"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { motion } from "framer-motion"
import { 
  Users, 
  Vote, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock,
  ExternalLink,
  Loader2
} from "lucide-react"

interface Proposal {
  id: string
  title: string
  description: string
  proposer: string
  startTime: number
  endTime: number
  forVotes: number
  againstVotes: number
  status: 'active' | 'passed' | 'failed' | 'executed'
  actions: Array<{
    target: string
    value: string
    signature: string
    calldata: string
  }>
}

interface CreateProposalData {
  title: string
  description: string
  actions: Array<{
    target: string
    value: string
    signature: string
    calldata: string
  }>
}

export function DAOGovernance() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [voting, setVoting] = useState<string | null>(null)
  const { address, isConnected } = useAccount()

  // Load proposals
  useEffect(() => {
    loadProposals()
  }, [])

  const loadProposals = async () => {
    setLoading(true)
    try {
      const response = await apiClient.callBlockchainFunction({
        functionName: 'getProposals',
        parameters: {}
      })
      if (response.success && response.data) {
        // Ensure data is an array
        const proposalsData = Array.isArray(response.data) ? response.data : []
        setProposals(proposalsData)
      } else {
        setProposals([])
      }
    } catch (error) {
      console.error("Failed to load proposals:", error)
      setProposals([])
    } finally {
      setLoading(false)
    }
  }

  const createProposal = async (data: CreateProposalData) => {
    if (!address) return

    setLoading(true)
    try {
      const txHash = await blockchainIntegration.createProposal(
        data.title,
        data.description,
        data.actions
      )
      console.log("Proposal created:", txHash)
      setCreateOpen(false)
      loadProposals()
    } catch (error) {
      console.error("Failed to create proposal:", error)
    } finally {
      setLoading(false)
    }
  }

  const voteOnProposal = async (proposalId: string, support: boolean) => {
    if (!address) return

    setVoting(proposalId)
    try {
      const txHash = await blockchainIntegration.voteOnProposal(
        proposalId,
        support,
        "Voting via Celo Automator"
      )
      console.log("Vote cast:", txHash)
      loadProposals()
    } catch (error) {
      console.error("Failed to vote:", error)
    } finally {
      setVoting(null)
    }
  }

  const executeProposal = async (proposalId: string) => {
    if (!address) return

    setLoading(true)
    try {
      const txHash = await blockchainIntegration.executeProposal(proposalId)
      console.log("Proposal executed:", txHash)
      loadProposals()
    } catch (error) {
      console.error("Failed to execute proposal:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: Proposal['status']) => {
    switch (status) {
      case 'active': return 'bg-primary'
      case 'passed': return 'bg-success'
      case 'failed': return 'bg-destructive'
      case 'executed': return 'bg-muted'
      default: return 'bg-muted'
    }
  }

  const getStatusIcon = (status: Proposal['status']) => {
    switch (status) {
      case 'active': return <Clock size={16} />
      case 'passed': return <CheckCircle size={16} />
      case 'failed': return <XCircle size={16} />
      case 'executed': return <CheckCircle size={16} />
      default: return <Clock size={16} />
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getVotePercentage = (proposal: Proposal) => {
    const total = proposal.forVotes + proposal.againstVotes
    if (total === 0) return 0
    return (proposal.forVotes / total) * 100
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users size={24} />
            DAO Governance
          </h2>
          <p className="text-muted-foreground">
            Participate in decentralized governance
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={!isConnected}
        >
          <Plus size={16} className="mr-2" />
          Create Proposal
        </Button>
      </div>

      {/* Proposals List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : !Array.isArray(proposals) || proposals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No proposals found</p>
            </CardContent>
          </Card>
        ) : (
          proposals.map((proposal) => (
            <motion.div
              key={proposal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-lg">{proposal.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {proposal.description}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(proposal.status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(proposal.status)}
                        {proposal.status}
                      </div>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Voting Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>For</span>
                          <span>{proposal.forVotes}</span>
                        </div>
                        <Progress value={getVotePercentage(proposal)} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Against</span>
                          <span>{proposal.againstVotes}</span>
                        </div>
                        <Progress value={100 - getVotePercentage(proposal)} className="h-2" />
                      </div>
                    </div>

                    {/* Time Info */}
                    <div className="text-sm text-muted-foreground">
                      <div>Start: {formatTime(proposal.startTime)}</div>
                      <div>End: {formatTime(proposal.endTime)}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {proposal.status === 'active' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => voteOnProposal(proposal.id, true)}
                            disabled={voting === proposal.id}
                          >
                            {voting === proposal.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle size={14} />
                            )}
                            <span className="ml-1">Vote For</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => voteOnProposal(proposal.id, false)}
                            disabled={voting === proposal.id}
                          >
                            <XCircle size={14} />
                            <span className="ml-1">Vote Against</span>
                          </Button>
                        </>
                      )}
                      {proposal.status === 'passed' && (
                        <Button
                          size="sm"
                          onClick={() => executeProposal(proposal.id)}
                          disabled={loading}
                        >
                          Execute Proposal
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`https://celoscan.io/address/${proposal.id}`, '_blank')}
                      >
                        <ExternalLink size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Proposal Dialog */}
      <CreateProposalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={createProposal}
        loading={loading}
      />
    </div>
  )
}

function CreateProposalDialog({
  open,
  onOpenChange,
  onSubmit,
  loading
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateProposalData) => void
  loading: boolean
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [actions, setActions] = useState<Array<{
    target: string
    value: string
    signature: string
    calldata: string
  }>>([])

  const handleSubmit = () => {
    onSubmit({
      title,
      description,
      actions
    })
    setTitle('')
    setDescription('')
    setActions([])
  }

  const addAction = () => {
    setActions([...actions, {
      target: '',
      value: '',
      signature: '',
      calldata: ''
    }])
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const updateAction = (index: number, field: string, value: string) => {
    const updated = [...actions]
    updated[index] = { ...updated[index], [field]: value }
    setActions(updated)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Proposal</DialogTitle>
          <DialogDescription>
            Create a new governance proposal for the DAO
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Proposal title"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your proposal..."
              rows={4}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Actions</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAction}
              >
                <Plus size={14} className="mr-1" />
                Add Action
              </Button>
            </div>

            {actions.map((action, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <Input
                  placeholder="Target Address"
                  value={action.target}
                  onChange={(e) => updateAction(index, 'target', e.target.value)}
                />
                <Input
                  placeholder="Value (ETH)"
                  value={action.value}
                  onChange={(e) => updateAction(index, 'value', e.target.value)}
                />
                <Input
                  placeholder="Function Signature"
                  value={action.signature}
                  onChange={(e) => updateAction(index, 'signature', e.target.value)}
                />
                <Input
                  placeholder="Calldata"
                  value={action.calldata}
                  onChange={(e) => updateAction(index, 'calldata', e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeAction(index)}
                  className="col-span-2"
                >
                  Remove Action
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={loading || !title || !description}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Proposal'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
