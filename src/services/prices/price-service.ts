import { timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, TokenAddress } from '@types';
import { IPriceService, IPriceSource, TokenPrice } from './types';

export class PriceService implements IPriceService {
  constructor(private readonly tokenSource: IPriceSource) {}

  supportedChains() {
    return this.tokenSource.supportedChains();
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
    return timeoutPromise(this.tokenSource.getCurrentPrices({ addresses, config }), config?.timeout);
  }
}
