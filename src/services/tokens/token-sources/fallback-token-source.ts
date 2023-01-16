import { ChainId, TimeString, TokenAddress } from '@types';
import { chainsUnion } from '@chains';
import { AddedProperties, BaseToken, ITokenSource, MergeTokenTokensFromSources } from '@services/tokens/types';
import { timeoutPromise } from '@shared/timeouts';

// This fallback source will use different sources and combine the results of each of them
export class FallbackTokenSource<Sources extends ITokenSource<any>[] | []> implements ITokenSource<MergeTokenTokensFromSources<Sources>> {
  private readonly sourceQueryTimeout?: TimeString;

  constructor(private readonly sources: Sources, options?: { sourceQueryTimeout: TimeString }) {
    this.sourceQueryTimeout = options?.sourceQueryTimeout;
  }

  supportedChains(): ChainId[] {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  async getTokens(
    addresses: Record<ChainId, TokenAddress[]>
  ): Promise<Record<ChainId, Record<TokenAddress, MergeTokenTokensFromSources<Sources>>>> {
    const result: Record<ChainId, Record<TokenAddress, MergeTokenTokensFromSources<Sources>>> = Object.fromEntries(
      Object.keys(addresses).map((chainId) => [chainId, {}])
    );

    // TODO: Make it smarter. The idea would be that if a source has finished and returned all tokens, we can resolve the promise.
    // Even if there are others that still haven't finished, but don't have any new properties. If there are unfinished sources with
    // new properties, or there are some missing tokens, we would still have to wait
    const promises = this.sources.map(async (source) => {
      const addressesForSource = getAddressesForSource(source, addresses);
      const sourceResult = await timeoutPromise(source.getTokens(addressesForSource), this.sourceQueryTimeout);
      for (const chainId in sourceResult) {
        for (const token of Object.values(sourceResult[chainId])) {
          const previousToken = result[chainId][token.address];
          result[chainId][token.address] = { ...previousToken, ...token };
        }
      }
    });

    await Promise.allSettled(promises);
    return result;
  }

  addedProperties(): AddedProperties<MergeTokenTokensFromSources<Sources>>[] {
    return [...new Set(this.sources.flatMap((source) => source.addedProperties()))] as AddedProperties<MergeTokenTokensFromSources<Sources>>[];
  }
}

function getAddressesForSource<Token extends BaseToken>(
  source: ITokenSource<Token>,
  addresses: Record<ChainId, TokenAddress[]>
): Record<ChainId, TokenAddress[]> {
  const chainsForSource = new Set(source.supportedChains().map((chainId) => `${chainId}`));
  const filteredEntries = Object.entries(addresses)
    .filter(([chainId]) => chainsForSource.has(chainId))
    .map<[ChainId, TokenAddress[]]>(([chainId, addresses]) => [parseInt(chainId), addresses]);
  return Object.fromEntries(filteredEntries);
}
