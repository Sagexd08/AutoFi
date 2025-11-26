"use client"

import { useState } from "react"
import Navbar from "@/components/navbar"
import { TransactionBuilder } from "@/components/blockchain/transaction-builder"
import { SwapInterface } from "@/components/blockchain/swap-interface"
import { NFTMinter } from "@/components/blockchain/nft-minter"
import { DAOGovernance } from "@/components/blockchain/dao-governance"
import PromptModal from "@/components/templates/prompt-modal"
import { useStore } from "@/lib/store"
import { useWallet } from "@/hooks/use-wallet"
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { 
  Send, 
  ArrowLeftRight, 
  Image, 
  Users, 
  Zap, 
  TrendingUp,
  Activity,
  Bell,
  Sparkles
} from "lucide-react"

export default function Tools() {
  const [activeTab, setActiveTab] = useState("transactions")
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const { wallet } = useStore()
  const { wallet: walletState } = useWallet()
  const { isConnected, lastUpdate, updates } = useRealtimeUpdates()

  const tools = [
    {
      id: "transactions",
      title: "Send Transactions",
      description: "Send CELO and tokens to any address",
      icon: Send,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      id: "swaps",
      title: "Token Swaps",
      description: "Swap tokens on Celo DEXs",
      icon: ArrowLeftRight,
      color: "text-secondary",
      bgColor: "bg-secondary/10"
    },
    {
      id: "nfts",
      title: "NFT Minting",
      description: "Create and mint NFTs",
      icon: Image,
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      id: "dao",
      title: "DAO Governance",
      description: "Participate in decentralized governance",
      icon: Users,
      color: "text-success",
      bgColor: "bg-success/10"
    }
  ]

  if (!wallet.isConnected) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <motion.div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-foreground mb-4">Blockchain Tools</h1>
          <p className="text-muted-foreground mb-8">
            Connect your wallet to access powerful blockchain automation tools
          </p>
        </motion.div>
      </main>
    )
  }

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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Blockchain Tools</h1>
              <p className="text-muted-foreground">Powerful tools for Web3 automation on Celo</p>
            </div>
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Button
                  onClick={() => setIsPromptModalOpen(true)}
                  className="bg-linear-to-r from-primary to-secondary hover:opacity-90 gap-2 font-semibold rounded-lg shadow-lg shadow-primary/30"
                >
                  <Sparkles size={18} />
                  Create Automation
                </Button>
              </motion.div>
              <Badge variant={isConnected ? "default" : "secondary"}>
                <Activity size={12} className="mr-1" />
                {isConnected ? "Live" : "Offline"}
              </Badge>
              {lastUpdate && (
                <Badge variant="outline">
                  <Bell size={12} className="mr-1" />
                  {updates.length} updates
                </Badge>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tools Navigation */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Available Tools</CardTitle>
                <CardDescription>
                  Choose a tool to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {tools.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <motion.button
                      key={tool.id}
                      onClick={() => setActiveTab(tool.id)}
                      className={`w-full p-3 rounded-lg text-left transition-smooth hover:bg-muted ${
                        activeTab === tool.id ? 'bg-muted' : ''
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tool.bgColor}`}>
                          <Icon size={20} className={tool.color} />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{tool.title}</div>
                          <div className="text-xs text-muted-foreground">{tool.description}</div>
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* Tool Content */}
          <div className="lg:col-span-3 space-y-6">
            {activeTab === "transactions" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send size={20} />
                      Send Transactions
                    </CardTitle>
                    <CardDescription>
                      Send CELO and tokens to any address on Celo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TransactionBuilder />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === "swaps" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <SwapInterface />
              </motion.div>
            )}

            {activeTab === "nfts" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <NFTMinter />
              </motion.div>
            )}

            {activeTab === "dao" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <DAOGovernance />
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
      <PromptModal open={isPromptModalOpen} onOpenChange={setIsPromptModalOpen} />
    </main>
  )
}
