import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Contract } from "ethers";
import { Address } from "viem";

interface ExtendedHRE extends HardhatRuntimeEnvironment {
  ethers: any;
}

export interface HardhatConfig {
  network: string;
  privateKey?: string;
  rpcUrl?: string;
}

export interface DeploymentResult {
  contractAddress: Address;
  transactionHash: string;
  gasUsed: string;
  blockNumber: number;
}

export interface ContractInfo {
  name: string;
  address: Address;
  abi: any[];
  bytecode: string;
}

export async function initializeHardhat(config: HardhatConfig): Promise<ExtendedHRE> {
  const hre = require("hardhat") as ExtendedHRE;

  if (config.network !== "hardhat") {
    const existingNetwork = hre.config.networks[config.network];
    if (existingNetwork && 'url' in existingNetwork) {

      if (config.rpcUrl) {
        (existingNetwork as any).url = config.rpcUrl;
      }
      if (config.privateKey) {
        (existingNetwork as any).accounts = [config.privateKey];
      }
    }
  }

  return hre;
}

export async function deployHardhatContract(
  config: HardhatConfig,
  contractName: string,
  constructorArgs: any[] = []
): Promise<DeploymentResult> {
  const hre = await initializeHardhat(config);
  const [deployer] = await hre.ethers.getSigners();

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(...constructorArgs);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();

  return {
    contractAddress: contractAddress as Address,
    transactionHash: deploymentTx?.hash || "",
    gasUsed: deploymentTx?.gasLimit?.toString() || "0",
    blockNumber: deploymentTx?.blockNumber || 0,
  };
}

export async function getContract(
  config: HardhatConfig,
  contractName: string,
  contractAddress: Address
): Promise<Contract> {
  const hre = await initializeHardhat(config);
  const [signer] = await hre.ethers.getSigners();

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  return ContractFactory.attach(contractAddress).connect(signer);
}

export async function callContractFunction(
  config: HardhatConfig,
  contractName: string,
  contractAddress: Address,
  functionName: string,
  args: any[] = []
): Promise<any> {
  const contract = await getContract(config, contractName, contractAddress);
  return await contract[functionName](...args);
}

export async function sendContractTransaction(
  config: HardhatConfig,
  contractName: string,
  contractAddress: Address,
  functionName: string,
  args: any[] = [],
  value: string = "0"
): Promise<any> {
  const contract = await getContract(config, contractName, contractAddress);
  const tx = await contract[functionName](...args, { value });
  return await tx.wait();
}

export async function getContractInfo(
  config: HardhatConfig,
  contractName: string
): Promise<ContractInfo> {
  const hre = await initializeHardhat(config);
  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  return {
    name: contractName,
    address: "0x0000000000000000000000000000000000000000" as Address,
    abi: ContractFactory.interface.format("json") as any[],
    bytecode: ContractFactory.bytecode,
  };
}

export async function verifyHardhatContract(
  config: HardhatConfig,
  contractAddress: Address,
  constructorArgs: any[] = []
): Promise<boolean> {
  const hre = await initializeHardhat(config);

  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: constructorArgs,
    });
    return true;
  } catch (error) {
    console.error("Contract verification failed:", error);
    return false;
  }
}

export async function getNetworkInfo(config: HardhatConfig): Promise<{
  name: string;
  chainId: number;
  blockNumber: number;
  gasPrice: string;
}> {
  const hre = await initializeHardhat(config);
  const network = await hre.ethers.provider.getNetwork();
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  const feeData = await hre.ethers.provider.getFeeData();

  return {
    name: network.name,
    chainId: Number(network.chainId),
    blockNumber,
    gasPrice: feeData.gasPrice?.toString() || "0",
  };
}

export async function getAccountBalance(
  config: HardhatConfig,
  address: Address
): Promise<string> {
  const hre = await initializeHardhat(config);
  const balance = await hre.ethers.provider.getBalance(address);
  return balance.toString();
}

export async function transferCELO(
  config: HardhatConfig,
  to: Address,
  amount: string
): Promise<any> {
  const hre = await initializeHardhat(config);
  const [signer] = await hre.ethers.getSigners();

  const tx = await signer.sendTransaction({
    to,
    value: hre.ethers.parseEther(amount),
  });

  return await tx.wait();
}

export async function compileContracts(config: HardhatConfig): Promise<boolean> {
  const hre = await initializeHardhat(config);

  try {
    await hre.run("compile");
    return true;
  } catch (error) {
    console.error("Compilation failed:", error);
    return false;
  }
}

export async function runTests(config: HardhatConfig): Promise<boolean> {
  const hre = await initializeHardhat(config);

  try {
    await hre.run("test");
    return true;
  } catch (error) {
    console.error("Tests failed:", error);
    return false;
  }
}
