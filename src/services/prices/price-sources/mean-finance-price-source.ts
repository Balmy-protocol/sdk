import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { TokenInChain, fromTokenInChain, toTokenInChain } from '@shared/utils';
import { MEAN_FINANCE_SUPPORTED_CHAINS } from '@services/quotes/quote-sources/mean-finance-quote-source';
import { PriceResult, IPriceSource, PricesQueriesSupport, TokenPrice } from '../types';
import { Chains } from '@chains';
import { nowInSeconds } from './utils';

export class MeanFinancePriceSource implements IPriceSource {
  constructor(private readonly fetch: IFetchService) {}

  supportedQueries() {
    const support: PricesQueriesSupport = { getCurrentPrices: true, getHistoricalPrices: false, getBulkHistoricalPrices: false };
    const entries = MEAN_FINANCE_SUPPORTED_CHAINS.filter((chainId) => chainId !== Chains.BASE_GOERLI.chainId) // Mean's price source does not support Base goerli
      .map((chainId) => [chainId, support]);
    return Object.fromEntries(entries);
  }

  async getCurrentPrices({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    const tokens = Object.entries(addresses).flatMap(([chainId, addresses]) =>
      addresses.map((address) => toTokenInChain(Number(chainId), address))
    );
    const response = await this.fetch.fetch('https://api.mean.finance/v1/prices', {
      body: JSON.stringify({ tokens }),
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

  getHistoricalPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    return Promise.reject(new Error('Operation not supported'));
  }

  getBulkHistoricalPrices(_: {
    addresses: Record<ChainId, { token: TokenAddress; timestamp: Timestamp }[]>;
    searchWidth: TimeString | undefined;
    config: { timeout?: TimeString } | undefined;
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    return Promise.reject(new Error('Operation not supported'));
  }
}

type Response = { tokens: Record<TokenInChain, TokenPrice> };
