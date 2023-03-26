import { ChainId, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { IPriceSource, TokenPrice } from '../types';
import { PortalsFiClient } from '@shared/portals-fi';

export class PortalsFiPriceSource implements IPriceSource {
  private readonly portalsFi: PortalsFiClient;

  constructor(fetch: IFetchService) {
    this.portalsFi = new PortalsFiClient(fetch);
  }

  async getCurrentPrices(params: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>> {
    const result: Record<ChainId, Record<TokenAddress, TokenPrice>> = {};
    const data = await this.portalsFi.getData(params);
    for (const [chainIdString, tokens] of Object.entries(data)) {
      const chainId = Number(chainIdString);
      result[chainId] = {};
      for (const [address, token] of Object.entries(tokens)) {
        result[chainId][address] = token.price;
      }
    }
    return result;
  }

  supportedChains(): ChainId[] {
    return this.portalsFi.supportedChains();
  }
}
