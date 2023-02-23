import { timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, TokenAddress } from '@types';
import { ITokenService, ITokenSource } from './types';

export class TokenService<TokenData extends object> implements ITokenService<TokenData> {
  constructor(private readonly tokenSource: ITokenSource<TokenData>) {}

  supportedChains(): ChainId[] {
    return Object.keys(this.tokenSource.tokenProperties()).map(Number);
  }

  tokenProperties() {
    return this.tokenSource.tokenProperties();
  }

  async getTokensForChain({
    chainId,
    addresses,
    config,
  }: {
    chainId: ChainId;
    addresses: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, TokenData>> {
    const byChainId = { [chainId]: addresses };
    const result = await this.getTokensByChainId({ addresses: byChainId, config });
    return result[chainId];
  }

  getTokens({
    addresses,
    config,
  }: {
    addresses: { chainId: ChainId; addresses: TokenAddress[] }[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenData>>> {
    const byChainId = Object.fromEntries(addresses.map(({ chainId, addresses }) => [chainId, addresses]));
    return this.getTokensByChainId({ addresses: byChainId, config });
  }

  getTokensByChainId({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenData>>> {
    return timeoutPromise(this.tokenSource.getTokens({ addresses, context: config }), config?.timeout);
  }
}
