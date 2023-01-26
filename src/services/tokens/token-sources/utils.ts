import { BaseToken, ITokenSource, MergeTokenTokensFromSources, PropertiesRecord } from '../types';

export function combineTokenProperties<Sources extends ITokenSource<BaseToken>[] | []>(
  sources: Sources
): PropertiesRecord<MergeTokenTokensFromSources<Sources>> {
  const result: Record<string, 'optional' | 'present'> = sources[0].tokenProperties();
  for (let i = 1; i < sources.length; i++) {
    const sourceProperties = sources[i].tokenProperties();
    const comb = new Set([...Object.keys(result), ...Object.keys(sourceProperties)]);
    for (const property of comb) {
      if (!(property in result) || !(property in sourceProperties) || (result as any)[property] !== (sourceProperties as any)[property]) {
        result[property] = 'optional';
      }
    }
  }
  return result as PropertiesRecord<MergeTokenTokensFromSources<Sources>>;
}
