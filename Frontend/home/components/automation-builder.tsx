/**
 * Automation Builder - Creates and manages automation workflows
 */

"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useStore } from "@/lib/store"
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
import { motion } from "framer-motion"
import { Plus, Loader2 } from "lucide-react"

const automationSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  type: z.enum(["transaction", "swap", "nft", "dao", "refi", "alerts"]),
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount"),
  frequency: z.enum(["once", "daily", "weekly", "monthly"]),
})

type AutomationFormData = z.infer<typeof automationSchema>

interface AutomationBuilderProps {
  onSuccess?: () => void
}

const automationTypes = [
  { value: "transaction", label: "Payment Transfer", description: "Send CELO or tokens" },
  { value: "swap", label: "Token Swap", description: "Exchange tokens on DEX" },
  { value: "nft", label: "NFT Operation", description: "Mint or transfer NFTs" },
  { value: "dao", label: "DAO Governance", description: "Vote or propose" },
  { value: "refi", label: "DeFi Strategy", description: "Lending and borrowing" },
  { value: "alerts", label: "Price Alerts", description: "Monitor prices" },
]

export function AutomationBuilder({ onSuccess }: AutomationBuilderProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { addAutomation } = useStore()

  const form = useForm<AutomationFormData>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: "",
      type: "transaction",
      recipientAddress: "",
      amount: "",
      frequency: "once",
    },
  })

  async function onSubmit(data: AutomationFormData) {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const newAutomation = {
        id: Date.now().toString(),
        name: data.name,
        type: data.type as any,
        status: "active" as const,
        progress: 0,
        nextRun:
          data.frequency === "once" ? "Manual trigger" : `Every ${data.frequency}`,
        createdAt: new Date(),
      }

      addAutomation(newAutomation)
      form.reset()
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      console.error("[AutomationBuilder] Error:", error)
      form.setError("root", {
        message: "Failed to create automation",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <motion.button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth font-medium"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Plus size={20} />
        Create Automation
      </motion.button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Automation</DialogTitle>
          <DialogDescription>
            Set up a new automation workflow for your Celo account
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Automation Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Weekly Payroll" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Automation Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {automationTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {automationTypes.find((t) => t.value === form.watch("type"))
                      ?.description}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recipient Address */}
            <FormField
              control={form.control}
              name="recipientAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Address</FormLabel>
                  <FormControl>
                    <Input placeholder="0x..." {...field} />
                  </FormControl>
                  <FormDescription>The destination wallet address</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (CELO)</FormLabel>
                  <FormControl>
                    <Input placeholder="0.00" type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Frequency */}
            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="once">One-time</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <motion.div
              className="flex gap-2 pt-4"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={20} className="animate-spin" />}
                {loading ? "Creating..." : "Create Automation"}
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
