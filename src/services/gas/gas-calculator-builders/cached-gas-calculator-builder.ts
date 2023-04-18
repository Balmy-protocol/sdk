import { ChainId, DefaultRequirements, FieldRequirementOptions, FieldsRequirements, TimeString } from '@types';
import { IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator, SupportedGasValues } from '../types';
import { ConcurrentLRUCache, ExpirationConfigOptions } from '@shared/concurrent-lru-cache';
import { calculateFieldRequirements } from '@shared/requirements-and-support';

type ConstructorParameters<GasValues extends SupportedGasValues> = {
  wrapped: IQuickGasCostCalculatorBuilder<GasValues>;
  expiration: {
    default: ExpirationConfigOptions;
    overrides?: Record<ChainId, ExpirationConfigOptions>;
  };
  maxSize?: number;
};
type CacheContext = { timeout?: TimeString } | undefined;
export class CachedGasCalculatorBuilder<GasValues extends SupportedGasValues> implements IQuickGasCostCalculatorBuilder<GasValues> {
  private readonly cache: ConcurrentLRUCache<CacheContext, string, IQuickGasCostCalculator<GasValues>>;
  private readonly wrapped: IQuickGasCostCalculatorBuilder<GasValues>;
  private readonly expirationOverrides: Record<ChainId, ExpirationConfigOptions>;

  constructor({ wrapped, expiration, maxSize }: ConstructorParameters<GasValues>) {
    this.wrapped = wrapped;
    this.cache = new ConcurrentLRUCache<CacheContext, string, IQuickGasCostCalculator<GasValues>>({
      calculate: (config, [cacheId]) => this.fromCacheKey(cacheId, config), // We know that we will only ask for one chain at a time
      config: {
        expiration: expiration.default,
        maxSize: maxSize ?? Object.keys(wrapped.supportedSpeeds()).length,
      },
    });
    this.expirationOverrides = expiration.overrides ?? {};
  }

  supportedSpeeds() {
    return this.wrapped.supportedSpeeds();
  }

  async build<Requirements extends FieldsRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { fields?: Requirements; timeout?: TimeString };
  }) {
    const expirationConfig = this.expirationOverrides[chainId];
    const key = this.toCacheKey(chainId, config?.fields);
    const calculator = await this.cache.getOrCalculateSingle({
      key,
      context: config,
      expirationConfig,
      timeout: config?.timeout,
    });
    return calculator as IQuickGasCostCalculator<GasValues, Requirements>;
  }

  private toCacheKey<Requirements extends FieldsRequirements<GasValues>>(chainId: ChainId, requirements: Requirements | undefined) {
    const support = this.wrapped.supportedSpeeds()[chainId];
    const fieldRequirements = calculateFieldRequirements(support, requirements);
    const requiredFields = Object.entries(fieldRequirements)
      .filter(([, requirement]) => requirement === 'required')
      .map(([field]) => field)
      .join(',');
    return `${chainId}-${requiredFields}`;
  }

  private async fromCacheKey(cacheId: string, config: CacheContext) {
    const [chainIdString, requiredFieldsText] = cacheId.split('-');
    const requiredFields = requiredFieldsText.length > 0 ? requiredFieldsText.split(',') : [];
    const requirements = Object.fromEntries(requiredFields.map((field) => [field, 'required'])) as Record<
      keyof GasValues,
      FieldRequirementOptions
    >;
    // We set the default to best effort here, even if it wasn't set on the original request. The idea is that we try our best to fetch all properties,
    // so that if we have a future request with the same required fields and best effort is set, then we can use the cached values
    const calculator = await this.wrapped.build({
      chainId: Number(chainIdString),
      config: { ...config, fields: { requirements, default: 'best effort' } },
    });
    return { [cacheId]: calculator } as Record<string, IQuickGasCostCalculator<GasValues, DefaultRequirements<GasValues>>>;
  }
}
