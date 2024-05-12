import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { BalanceInput, IBalanceService, IBalanceSource } from './types';
import { timeoutPromise } from '@shared/timeouts';

export class BalanceService implements IBalanceService {
  constructor(private readonly source: IBalanceSource) {}

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  async getBalancesForAccountInChain({
    chainId,
    account,
    tokens,
    config,
  }: {
    chainId: ChainId;
    account: Address;
    tokens: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, bigint>> {
    const result = await this.getBalancesForAccount({
      account,
      tokens: tokens.map((token) => ({ chainId, token })),
      config,
    });
    return result[chainId];
  }

  async getBalancesForAccount({
    account,
    tokens,
    config,
  }: {
    account: Address;
    tokens: Omit<BalanceInput, 'account'>[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, bigint>>> {
    const result = await this.getBalances({ tokens: tokens.map((token) => ({ account, ...token })), config });
    const entries = Object.entries(result).map<[ChainId, Record<TokenAddress, bigint>]>(([chainId, result]) => [
      Number(chainId),
      result[account],
    ]);
    return Object.fromEntries(entries);
  }

  async getBalancesInChain({
    chainId,
    tokens,
    config,
  }: {
    chainId: ChainId;
    tokens: Omit<BalanceInput, 'chainId'>[];
    config?: { timeout?: TimeString };
  }) {
    const result = await this.getBalances({ tokens: tokens.map((token) => ({ chainId, ...token })), config });
    return result[chainId];
  }

  getBalances({ tokens, config }: { tokens: BalanceInput[]; config?: { timeout?: TimeString } }) {
    return timeoutPromise(this.source.getBalances({ tokens, config }), config?.timeout);
  }
}
