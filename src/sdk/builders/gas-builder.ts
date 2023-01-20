import { ChainId } from '@types';
import { ArrayTwoOrMore } from '@utility-types';
import { Chains } from '@chains';
import { ExpirationConfigOptions } from '@shared/generic-cache';
import { IFetchService } from '@services/fetch/types';
import { IProviderSource } from '@services/providers/types';
import { IMulticallService } from '@services/multicall/types';
import { IGasPriceSource, IQuickGasCostCalculatorBuilder } from '@services/gas/types';
import { CachedGasCalculatorBuilder } from '@services/gas/gas-calculator-builders/cached-gas-calculator-builder';
import { GasCalculatorBuilderCombiner } from '@services/gas/gas-calculator-builders/gas-calculator-builder-combiner';
import { GenericGasCalculatorBuilder } from '@services/gas/gas-calculator-builders/generic-gas-calculator-builder';
import { OptimismGasCalculatorBuilder } from '@services/gas/gas-calculator-builders/optimism';
import { FastestGasPriceSourceCombinator } from '@services/gas/gas-price-sources/fastest-gas-price-source-combinator';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean';
import { PrioritizedGasPriceSourceCombinator } from '@services/gas/gas-price-sources/prioritized-gas-price-source-combinator';
import { ProviderGasPriceSource } from '@services/gas/gas-price-sources/provider';
import { GasService } from '@services/gas/gas-service';

type GasSource = 'open-ocean' | 'rpc' | { custom: IGasPriceSource<any> };
type GasSourceCalculation = 'only-first-possible-source-on-list' | 'fastest';
type GasSources = { source: GasSource } | { sources: ArrayTwoOrMore<GasSource>; calculation?: GasSourceCalculation };
type GasSourceConfig =
  | { useCaching: false }
  | { useCaching: true; expiration: ExpirationConfigOptions; overrides?: Record<ChainId, ExpirationConfigOptions> };
export type BuildGasParams = GasSources & { config?: GasSourceConfig };

export function buildGasService(
  params: BuildGasParams | undefined,
  fetchService: IFetchService,
  providerSource: IProviderSource,
  multicallService: IMulticallService
) {
  const openOceanSource = new OpenOceanGasPriceSource(fetchService);
  const providerGasSource = new ProviderGasPriceSource(providerSource);

  let source: IGasPriceSource<any>;
  if (!params) {
    source = new PrioritizedGasPriceSourceCombinator([openOceanSource, providerGasSource]);
  } else if ('source' in params) {
    source = getGasSourceForConfig(params.source, { openOceanSource, providerGasSource });
  } else {
    const sources = params.sources.map((source) => getGasSourceForConfig(source, { openOceanSource, providerGasSource })) as ArrayTwoOrMore<
      IGasPriceSource<any>
    >;
    switch (params.calculation) {
      case 'fastest':
        source = new FastestGasPriceSourceCombinator(sources);
        break;
      case 'only-first-possible-source-on-list':
      default:
        source = new PrioritizedGasPriceSourceCombinator(sources);
        break;
    }
  }

  let gasCostCalculatorBuilder: IQuickGasCostCalculatorBuilder = buildGasCalculatorBuilder({ gasPriceSource: source, multicallService });
  if (params?.config?.useCaching) {
    // Add caching if necessary
    gasCostCalculatorBuilder = new CachedGasCalculatorBuilder({
      wrapped: gasCostCalculatorBuilder,
      expiration: { default: params.config.expiration, overrides: params.config.overrides },
    });
  }

  return new GasService({ providerSource, gasCostCalculatorBuilder });
}

function getGasSourceForConfig(
  source: GasSource,
  { openOceanSource, providerGasSource }: { openOceanSource: OpenOceanGasPriceSource; providerGasSource: ProviderGasPriceSource }
) {
  if (source === 'open-ocean') {
    return openOceanSource;
  } else if (source === 'rpc') {
    return providerGasSource;
  } else {
    return source.custom;
  }
}

function buildGasCalculatorBuilder({
  gasPriceSource,
  multicallService,
}: {
  gasPriceSource: IGasPriceSource<any>;
  multicallService: IMulticallService;
}) {
  const defaultCalculatorBuilder = new GenericGasCalculatorBuilder(gasPriceSource);
  const calculatorBuilderOverrides = {
    [Chains.OPTIMISM.chainId]: new OptimismGasCalculatorBuilder(multicallService),
  };
  return new GasCalculatorBuilderCombiner({ defaultCalculatorBuilder, calculatorBuilderOverrides });
}
