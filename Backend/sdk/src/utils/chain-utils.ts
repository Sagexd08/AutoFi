export class ChainUtils {
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  static isValidTxHash(txHash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(txHash);
  }
  static formatAddress(address: string): string {
    if (!this.isValidAddress(address)) {
      throw new Error('Invalid address format');
    }
    return address.toLowerCase();
  }
  static shortenAddress(address: string, chars = 4): string {
    if (!this.isValidAddress(address)) {
      throw new Error('Invalid address format');
    }
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
  }
}
