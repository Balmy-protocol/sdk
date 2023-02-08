import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { Chains } from '@chains';
import { BalanceQueriesSupport } from '../types';
import { IFetchService } from '@services/fetch';
import { BaseBalanceSource } from './base-balance-source';

const URLs: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth-mainnet.g.alchemy.com/v2',
  [Chains.POLYGON.chainId]: 'polygon-mainnet.g.alchemy.com/v2',
  [Chains.OPTIMISM.chainId]: 'opt-mainnet.g.alchemy.com/v2',
  [Chains.ARBITRUM.chainId]: 'arb-mainnet.g.alchemy.com/v2',
};

// Note: when checking tokens held by an account, Alchemy returns about 300 tokens max
export class AlchemyBalanceSource extends BaseBalanceSource {
  constructor(private readonly fetchService: IFetchService, private readonly alchemyKey: string) {
    super();
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const entries = Object.keys(URLs).map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: true }]);
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

  protected async fetchERC20BalancesInChain(
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
    const url = this.getUrl(chainId);
    const response = await this.fetchService.fetch(url, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method,
        params: params,
      }),
      timeout,
    });
    const { result } = await response.json();
    return result;
  }

  private getUrl(chainId: ChainId) {
    const url = URLs[chainId];
    if (!url) throw new Error(`Unsupported chain with id ${chainId}`);
    return `https://${url}/${this.alchemyKey}`;
  }
}

function toRecord(balances: { contractAddress: TokenAddress; tokenBalance: string | null }[]): Record<TokenAddress, AmountOfToken> {
  return Object.fromEntries(balances.map(({ contractAddress, tokenBalance }) => [contractAddress, tokenBalance ?? '0']));
}
