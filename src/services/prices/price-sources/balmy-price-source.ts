import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { TokenInChain, fromTokenInChain, toTokenInChain } from '@shared/utils';
import { BALMY_SUPPORTED_CHAINS } from '@services/quotes/quote-sources/balmy-quote-source';
import { PriceResult, IPriceSource, PricesQueriesSupport, TokenPrice, PriceInput } from '../types';
import { nowInSeconds } from './utils';

export class BalmyPriceSource implements IPriceSource {
  constructor(private readonly fetch: IFetchService) {}

  supportedQueries() {
    const support: PricesQueriesSupport = { getCurrentPrices: true, getHistoricalPrices: true, getBulkHistoricalPrices: true, getChart: false };
    const entries = BALMY_SUPPORTED_CHAINS.map((chainId) => [chainId, support]);
    return Object.fromEntries(entries);
  }

  async getCurrentPrices({
    tokens,
    config,
  }: {
    tokens: PriceInput[];
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const tokensInChain = tokens.map(({ chainId, token }) => toTokenInChain(chainId, token));
    const response = await this.fetch.fetch('https://api.balmy.xyz/v1/prices', {
      body: JSON.stringify({ tokens: tokensInChain }),
      method: 'POST',
      timeout: config?.timeout,
    });
    const body: Response = await response.json();
    const result: Record<ChainId, Record<TokenAddress, PriceResult>> = {};
    for (const [tokenInChain, price] of Object.entries(body.tokens)) {
      const { chainId, address } = fromTokenInChain(tokenInChain);
      if (!(chainId in result)) result[chainId] = {};
      result[chainId][address] = { price, closestTimestamp: nowInSeconds() };
    }
    return result;
  }

  async getHistoricalPrices({
    tokens,
    timestamp,
    searchWidth,
    config,
  }: {
    tokens: PriceInput[];
    timestamp: Timestamp;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const input = tokens.map(({ token, chainId }) => ({ chainId, token, timestamp }));
    const prices = await this.getBulkHistoricalPrices({ tokens: input, searchWidth, config });
    return Object.fromEntries(
      Object.entries(prices).map(([chainId, tokens]) => [
        chainId,
        Object.fromEntries(Object.entries(tokens).map(([token, price]) => [token, price[timestamp]])),
      ])
    );
  }

  async getBulkHistoricalPrices({
    tokens,
    config,
  }: {
    tokens: { chainId: ChainId; token: TokenAddress; timestamp: Timestamp }[];
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    const tokensInput = tokens.map(({ chainId, token, timestamp }) => ({ chain: chainId, token, timestamp }));
    const response = await this.fetch.fetch('https://api.balmy.xyz/v1/historical-prices', {
      body: JSON.stringify({ tokens: tokensInput }),
      method: 'POST',
      timeout: config?.timeout,
    });
    const body = await response.json();
    return body.tokens;
  }

  async getChart(_: {
    tokens: PriceInput[];
    span: number;
    period: TimeString;
    bound: { from: Timestamp } | { upTo: Timestamp | 'now' };
    searchWidth?: TimeString;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult[]>>> {
    return Promise.reject(new Error('Operation not supported'));
  }
}

type Response = { tokens: Record<TokenInChain, TokenPrice> };
