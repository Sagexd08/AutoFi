"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, X, Moon, Sun, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount, useSwitchChain } from "wagmi"
import { celo, celoAlfajores } from "wagmi/chains"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const { isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const handleNetworkChange = async (value: string) => {
    try {
      if (value === "mainnet") {
        switchChain?.({ chainId: celo.id })
      } else {
        switchChain?.({ chainId: celoAlfajores.id })
      }
    } catch (err) {
      console.error("Network switch error:", err)
    }
  }

  const currentNetwork = chainId === celoAlfajores.id ? "testnet" : "mainnet"

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/tools", label: "Tools" },
    { href: "/templates", label: "Templates" },
    { href: "/analytics", label: "Analytics" },
  ]

  return (
    <>
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
              {mounted && isConnected && (
                <Select value={currentNetwork} onValueChange={handleNetworkChange}>
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
                {mounted ? (
                  theme === "dark" ? (
                    <Sun size={20} className="text-amber-400" />
                  ) : (
                    <Moon size={20} className="text-slate-600" />
                  )
                ) : (
                  <div className="w-5 h-5" />
                )}
              </motion.button>

              {/* Wallet Connect Button */}
              <div className="hidden sm:block">
                {mounted && <ConnectButton showBalance={false} />}
              </div>

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
                  className="px-4 pt-2"
                >
                  {mounted && <ConnectButton showBalance={false} />}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </>
  )
}
