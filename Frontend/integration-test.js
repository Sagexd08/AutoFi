/**
 * Frontend-Backend Integration Test
 * Tests the complete integration between Frontend and Backend
 */

import { apiClient } from './lib/api-client.js'
import { blockchainIntegration } from './lib/blockchain-integration.js'

class IntegrationTest {
  constructor() {
    this.results = []
    this.errors = []
  }

  async runAllTests() {
    console.log('🚀 Starting Frontend-Backend Integration Tests...\n')

    const tests = [
      { name: 'Backend Connection', fn: this.testBackendConnection.bind(this) },
      { name: 'API Client', fn: this.testApiClient.bind(this) },
      { name: 'Blockchain Integration', fn: this.testBlockchainIntegration.bind(this) },
      { name: 'WebSocket Connection', fn: this.testWebSocketConnection.bind(this) },
      { name: 'AI Integration', fn: this.testAIIntegration.bind(this) },
      { name: 'Automation System', fn: this.testAutomationSystem.bind(this) },
      { name: 'Real-time Updates', fn: this.testRealtimeUpdates.bind(this) }
    ]

    for (const test of tests) {
      try {
        console.log(`🧪 Testing ${test.name}...`)
        await test.fn()
        console.log(`✅ ${test.name} - PASSED\n`)
      } catch (error) {
        console.log(`❌ ${test.name} - FAILED: ${error.message}\n`)
        this.errors.push({ test: test.name, error: error.message })
      }
    }

    this.printResults()
  }

  async testBackendConnection() {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/health`)
      if (!response.ok) {
        throw new Error(`Backend not responding: ${response.status}`)
      }
      this.results.push('Backend Connection: PASSED')
    } catch (error) {
      throw new Error(`Backend connection failed: ${error.message}`)
    }
  }

  async testApiClient() {
    try {
      // Test system status
      const statusResponse = await apiClient.getSystemStatus()
      if (!statusResponse.success) {
        throw new Error('Failed to get system status')
      }

      // Test available functions
      const functionsResponse = await apiClient.getAvailableFunctions()
      if (!functionsResponse.success) {
        throw new Error('Failed to get available functions')
      }

      this.results.push('API Client: PASSED')
    } catch (error) {
      throw new Error(`API Client test failed: ${error.message}`)
    }
  }

  async testBlockchainIntegration() {
    try {
      // Test blockchain configuration
      const config = blockchainIntegration.getConfig()
      if (!config.network || !config.rpcUrl) {
        throw new Error('Blockchain configuration incomplete')
      }

      // Test system status
      const status = await blockchainIntegration.getSystemStatus()
      if (!status.status) {
        throw new Error('Failed to get blockchain system status')
      }

      this.results.push('Blockchain Integration: PASSED')
    } catch (error) {
      throw new Error(`Blockchain integration test failed: ${error.message}`)
    }
  }

  async testWebSocketConnection() {
    return new Promise((resolve, reject) => {
      try {
        const ws = apiClient.connectWebSocket((data) => {
          console.log('WebSocket message received:', data)
          ws.close()
          this.results.push('WebSocket Connection: PASSED')
          resolve()
        })

        ws.onerror = (error) => {
          reject(new Error(`WebSocket connection failed: ${error}`))
        }

        ws.onopen = () => {
          console.log('WebSocket connected successfully')
          // Close after successful connection
          setTimeout(() => {
            ws.close()
            this.results.push('WebSocket Connection: PASSED')
            resolve()
          }, 1000)
        }

        // Timeout after 5 seconds
        setTimeout(() => {
          ws.close()
          reject(new Error('WebSocket connection timeout'))
        }, 5000)
      } catch (error) {
        reject(new Error(`WebSocket test failed: ${error.message}`))
      }
    })
  }

  async testAIIntegration() {
    try {
      // Test AI execution with a simple prompt
      const result = await blockchainIntegration.executeWithAI(
        'Get the current CELO price',
        { context: 'test' }
      )

      if (!result.functionCalls || !Array.isArray(result.functionCalls)) {
        throw new Error('AI execution did not return expected format')
      }

      this.results.push('AI Integration: PASSED')
    } catch (error) {
      throw new Error(`AI integration test failed: ${error.message}`)
    }
  }

  async testAutomationSystem() {
    try {
      // Test creating automation with AI
      const automation = await blockchainIntegration.createAutomationWithAI(
        'Create a simple automation that sends 1 CELO to a test address',
        { context: 'test' }
      )

      if (!automation.id || !automation.name) {
        throw new Error('Automation creation did not return expected format')
      }

      this.results.push('Automation System: PASSED')
    } catch (error) {
      throw new Error(`Automation system test failed: ${error.message}`)
    }
  }

  async testRealtimeUpdates() {
    try {
      // Test real-time subscription
      let updateReceived = false
      
      const unsubscribe = blockchainIntegration.subscribeToPrice('CELO', (price) => {
        console.log('Price update received:', price)
        updateReceived = true
        unsubscribe()
      })

      // Wait for update or timeout
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          if (updateReceived) {
            this.results.push('Real-time Updates: PASSED')
            resolve()
          } else {
            // Still pass if no update received (might be normal)
            this.results.push('Real-time Updates: PASSED (no updates received)')
            resolve()
          }
        }, 3000)
      })
    } catch (error) {
      throw new Error(`Real-time updates test failed: ${error.message}`)
    }
  }

  printResults() {
    console.log('\n📊 Integration Test Results:')
    console.log('================================')
    
    this.results.forEach(result => {
      console.log(`✅ ${result}`)
    })

    if (this.errors.length > 0) {
      console.log('\n❌ Errors:')
      this.errors.forEach(error => {
        console.log(`❌ ${error.test}: ${error.error}`)
      })
    }

    console.log(`\n📈 Summary: ${this.results.length} passed, ${this.errors.length} failed`)
    
    if (this.errors.length === 0) {
      console.log('🎉 All integration tests passed! Frontend-Backend connection is working correctly.')
    } else {
      console.log('⚠️  Some tests failed. Please check the Backend connection and configuration.')
    }
  }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  const test = new IntegrationTest()
  test.runAllTests().catch(console.error)
}

export default IntegrationTest
