/**
 * Transaction Builder Component
 * Allows users to create and send blockchain transactions
 */

"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useStore } from "@/lib/store"
import { blockchainIntegration } from "@/lib/blockchain-integration"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { Send, Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react"

const transactionSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  value: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount"),
  token: z.enum(["CELO", "cUSD", "cEUR", "cREAL"]),
  gasLimit: z.string().optional(),
  gasPrice: z.string().optional(),
})

type TransactionFormData = z.infer<typeof transactionSchema>

interface TransactionBuilderProps {
  onSuccess?: (txHash: string) => void
}

export function TransactionBuilder({ onSuccess }: TransactionBuilderProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [gasEstimate, setGasEstimate] = useState<{ gasLimit: string; gasPrice: string } | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'failed' | null>(null)
  const { wallet } = useStore()

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      to: "",
      value: "",
      token: "CELO",
      gasLimit: "",
      gasPrice: "",
    },
  })

  const estimateGas = async (data: TransactionFormData) => {
    try {
      setLoading(true)
      const estimate = await blockchainIntegration.estimateGas({
        to: data.to,
        value: data.value,
        data: undefined
      })
      setGasEstimate(estimate)
      form.setValue('gasLimit', estimate.gasLimit)
      form.setValue('gasPrice', estimate.gasPrice)
      console.log('Gas estimate:', estimate)
    } catch (error) {
      console.error('Failed to estimate gas:', error)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: TransactionFormData) => {
    if (!wallet.address) return

    setLoading(true)
    setTxStatus('pending')
    try {
      const hash = await blockchainIntegration.sendTransaction(
        data.to,
        data.value,
        undefined
      )
      
      setTxHash(hash)
      setTxStatus('success')
      onSuccess?.(hash)
      
      // Close dialog after success
      setTimeout(() => {
        setOpen(false)
        form.reset()
        setTxHash(null)
        setTxStatus(null)
        setGasEstimate(null)
      }, 2000)
    } catch (error) {
      console.error('Transaction failed:', error)
      setTxStatus('failed')
    } finally {
      setLoading(false)
    }
  }

  const getTokenAddress = (token: string) => {
    const config = blockchainIntegration.getConfig()
    return config.tokens[token as keyof typeof config.tokens]
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <motion.button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth font-medium"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Send size={16} />
        Send Transaction
      </motion.button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Transaction</DialogTitle>
          <DialogDescription>
            Send tokens to another address on Celo
          </DialogDescription>
        </DialogHeader>

        {txStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Card className={txStatus === 'success' ? 'border-success' : txStatus === 'failed' ? 'border-destructive' : 'border-primary'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {txStatus === 'success' ? (
                    <CheckCircle className="text-success" size={20} />
                  ) : txStatus === 'failed' ? (
                    <AlertCircle className="text-destructive" size={20} />
                  ) : (
                    <Loader2 className="text-primary animate-spin" size={20} />
                  )}
                  <span className="font-medium">
                    {txStatus === 'success' ? 'Transaction Successful' : 
                     txStatus === 'failed' ? 'Transaction Failed' : 
                     'Transaction Pending'}
                  </span>
                </div>
                {txHash && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Hash:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {txHash.slice(0, 10)}...{txHash.slice(-8)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(`https://celoscan.io/tx/${txHash}`, '_blank')}
                    >
                      <ExternalLink size={14} />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Token Selection */}
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Token</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recipient Address */}
            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Address</FormLabel>
                  <FormControl>
                    <Input placeholder="0x..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input placeholder="0.00" type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Gas Settings */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gasLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gas Limit</FormLabel>
                    <FormControl>
                      <Input placeholder="21000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gasPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gas Price (gwei)</FormLabel>
                    <FormControl>
                      <Input placeholder="5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Gas Estimate Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => estimateGas(form.getValues())}
              disabled={!form.watch('to') || !form.watch('value')}
            >
              Estimate Gas
            </Button>

            {gasEstimate && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-muted rounded-lg space-y-3"
              >
                <div className="text-sm font-semibold">Gas Estimation Details</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Gas Limit:</span>
                    <span className="font-mono font-semibold">{gasEstimate.gasLimit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gas Price:</span>
                    <span className="font-mono font-semibold">{gasEstimate.gasPrice} gwei</span>
                  </div>
                  {gasEstimate.estimatedCost && (
                    <div className="flex justify-between">
                      <span>Estimated Cost:</span>
                      <span className="font-mono font-semibold">{gasEstimate.estimatedCost} ETH</span>
                    </div>
                  )}
                  {gasEstimate.breakdown && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground">Price Breakdown:</div>
                      <div className="flex justify-between text-xs">
                        <span>Safe:</span>
                        <span className="font-mono">{gasEstimate.breakdown.safe.gasPrice} gwei</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Fast:</span>
                        <span className="font-mono">{gasEstimate.breakdown.fast.gasPrice} gwei</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Instant:</span>
                        <span className="font-mono">{gasEstimate.breakdown.instant.gasPrice} gwei</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Submit */}
            <motion.div
              className="flex gap-2 pt-4"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                disabled={loading || !wallet.isConnected}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={20} className="animate-spin" />}
                {loading ? "Sending..." : "Send Transaction"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </motion.div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
