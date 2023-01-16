import { ChainId } from '@types';
import { ContextlessCache, ExpirationConfigOptions } from '@shared/generic-cache';
import { GasPrice, GasSpeed, IGasPriceSource } from '../types';

export class CachedGasPriceSource implements IGasPriceSource {
  private readonly cache: ContextlessCache<ChainId, Record<GasSpeed, GasPrice>>;

  constructor(
    private readonly source: IGasPriceSource,
    expirationConfig: ExpirationConfigOptions,
    private readonly overrides?: Record<ChainId, ExpirationConfigOptions>
  ) {
    this.cache = new ContextlessCache<ChainId, Record<GasSpeed, GasPrice>>({
      calculate: ([chainId]) => this.source.getGasPrice(chainId),
      toStorableKey: (chainId) => `${chainId}`,
      expirationConfig,
    });
  }

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  async getGasPrice(chainId: ChainId): Promise<Record<GasSpeed, GasPrice>> {
    const expirationConfig = this.overrides?.[chainId];
    const result = await this.cache.getOrCalculateSingle({ key: chainId, expirationConfig });
    return result!;
  }
}
