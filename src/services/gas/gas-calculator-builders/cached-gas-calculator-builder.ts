import { ChainId } from '@types';
import { IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator } from '../types';
import { ContextlessCache, ExpirationConfigOptions } from '@shared/generic-cache';

type ConstructorParameters = {
  wrapped: IQuickGasCostCalculatorBuilder;
  expiration: {
    default: ExpirationConfigOptions;
    overrides?: Record<ChainId, ExpirationConfigOptions>;
  };
};

export class CachedGasCalculatorBuilder implements IQuickGasCostCalculatorBuilder {
  private readonly cache: ContextlessCache<ChainId, IQuickGasCostCalculatorBuilder>;
  private readonly wrapped: IQuickGasCostCalculatorBuilder;
  private readonly expirationOverrides: Record<ChainId, ExpirationConfigOptions>;

  constructor({ wrapped, expiration }: ConstructorParameters) {
    this.wrapped = wrapped;
    this.cache = new ContextlessCache<ChainId, IQuickGasCostCalculatorBuilder>({
      calculate: ([chainId]) => this.wrapped.build(chainId), // We know that we will only ask for one chain at a time
      toStorableKey: (chainId) => `${chainId}`,
      expirationConfig: expiration.default,
    });
    this.expirationOverrides = expiration.overrides ?? {};
  }

  supportedChains(): ChainId[] {
    return this.wrapped.supportedChains();
  }

  async build(chainId: ChainId): Promise<IQuickGasCostCalculator> {
    const expirationConfig = this.expirationOverrides[chainId];
    const calculator = await this.cache.getOrCalculateSingle({
      key: chainId,
      expirationConfig,
    });
    return calculator!.build(chainId);
  }
}
