import { chainsUnion } from '@chains';
import { ChainId } from '@types';
import { ITokenSource, MergeTokensFromSources, PropertiesRecord } from '../types';

export function combineTokenProperties<
  Sources extends ITokenSource<object>[] | [],
  TokenData extends MergeTokensFromSources<Sources> = MergeTokensFromSources<Sources>
>(sources: Sources): Record<ChainId, PropertiesRecord<TokenData>> {
  const chains = chainsUnion(sources.map((source) => Object.keys(source.tokenProperties()).map(Number)));
  const result: Record<ChainId, Record<string, 'optional' | 'present'>> = {};
  for (const chainId of chains) {
    const sourcesInChain = sources.filter((source) => chainId in source.tokenProperties());
    const chainResult = sourcesInChain[0].tokenProperties()[chainId] as Record<string, 'optional' | 'present'>;
    for (let i = 1; i < sourcesInChain.length; i++) {
      const sourceProperties = sourcesInChain[i].tokenProperties();
      const comb = new Set([...Object.keys(result), ...Object.keys(sourceProperties)]);
      for (const property of comb) {
        if (!(property in result) || !(property in sourceProperties) || (result as any)[property] !== (sourceProperties as any)[property]) {
          chainResult[property] = 'optional';
        }
      }
    }
    result[chainId] = chainResult;
  }

  return result as PropertiesRecord<TokenData>;
}
