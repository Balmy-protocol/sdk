import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';
import { buildEthersProviderForHttpSource } from './base/base-http-provider';
import { buildEthersProviderForWebSocketSource } from './base/base-web-socket-provider';
import { ALCHEMY_URLs, alchemySupportedChains } from '@shared/alchemy-rpc';

export class AlchemyProviderSource implements IProviderSource {
  constructor(private readonly key: string, private readonly protocol: 'https' | 'wss') {}

  supportedChains(): ChainId[] {
    return alchemySupportedChains();
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    const url = `${this.protocol}://${ALCHEMY_URLs[chainId]}/${this.key}`;
    return this.protocol === 'https' ? buildEthersProviderForHttpSource(url, chainId) : buildEthersProviderForWebSocketSource(url, chainId);
  }
}
