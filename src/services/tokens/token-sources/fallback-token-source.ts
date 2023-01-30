import { ChainId, TimeString, TokenAddress } from '@types';
import { chainsUnion } from '@chains';
import { BaseToken, ITokenSource, MergeTokenTokensFromSources, PropertiesRecord } from '@services/tokens/types';
import { timeoutPromise } from '@shared/timeouts';
import { combineTokenProperties } from './utils';

// This fallback source will use different sources and combine the results of each of them
export class FallbackTokenSource<Sources extends ITokenSource<BaseToken>[] | []> implements ITokenSource<MergeTokenTokensFromSources<Sources>> {
  constructor(private readonly sources: Sources) {}

  supportedChains(): ChainId[] {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getTokens(
    addresses: Record<ChainId, TokenAddress[]>,
    context?: { timeout?: TimeString }
  ): Promise<Record<ChainId, Record<TokenAddress, MergeTokenTokensFromSources<Sources>>>> {
    return new Promise<Record<ChainId, Record<TokenAddress, MergeTokenTokensFromSources<Sources>>>>((resolve, reject) => {
      const result: Record<ChainId, Record<TokenAddress, MergeTokenTokensFromSources<Sources>>> = {};
      const propertiesCounter = this.buildPropertiesCounter(addresses);

      let sourcesLeftToFulfil = this.sources.length;
      let successfulRequests = 0;

      const handleFulfil = (source: ITokenSource) => {
        this.updatePropertiesCounterWhenSourceFulfilled(propertiesCounter, source, addresses);

        if (--sourcesLeftToFulfil === 0 || Object.keys(propertiesCounter).length === 0) {
          if (successfulRequests > 0) {
            resolve(result);
          } else {
            reject(new Error('Could not find tokens for the given addresses'));
          }
        }
      };

      this.sources.forEach(async (source) => {
        const addressesForSource = getAddressesForSource(source, addresses);
        if (Object.keys(addressesForSource).length === 0) {
          // If there is nothing to query for this source, exit
          handleFulfil(source);
          return;
        }

        timeoutPromise(source.getTokens(addressesForSource), context?.timeout, { reduceBy: '100' })
          .then((sourceResult) => {
            successfulRequests++;
            for (const [chainIdString, tokenRecord] of Object.entries(sourceResult)) {
              const chainId = parseInt(chainIdString);
              const tokens = Object.values(tokenRecord);
              if (!(chainId in result) && tokens.length > 0) result[chainId] = {};

              for (const token of tokens) {
                // Add to result
                result[chainId][token.address] = { ...result[chainId][token.address], ...token };

                // Remove from counter
                for (const tokenProperty in token) {
                  const property = tokenProperty as keyof MergeTokenTokensFromSources<Sources>;
                  delete propertiesCounter[chainId][token.address][property];
                }
              }
            }
          })
          .finally(() => handleFulfil(source));
      });
    });
  }

  tokenProperties(): PropertiesRecord<MergeTokenTokensFromSources<Sources>> {
    return combineTokenProperties(this.sources);
  }

  private buildPropertiesCounter(addresses: Record<ChainId, TokenAddress[]>) {
    const propertiesCounter: Record<ChainId, Record<TokenAddress, Record<keyof MergeTokenTokensFromSources<Sources>, number>>> = {};
    for (const chainId in addresses) {
      propertiesCounter[chainId];
      const counter: Record<keyof MergeTokenTokensFromSources<Sources>, number> = {} as any;
      for (const source of this.sources) {
        if (source.supportedChains().includes(parseInt(chainId))) {
          for (const tokenProperty in source.tokenProperties()) {
            const property = tokenProperty as keyof MergeTokenTokensFromSources<Sources>;
            counter[property] = (counter[property] ?? 0) + 1;
          }
        }
      }
      propertiesCounter[chainId] = {};
      for (const tokenAddress of addresses[chainId]) {
        propertiesCounter[chainId][tokenAddress] = counter;
      }
    }
    return propertiesCounter;
  }

  private updatePropertiesCounterWhenSourceFulfilled(
    propertiesCounter: Record<ChainId, Record<TokenAddress, Record<keyof MergeTokenTokensFromSources<Sources>, number>>>,
    source: ITokenSource<BaseToken>,
    addresses: Record<ChainId, TokenAddress[]>
  ) {
    const tokenProperties = source.tokenProperties();
    const addressesForSource = getAddressesForSource(source, addresses);
    for (const [chainIdString, addresses] of Object.entries(addressesForSource)) {
      const chainId = parseInt(chainIdString);
      for (const address of addresses) {
        for (const tokenProperty in tokenProperties) {
          const property = tokenProperty as keyof MergeTokenTokensFromSources<Sources>;
          const counter = propertiesCounter[chainId][address][property];
          if (counter !== undefined) {
            if (counter === 1) {
              delete propertiesCounter[chainId][address][property];
            } else {
              propertiesCounter[chainId][address][property] = counter - 1;
            }
          }
        }
        if (Object.keys(propertiesCounter[chainId][address]).length === 0) {
          delete propertiesCounter[chainId][address];
        }
      }
      if (Object.keys(propertiesCounter[chainId]).length === 0) {
        delete propertiesCounter[chainId];
      }
    }
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
