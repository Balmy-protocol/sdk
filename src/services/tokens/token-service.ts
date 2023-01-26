import { timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, TokenAddress } from '@types';
import { BaseToken, ITokenService, ITokenSource } from './types';

export class TokenService<Token extends BaseToken> implements ITokenService<Token> {
  constructor(private readonly tokenSource: ITokenSource<Token>) {}

  supportedChains(): ChainId[] {
    return this.tokenSource.supportedChains();
  }

  async getTokensForChain(chainId: ChainId, addresses: TokenAddress[], config?: { timeout?: TimeString }): Promise<Record<TokenAddress, Token>> {
    const byChainId = { [chainId]: addresses };
    const result = await this.getTokensByChainId(byChainId, config);
    return result[chainId];
  }

  getTokens(
    addresses: { chainId: ChainId; addresses: TokenAddress[] }[],
    config?: { timeout?: TimeString }
  ): Promise<Record<ChainId, Record<TokenAddress, Token>>> {
    const byChainId = Object.fromEntries(addresses.map(({ chainId, addresses }) => [chainId, addresses]));
    return this.getTokensByChainId(byChainId, config);
  }

  getTokensByChainId(
    addresses: Record<ChainId, TokenAddress[]>,
    config?: { timeout?: TimeString }
  ): Promise<Record<ChainId, Record<TokenAddress, Token>>> {
    return timeoutPromise(this.tokenSource.getTokens(addresses), config?.timeout);
  }
}
