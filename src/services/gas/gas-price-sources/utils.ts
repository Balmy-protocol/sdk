import { ChainId } from '@types';
import { IGasPriceSource, MergeGasSpeedsFromSources } from '../types';

export function combineSupportedSpeeds<Sources extends IGasPriceSource<any>[] | []>(
  sources: Sources
): Record<ChainId, MergeGasSpeedsFromSources<Sources>[]> {
  const merged: Record<ChainId, Set<MergeGasSpeedsFromSources<Sources>>> = {};
  for (const source of sources) {
    const support = source.supportedSpeeds();
    for (const chainId in support) {
      if (!(chainId in merged)) merged[chainId] = new Set();
      for (const speed of support[chainId]) {
        merged[chainId].add(speed);
      }
    }
  }
  const entries = Object.entries(merged).map<[ChainId, MergeGasSpeedsFromSources<Sources>[]]>(([chainId, set]) => [Number(chainId), [...set]]);
  return Object.fromEntries(entries);
}
