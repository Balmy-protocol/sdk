import { providers } from 'ethers';
import { networksUnion } from '@networks';
import { Network } from '@types';
import { ArrayOneOrMore } from '@utility-types';
import { IProviderSource } from '../types';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given network
export class FallbackWhenNetworkNotSupportedProviderSource implements IProviderSource {
  constructor(private readonly sources: ArrayOneOrMore<IProviderSource>) {}

  supportedNetworks(): Network[] {
    return networksUnion(this.sources.map((source) => source.supportedNetworks()));
  }

  getProvider(network: Network): providers.BaseProvider {
    const source = this.sources.find((source) => source.supportedNetworks().includes(network));
    if (!source) throw new Error(`Network ${network.name} not supported`);
    return source.getProvider(network);
  }
}
