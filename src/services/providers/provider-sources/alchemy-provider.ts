import { ChainId } from '@types';
import { IProviderSource } from '../types';
import { buildEthersProviderForHttpSource, buildViemTransportForHttpSource } from './base/base-http-provider';
import { buildEthersProviderForWebSocketSource, buildViemTransportForWebSocketSource } from './base/base-web-socket-provider';
import { alchemySupportedChains, buildAlchemyUrl } from '@shared/alchemy-rpc';

export class AlchemyProviderSource implements IProviderSource {
  constructor(private readonly key: string, private readonly protocol: 'https' | 'wss') {}

  supportedClients() {
    const support = { ethers: true, viem: true };
    return Object.fromEntries(alchemySupportedChains().map((chainId) => [chainId, support]));
  }

  getEthersProvider({ chainId }: { chainId: ChainId }) {
    const url = buildAlchemyUrl(this.key, this.protocol, chainId);
    return this.protocol === 'https' ? buildEthersProviderForHttpSource(url, chainId) : buildEthersProviderForWebSocketSource(url, chainId);
  }

  getViemTransport({ chainId }: { chainId: ChainId }) {
    const url = buildAlchemyUrl(this.key, this.protocol, chainId);
    return this.protocol === 'https' ? buildViemTransportForHttpSource(url, chainId) : buildViemTransportForWebSocketSource(url, chainId);
  }
}
