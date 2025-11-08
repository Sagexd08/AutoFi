import type { Address } from 'viem';

export interface ABIRegistryEntry {
  address: Address;
  name: string;
  abi: unknown[];
  bytecode?: string;
  source?: string;
  version?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

class ABIRegistry {
  private registry = new Map<Address, ABIRegistryEntry>();
  private nameIndex = new Map<string, Address[]>();

  register(entry: Omit<ABIRegistryEntry, 'createdAt'>): void {
    const now = new Date().toISOString();
    const fullEntry: ABIRegistryEntry = {
      ...entry,
      createdAt: entry.createdAt || now,
      updatedAt: now,
    };

    this.registry.set(entry.address, fullEntry);

    if (!this.nameIndex.has(entry.name)) {
      this.nameIndex.set(entry.name, []);
    }
    const addresses = this.nameIndex.get(entry.name)!;
    if (!addresses.includes(entry.address)) {
      addresses.push(entry.address);
    }
  }

  get(address: Address): ABIRegistryEntry | undefined {
    return this.registry.get(address);
  }

  getByName(name: string): ABIRegistryEntry[] {
    const addresses = this.nameIndex.get(name) || [];
    return addresses.map((addr) => this.registry.get(addr)!).filter(Boolean);
  }

  getAll(): ABIRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  remove(address: Address): boolean {
    const entry = this.registry.get(address);
    if (!entry) return false;

    this.registry.delete(address);
    const addresses = this.nameIndex.get(entry.name);
    if (addresses) {
      const index = addresses.indexOf(address);
      if (index > -1) {
        addresses.splice(index, 1);
      }
    }
    return true;
  }

  search(query: string): ABIRegistryEntry[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.registry.values()).filter(
      (entry) =>
        entry.name.toLowerCase().includes(lowerQuery) ||
        entry.address.toLowerCase().includes(lowerQuery) ||
        entry.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }
}

export const abiRegistry = new ABIRegistry();

