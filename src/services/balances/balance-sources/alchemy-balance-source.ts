import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { BalanceQueriesSupport } from '../types';
import { IFetchService } from '@services/fetch';
import { alchemySupportedChains, callAlchemyRPC } from '@shared/alchemy-rpc';
import { SingleAccountAndChainBaseBalanceSource } from './base/single-account-and-chain-base-balance-source';

// Note: when checking tokens held by an account, Alchemy returns about 300 tokens max
export class AlchemyBalanceSource extends SingleAccountAndChainBaseBalanceSource {
  constructor(private readonly fetchService: IFetchService, private readonly alchemyKey: string) {
    super();
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const entries = alchemySupportedChains().map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: true }]);
    return Object.fromEntries(entries);
  }

  protected async fetchERC20TokensHeldByAccountInChain(
    chainId: ChainId,
    account: Address,
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const allBalances: { contractAddress: TokenAddress; tokenBalance: string | null }[] = [];
    let pageKey: string | undefined = undefined;
    do {
      try {
        const args: any[] = [account, 'erc20'];
        if (pageKey) args.push({ pageKey });
        const result = await this.callRPC<{ tokenBalances: { contractAddress: TokenAddress; tokenBalance: string | null }[]; pageKey?: string }>(
          chainId,
          'alchemy_getTokenBalances',
          args,
          context?.timeout
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
    context?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const { tokenBalances } = await this.callRPC<{ tokenBalances: { contractAddress: TokenAddress; tokenBalance: string | null }[] }>(
      chainId,
      'alchemy_getTokenBalances',
      [account, addresses],
      context?.timeout
    );

    return toRecord(tokenBalances);
  }

  protected fetchNativeBalanceInChain(chainId: ChainId, account: Address, context?: { timeout?: TimeString }): Promise<AmountOfToken> {
    return this.callRPC(chainId, 'eth_getBalance', [account, 'latest']);
  }

  private async callRPC<T>(chainId: ChainId, method: string, params: any, timeout?: TimeString): Promise<T> {
    const response = await callAlchemyRPC(this.fetchService, this.alchemyKey, chainId, method, params, timeout);
    const { result } = await response.json();
    return result;
  }
}

function toRecord(balances: { contractAddress: TokenAddress; tokenBalance: string | null }[]): Record<TokenAddress, AmountOfToken> {
  return Object.fromEntries(balances.map(({ contractAddress, tokenBalance }) => [contractAddress, tokenBalance ?? '0']));
}
