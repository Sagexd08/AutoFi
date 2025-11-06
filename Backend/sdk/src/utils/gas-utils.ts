export class GasUtils {
  static formatGasPrice(gasPrice: string): string {
    return gasPrice.toString();
  }
  static calculateGasCost(gasLimit: string, gasPrice: string): string {
    const limit = BigInt(gasLimit);
    const price = BigInt(gasPrice);
    return (limit * price).toString();
  }
  static formatGasCost(cost: string, decimals = 18): string {
    const costBigInt = BigInt(cost);
    const divisor = BigInt(10 ** decimals);
    const wholePart = costBigInt / divisor;
    const fractionalPart = costBigInt % divisor;
    if (fractionalPart === 0n) {
      return wholePart.toString();
    }
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    if (trimmedFractional === '') {
      return wholePart.toString();
    }
    return `${wholePart}.${trimmedFractional}`;
  }
}
