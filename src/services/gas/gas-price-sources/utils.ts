import { chainsUnion } from '@chains';
import { calculateFieldRequirements } from '@shared/field-requirements';
import { ChainId, FieldRequirementOptions, FieldsRequirements, SupportInChain } from '@types';
import { IGasPriceSource, MergeGasValues } from '../types';

export function combineSupportedSpeeds<Sources extends IGasPriceSource<object>[] | []>(sources: Sources) {
  const allChains = chainsUnion(sources.map((source) => Object.keys(source.supportedSpeeds()).map(Number)));
  const result: Record<ChainId, SupportInChain<MergeGasValues<Sources>>> = {};
  for (const chainId of allChains) {
    result[chainId] = combineSpeedsInChain(chainId, sources);
  }
  return result;
}

function combineSpeedsInChain<Sources extends IGasPriceSource<object>[] | []>(
  chainId: ChainId,
  sources: Sources
): SupportInChain<MergeGasValues<Sources>> {
  const sourcesInChain: Sources = sources.filter((source) => chainId in source.supportedSpeeds()) as Sources;
  const result = sourcesInChain[0].supportedSpeeds();
  for (let i = 1; i < sourcesInChain.length; i++) {
    const sourceSpeeds = sourcesInChain[i].supportedSpeeds();
    const allSpeeds = [...new Set(...Object.keys(sourceSpeeds), ...Object.keys(result))];
    for (const speed of allSpeeds) {
      const speedAny = speed as any;
      if (result[speedAny] !== sourceSpeeds[speedAny]) {
        (result as any)[speedAny] = 'optional';
      }
    }
  }
  return result as SupportInChain<MergeGasValues<Sources>>;
}

// TODO: Test
export function filterSourcesBasedOnRequirements<Sources extends IGasPriceSource<object>[] | []>(
  sources: Sources,
  chainId: ChainId,
  requirements: FieldsRequirements<MergeGasValues<Sources>> | undefined
) {
  const combined = combineSpeedsInChain(chainId, sources);
  const fieldRequirements = calculateFieldRequirements(combined, requirements);
  return sources.filter((source) => doesSourceMeetRequirements(fieldRequirements, source.supportedSpeeds()[chainId]));
}

function doesSourceMeetRequirements(requirements: Record<string, FieldRequirementOptions>, support: object | undefined) {
  for (const speed in requirements) {
    if (requirements[speed] === 'required' && (support as any)?.[speed] !== 'present') {
      return false;
    }
  }
  return true;
}
