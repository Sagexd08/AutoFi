/**
 * NFT Minter Component
 * Allows users to mint and manage NFTs
 */

"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useStore } from "@/lib/store"
import { blockchainIntegration } from "@/lib/blockchain-integration"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { Image, Loader2, CheckCircle, AlertCircle, ExternalLink, Upload } from "lucide-react"

const nftSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  imageUrl: z.string().url("Invalid image URL"),
  attributes: z.array(z.object({
    trait_type: z.string(),
    value: z.string(),
  })).optional(),
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address").optional(),
})

type NFTFormData = z.infer<typeof nftSchema>

interface NFTMetadata {
  name: string
  description: string
  image: string
  attributes?: Array<{
    trait_type: string
    value: string
  }>
}

export function NFTMinter() {
  const [loading, setLoading] = useState(false)
  const [minted, setMinted] = useState<{ tokenId: string; txHash: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const { wallet } = useStore()

  const form = useForm<NFTFormData>({
    resolver: zodResolver(nftSchema),
    defaultValues: {
      name: "",
      description: "",
      imageUrl: "",
      attributes: [],
      recipient: wallet.address || "",
    },
  })

  // Update recipient when wallet changes
  useEffect(() => {
    if (wallet.address) {
      form.setValue('recipient', wallet.address)
    }
  }, [wallet.address, form])

  // Preview image
  const imageUrl = form.watch('imageUrl')
  useEffect(() => {
    if (imageUrl) {
      setPreview(imageUrl)
    }
  }, [imageUrl])

  const onSubmit = async (data: NFTFormData) => {
    if (!wallet.address) return

    setLoading(true)
    try {
      // Create metadata
      const metadata: NFTMetadata = {
        name: data.name,
        description: data.description,
        image: data.imageUrl,
        attributes: data.attributes || [],
      }

      // Mint NFT
      const txHash = await blockchainIntegration.mintNFT(
        data.recipient || wallet.address,
        data.imageUrl,
        metadata
      )

      setMinted({
        tokenId: "1", // This would come from the transaction receipt
        txHash
      })
    } catch (error) {
      console.error("NFT minting failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const addAttribute = () => {
    const currentAttributes = form.getValues('attributes') || []
    form.setValue('attributes', [
      ...currentAttributes,
      { trait_type: '', value: '' }
    ])
  }

  const removeAttribute = (index: number) => {
    const currentAttributes = form.getValues('attributes') || []
    form.setValue('attributes', currentAttributes.filter((_, i) => i !== index))
  }

  const updateAttribute = (index: number, field: 'trait_type' | 'value', value: string) => {
    const currentAttributes = form.getValues('attributes') || []
    const updated = [...currentAttributes]
    updated[index] = { ...updated[index], [field]: value }
    form.setValue('attributes', updated)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image size={20} />
          Mint NFT
        </CardTitle>
        <CardDescription>
          Create and mint your own NFT on Celo
        </CardDescription>
      </CardHeader>
      <CardContent>
        {minted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-success">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-success" size={20} />
                  <span className="font-medium text-success">NFT Minted Successfully!</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>Token ID:</span>
                    <Badge variant="outline">{minted.tokenId}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Transaction:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {minted.txHash.slice(0, 10)}...{minted.txHash.slice(-8)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(`https://celoscan.io/tx/${minted.txHash}`, '_blank')}
                    >
                      <ExternalLink size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form Fields */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NFT Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Awesome NFT" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your NFT..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/image.png"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter a URL to an image for your NFT
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Address</FormLabel>
                      <FormControl>
                        <Input placeholder="0x..." {...field} />
                      </FormControl>
                      <FormDescription>
                        Leave empty to mint to your wallet
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Preview */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Preview</label>
                  <div className="mt-2 border rounded-lg p-4 bg-muted/20 min-h-[200px] flex items-center justify-center">
                    {preview ? (
                      <img
                        src={preview}
                        alt="NFT Preview"
                        className="max-w-full max-h-48 rounded-lg"
                        onError={() => setPreview(null)}
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Upload size={32} className="mx-auto mb-2" />
                        <p>Image preview will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Attributes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Attributes</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAttribute}
                >
                  Add Attribute
                </Button>
              </div>

              {form.watch('attributes')?.map((_, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="Trait Type"
                    value={form.watch('attributes')?.[index]?.trait_type || ''}
                    onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                  />
                  <Input
                    placeholder="Value"
                    value={form.watch('attributes')?.[index]?.value || ''}
                    onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeAttribute(index)}
                  >
                    Remove
                  </Button>
                </motion.div>
              ))}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading || !wallet.isConnected}
              className="w-full flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={20} className="animate-spin" />}
              {loading ? "Minting NFT..." : "Mint NFT"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
