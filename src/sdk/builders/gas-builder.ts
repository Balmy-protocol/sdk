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
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean-gas-price-source';
import { PrioritizedGasPriceSourceCombinator } from '@services/gas/gas-price-sources/prioritized-gas-price-source-combinator';
import { RPCGasPriceSource } from '@services/gas/gas-price-sources/rpc-gas-price-source';
import { GasService } from '@services/gas/gas-service';
import { OwlracleGasPriceSource } from '@services/gas/gas-price-sources/owlracle-gas-price-source';
import { EthGasStationGasPriceSource } from '@services/gas/gas-price-sources/eth-gas-station-gas-price-source';
import { EtherscanGasPriceSource } from '@services/gas/gas-price-sources/etherscan-gas-price-source';
import { PolygonGasStationGasPriceSource } from '@services/gas/gas-price-sources/polygon-gas-station-gas-price-source';

export type GasSourceInput =
  | { type: 'open-ocean' }
  | { type: 'rpc' }
  | { type: 'eth-gas-station' }
  | { type: 'polygon-gas-station' }
  | { type: 'owlracle'; key: string }
  | { type: 'etherscan'; key?: string }
  | { type: 'custom'; instance: IGasPriceSource<any> }
  | { type: 'fastest'; sources: ArrayTwoOrMore<GasSourceInput> }
  | { type: 'only-first-source-that-supports-chain'; sources: ArrayTwoOrMore<GasSourceInput> };
type CachingConfig =
  | { useCaching: false }
  | { useCaching: true; expiration: ExpirationConfigOptions & { overrides?: Record<ChainId, ExpirationConfigOptions> } };
export type GasSourceConfigInput = { caching?: CachingConfig };
export type BuildGasParams = { source: GasSourceInput; config?: GasSourceConfigInput };

export function buildGasService(
  params: BuildGasParams | undefined,
  fetchService: IFetchService,
  providerSource: IProviderSource,
  multicallService: IMulticallService
) {
  const openOcean = new OpenOceanGasPriceSource(fetchService);
  const rpc = new RPCGasPriceSource(providerSource);
  const source = buildSource(params?.source, { fetchService, openOcean, rpc });

  let gasCostCalculatorBuilder: IQuickGasCostCalculatorBuilder = buildGasCalculatorBuilder({ gasPriceSource: source, multicallService });
  if (params?.config?.caching?.useCaching) {
    // Add caching if necessary
    gasCostCalculatorBuilder = new CachedGasCalculatorBuilder({
      wrapped: gasCostCalculatorBuilder,
      expiration: { default: params.config.caching.expiration, overrides: params.config.caching.expiration.overrides },
    });
  }

  return new GasService({ providerSource, gasCostCalculatorBuilder });
}

function buildSource(
  source: GasSourceInput | undefined,
  { openOcean, rpc, fetchService }: { openOcean: OpenOceanGasPriceSource; rpc: RPCGasPriceSource; fetchService: IFetchService }
): IGasPriceSource<any> {
  switch (source?.type) {
    case undefined:
      return new PrioritizedGasPriceSourceCombinator([openOcean, rpc]);
    case 'open-ocean':
      return openOcean;
    case 'rpc':
      return rpc;
    case 'eth-gas-station':
      return new EthGasStationGasPriceSource(fetchService);
    case 'polygon-gas-station':
      return new PolygonGasStationGasPriceSource(fetchService);
    case 'etherscan':
      return new EtherscanGasPriceSource(fetchService, source.key);
    case 'owlracle':
      return new OwlracleGasPriceSource(fetchService, source.key);
    case 'custom':
      return source.instance;
    case 'fastest':
      return new FastestGasPriceSourceCombinator(source.sources.map((source) => buildSource(source, { fetchService, openOcean, rpc })));
    case 'only-first-source-that-supports-chain':
      return new PrioritizedGasPriceSourceCombinator(source.sources.map((source) => buildSource(source, { fetchService, openOcean, rpc })));
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
