import { Address as ViemAddress } from 'viem';
import { ChainId, Address, Chain } from '@types';
import { toLower } from './utils';

export class Contract {
  private readonly defaultAddress: ContractAddress | undefined;
  private readonly overrides: Record<ChainId, ContractAddress> = {};

  constructor({ defaultAddress, overrides }: { defaultAddress: ContractAddress | undefined; overrides: Record<ChainId, ContractAddress> }) {
    this.defaultAddress = defaultAddress;
    this.overrides = overrides;
  }

  address(chain: ChainId | Chain): ContractAddress {
    const chainId = typeof chain === 'number' ? chain : chain.chainId;
    const address = this.overrides[chainId] ?? this.defaultAddress;
    if (!address) {
      throw new Error(`Found no address on chain with id ${chainId}`);
    }
    return address;
  }

  static with({ defaultAddress }: { defaultAddress: Address }): ContractBuilder {
    return new ContractBuilder(defaultAddress);
  }

  static withNoDefault(): ContractBuilder {
    return new ContractBuilder();
  }
}

class ContractBuilder {
  private readonly overrides: Record<ChainId, ContractAddress> = {};
  private readonly defaultAddress: ContractAddress | undefined;

  constructor(defaultAddress?: Address) {
    this.defaultAddress = defaultAddress ? (toLower(defaultAddress) as ContractAddress) : undefined;
  }

  and({ address, onChain }: { address: Address; onChain: ChainId | Chain }) {
    const chainId = typeof onChain === 'number' ? onChain : onChain.chainId;
    this.overrides[chainId] = toLower(address) as ContractAddress;
    return this;
  }

  build(): Contract {
    return new Contract({ defaultAddress: this.defaultAddress, overrides: this.overrides });
  }
}

type ContractAddress = Lowercase<Address> & ViemAddress;
