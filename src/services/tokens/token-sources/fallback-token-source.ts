import { ChainId, Network, TimeString, TokenAddress } from "@types"
import { networksUnion } from "@networks"
import { AddedProperties, BaseToken, ITokenSource } from "@services/tokens/types"
import { timeoutPromise } from "@shared/timeouts"

// This fallback source will use different sources and combine the results of each of them
export class FallbackTokenSource<CombinedToken extends BaseToken> implements ITokenSource<CombinedToken> {

  private readonly sourceQueryTimeout: TimeString

  constructor(private readonly sources: ITokenSource<CombinedToken>[], options?: { sourceQueryTimeout: TimeString }) {
    this.sourceQueryTimeout = options?.sourceQueryTimeout ?? '1s'
  }  

  supportedNetworks(): Network[] {
    return networksUnion(this.sources.map(source => source.supportedNetworks()))
  }

  async getTokens(addresses: Record<ChainId, TokenAddress[]>): Promise<Record<ChainId, Record<TokenAddress, CombinedToken>>> {
    const result: Record<ChainId, Record<TokenAddress, CombinedToken>> =
      Object.fromEntries(Object.keys(addresses).map(chainId => [chainId, {}]))

    // TODO: Make it smarter. The idea would be that if a source has finished and returned all tokens, we can resolve the promise. 
    // Even if there are others that still haven't finished, but don't have any new properties. If there are unfinished sources with
    // new properties, or there are some missing tokens, we would still have to wait
    const promises = this.sources.map(async source => {
      const addressesForSource = getAddressesForSource(source, addresses)
      const sourceResult = await timeoutPromise(source.getTokens(addressesForSource), this.sourceQueryTimeout)
      for (const chainId in sourceResult) {
        for (const token of Object.values(sourceResult[chainId])) {
          const previousToken = result[chainId][token.address]
          result[chainId][token.address] = { ...previousToken, ...token }
        }
      }
    })

    await Promise.allSettled(promises)
    return result
  }

  addedProperties(): AddedProperties<CombinedToken>[] {
    return [...new Set(this.sources.flatMap(source => source.addedProperties()))]
  }
}

function getAddressesForSource<Token extends BaseToken>(source: ITokenSource<Token>, addresses: Record<ChainId, TokenAddress[]>): Record<ChainId, TokenAddress[]> {
  const chainsForSource = new Set(source.supportedNetworks().map(({ chainId }) => `${chainId}`))
  const filteredEntries = Object.entries(addresses)
    .filter(([chainId]) => chainsForSource.has(chainId))
    .map<[ChainId, TokenAddress[]]>(([chainId, addresses]) => [parseInt(chainId), addresses])
  return Object.fromEntries(filteredEntries)
}