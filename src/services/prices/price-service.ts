import { timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IPriceService, IPriceSource, PriceInput, PriceResult } from './types';

export class PriceService implements IPriceService {
  constructor(private readonly priceSource: IPriceSource) {}

  supportedChains() {
    return Object.entries(this.supportedQueries())
      .filter(([, support]) => support.getCurrentPrices || support.getHistoricalPrices)
      .map(([chainId]) => Number(chainId));
  }

  supportedQueries() {
    return this.priceSource.supportedQueries();
  }

  async getCurrentPricesInChain({
    chainId,
    tokens,
    config,
  }: {
    chainId: ChainId;
    tokens: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, PriceResult>> {
    const input = tokens.map((token) => ({ chainId, token }));
    const result = await this.getCurrentPrices({ tokens: input, config });
    return result[chainId] ?? {};
  }

  getCurrentPrices({
    tokens,
    config,
  }: {
    tokens: PriceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    return timeoutPromise(this.priceSource.getCurrentPrices({ tokens, config }), config?.timeout, {
      description: 'Timeouted while fetching current prices',
    });
  }

  async getHistoricalPricesInChain({
    chainId,
    tokens,
    timestamp,
    searchWidth,
    config,
  }: {
    chainId: ChainId;
    tokens: TokenAddress[];
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }) {
    const input = tokens.map((token) => ({ chainId, token }));
    const result = await this.getHistoricalPrices({ tokens: input, timestamp, searchWidth, config });
    return result[chainId] ?? {};
  }

  getHistoricalPrices({
    config,
    searchWidth,
    ...params
  }: {
    tokens: PriceInput[];
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }) {
    return timeoutPromise(this.priceSource.getHistoricalPrices({ ...params, searchWidth, config }), config?.timeout, {
      description: 'Timeouted while fetching historical prices',
    });
  }

  getBulkHistoricalPrices({
    tokens,
    searchWidth,
    config,
  }: {
    tokens: { chainId: ChainId; token: TokenAddress; timestamp: Timestamp }[];
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    return timeoutPromise(this.priceSource.getBulkHistoricalPrices({ tokens, searchWidth, config }), config?.timeout, {
      description: 'Timeouted while fetching bulk historical prices',
    });
  }
  getChart({
    tokens,
    span,
    period,
    bound,
    searchWidth,
    config,
  }: {
    tokens: PriceInput[];
    span: number;
    period: TimeString;
    bound: { from: Timestamp } | { upTo: Timestamp | 'now' };
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult[]>>> {
    return timeoutPromise(this.priceSource.getChart({ tokens, span, period, bound, searchWidth, config }), config?.timeout, {
      description: 'Timeouted while fetching chart prices',
    });
  }
}
