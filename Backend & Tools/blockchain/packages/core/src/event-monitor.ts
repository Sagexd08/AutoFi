import { Address, Hash, Hex } from "viem";
import { CeloClient } from "./celo-client";
import { BlockEvents, Transaction, TokenTransfer, Event } from "./types";

export class BlockScanner {
  private client: CeloClient;
  private lastScannedBlock: bigint;
  private pollingInterval: number = 3000;
  private isRunning: boolean = false;
  private eventCallbacks: Map<string, (events: BlockEvents) => void> = new Map();

  constructor(client: CeloClient) {
    this.client = client;
    this.lastScannedBlock = 0n;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Block scanner is already running");
      return;
    }

    this.isRunning = true;
    console.log("🔍 Starting block scanner...");

    const currentBlock = await this.client.getBlockNumber();
    this.lastScannedBlock = currentBlock - 1n;

    this.pollLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log("🛑 Block scanner stopped");
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.scanNewBlocks();
        await this.sleep(this.pollingInterval);
      } catch (error) {
        console.error("Error in block scanner:", error);
        await this.sleep(this.pollingInterval * 2);
      }
    }
  }

  private async scanNewBlocks(): Promise<void> {
    const currentBlock = await this.client.getBlockNumber();

    if (currentBlock > this.lastScannedBlock) {
      console.log(`📦 Scanning blocks ${this.lastScannedBlock + 1n} to ${currentBlock}`);

      for (let blockNum = this.lastScannedBlock + 1n; blockNum <= currentBlock; blockNum++) {
        const blockEvents = await this.scanBlock(blockNum);

        if (blockEvents.transactions.length > 0 ||
            blockEvents.transfers.length > 0 ||
            blockEvents.contractEvents.length > 0) {

          console.log(`📊 Block ${blockNum}: ${blockEvents.transactions.length} txs, ${blockEvents.transfers.length} transfers, ${blockEvents.contractEvents.length} events`);

          this.eventCallbacks.forEach((callback, id) => {
            try {
              callback(blockEvents);
            } catch (error) {
              console.error(`Error in event callback ${id}:`, error);
            }
          });
        }
      }

      this.lastScannedBlock = currentBlock;
    }
  }

  async scanBlock(blockNumber: bigint): Promise<BlockEvents> {
    const block = await this.client.getBlock({ blockNumber, includeTransactions: true });

    const transactions: Transaction[] = [];
    const transfers: TokenTransfer[] = [];
    const contractEvents: Event[] = [];

    if (block.transactions) {
      for (const tx of block.transactions) {
        if (typeof tx === 'object') {
          transactions.push({
            hash: tx.hash,
            from: tx.from,
            to: tx.to || "0x0000000000000000000000000000000000000000",
            value: tx.value,
            gasUsed: tx.gas,
            gasPrice: tx.gasPrice || 0n,
            timestamp: Number(block.timestamp),
            blockNumber: blockNumber
          });

          if (tx.to && tx.to !== "0x0000000000000000000000000000000000000000") {
            try {
              const transferEvents = await this.client.getLogs({
                address: tx.to,
                event: {
                  type: "event",
                  name: "Transfer",
                  inputs: [
                    { name: "from", type: "address", indexed: true },
                    { name: "to", type: "address", indexed: true },
                    { name: "value", type: "uint256", indexed: false }
                  ]
                },
                fromBlock: blockNumber,
                toBlock: blockNumber
              });

              for (const event of transferEvents) {
                transfers.push({
                  hash: event.transactionHash,
                  from: `0x${event.topics[1]?.slice(26)}` as Address,
                  to: `0x${event.topics[2]?.slice(26)}` as Address,
                  token: event.address,
                  amount: BigInt(event.data),
                  timestamp: Number(block.timestamp),
                  blockNumber: blockNumber
                });
              }
            } catch (error) {
            }
          }
        }
      }
    }

    const agentContracts = [
      this.client.getNetworkConfig().contracts.agentRegistry,
      this.client.getNetworkConfig().contracts.agentTreasury,
      this.client.getNetworkConfig().contracts.donationSplitter,
      this.client.getNetworkConfig().contracts.yieldAggregator,
      this.client.getNetworkConfig().contracts.masterTrading,
      this.client.getNetworkConfig().contracts.attendanceNFT
    ];

    for (const contractAddress of agentContracts) {
      if (contractAddress !== "0x0000000000000000000000000000000000000000") {
        try {
          const logs = await this.client.getLogs({
            address: contractAddress,
            fromBlock: blockNumber,
            toBlock: blockNumber
          });

          for (const log of logs) {
            contractEvents.push({
              address: log.address,
              topics: log.topics,
              data: log.data,
              blockNumber: blockNumber,
              transactionHash: log.transactionHash,
              logIndex: log.logIndex
            });
          }
        } catch (error) {
        }
      }
    }

    return {
      blockNumber,
      transactions,
      transfers,
      contractEvents
    };
  }

  async getWalletTransactions(
    address: Address,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<Transaction[]> {
    return await this.client.getTransactionHistory(address, fromBlock, toBlock);
  }

  async getContractEvents(
    contractAddress: Address,
    eventSignature: string,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<Event[]> {
    const logs = await this.client.getLogs({
      address: contractAddress,
      event: {
        type: "event",
        name: eventSignature,
        inputs: []
      },
      fromBlock,
      toBlock
    });

    return logs.map(log => ({
      address: log.address,
      topics: log.topics,
      data: log.data,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex
    }));
  }

  subscribe(id: string, callback: (events: BlockEvents) => void): void {
    this.eventCallbacks.set(id, callback);
    console.log(`📡 Registered event callback: ${id}`);
  }

  unsubscribe(id: string): void {
    this.eventCallbacks.delete(id);
    console.log(`📡 Unregistered event callback: ${id}`);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus(): { isRunning: boolean; lastScannedBlock: bigint; subscribers: number } {
    return {
      isRunning: this.isRunning,
      lastScannedBlock: this.lastScannedBlock,
      subscribers: this.eventCallbacks.size
    };
  }
}