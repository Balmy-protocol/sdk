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
    const support: PricesQueriesSupport = { getCurrentPrices: true, getHistoricalPrices: true, getBulkHistoricalPrices: true };
    const entries = this.defiLlama.supportedChains().map((chainId) => [chainId, support]);
    return Object.fromEntries(entries);
  }

  async getCurrentPrices(params: {
    addresses: Record<ChainId, TokenAddress[]>;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const result: Record<ChainId, Record<TokenAddress, PriceResult>> = {};
    const data = await this.defiLlama.getCurrentTokenData(params);
    for (const [chainIdString, tokens] of Object.entries(data)) {
      const chainId = Number(chainIdString);
      result[chainId] = {};
      for (const [address, token] of Object.entries(tokens)) {
        result[chainId][address] = { price: token.price, closestTimestamp: token.timestamp };
      }
    }
    return result;
  }

  async getHistoricalPrices(params: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const result: Record<ChainId, Record<TokenAddress, PriceResult>> = {};
    const data = await this.defiLlama.getHistoricalTokenData(params);
    for (const [chainIdString, tokens] of Object.entries(data)) {
      const chainId = Number(chainIdString);
      result[chainId] = {};
      for (const [address, { price, timestamp }] of Object.entries(tokens)) {
        result[chainId][address] = { price, closestTimestamp: timestamp };
      }
    }
    return result;
  }

  async getBulkHistoricalPrices({
    addresses,
    searchWidth,
    config,
  }: {
    addresses: Record<ChainId, { token: TokenAddress; timestamp: Timestamp }[]>;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    const aggregatedByTimestamp: Record<Timestamp, Record<ChainId, TokenAddress[]>> = {};
    for (const chainId in addresses) {
      for (const { token, timestamp } of addresses[chainId]) {
        if (!(timestamp in aggregatedByTimestamp)) aggregatedByTimestamp[timestamp] = {};
        if (!(chainId in aggregatedByTimestamp[timestamp])) aggregatedByTimestamp[timestamp][chainId] = [];
        aggregatedByTimestamp[timestamp][chainId].push(token);
      }
    }
    const allPrices = await Promise.all(
      Object.entries(aggregatedByTimestamp).map(async ([timestamp, addresses]) => ({
        timestamp: Number(timestamp),
        prices: await this.getHistoricalPrices({ timestamp: Number(timestamp), addresses, searchWidth, config }),
      }))
    );

    const result: Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>> = {};
    for (const { timestamp, prices } of allPrices) {
      for (const chainId in prices) {
        if (!(chainId in result)) result[chainId] = {};
        for (const token in prices[chainId]) {
          if (!(token in result[chainId])) result[chainId][token] = {};
          result[chainId][token][timestamp] = prices[chainId][token];
        }
      }
    }
    return result;
  }
}
