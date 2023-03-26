import { ChainId } from '@types';
import { Chains } from '@chains';
import { ExpirationConfigOptions } from '@shared/generic-cache';
import { IFetchService } from '@services/fetch/types';
import { IProviderSource } from '@services/providers/types';
import { IMulticallService } from '@services/multicall/types';
import { ExtractGasValues, IGasPriceSource, IGasService, IQuickGasCostCalculatorBuilder, SupportedGasValues } from '@services/gas/types';
import { CachedGasCalculatorBuilder } from '@services/gas/gas-calculator-builders/cached-gas-calculator-builder';
import { GasCalculatorBuilderCombiner } from '@services/gas/gas-calculator-builders/gas-calculator-builder-combiner';
import { GenericGasCalculatorBuilder } from '@services/gas/gas-calculator-builders/generic-gas-calculator-builder';
import { OptimismGasCalculatorBuilder } from '@services/gas/gas-calculator-builders/optimism';
import { FastestGasPriceSourceCombinator } from '@services/gas/gas-price-sources/fastest-gas-price-source-combinator';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean-gas-price-source';
import { PrioritizedGasPriceSourceCombinator } from '@services/gas/gas-price-sources/prioritized-gas-price-source-combinator';
import { RPCGasPriceSource } from '@services/gas/gas-price-sources/rpc-gas-price-source';
import { GasService } from '@services/gas/gas-service';
import { OwlracleGasPriceSource } from '@services/gas/gas-price-sources/owlracle-gas-price-source';
import { EthGasStationGasPriceSource } from '@services/gas/gas-price-sources/eth-gas-station-gas-price-source';
import { EtherscanGasPriceSource } from '@services/gas/gas-price-sources/etherscan-gas-price-source';
import { PolygonGasStationGasPriceSource } from '@services/gas/gas-price-sources/polygon-gas-station-gas-price-source';
import { AggregatorGasPriceSource, GasPriceAggregationMethod } from '@services/gas/gas-price-sources/aggregator-gas-price-source';
import { ParaswapGasPriceSource } from '@services/gas/gas-price-sources/paraswap-gas-price-source';

// TODO: When Optimism moves to Bedrock, we won't need a special gas calculator builder for it. When that happens, we can have only one calculation
// builder and move the cache to the source level (now it's at the calculator builder level). When we do that, we can remove this here and simplify
// quite a lot of things
type CachelessInput = Exclude<GasSourceInput, { type: 'cached' }>;
type SingleSourceInput = Exclude<CachelessInput, { type: 'fastest' } | { type: 'aggregate' } | { type: 'prioritized' }>;

export type GasSourceInput =
  | { type: 'open-ocean' }
  | { type: 'paraswap' }
  | { type: 'rpc' }
  | { type: 'eth-gas-station' }
  | { type: 'polygon-gas-station' }
  | {
      type: 'cached';
      underlyingSource: CachelessInput;
      expiration: ExpirationConfigOptions & { overrides?: Record<ChainId, ExpirationConfigOptions> };
    }
  | { type: 'owlracle'; key: string }
  | { type: 'etherscan'; keys?: Record<ChainId, string> }
  | { type: 'custom'; instance: IGasPriceSource<any> }
  | { type: 'fastest'; sources: SingleSourceInput[] }
  | { type: 'aggregate'; sources: SingleSourceInput[]; by: GasPriceAggregationMethod }
  | { type: 'prioritized'; sources: SingleSourceInput[] };
export type BuildGasParams = { source: GasSourceInput };

export type CalculateGasValuesFromSourceParams<Params extends BuildGasParams | undefined> = ExtractGasValues<CalculateSourceFromParams<Params>>;

type CalculateSourceFromParams<T extends BuildGasParams | undefined> = T extends BuildGasParams
  ? CalculateSourceFromInput<T['source']>
  : CalculateSourceFromInput<undefined>;

type CalculateSourceFromInput<Input extends GasSourceInput | undefined> = undefined extends Input
  ? AggregatorGasPriceSource<PublicSources>
  : Input extends { type: 'open-ocean' }
  ? OpenOceanGasPriceSource
  : Input extends { type: 'paraswap' }
  ? ParaswapGasPriceSource
  : Input extends { type: 'rpc' }
  ? RPCGasPriceSource
  : Input extends { type: 'eth-gas-station' }
  ? EthGasStationGasPriceSource
  : Input extends { type: 'polygon-gas-station' }
  ? PolygonGasStationGasPriceSource
  : Input extends { type: 'owlracle' }
  ? OwlracleGasPriceSource
  : Input extends { type: 'etherscan' }
  ? EtherscanGasPriceSource
  : Input extends { type: 'custom' }
  ? Input['instance']
  : Input extends { type: 'cached' }
  ? CalculateSourceFromInput<Input['underlyingSource']>
  : Input extends { type: 'fastest' }
  ? FastestGasPriceSourceCombinator<SourcesFromArray<Input['sources']>>
  : Input extends { type: 'aggregate' }
  ? AggregatorGasPriceSource<SourcesFromArray<Input['sources']>>
  : Input extends { type: 'prioritized' }
  ? PrioritizedGasPriceSourceCombinator<SourcesFromArray<Input['sources']>>
  : never;

type SourcesFromArray<Inputs extends SingleSourceInput[]> = Inputs extends SingleSourceInput[]
  ? { [K in keyof Inputs]: Inputs[K] extends GasSourceInput ? CalculateSourceFromInput<Inputs[K]> : Inputs[K] }
  : Inputs;

export function buildGasService<Params extends BuildGasParams | undefined>(
  params: Params,
  fetchService: IFetchService,
  providerSource: IProviderSource,
  multicallService: IMulticallService
): IGasService<ExtractGasValues<CalculateSourceFromParams<Params>>> {
  const sourceInput: CachelessInput | undefined = params?.source?.type === 'cached' ? params.source.underlyingSource : params?.source;
  const source = buildSource(sourceInput, { fetchService, multicallService, providerSource }) as IGasPriceSource<
    CalculateGasValuesFromSourceParams<Params>
  >;

  let gasCostCalculatorBuilder = buildGasCalculatorBuilder({ gasPriceSource: source, multicallService }) as IQuickGasCostCalculatorBuilder<
    CalculateGasValuesFromSourceParams<Params>
  >;
  if (params?.source?.type === 'cached') {
    // Add caching if necessary
    gasCostCalculatorBuilder = new CachedGasCalculatorBuilder({
      wrapped: gasCostCalculatorBuilder,
      expiration: { default: params.source.expiration, overrides: params.source.expiration.overrides },
    });
  }

  return new GasService({ providerSource, gasCostCalculatorBuilder });
}

function buildSource(
  source: CachelessInput | undefined,
  {
    providerSource,
    multicallService,
    fetchService,
  }: { providerSource: IProviderSource; multicallService: IMulticallService; fetchService: IFetchService }
): IGasPriceSource<object> {
  switch (source?.type) {
    case undefined:
      return new AggregatorGasPriceSource(calculatePublicSources({ fetchService, providerSource }), 'median');
    case 'open-ocean':
      return new OpenOceanGasPriceSource(fetchService);
    case 'paraswap':
      return new ParaswapGasPriceSource(fetchService);
    case 'rpc':
      return new RPCGasPriceSource(providerSource);
    case 'eth-gas-station':
      return new EthGasStationGasPriceSource(fetchService);
    case 'polygon-gas-station':
      return new PolygonGasStationGasPriceSource(fetchService);
    case 'etherscan':
      return new EtherscanGasPriceSource(fetchService, source.keys);
    case 'owlracle':
      return new OwlracleGasPriceSource(fetchService, source.key);
    case 'custom':
      return source.instance;
    case 'aggregate':
      return new AggregatorGasPriceSource(calculateSources(source.sources, { fetchService, multicallService, providerSource }), source.by);
    case 'fastest':
      return new FastestGasPriceSourceCombinator(calculateSources(source.sources, { fetchService, multicallService, providerSource }));
    case 'prioritized':
      return new PrioritizedGasPriceSourceCombinator(
        source.sources.map((source) => buildSource(source, { fetchService, multicallService, providerSource }))
      );
  }
}

type PublicSources = [
  OpenOceanGasPriceSource,
  RPCGasPriceSource,
  EthGasStationGasPriceSource,
  PolygonGasStationGasPriceSource,
  EtherscanGasPriceSource,
  ParaswapGasPriceSource
];

function calculateSources(
  sources: CachelessInput[],
  {
    providerSource,
    multicallService,
    fetchService,
  }: { providerSource: IProviderSource; multicallService: IMulticallService; fetchService: IFetchService }
) {
  return sources.map((source) => buildSource(source, { fetchService, multicallService, providerSource }));
}

function calculatePublicSources({
  providerSource,
  fetchService,
}: {
  providerSource: IProviderSource;
  fetchService: IFetchService;
}): PublicSources {
  const openOcean = new OpenOceanGasPriceSource(fetchService);
  const rpc = new RPCGasPriceSource(providerSource);
  const ethGasStation = new EthGasStationGasPriceSource(fetchService);
  const polygonGasStation = new PolygonGasStationGasPriceSource(fetchService);
  const etherscan = new EtherscanGasPriceSource(fetchService);
  const paraswap = new ParaswapGasPriceSource(fetchService);
  return [openOcean, rpc, ethGasStation, polygonGasStation, etherscan, paraswap];
}

function buildGasCalculatorBuilder<GasValues extends SupportedGasValues>({
  gasPriceSource,
  multicallService,
}: {
  gasPriceSource: IGasPriceSource<GasValues>;
  multicallService: IMulticallService;
}) {
  const defaultCalculatorBuilder = new GenericGasCalculatorBuilder(gasPriceSource);
  const calculatorBuilderOverrides = {
    [Chains.OPTIMISM.chainId]: new OptimismGasCalculatorBuilder(multicallService),
  };
  return new GasCalculatorBuilderCombiner({ defaultCalculatorBuilder, calculatorBuilderOverrides });
}
