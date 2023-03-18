import {
  calculateFieldRequirements,
  couldSupportMeetRequirements,
  combineSourcesSupport,
  doesResponseMeetRequirements,
} from '@shared/requirements-and-support';
import { ChainId, FieldRequirementOptions, FieldsRequirements, TimeString } from '@types';
import { IGasPriceSource, MergeGasValues, GasPriceResult } from '../types';

// This source will take a list of sources, and try to calculate the gas price on all of them, returning
// the one that resolves first
export class FastestGasPriceSourceCombinator<Sources extends IGasPriceSource<object>[] | []>
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
    const gasResults = sourcesInChain.map((source) =>
      source.getGasPrice({ chainId, config, context }).then((response) => failIfResponseDoesNotMeetRequirements(response, config?.fields))
    );
    return Promise.any(gasResults) as Promise<GasPriceResult<MergeGasValues<Sources>, Requirements>>;
  }
}

function failIfResponseDoesNotMeetRequirements<Values extends Object, Requirements extends FieldsRequirements<Values>>(
  response: GasPriceResult<Values, Requirements>,
  requirements: Requirements | undefined
) {
  if (!doesResponseMeetRequirements(response, requirements)) {
    throw new Error('Failed to meet requirements');
  }
  return response;
}
