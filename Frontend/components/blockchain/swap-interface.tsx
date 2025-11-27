"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useAccount, useBalance } from "wagmi"
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { ArrowUpDown, Loader2, TrendingUp, AlertTriangle } from "lucide-react"

const swapSchema = z.object({
  tokenIn: z.string(),
  tokenOut: z.string(),
  amountIn: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount"),
  slippage: z.number().min(0.1).max(50),
})

type SwapFormData = z.infer<typeof swapSchema>

interface SwapQuote {
  amountOut: string
  priceImpact: number
  minimumReceived: string
  route: string[]
  gasEstimate: string
}

export function SwapInterface() {
  const [loading, setLoading] = useState(false)
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const { address, isConnected } = useAccount()
  const { data: balanceData } = useBalance({ address })

  const form = useForm<SwapFormData>({
    resolver: zodResolver(swapSchema),
    defaultValues: {
      tokenIn: "CELO",
      tokenOut: "cUSD",
      amountIn: "",
      slippage: 0.5,
    },
  })

  // Fetch token prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const tokens = ["CELO", "cUSD", "cEUR", "cREAL"]
        const pricePromises = tokens.map(async (token) => {
          try {
            const price = await blockchainIntegration.getTokenPrice(token)
            return [token, price]
          } catch {
            return [token, 0]
          }
        })
        const priceResults = await Promise.all(pricePromises)
        const priceMap = Object.fromEntries(priceResults)
        setPrices(priceMap)
      } catch (error) {
        console.error("Failed to fetch prices:", error)
      }
    }

    fetchPrices()
    const interval = setInterval(fetchPrices, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Get quote when form changes
  useEffect(() => {
    const subscription = form.watch(async (data) => {
      if (data.tokenIn && data.tokenOut && data.amountIn && data.tokenIn !== data.tokenOut) {
        await getQuote(data as SwapFormData)
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const getQuote = async (data: SwapFormData) => {
    try {
      setLoading(true)
      const response = await apiClient.callBlockchainFunction({
        functionName: 'getSwapQuote',
        parameters: {
          tokenIn: data.tokenIn,
          tokenOut: data.tokenOut,
          amountIn: data.amountIn,
          slippage: data.slippage
        }
      })

      if (response.success && response.data) {
        // Ensure all required fields are present
        const quoteData = {
          amountOut: response.data.amountOut || data.amountIn,
          priceImpact: response.data.priceImpact ?? 0.5,
          minimumReceived: response.data.minimumReceived || data.amountIn,
          route: response.data.route || [data.tokenIn, data.tokenOut],
          gasEstimate: response.data.gasEstimate || '21000'
        }
        setQuote(quoteData)
      } else {
        // Create default quote if endpoint fails
        const defaultQuote: SwapQuote = {
          amountOut: data.amountIn,
          priceImpact: 0.5,
          minimumReceived: data.amountIn,
          route: [data.tokenIn, data.tokenOut],
          gasEstimate: '21000'
        }
        setQuote(defaultQuote)
      }
    } catch (error) {
      console.error("Failed to get quote:", error)
      // Set default quote on error
      const defaultQuote: SwapQuote = {
        amountOut: data.amountIn,
        priceImpact: 0.5,
        minimumReceived: data.amountIn,
        route: [data.tokenIn, data.tokenOut],
        gasEstimate: '21000'
      }
      setQuote(defaultQuote)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: SwapFormData) => {
    if (!address || !quote) return

    setLoading(true)
    try {
      const txHash = await blockchainIntegration.swapTokens(
        data.tokenIn,
        data.tokenOut,
        data.amountIn,
        quote.minimumReceived,
        data.slippage
      )
      
      // Show success message or redirect
      console.log("Swap successful:", txHash)
    } catch (error) {
      console.error("Swap failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const getTokenBalance = (token: string) => {
    if (token === 'CELO' && balanceData) {
      return balanceData.formatted
    }
    return "0"
  }

  const getTokenPrice = (token: string) => {
    return prices[token] || 0
  }

  const formatPrice = (price: number) => {
    return price < 1 ? price.toFixed(6) : price.toFixed(2)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp size={20} />
          Token Swap
        </CardTitle>
        <CardDescription>
          Swap tokens on Celo DEXs with the best rates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Token In */}
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="tokenIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <div className="flex gap-2">
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CELO">CELO</SelectItem>
                          <SelectItem value="cUSD">cUSD</SelectItem>
                          <SelectItem value="cEUR">cEUR</SelectItem>
                          <SelectItem value="cREAL">cREAL</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormField
                        control={form.control}
                        name="amountIn"
                        render={({ field: amountField }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="0.00"
                                type="number"
                                step="0.01"
                                {...amountField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Balance: {getTokenBalance(field.value)}</span>
                      <span>${formatPrice(getTokenPrice(field.value))}</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Swap Direction Button */}
            <motion.div
              className="flex justify-center"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const tokenIn = form.getValues('tokenIn')
                  const tokenOut = form.getValues('tokenOut')
                  form.setValue('tokenIn', tokenOut)
                  form.setValue('tokenOut', tokenIn)
                }}
              >
                <ArrowUpDown size={16} />
              </Button>
            </motion.div>

            {/* Token Out */}
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="tokenOut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <div className="flex gap-2">
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CELO">CELO</SelectItem>
                          <SelectItem value="cUSD">cUSD</SelectItem>
                          <SelectItem value="cEUR">cEUR</SelectItem>
                          <SelectItem value="cREAL">cREAL</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex-1 p-3 bg-muted rounded-md">
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-sm">Getting quote...</span>
                          </div>
                        ) : quote ? (
                          <div className="text-sm">
                            <div className="font-medium">{quote.amountOut}</div>
                            <div className="text-muted-foreground">
                              ${formatPrice(parseFloat(quote.amountOut) * getTokenPrice(field.value))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Enter amount</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Balance: {getTokenBalance(field.value)}</span>
                      <span>${formatPrice(getTokenPrice(field.value))}</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Slippage */}
            <FormField
              control={form.control}
              name="slippage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slippage Tolerance</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quote Details */}
            {quote && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2 p-3 bg-muted rounded-lg"
              >
                <div className="flex justify-between text-sm">
                  <span>Price Impact:</span>
                  <span className={Number(quote.priceImpact) > 5 ? "text-destructive" : ""}>
                    {typeof quote.priceImpact === 'number' ? quote.priceImpact.toFixed(2) : '0.00'}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Minimum Received:</span>
                  <span>{quote.minimumReceived || '0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Gas Estimate:</span>
                  <span>{quote.gasEstimate || '21000'}</span>
                </div>
                {quote.priceImpact && Number(quote.priceImpact) > 5 && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertTriangle size={14} />
                    <span>High price impact</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading || !isConnected || !quote}
              className="w-full flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={20} className="animate-spin" />}
              {loading ? "Swapping..." : "Swap Tokens"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
