import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { IGasPriceSource, MergeGasSpeedsFromSources } from '../types';

export function combineSupportedSpeeds<Sources extends IGasPriceSource<any>[] | []>(sources: Sources) {
  const allChains = chainsUnion(sources.map((source) => Object.keys(source.supportedSpeeds()).map(Number)));
  const result: Record<ChainId, MergeGasSpeedsFromSources<Sources>[]> = {};
  for (const chainId of allChains) {
    result[chainId] = combineSpeedsInChain(chainId, sources);
  }
  return result;
}

function combineSpeedsInChain<Sources extends IGasPriceSource<any>[] | []>(
  chainId: ChainId,
  sources: Sources
): MergeGasSpeedsFromSources<Sources>[] {
  const set: Set<MergeGasSpeedsFromSources<Sources>> = new Set();
  for (const source of sources) {
    const support = source.supportedSpeeds();
    for (const speed of support[chainId] ?? []) {
      set.add(speed);
    }
  }
  return [...set];
}

// When we combine sources, we might end up in a situation where one of the sources in a chain supports less speeds than the rest
// So when this happens, the result of this particular source will not match the speeds reported by the combination of all of them
// So this function allows us to filter out those sources, and only keep the ones that fully match the reported support
export function keepSourcesWithMatchingSupportOnChain<Sources extends IGasPriceSource<any>[] | []>(
  chainId: ChainId,
  sources: Sources
): IGasPriceSource<any>[] {
  const combinedSupport = combineSpeedsInChain(chainId, sources) ?? [];
  if (combinedSupport.length === 0) return [];
  return sources.filter((source) => (source.supportedSpeeds()[chainId]?.length ?? 0) === combinedSupport.length);
}
