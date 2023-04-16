import { ChainId, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch/types';
import { TokenInChain, fromTokenInChain, toTokenInChain } from '@shared/utils';
import { MEAN_FINANCE_SUPPORTED_CHAINS } from '@services/quotes/quote-sources/mean-finance';
import { HistoricalPriceResult, IPriceSource, PricesQueriesSupport, Timestamp, TokenPrice } from '../types';

export class MeanFinancePriceSource implements IPriceSource {
  constructor(private readonly fetch: IFetchService) {}

  supportedQueries() {
    const support: PricesQueriesSupport = { getCurrentPrices: true, getHistoricalPrices: false };
    const entries = MEAN_FINANCE_SUPPORTED_CHAINS.map((chainId) => [chainId, support]);
    return Object.fromEntries(entries);
  }

  async getCurrentPrices({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>> {
    const tokens = Object.entries(addresses).flatMap(([chainId, addresses]) =>
      addresses.map((address) => toTokenInChain(Number(chainId), address))
    );
    const response = await this.fetch.fetch('https://api.mean.finance/v1/prices', {
      body: JSON.stringify({ tokens }),
      method: 'POST',
      timeout: config?.timeout,
    });
    const body: Response = await response.json();
    const result: Record<ChainId, Record<TokenAddress, TokenPrice>> = {};
    for (const [tokenInChain, price] of Object.entries(body.tokens)) {
      const { chainId, address } = fromTokenInChain(tokenInChain);
      if (!(chainId in result)) result[chainId] = {};
      result[chainId][address] = price;
    }
    return result;
  }

  getHistoricalPrices(_: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, HistoricalPriceResult>>> {
    throw new Error('Operation not supported');
  }
}

type Response = { tokens: Record<TokenInChain, TokenPrice> };
