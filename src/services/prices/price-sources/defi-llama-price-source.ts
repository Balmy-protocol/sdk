import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { PriceResult, IPriceSource, PricesQueriesSupport } from '../types';
import { DefiLlamaClient } from '@shared/defi-llama';

export class DefiLlamaPriceSource implements IPriceSource {
  private readonly defiLlama: DefiLlamaClient;

  constructor(fetch: IFetchService) {
    this.defiLlama = new DefiLlamaClient(fetch);
  }

  supportedQueries() {
    const support: PricesQueriesSupport = { getCurrentPrices: true, getHistoricalPrices: true };
    const entries = this.defiLlama.supportedChains().map((chainId) => [chainId, support]);
    return Object.fromEntries(entries);
  }

  async getCurrentPrices(params: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const result: Record<ChainId, Record<TokenAddress, PriceResult>> = {};
    const data = await this.defiLlama.getCurrentTokenData(params);
    for (const [chainIdString, tokens] of Object.entries(data)) {
      const chainId = Number(chainIdString);
      result[chainId] = {};
      for (const [address, token] of Object.entries(tokens)) {
        result[chainId][address] = { price: token.price, timestamp: token.timestamp };
      }
    }
    return result;
  }

  async getHistoricalPrices(params: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const result: Record<ChainId, Record<TokenAddress, PriceResult>> = {};
    const data = await this.defiLlama.getHistoricalTokenData(params);
    for (const [chainIdString, tokens] of Object.entries(data)) {
      const chainId = Number(chainIdString);
      result[chainId] = {};
      for (const [address, { price, timestamp }] of Object.entries(tokens)) {
        result[chainId][address] = { price, timestamp };
      }
    }
    return result;
  }
}
