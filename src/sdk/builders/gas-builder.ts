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

type GasSource =
  | { type: 'open-ocean' }
  | { type: 'rpc' }
  | { type: 'custom'; instance: IGasPriceSource<any> }
  | { type: 'fastest'; sources: ArrayTwoOrMore<GasSource> }
  | { type: 'only-first-source-that-supports-chain'; sources: ArrayTwoOrMore<GasSource> };
type GasSourceConfig =
  | { useCaching: false }
  | { useCaching: true; expiration: ExpirationConfigOptions; overrides?: Record<ChainId, ExpirationConfigOptions> };
export type BuildGasParams = { source: GasSource; config?: GasSourceConfig };

export function buildGasService(
  params: BuildGasParams | undefined,
  fetchService: IFetchService,
  providerSource: IProviderSource,
  multicallService: IMulticallService
) {
  const openOcean = new OpenOceanGasPriceSource(fetchService);
  const provider = new ProviderGasPriceSource(providerSource);
  const source = buildSource(params?.source, { openOcean, provider });

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

function buildSource(
  source: GasSource | undefined,
  { openOcean, provider }: { openOcean: OpenOceanGasPriceSource; provider: ProviderGasPriceSource }
): IGasPriceSource<any> {
  switch (source?.type) {
    case undefined:
      return new PrioritizedGasPriceSourceCombinator([openOcean, provider]);
    case 'open-ocean':
      return openOcean;
    case 'rpc':
      return provider;
    case 'custom':
      return source.instance;
    case 'fastest':
      return new FastestGasPriceSourceCombinator(source.sources.map((source) => buildSource(source, { openOcean, provider })));
    case 'only-first-source-that-supports-chain':
      return new PrioritizedGasPriceSourceCombinator(source.sources.map((source) => buildSource(source, { openOcean, provider })));
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
