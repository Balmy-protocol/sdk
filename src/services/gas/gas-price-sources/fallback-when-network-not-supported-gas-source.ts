import { networksUnion } from '@networks';
import { Network } from '@types';
import { ArrayOneOrMore } from '@utility-types';
import { IGasPriceSource } from '../types';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given network
export class FallbackWhenNetworkNotSupportedGasPriceSource implements IGasPriceSource {
  constructor(private readonly sources: ArrayOneOrMore<IGasPriceSource>) {}

  supportedNetworks(): Network[] {
    return networksUnion(this.sources.map((source) => source.supportedNetworks()));
  }

  getGasPrice(network: Network) {
    const source = this.sources.find((source) => source.supportedNetworks().includes(network));
    if (!source) throw new Error(`Network ${network.name} not supported`);
    return source.getGasPrice(network);
  }
}
