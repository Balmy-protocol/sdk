import { TokenBalanceType, TokenBalancesResponseErc20 } from 'alchemy-sdk';
import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { BalanceQueriesSupport } from '../types';
import { alchemySupportedChains, buildAlchemyClient } from '@shared/alchemy-rpc';
import { SingleAccountAndChainBaseBalanceSource } from './base/single-account-and-chain-base-balance-source';
import { timeoutPromise } from '@shared/timeouts';

// Note: when checking tokens held by an account, Alchemy returns about 300 tokens max
export class AlchemyBalanceSource extends SingleAccountAndChainBaseBalanceSource {
  constructor(private readonly alchemyKey: string) {
    super();
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const entries = alchemySupportedChains().map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: true }]);
    return Object.fromEntries(entries);
  }

  protected async fetchERC20TokensHeldByAccountInChain(
    chainId: ChainId,
    account: Address,
    config?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const allBalances: { contractAddress: TokenAddress; tokenBalance: string | null }[] = [];
    let pageKey: string | undefined = undefined;
    do {
      try {
        const result: TokenBalancesResponseErc20 = await timeoutPromise(
          buildAlchemyClient(this.alchemyKey, chainId).core.getTokenBalances(account, {
            type: TokenBalanceType.ERC20,
            pageKey,
          }),
          config?.timeout
        );
        allBalances.push(...result.tokenBalances);
        pageKey = result.pageKey;
      } catch (e) {
        pageKey = undefined; // We do this to abort
      }
    } while (!!pageKey);
    return toRecord(allBalances);
  }

  protected async fetchERC20BalancesForAccountInChain(
    chainId: ChainId,
    account: Address,
    addresses: TokenAddress[],
    config?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const { tokenBalances } = await timeoutPromise(
      buildAlchemyClient(this.alchemyKey, chainId).core.getTokenBalances(account, addresses),
      config?.timeout
    );
    return toRecord(tokenBalances);
  }

  protected fetchNativeBalanceInChain(chainId: ChainId, account: Address, config?: { timeout?: TimeString }): Promise<AmountOfToken> {
    return timeoutPromise(
      buildAlchemyClient(this.alchemyKey, chainId)
        .core.getBalance(account)
        .then((balance) => balance.toString()),
      config?.timeout
    );
  }
}

function toRecord(balances: { contractAddress: TokenAddress; tokenBalance: string | null }[]): Record<TokenAddress, AmountOfToken> {
  return Object.fromEntries(balances.map(({ contractAddress, tokenBalance }) => [contractAddress, tokenBalance ?? '0']));
}
