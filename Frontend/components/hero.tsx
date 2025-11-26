"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import React from "react"

function HeroCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = React.useState(0)

  React.useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)

      setDisplayValue(Math.floor(value * progress))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [value, duration])

  return <span>{displayValue}</span>
}

export default function Hero() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7 },
    },
  }

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden bg-linear-to-b from-background via-background to-muted/20">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated Arc Background */}
        <motion.svg
          className="absolute bottom-0 left-0 w-full h-2/3"
          viewBox="0 0 1440 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* Main Arc */}
          <motion.path
            d="M 0 400 Q 360 50 720 50 T 1440 400"
            stroke="url(#arcGradient)"
            strokeWidth="2"
            fill="none"
            animate={{ strokeDashoffset: [0, -20] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            strokeDasharray="20,10"
          />
          
          {/* Glow Arc */}
          <motion.path
            d="M 0 400 Q 360 50 720 50 T 1440 400"
            stroke="url(#arcGlowGradient)"
            strokeWidth="40"
            fill="none"
            opacity="0.3"
            filter="blur(20px)"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          <defs>
            <linearGradient id="arcGradient" x1="0" y1="0" x2="1440" y2="0">
              <stop offset="0%" stopColor="currentColor" className="text-primary" stopOpacity="0.8" />
              <stop offset="50%" stopColor="currentColor" className="text-secondary" stopOpacity="0.8" />
              <stop offset="100%" stopColor="currentColor" className="text-primary" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="arcGlowGradient" x1="0" y1="0" x2="1440" y2="0">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.5" />
            </linearGradient>
          </defs>
        </motion.svg>

        {/* Floating orbs */}
        <motion.div
          className="absolute top-20 right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl"
          animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-40 left-10 w-80 h-80 bg-secondary/10 rounded-full blur-3xl"
          animate={{ y: [0, 30, 0], x: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Badge */}
        <motion.div
          variants={itemVariants}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-full glass-dark hover:border-primary/50 transition-smooth hover:text-white">
            <motion.span
              className="w-2.5 h-2.5 bg-success rounded-full"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            />
            <span className="text-sm font-semibold text-primary">Automation on Celo</span>
          </div>
        </motion.div>

        {/* Heading */}
        <motion.h1
          variants={itemVariants}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight text-center"
        >
          Automate Payments, NFTs, Swaps & DAO Tasks
        </motion.h1>

        {/* Subheading */}
        <motion.p
          variants={itemVariants}
          className="text-lg sm:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed text-center hover:text-white transition-smooth"
        >
          Transparent, low-cost, mobile-first blockchain automation for everyone. Build powerful workflows without code.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link href="/dashboard">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground transition-smooth hover-lift group w-full sm:w-auto font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 rounded-full px-8"
              >
                Connect Wallet
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-smooth" size={20} />
              </Button>
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link href="/tools">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto font-semibold rounded-full transition-smooth px-8 hover:text-white"
              >
                <Sparkles size={18} className="mr-2" />
                Explore Tools
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto"
        >
          {[
            { value: 50, label: "Automation Tools", suffix: "+" },
            { value: 1000, label: "Active Users" },
            { value: 10, label: "Supported Chains" },
          ].map((stat, index) => (
            <motion.div
              key={index}
              className="p-4 bg-card/40 glass rounded-lg border border-border/30 hover:border-primary/50 transition-smooth hover-lift text-center"
              whileHover={{ y: -4 }}
            >
              <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">
                <HeroCounter value={stat.value} />
                {stat.suffix}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground font-medium hover:text-white transition-smooth">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  )
}
