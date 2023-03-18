import { couldSupportMeetRequirements, combineSourcesSupport, doesResponseMeetRequirements } from '@shared/requirements-and-support';
import { ChainId, FieldsRequirements, TimeString } from '@types';
import { GasPriceResult, IGasPriceSource, MergeGasValues } from '../types';

// This source will take a list of sources, sorted by priority, and use the first one possible
// that supports the given chain
export class PrioritizedGasPriceSourceCombinator<Sources extends IGasPriceSource<object>[] | []>
  implements IGasPriceSource<MergeGasValues<Sources>>
{
  constructor(private readonly sources: Sources) {
    if (sources.length === 0) throw new Error('No sources were specified');
  }

  supportedSpeeds() {
    return combineSourcesSupport<IGasPriceSource<object>, MergeGasValues<Sources>>(this.sources, (source) => source.supportedSpeeds());
  }

  async getGasPrice<Requirements extends FieldsRequirements<MergeGasValues<Sources>>>({
    chainId,
    config,
    context,
  }: {
    chainId: ChainId;
    config?: { fields?: Requirements };
    context?: { timeout?: TimeString };
  }) {
    const sourcesInChain = this.sources.filter(
      (source) => chainId in source.supportedSpeeds() && couldSupportMeetRequirements(source.supportedSpeeds()[chainId], config?.fields)
    );
    if (sourcesInChain.length === 0) throw new Error(`Chain with id ${chainId} cannot support the given requirements`);
    const gasResults = sourcesInChain.map((source) => source.getGasPrice({ chainId, config, context }));
    return new Promise<GasPriceResult<MergeGasValues<Sources>, Requirements>>(async (resolve, reject) => {
      for (let i = 0; i < gasResults.length; i++) {
        try {
          const response = await gasResults[i];
          if (doesResponseMeetRequirements(response, config?.fields)) {
            resolve(response as GasPriceResult<MergeGasValues<Sources>, Requirements>);
          }
        } catch {}
      }
      reject(new Error('Could not fetch gas prices that met the given requirements'));
    });
  }
}
