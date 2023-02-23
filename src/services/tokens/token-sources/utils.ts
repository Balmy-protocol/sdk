import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { ITokenSource, KeyOfToken, MergeTokensFromSources } from '../types';

export function combineTokenProperties<Sources extends ITokenSource<object>[]>(
  sources: Sources
): Record<ChainId, KeyOfToken<MergeTokensFromSources<Sources>>[]> {
  const chains = chainsUnion(sources.map((source) => Object.keys(source.tokenProperties()).map(Number)));
  const result: Record<ChainId, KeyOfToken<MergeTokensFromSources<Sources>>[]> = {};
  for (const chainId of chains) {
    const keys: Set<KeyOfToken<MergeTokensFromSources<Sources>>> = new Set();
    for (const source of sources) {
      for (const property of source.tokenProperties()[chainId] ?? []) {
        keys.add(property);
      }
    }
    result[chainId] = [...keys];
  }

  return result;
}
