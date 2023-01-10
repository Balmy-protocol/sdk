import { ChainId, Network, TokenAddress } from "@types"
import { BaseToken, ITokenService, ITokenSource } from "./types"

export class TokenService<Token extends BaseToken> implements ITokenService<Token> {

  constructor(private readonly tokenSource: ITokenSource<Token>) { }

  supportedNetworks(): Network[] {
    return this.tokenSource.supportedNetworks()
  }

  async getTokensForNetwork(network: Network, addresses: TokenAddress[]): Promise<Record<TokenAddress, Token>> {
    const byChainId = { [network.chainId]: addresses }
    const result = await this.getTokensByChainId(byChainId)
    return result[network.chainId]
  }

  getTokens(...addresses: { network: Network; addresses: TokenAddress[] }[]): Promise<Record<ChainId, Record<TokenAddress, Token>>> {
    const byChainId = Object.fromEntries(addresses.map(({ network, addresses }) => [network.chainId, addresses]))
    return this.getTokensByChainId(byChainId)
  }

  getTokensByChainId(addresses: Record<ChainId, TokenAddress[]>): Promise<Record<ChainId, Record<TokenAddress, Token>>> {
    return this.tokenSource.getTokens(addresses)
  }
}
