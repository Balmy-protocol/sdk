import { ChainId, DefaultRequirements, FieldRequirementOptions, FieldsRequirements, TimeString } from '@types';
import { IQuickGasCostCalculatorBuilder, IQuickGasCostCalculator, SupportedGasValues } from '../types';
import { Cache, ExpirationConfigOptions } from '@shared/generic-cache';
import { calculateFieldRequirements } from '@shared/requirements-and-support';

type ConstructorParameters<GasValues extends SupportedGasValues> = {
  wrapped: IQuickGasCostCalculatorBuilder<GasValues>;
  expiration: {
    default: ExpirationConfigOptions;
    overrides?: Record<ChainId, ExpirationConfigOptions>;
  };
};
type CacheContext = { timeout?: TimeString } | undefined;
export class CachedGasCalculatorBuilder<GasValues extends SupportedGasValues> implements IQuickGasCostCalculatorBuilder<GasValues> {
  private readonly cache: Cache<CacheContext, string, IQuickGasCostCalculator<GasValues>>;
  private readonly wrapped: IQuickGasCostCalculatorBuilder<GasValues>;
  private readonly expirationOverrides: Record<ChainId, ExpirationConfigOptions>;

  constructor({ wrapped, expiration }: ConstructorParameters<GasValues>) {
    this.wrapped = wrapped;
    this.cache = new Cache<CacheContext, string, IQuickGasCostCalculator<GasValues>>({
      calculate: (config, [cacheId]) => this.fromCacheKey(cacheId, config), // We know that we will only ask for one chain at a time
      expirationConfig: expiration.default,
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
    const requirementsString = Object.entries(fieldRequirements)
      .map(([field, requirement]) => `${field}:${requirement}`)
      .join('|');
    return `${chainId}-${requirementsString}`;
  }

  private async fromCacheKey(cacheId: string, config: CacheContext) {
    const [chainIdString, requirementsString] = cacheId.split('-');
    const requirements: Record<keyof GasValues, FieldRequirementOptions> = Object.fromEntries(
      requirementsString.split('|').map((fieldRequirement) => fieldRequirement.split(':'))
    );
    const calculator = await this.wrapped.build({
      chainId: Number(chainIdString),
      config: { ...config, fields: { requirements } },
    });
    return { [cacheId]: calculator } as Record<string, IQuickGasCostCalculator<GasValues, DefaultRequirements<GasValues>>>;
  }
}
