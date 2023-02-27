import { ChainId, TimeString } from '@types';
import { IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator } from '../types';
import { Cache, ExpirationConfigOptions } from '@shared/generic-cache';

type ConstructorParameters = {
  wrapped: IQuickGasCostCalculatorBuilder;
  expiration: {
    default: ExpirationConfigOptions;
    overrides?: Record<ChainId, ExpirationConfigOptions>;
  };
};
type CacheContext = { timeout?: TimeString } | undefined;
export class CachedGasCalculatorBuilder implements IQuickGasCostCalculatorBuilder {
  private readonly cache: Cache<CacheContext, ChainId, IQuickGasCostCalculator>;
  private readonly wrapped: IQuickGasCostCalculatorBuilder;
  private readonly expirationOverrides: Record<ChainId, ExpirationConfigOptions>;

  constructor({ wrapped, expiration }: ConstructorParameters) {
    this.wrapped = wrapped;
    this.cache = new Cache<CacheContext, ChainId, IQuickGasCostCalculator>({
      calculate: (context, [chainId]) => this.wrapped.build({ chainId, context }).then((calculator) => ({ [chainId]: calculator })), // We know that we will only ask for one chain at a time
      toStorableKey: (chainId) => `${chainId}`,
      expirationConfig: expiration.default,
    });
    this.expirationOverrides = expiration.overrides ?? {};
  }

  supportedChains(): ChainId[] {
    return this.wrapped.supportedChains();
  }

  async build({ chainId, context }: { chainId: ChainId; context?: { timeout?: TimeString } }): Promise<IQuickGasCostCalculator> {
    const expirationConfig = this.expirationOverrides[chainId];
    const calculator = await this.cache.getOrCalculateSingle({
      key: chainId,
      context,
      expirationConfig,
      timeout: context?.timeout,
    });
    return calculator!;
  }
}
