import { ChainId, FieldRequirementOptions, FieldsRequirements, TimeString } from '@types';
import { SupportedGasValues, IGasPriceSource, GasPriceResult } from '../types';
import { ConcurrentLRUCacheWithContext, ExpirationConfigOptions } from '@shared/concurrent-lru-cache';
import { calculateFieldRequirements } from '@shared/requirements-and-support';

type ConstructorParameters<GasValues extends SupportedGasValues> = {
  underlying: IGasPriceSource<GasValues>;
  expiration: {
    default: ExpirationConfigOptions;
    overrides?: Record<ChainId, ExpirationConfigOptions>;
  };
  maxSize?: number;
};
type CacheContext = { timeout?: TimeString } | undefined;
export class CachedGasPriceSource<GasValues extends SupportedGasValues> implements IGasPriceSource<GasValues> {
  private readonly cache: ConcurrentLRUCacheWithContext<CacheContext, string, GasPriceResult<GasValues>>;
  private readonly underlying: IGasPriceSource<GasValues>;
  private readonly expirationOverrides: Record<ChainId, ExpirationConfigOptions>;

  constructor({ underlying, expiration, maxSize }: ConstructorParameters<GasValues>) {
    this.underlying = underlying;
    this.cache = new ConcurrentLRUCacheWithContext<CacheContext, string, GasPriceResult<GasValues>>({
      calculate: (config, [cacheId]) => this.fromCacheKey(cacheId, config), // We know that we will only ask for one chain at a time
      config: {
        expiration: expiration.default,
        maxSize: maxSize ?? Object.keys(underlying.supportedSpeeds()).length,
      },
    });
    this.expirationOverrides = expiration.overrides ?? {};
  }

  supportedSpeeds() {
    return this.underlying.supportedSpeeds();
  }

  async getGasPrice<Requirements extends FieldsRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { fields?: Requirements; timeout?: TimeString };
  }): Promise<GasPriceResult<GasValues, Requirements>> {
    const expirationConfig = this.expirationOverrides[chainId];
    const key = this.toCacheKey(chainId, config?.fields);
    const gasPrice = await this.cache.getOrCalculateSingle({
      key,
      context: config,
      expirationConfig,
      timeout: config?.timeout,
    });
    return gasPrice as GasPriceResult<GasValues, Requirements>;
  }

  private toCacheKey<Requirements extends FieldsRequirements<GasValues>>(chainId: ChainId, requirements: Requirements | undefined) {
    const support = this.underlying.supportedSpeeds()[chainId];
    const fieldRequirements = calculateFieldRequirements(support, requirements);
    const requiredFields = Object.entries(fieldRequirements)
      .filter(([, requirement]) => requirement === 'required')
      .map(([field]) => field)
      .sort()
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
    const gasPrice = await this.underlying.getGasPrice({
      chainId: Number(chainIdString),
      config: { ...config, fields: { requirements, default: 'best effort' } },
    });
    return { [cacheId]: gasPrice } as Record<string, GasPriceResult<GasValues>>;
  }
}
