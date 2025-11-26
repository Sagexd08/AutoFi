/**
 * Token Display Component - Shows user's token portfolio
 */

"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@/hooks/use-wallet"
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
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react"

export function TokenDisplay() {
  const { wallet } = useWallet()
  const [totalValue, setTotalValue] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (wallet.tokens && wallet.tokens.length > 0) {
      const total = wallet.tokens.reduce((sum, token) => {
        if (token.price) {
          return sum + parseFloat(token.balance) * token.price
        }
        return sum
      }, 0)
      setTotalValue(total)
      setLoading(false)
    }
  }, [wallet.tokens])

  if (!wallet.isConnected) {
    return (
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Connect your wallet to see your tokens</p>
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
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : wallet.tokens.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No tokens found in your wallet
          </p>
        ) : (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {wallet.tokens.map((token, index) => {
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
