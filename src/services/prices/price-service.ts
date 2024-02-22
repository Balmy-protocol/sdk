import { timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IPriceService, IPriceSource, PriceResult } from './types';

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

  async getCurrentPricesForChain({
    chainId,
    addresses,
    config,
  }: {
    chainId: ChainId;
    addresses: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, PriceResult>> {
    const byChainId = { [chainId]: addresses };
    const result = await this.getCurrentPrices({ addresses: byChainId, config });
    return result[chainId] ?? {};
  }

  getCurrentPrices({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, PriceResult>>> {
    return timeoutPromise(this.priceSource.getCurrentPrices({ addresses, config }), config?.timeout, {
      description: 'Timeouted while fetching current prices',
    });
  }

  async getHistoricalPricesForChain({
    chainId,
    addresses,
    timestamp,
    searchWidth,
    config,
  }: {
    chainId: ChainId;
    addresses: TokenAddress[];
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }) {
    const byChainId = { [chainId]: addresses };
    const result = await this.getHistoricalPrices({ addresses: byChainId, timestamp, searchWidth, config });
    return result[chainId] ?? {};
  }

  getHistoricalPrices({
    config,
    searchWidth,
    ...params
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }) {
    return timeoutPromise(this.priceSource.getHistoricalPrices({ ...params, searchWidth, config }), config?.timeout, {
      description: 'Timeouted while fetching historical prices',
    });
  }

  getBulkHistoricalPrices({
    addresses,
    searchWidth,
    config,
  }: {
    addresses: { chainId: ChainId; token: TokenAddress; timestamp: Timestamp }[];
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<Timestamp, PriceResult>>>> {
    const collectedByChainId: Record<ChainId, { token: TokenAddress; timestamp: Timestamp }[]> = {};
    for (const { chainId, token, timestamp } of addresses) {
      if (!(chainId in collectedByChainId)) collectedByChainId[chainId] = [];
      collectedByChainId[chainId].push({ token, timestamp });
    }
    return timeoutPromise(this.priceSource.getBulkHistoricalPrices({ addresses: collectedByChainId, searchWidth, config }), config?.timeout, {
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
    tokens: Record<ChainId, TokenAddress[]>;
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
