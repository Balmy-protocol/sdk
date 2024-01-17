import { Address, AmountOfToken, BigIntish, ChainId, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch';
import { OnlyTokensHeldBalanceSource } from './base/only-tokens-held-balance-source';
import { ONE_INCH_METADATA } from '@services/quotes/quote-sources/1inch-quote-source';

export class OneInchBalanceSource extends OnlyTokensHeldBalanceSource {
  constructor(private readonly fetchService: IFetchService) {
    super();
  }

  async getTokensHeldByAccounts({
    accounts,
    config,
  }: {
    accounts: Record<ChainId, Address[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    const accountsInChain: { chainId: ChainId; account: Address }[] = Object.entries(accounts).flatMap(([chainId, accounts]) =>
      accounts.map((account) => ({ chainId: Number(chainId), account }))
    );

    const allResults = await Promise.all(
      accountsInChain.map(async ({ account, chainId }) => ({
        account,
        chainId,
        balances: await this.fetchTokensHeldByAccount(account, chainId, config?.timeout),
      }))
    );
    const merged: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>> = {};
    for (const { chainId, account, balances } of allResults) {
      if (!(chainId in merged)) merged[chainId] = {};
      merged[chainId][account] = balances;
    }
    return merged;
  }

  protected supportedChains(): ChainId[] {
    return ONE_INCH_METADATA.supports.chains;
  }

  private async fetchTokensHeldByAccount(
    account: Address,
    chainId: ChainId,
    timeout?: TimeString
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const response = await this.fetchService.fetch(`https://balances.1inch.io/v1.1/${chainId}/balances/${account}`, {
      timeout,
    });
    const balances: Record<TokenAddress, BigIntish> = await response.json();
    const entries = Object.entries(balances)
      .filter(([, amount]) => BigInt(amount) > 0)
      .map(([token, amount]) => [token, BigInt(amount).toString()]);
    return Object.fromEntries(entries);
  }
}
