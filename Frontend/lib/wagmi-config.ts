import { http } from 'wagmi'
import { mainnet, celo, celoAlfajores } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

// Custom RPC URLs with fallbacks to avoid rate limiting
const celoRpcUrls = [
  'https://forno.celo.org',
  'https://rpc.ankr.com/celo',
]

const celoAlfajoresRpcUrls = [
  'https://alfajores-forno.celo-testnet.org',
]

const mainnetRpcUrls = [
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://ethereum.publicnode.com',
]

// RainbowKit configuration with custom transports
export const config = getDefaultConfig({
  appName: 'AutoFi',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [celo, celoAlfajores, mainnet],
  ssr: true,
  transports: {
    [celo.id]: http(celoRpcUrls[0], {
      batch: {
        wait: 100, // Wait 100ms to batch requests
      },
      retryCount: 3,
      retryDelay: 1000,
    }),
    [celoAlfajores.id]: http(celoAlfajoresRpcUrls[0], {
      batch: {
        wait: 100,
      },
      retryCount: 3,
      retryDelay: 1000,
    }),
    [mainnet.id]: http(mainnetRpcUrls[0], {
      batch: {
        wait: 100,
      },
      retryCount: 3,
      retryDelay: 1000,
    }),
  },
})

// Export chains for use in other components
export const supportedChains = [celo, celoAlfajores, mainnet] as const
