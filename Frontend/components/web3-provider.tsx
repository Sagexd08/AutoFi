'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the providers with SSR disabled
const Web3ProviderInner = dynamic(
  () => import('./web3-provider-inner').then((mod) => mod.Web3ProviderInner),
  { 
    ssr: false,
    loading: () => null
  }
)

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return <Web3ProviderInner>{children}</Web3ProviderInner>
}
