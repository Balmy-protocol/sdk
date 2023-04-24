import { timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, Timestamp, TokenAddress } from '@types';
import { IPriceService, IPriceSource, TokenPrice } from './types';

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
  }): Promise<Record<TokenAddress, TokenPrice>> {
    const byChainId = { [chainId]: addresses };
    const result = await this.getCurrentPrices({ addresses: byChainId, config });
    return result[chainId];
  }

  getCurrentPrices({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenPrice>>> {
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
    return result[chainId];
  }

  getHistoricalPrices({
    config,
    ...params
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    timestamp: Timestamp;
    searchWidth?: TimeString;
    config?: { timeout?: TimeString };
  }) {
    return timeoutPromise(this.priceSource.getHistoricalPrices({ ...params, config }), config?.timeout, {
      description: 'Timeouted while fetching historical prices',
    });
  }
}
