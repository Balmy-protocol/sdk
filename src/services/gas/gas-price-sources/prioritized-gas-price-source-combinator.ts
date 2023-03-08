import { ChainId, FieldsRequirements, TimeString } from '@types';
import { GasPriceResult, IGasPriceSource, MergeGasValues } from '../types';
import { combineSupportedSpeeds, filterSourcesBasedOnRequirements } from './utils';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given chain
export class PrioritizedGasPriceSourceCombinator<Sources extends IGasPriceSource<object>[] | []>
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
    return sourcesInChain[0].getGasPrice({ chainId, context, config }) as Promise<GasPriceResult<MergeGasValues<Sources>, Requirements>>;
  }
}
