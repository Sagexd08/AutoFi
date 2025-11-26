"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X, Moon, Sun, Zap, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/hooks/use-wallet"
import { motion, AnimatePresence } from "framer-motion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [network, setNetwork] = useState("mainnet")
  const { wallet, isConnecting, error, connect, disconnect, switchToMainnet, switchToTestnet } = useWallet()

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle("dark")
  }

  const handleWalletClick = () => {
    if (wallet.isConnected) {
      disconnect()
    } else {
      connect()
    }
  }

  const handleNetworkChange = async (value: string) => {
    setNetwork(value)
    try {
      if (value === "mainnet") {
        await switchToMainnet()
      } else {
        await switchToTestnet()
      }
    } catch (err) {
      console.error("Network switch error:", err)
    }
  }

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/tools", label: "Tools" },
    { href: "/templates", label: "Templates" },
    { href: "/analytics", label: "Analytics" },
  ]

  return (
    <>
      {error && (
        <motion.div
          className="bg-destructive/10 border-b border-destructive/30 px-4 py-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Alert variant="destructive" className="max-w-7xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl transition-smooth">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <motion.div
                className="w-10 h-10 bg-linear-to-br from-primary via-primary to-secondary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-smooth"
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <Zap size={24} className="stroke-[2.5]" />
              </motion.div>
              <div className="hidden sm:flex flex-col">
                <span className="font-bold text-lg text-foreground transition-smooth">
                  AutoFi
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1 bg-muted/40 glass rounded-full px-2 py-1.5 border border-border/40">
              {navLinks.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-4 py-2 text-foreground/70 hover:text-white transition-smooth relative group rounded-full hover:bg-primary/10"
                >
                  <motion.span
                    className="relative z-10 font-medium text-sm"
                    whileHover={{ scale: 1.05 }}
                  >
                    {item.label}
                  </motion.span>
                </Link>
              ))}
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Network Switcher */}
              {wallet.isConnected && (
                <Select value={network} onValueChange={handleNetworkChange}>
                  <SelectTrigger className="w-32 h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mainnet">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Mainnet
                      </span>
                    </SelectItem>
                    <SelectItem value="testnet">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                        Testnet
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Theme toggle */}
              <motion.button
                onClick={toggleTheme}
                className="p-2.5 hover:bg-muted rounded-full transition-smooth hover-lift"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun size={20} className="text-amber-400" />
                ) : (
                  <Moon size={20} className="text-slate-600" />
                )}
              </motion.button>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleWalletClick}
                  disabled={isConnecting}
                  className={`hidden sm:inline-flex transition-smooth hover-lift font-medium rounded-full px-6 ${
                    wallet.isConnected
                      ? "bg-success/20 hover:bg-success/30 text-success border border-success/30"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 border border-primary/50"
                  }`}
                >
                  {isConnecting ? (
                    <>
                      <motion.span
                        className="w-2 h-2 bg-current rounded-full mr-2"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                      />
                      Connecting...
                    </>
                  ) : wallet.isConnected ? (
                    <>
                      <motion.span
                        className="w-2 h-2 bg-success rounded-full mr-2"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                      />
                      {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                    </>
                  ) : (
                    "Connect Wallet"
                  )}
                </Button>
              </motion.div>

              {/* Mobile menu button */}
              <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 hover:bg-muted rounded-full transition-smooth"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </motion.button>
            </div>
          </div>

          {/* Mobile menu */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="md:hidden pb-4 space-y-2 border-t border-border/30 pt-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                {navLinks.map((item, index) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      className="block px-4 py-2.5 hover:bg-muted rounded-full transition-smooth text-foreground/80 hover:text-white font-medium"
                      onClick={() => setIsOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navLinks.length * 0.05 }}
                >
                  <Button
                    onClick={handleWalletClick}
                    disabled={isConnecting}
                    className="w-full mt-2 transition-smooth font-medium rounded-full"
                  >
                    {isConnecting ? "Connecting..." : wallet.isConnected ? "✓ Connected" : "Connect Wallet"}
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </>
  )
}
