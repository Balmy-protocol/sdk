import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { Addresses } from '@shared/constants';
import { filterRejectedResults, groupByChain, isSameAddress } from '@shared/utils';
import { timeoutPromise } from '@shared/timeouts';
import { BalanceInput, IBalanceSource } from '../../types';

export abstract class SingleChainBaseBalanceSource implements IBalanceSource {
  async getBalances({
    tokens,
    config,
  }: {
    tokens: BalanceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>> {
    const groupedByChain = groupByChain(tokens);
    const promises = Object.entries(groupedByChain).map<Promise<[ChainId, Record<Address, Record<TokenAddress, bigint>>]>>(
      async ([chainId, tokens]) => [
        Number(chainId),
        await timeoutPromise(this.fetchBalancesInChain(Number(chainId), tokens), config?.timeout, { reduceBy: '100' }),
      ]
    );
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  private async fetchBalancesInChain(
    chainId: ChainId,
    tokens: Omit<BalanceInput, 'chainId'>[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, bigint>>> {
    const accountsToFetchNativeToken: Address[] = [];
    const nonNativeTokens: Omit<BalanceInput, 'chainId'>[] = [];

    for (const { account, token } of tokens) {
      if (isSameAddress(token, Addresses.NATIVE_TOKEN)) {
        accountsToFetchNativeToken.push(account);
      } else {
        nonNativeTokens.push({ account, token });
      }
    }

    const erc20Promise =
      Object.keys(nonNativeTokens).length > 0
        ? this.fetchERC20BalancesInChain(chainId, nonNativeTokens, config)
        : Promise.resolve<Record<Address, Record<TokenAddress, bigint>>>({});

    const nativePromise =
      accountsToFetchNativeToken.length > 0
        ? this.fetchNativeBalancesInChain(chainId, accountsToFetchNativeToken, config)
        : Promise.resolve<Record<Address, bigint>>({});

    const [erc20Result, nativeResult] = await Promise.all([erc20Promise, nativePromise]);

    const result: Record<Address, Record<TokenAddress, bigint>> = {};

    for (const { account, token } of tokens) {
      const balance = isSameAddress(token, Addresses.NATIVE_TOKEN) ? nativeResult[account] : erc20Result[account]?.[token];

      if (balance !== undefined) {
        if (!(account in result)) result[account] = {};
        result[account][token] = balance;
      }
    }

    return result;
  }

  abstract supportedChains(): ChainId[];

  protected abstract fetchERC20BalancesInChain(
    chainId: ChainId,
    tokens: Omit<BalanceInput, 'chainId'>[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, bigint>>>;
  protected abstract fetchNativeBalancesInChain(
    chainId: ChainId,
    accounts: Address[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, bigint>>;
}
