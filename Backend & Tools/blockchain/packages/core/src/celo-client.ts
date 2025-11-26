import {
  createPublicClient,
  createWalletClient,
  http,
  Address,
  Hash,
  Hex,
  PublicClient,
  WalletClient,
  Chain
} from "viem";
import { celo, celoAlfajores } from "viem/chains";
import { CeloNetworkConfig, Transaction, TokenTransfer, Event, TransactionRequest, TransactionReceipt, SimulationResult } from "./types";

const CELO_CHAINS = {
  alfajores: celoAlfajores,
  mainnet: celo
} as const;

export class CeloClient {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private network: CeloNetworkConfig;
  private chain: Chain;

  constructor(
    privateKey: string,
    network: 'alfajores' | 'mainnet',
    rpcUrl?: string
  ) {
    this.chain = CELO_CHAINS[network];
    this.network = this.getNetworkConfigInternal(network);

    if (rpcUrl) {
      this.network.rpcUrl = rpcUrl;
    }

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.network.rpcUrl)
    });

    this.walletClient = createWalletClient({
      chain: this.chain,
      transport: http(this.network.rpcUrl),
      account: privateKey as Address
    });
  }

  getNetworkConfig(): CeloNetworkConfig {
    return this.network;
  }

  private getNetworkConfigInternal(network: 'alfajores' | 'mainnet'): CeloNetworkConfig {
    if (network === 'alfajores') {
      return {
        chainId: 44787,
        name: "Celo Alfajores",
        rpcUrl: "https://alfajores-forno.celo-testnet.org",
        explorerUrl: "https://alfajores.celoscan.io",
        contracts: {
          agentRegistry: "0x0000000000000000000000000000000000000000",
          agentTreasury: "0x0000000000000000000000000000000000000000",
          donationSplitter: "0x0000000000000000000000000000000000000000",
          yieldAggregator: "0x0000000000000000000000000000000000000000",
          masterTrading: "0x0000000000000000000000000000000000000000",
          attendanceNFT: "0x0000000000000000000000000000000000000000"
        },
        tokens: {
          cUSD: "0x874069Fa1Eb16D44d62F6a2e4c8B0C1C3b1C5C1C",
          cEUR: "0x10c892A6ECfc32b4C1C6Cb8C1C3b1C5C1C3b1C5C1C",
          cREAL: "0x00Be915B9dCf56a3CBE739D9B9c202ca692409EC",
          CELO: "0x0000000000000000000000000000000000000000"
        },
        defiProtocols: {
          moola: "0x0000000000000000000000000000000000000000",
          ubeswap: "0x0000000000000000000000000000000000000000",
          curve: "0x0000000000000000000000000000000000000000"
        }
      };
    } else {
      return {
        chainId: 42220,
        name: "Celo Mainnet",
        rpcUrl: "https://forno.celo.org",
        explorerUrl: "https://celoscan.io",
        contracts: {
          agentRegistry: "0x0000000000000000000000000000000000000000",
          agentTreasury: "0x0000000000000000000000000000000000000000",
          donationSplitter: "0x0000000000000000000000000000000000000000",
          yieldAggregator: "0x0000000000000000000000000000000000000000",
          masterTrading: "0x0000000000000000000000000000000000000000",
          attendanceNFT: "0x0000000000000000000000000000000000000000"
        },
        tokens: {
          cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
          cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
          cREAL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
          CELO: "0x0000000000000000000000000000000000000000"
        },
        defiProtocols: {
          moola: "0x0000000000000000000000000000000000000000",
          ubeswap: "0x0000000000000000000000000000000000000000",
          curve: "0x0000000000000000000000000000000000000000"
        }
      };
    }
  }

  async getBalance(address: Address): Promise<bigint> {
    return await this.publicClient.getBalance({ address });
  }

  async getTokenBalance(token: Address, address: Address): Promise<bigint> {
    if (token === this.network.tokens.CELO) {
      return await this.getBalance(address);
    }

    const balance = await this.publicClient.readContract({
      address: token,
      abi: [
        {
          name: "balanceOf",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "balance", type: "uint256" }]
        }
      ],
      functionName: "balanceOf",
      args: [address]
    });

    return balance as bigint;
  }

  async sendNativeToken(to: Address, amount: bigint): Promise<Hash> {
    return await this.walletClient.sendTransaction({
      to,
      value: amount,
      account: await this.walletClient.getAddresses().then(addrs => addrs[0]),
      chain: this.chain
    });
  }

  async sendTransaction(request: TransactionRequest): Promise<Hash> {
    return await this.walletClient.sendTransaction({
      to: request.to,
      value: request.value,
      data: request.data,
      gas: request.gasLimit,
      gasPrice: request.gasPrice,
      account: await this.walletClient.getAddresses().then(addrs => addrs[0]),
      chain: this.chain
    });
  }

  async sendToken(token: Address, to: Address, amount: bigint): Promise<Hash> {
    if (token === this.network.tokens.CELO) {
      return await this.sendNativeToken(to, amount);
    }

    return await this.walletClient.writeContract({
      address: token,
      abi: [
        {
          name: "transfer",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" }
          ],
          outputs: [{ name: "success", type: "bool" }]
        }
      ],
      functionName: "transfer",
      args: [to, amount],
      chain: this.chain,
      account: await this.walletClient.getAddresses().then(addrs => addrs[0])
    });
  }

  async getTransactionHistory(
    address: Address,
    fromBlock?: bigint,
    toBlock?: bigint
  ): Promise<Transaction[]> {
    const currentBlock = await this.publicClient.getBlockNumber();
    const startBlock = fromBlock || currentBlock - 1000n;
    const endBlock = toBlock || currentBlock;

    const transactions: Transaction[] = [];

    for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
      const block = await this.publicClient.getBlock({
        blockNumber: blockNum,
        includeTransactions: true
      });

      if (block.transactions) {
        for (const tx of block.transactions) {
          if (typeof tx === 'object' && (tx.from === address || tx.to === address)) {
            transactions.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to || "0x0000000000000000000000000000000000000000",
              value: tx.value,
              gasUsed: tx.gas,
              gasPrice: tx.gasPrice || 0n,
              timestamp: Number(block.timestamp),
              blockNumber: blockNum
            });
          }
        }
      }
    }

    return transactions;
  }

  async getTokenTransfers(
    token: Address,
    address: Address,
    fromBlock?: bigint
  ): Promise<TokenTransfer[]> {
    const currentBlock = await this.publicClient.getBlockNumber();
    const startBlock = fromBlock || currentBlock - 1000n;

    const transferEvents = await this.publicClient.getLogs({
      address: token,
      event: {
        type: "event",
        name: "Transfer",
        inputs: [
          { name: "from", type: "address", indexed: true },
          { name: "to", type: "address", indexed: true },
          { name: "value", type: "uint256", indexed: false }
        ]
      },
      fromBlock: startBlock,
      toBlock: currentBlock
    });

    return transferEvents
      .filter(event =>
        event.topics[1]?.toLowerCase() === address.toLowerCase() ||
        event.topics[2]?.toLowerCase() === address.toLowerCase()
      )
      .map(event => ({
        hash: event.transactionHash,
        from: `0x${event.topics[1]?.slice(26)}` as Address,
        to: `0x${event.topics[2]?.slice(26)}` as Address,
        token,
        amount: BigInt(event.data),
        timestamp: 0,
        blockNumber: event.blockNumber
      }));
  }

  async readContract<T>(
    address: Address,
    abi: any,
    functionName: string,
    args?: any[]
  ): Promise<T> {
    return await this.publicClient.readContract({
      address,
      abi,
      functionName,
      args: args || []
    }) as T;
  }

  async writeContract(
    address: Address,
    abi: any,
    functionName: string,
    args?: any[],
    value?: bigint
  ): Promise<Hash> {
    return await this.walletClient.writeContract({
      address,
      abi,
      functionName,
      args: args || [],
      value,
      chain: this.chain,
      account: await this.walletClient.getAddresses().then(addrs => addrs[0])
    });
  }

  async registerAgent(
    agentType: string,
    dailyLimit: bigint,
    perTxLimit: bigint
  ): Promise<bigint> {
    const result = await this.writeContract(
      this.network.contracts.agentRegistry,
      [
        {
          name: "registerAgent",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "agentType", type: "string" },
            { name: "agentWallet", type: "address" },
            { name: "dailyLimit", type: "uint256" },
            { name: "perTxLimit", type: "uint256" }
          ],
          outputs: [{ name: "agentId", type: "uint256" }]
        }
      ],
      "registerAgent",
      [agentType, await this.walletClient.getAddresses().then(addrs => addrs[0]), dailyLimit, perTxLimit]
    );

    const receipt = await this.waitForTransaction(result);
    const event = receipt.logs.find(log =>
      log.topics[0] === "0x" + "AgentRegistered".padEnd(64, "0")
    );

    if (event) {
      return BigInt(event.topics[1]);
    }

    throw new Error("Failed to get agent ID from registration");
  }

  async checkAgentPermission(
    agentId: bigint,
    operation: string,
    amount: bigint,
    recipient: Address
  ): Promise<boolean> {
    return await this.readContract<boolean>(
      this.network.contracts.agentRegistry,
      [
        {
          name: "isOperationAllowed",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "agentId", type: "uint256" },
            { name: "operation", type: "bytes32" },
            { name: "amount", type: "uint256" },
            { name: "recipient", type: "address" }
          ],
          outputs: [{ name: "allowed", type: "bool" }]
        }
      ],
      "isOperationAllowed",
      [agentId, operation, amount, recipient]
    );
  }

  async recordAgentAction(
    agentId: bigint,
    actionType: string,
    amount: bigint,
    data: Hex
  ): Promise<Hash> {
    return await this.writeContract(
      this.network.contracts.agentRegistry,
      [
        {
          name: "recordAgentAction",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "agentId", type: "uint256" },
            { name: "actionType", type: "bytes32" },
            { name: "amount", type: "uint256" },
            { name: "data", type: "bytes" }
          ],
          outputs: []
        }
      ],
      "recordAgentAction",
      [agentId, actionType, amount, data]
    );
  }

  async depositToTreasury(token: Address, amount: bigint): Promise<Hash> {
    if (token === this.network.tokens.CELO) {
      return await this.walletClient.sendTransaction({
        to: this.network.contracts.agentTreasury,
        value: amount,
        account: await this.walletClient.getAddresses().then(addrs => addrs[0]),
        chain: this.chain
      });
    } else {
      await this.writeContract(
        token,
        [
          {
            name: "approve",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" }
            ],
            outputs: [{ name: "success", type: "bool" }]
          }
        ],
        "approve",
        [this.network.contracts.agentTreasury, amount]
      );

      return await this.writeContract(
        this.network.contracts.agentTreasury,
        [
          {
            name: "deposit",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" }
            ],
            outputs: []
          }
        ],
        "deposit",
        [token, amount]
      );
    }
  }

  async agentWithdrawFromTreasury(
    agentId: bigint,
    token: Address,
    recipient: Address,
    amount: bigint
  ): Promise<Hash> {
    return await this.writeContract(
      this.network.contracts.agentTreasury,
      [
        {
          name: "agentWithdraw",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "agentId", type: "uint256" },
            { name: "token", type: "address" },
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" }
          ],
          outputs: [{ name: "success", type: "bool" }]
        }
      ],
      "agentWithdraw",
      [agentId, token, recipient, amount]
    );
  }

  async batchTransferFromTreasury(
    agentId: bigint,
    token: Address,
    recipients: Address[],
    amounts: bigint[]
  ): Promise<Hash> {
    return await this.writeContract(
      this.network.contracts.agentTreasury,
      [
        {
          name: "batchTransfer",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "agentId", type: "uint256" },
            { name: "token", type: "address" },
            { name: "recipients", type: "address[]" },
            { name: "amounts", type: "uint256[]" }
          ],
          outputs: [{ name: "success", type: "bool" }]
        }
      ],
      "batchTransfer",
      [agentId, token, recipients, amounts]
    );
  }

  async estimateGas(tx: TransactionRequest): Promise<bigint> {
    return await this.publicClient.estimateGas({
      to: tx.to,
      data: tx.data,
      value: tx.value || 0n
    });
  }

  async getCurrentGasPrice(): Promise<bigint> {
    return await this.publicClient.getGasPrice();
  }

  async simulateTransaction(tx: TransactionRequest): Promise<SimulationResult> {
    try {
      const gasUsed = await this.estimateGas(tx);
      return {
        success: true,
        gasUsed,
        returnData: "0x" as Hex,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        gasUsed: 0n,
        returnData: "0x" as Hex,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  async waitForTransaction(hash: Hash): Promise<TransactionReceipt> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return {
      hash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      transactionIndex: receipt.transactionIndex,
      from: receipt.from,
      to: receipt.to || "0x0000000000000000000000000000000000000000",
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      status: receipt.status === "success" ? "success" : "reverted",
      logs: receipt.logs.map(log => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash,
        logIndex: log.logIndex
      }))
    };
  }

  async getTransactionReceipt(hash: Hash): Promise<TransactionReceipt> {
    const receipt = await this.publicClient.getTransactionReceipt({ hash });
    return {
      hash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      transactionIndex: receipt.transactionIndex,
      from: receipt.from,
      to: receipt.to || "0x0000000000000000000000000000000000000000",
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      status: receipt.status === "success" ? "success" : "reverted",
      logs: receipt.logs.map(log => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash,
        logIndex: log.logIndex
      }))
    };
  }

  setContractAddresses(contracts: Partial<CeloNetworkConfig['contracts']>): void {
    this.network.contracts = { ...this.network.contracts, ...contracts };
  }

  async getAddresses(): Promise<Address[]> {
    return this.walletClient.getAddresses();
  }

  async getBlock(params: { blockNumber: bigint; includeTransactions: boolean }) {
    return await this.publicClient.getBlock(params);
  }

  async getLogs(params: any) {
    return await this.publicClient.getLogs(params);
  }

  async getBlockNumber(): Promise<bigint> {
    return await this.publicClient.getBlockNumber();
  }
}