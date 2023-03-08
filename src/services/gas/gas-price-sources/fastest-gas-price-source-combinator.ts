import { ChainId, FieldsRequirements, TimeString } from '@types';
import { IGasPriceSource, MergeGasValues, GasPriceResult } from '../types';
import { combineSupportedSpeeds, filterSourcesBasedOnRequirements } from './utils';

// This source will take a list of sources, and try to calculate the gas price on all of them, returning
// the one that resolves first
export class FastestGasPriceSourceCombinator<Sources extends IGasPriceSource<object>[] | []>
  implements IGasPriceSource<MergeGasValues<Sources>>
{
  constructor(private readonly sources: Sources) {}

  supportedSpeeds() {
    return combineSupportedSpeeds(this.sources);
  }

  // TODO: Test
  getGasPrice<Requirements extends FieldsRequirements<MergeGasValues<Sources>>>({
    chainId,
    config,
    context,
  }: {
    chainId: ChainId;
    config?: { fields?: Requirements };
    context?: { timeout?: TimeString };
  }) {
    const sourcesInChain = filterSourcesBasedOnRequirements(this.sources, chainId, config?.fields);
    if (sourcesInChain.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    return Promise.any(sourcesInChain.map((source) => source.getGasPrice({ chainId, config, context }))) as Promise<
      GasPriceResult<MergeGasValues<Sources>, Requirements>
    >;
  }
}
