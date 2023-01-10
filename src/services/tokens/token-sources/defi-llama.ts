import { ChainId, Network, TokenAddress } from "@types"
import { Addresses } from "@shared/constants"
import { Networks } from "@networks"
import { IFetchService } from "@services/fetch/types"
import { AddedProperties, BaseToken, ITokenSource } from "../types"
import { isSameAddress } from "@shared/utils"

const NETWORK_KEYS: Record<ChainId, string> = {
  [Networks.ETHEREUM.chainId]: 'ethereum',
  [Networks.BNB_CHAIN.chainId]: 'bsc',
  [Networks.POLYGON.chainId]: 'polygon',
  [Networks.AVALANCHE.chainId]: 'avax',
  [Networks.FANTOM.chainId]: 'fantom',
  [Networks.GNOSIS.chainId]: 'xdai',
  [Networks.HECO.chainId]: 'heco',
  [Networks.ARBITRUM.chainId]: 'arbitrum',
  [Networks.OPTIMISM.chainId]: 'optimism',
  [Networks.CELO.chainId]: 'celo',
  [Networks.CRONOS.chainId]: 'cronos',
  [Networks.BOBA.chainId]: 'boba',
  [Networks.MOONRIVER.chainId]: 'moonriver',
  [Networks.OKC.chainId]: 'okexchain',

  // TODO: there are some missing. Check https://coins.llama.fi/chains
}

export type DefiLlamaToken = FetchTokenResult & BaseToken
export class DefiLlamaTokenSource implements ITokenSource<DefiLlamaToken> {

  constructor(private readonly fetch: IFetchService) { }  

  supportedNetworks(): Network[] {
    return Object.keys(NETWORK_KEYS)
      .map(chainId => Networks.byKey(chainId))
      .filter((network): network is Network => !!network)
  }

  async getTokens(addresses: Record<ChainId, TokenAddress[]>): Promise<Record<ChainId, Record<TokenAddress, DefiLlamaToken>>> {
    const tokenIds = Object.entries(addresses)
      .flatMap(([chainId, addresses]) => addresses.map(address => toTokenId(parseInt(chainId), address)))
    const coins = await this.fetchTokens(tokenIds)
    const result: Record<ChainId, Record<TokenAddress, DefiLlamaToken>> = Object.fromEntries(Object.keys(addresses).map(chainId => [chainId, {}]))
    for (const [tokenInNetwork, token] of Object.entries(coins)) {
      const { chainId, address } = fromTokenId(tokenInNetwork)
      result[chainId][address] = { ...token, address }
    }
    return result
  }

  addedProperties(): AddedProperties<DefiLlamaToken>[] {
    return ['price', 'timestamp']
  }

  private async fetchTokens(tokens: TokenId[]) {
    const chunkSize = 30;
    const chunks = [...Array(Math.ceil(tokens.length / chunkSize))].map(_ => tokens.splice(0, chunkSize))
    const requests = chunks.map(async chunk => {
      const url = 'https://coins.llama.fi/prices/current/' + chunk.join(',')
      const response = await this.fetch.fetch(url)
      if (!response.ok) {
        throw new Error('Request to Defi Llama API failed')
      }
      const { coins }: { coins: Record<TokenId, FetchTokenResult> } = await response.json()
      return coins
    })
    const responses = await Promise.all(requests)
    return responses.reduce((accum, curr) => ({ ...accum, ...curr }), {})
  }
}

const DEFI_LLAMA_NATIVE_TOKEN = '0x0000000000000000000000000000000000000000'

function toTokenId(chainId: ChainId, address: TokenAddress) {
  const key = NETWORK_KEYS[chainId]
  return isSameAddress(address, Addresses.NATIVE_TOKEN)
    ? `${key}:${DEFI_LLAMA_NATIVE_TOKEN}`
    : `${key}:${address}`
}

function fromTokenId(tokenInNetwork: TokenId): { chainId: ChainId, address: TokenAddress } {
  const [key, address] = tokenInNetwork.split(':')
  return {
    chainId: Networks.byKeyOrFail(key).chainId,
    address: address.replaceAll(DEFI_LLAMA_NATIVE_TOKEN, Addresses.NATIVE_TOKEN)
  }
}

type FetchTokenResult = {
  decimals: number,
  price: number,
  symbol: string,
  timestamp: number
}
type TokenId = string