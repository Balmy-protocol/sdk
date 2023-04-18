import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { HistoricalPriceResult, IPriceSource, PricesQueriesSupport, TokenPrice } from '../types';
import { PortalsFiClient } from '@shared/portals-fi';

export class PortalsFiPriceSource implements IPriceSource {
  private readonly portalsFi: PortalsFiClient;

  constructor(fetch: IFetchService) {
    this.portalsFi = new PortalsFiClient(fetch);
  }

  supportedQueries() {
    const support: PricesQueriesSupport = { getCurrentPrices: true, getHistoricalPrices: false };
    const entries = this.portalsFi.supportedChains().map((chainId) => [chainId, support]);
    return Object.fromEntries(entries);
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

  getHistoricalPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, HistoricalPriceResult>>> {
    return Promise.reject(new Error('Operation not supported'));
  }
}
