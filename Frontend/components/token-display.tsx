/**
 * Token Display Component - Shows user's token portfolio
 */

"use client"

import { useEffect, useState } from "react"
import { useAccount, useBalance } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, DollarSign, Wallet } from "lucide-react"
import { formatEther } from "viem"

interface Token {
  symbol: string
  name: string
  balance: string
  price?: number
  address: string
}

export function TokenDisplay() {
  const { address, isConnected } = useAccount()
  const { data: balanceData, isLoading: balanceLoading } = useBalance({ address })
  const [tokens, setTokens] = useState<Token[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (balanceData && isConnected) {
      // Create a token entry for CELO balance
      const celoToken: Token = {
        symbol: balanceData.symbol,
        name: "Celo",
        balance: formatEther(balanceData.value),
        price: 0.5, // You could fetch real price from an API
        address: "0x0000000000000000000000000000000000000000"
      }
      setTokens([celoToken])
      setTotalValue(parseFloat(celoToken.balance) * (celoToken.price || 0))
      setLoading(false)
    }
  }, [balanceData, isConnected])

  if (!mounted) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!isConnected) {
    return (
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6 text-center flex flex-col items-center gap-4">
          <Wallet className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Connect your wallet to see your tokens</p>
          <ConnectButton />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Your Portfolio</CardTitle>
            <CardDescription>Your token holdings and balance</CardDescription>
          </div>
          <motion.div
            className="text-right"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-2xl font-bold text-foreground">${totalValue.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Total Value</p>
          </motion.div>
        </div>
      </CardHeader>

      <CardContent>
        {loading || balanceLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No tokens found in your wallet
          </p>
        ) : (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {tokens.map((token, index) => {
              const balance = parseFloat(token.balance)
              const value = token.price ? balance * token.price : 0
              const isPositive = value > 0

              return (
                <motion.div
                  key={token.address}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{token.symbol}</p>
                      <Badge variant="outline" className="text-xs">
                        {token.name}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {balance.toFixed(4)} {token.symbol}
                    </p>
                  </div>

                  <div className="text-right">
                    {token.price && (
                      <>
                        <p className="font-semibold">${token.price.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          ${value.toFixed(2)}
                        </p>
                      </>
                    )}
                  </div>

                  {token.price && isPositive && (
                    <div className="ml-2 text-success">
                      <TrendingUp size={18} />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
