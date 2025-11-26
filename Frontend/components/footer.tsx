"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Zap, Github, Twitter, Linkedin } from "lucide-react"

export default function Footer() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  }

  const footerSections = [
    {
      title: "AutoFi",
      items: [],
    },
    {
      title: "Product",
      items: [
        { label: "Tools", href: "/tools" },
        { label: "Templates", href: "/templates" },
        { label: "Pricing", href: "#" },
      ],
    },
    {
      title: "Resources",
      items: [
        { label: "Docs", href: "#" },
        { label: "API", href: "#" },
        { label: "Community", href: "#" },
      ],
    },
    {
      title: "Legal",
      items: [
        { label: "Privacy", href: "#" },
        { label: "Terms", href: "#" },
        { label: "Contact", href: "#" },
      ],
    },
  ]

  const socialLinks = [
    { icon: Github, href: "#", label: "GitHub" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
  ]

  return (
    <footer className="bg-sidebar text-sidebar-foreground border-t border-sidebar-border/30 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {footerSections.map((section, sectionIndex) => (
            <motion.div key={sectionIndex} variants={itemVariants}>
              <h3 className="font-bold text-lg mb-5 text-sidebar-foreground">{section.title}</h3>
              <ul className="space-y-3 text-sidebar-foreground/70">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Link
                      href={item.href || "#"}
                      className="hover:text-white transition-smooth hover:translate-x-1 inline-block font-medium"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="border-t border-sidebar-border/30 pt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-primary" />
              <p className="text-sidebar-foreground/60 font-medium">&copy; 2025 AutoFi. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-4">
              {socialLinks.map((social, index) => {
                const Icon = social.icon
                return (
                  <motion.a
                    key={index}
                    href={social.href}
                    className="p-2 hover:bg-sidebar-border rounded-lg transition-smooth hover-lift"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label={social.label}
                  >
                    <Icon
                      size={20}
                      className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-smooth"
                    />
                  </motion.a>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
