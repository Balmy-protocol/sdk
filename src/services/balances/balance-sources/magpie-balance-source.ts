import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch';
import { OnlyTokensHeldBalanceSource } from './base/only-tokens-held-balance-source';
import { buildMagpieBalanceManagerUrl, magpieSupportedChains } from '@shared/magpie';

export class MagpieBalanceSource extends OnlyTokensHeldBalanceSource {
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
    return magpieSupportedChains();
  }

  private async fetchTokensHeldByAccount(
    account: Address,
    chainId: ChainId,
    timeout?: TimeString
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const response = await this.fetchService.fetch(`${buildMagpieBalanceManagerUrl(chainId)}/balances?walletAddress=${account}`, {
      timeout,
    });
    const balances: { tokenAddress: string; amount: string }[] = await response.json();
    if (!balances || !balances.map) throw new Error(`${buildMagpieBalanceManagerUrl(chainId)}/balances?walletAddress=${account}`);
    console.log(balances.length);
    return Object.fromEntries(balances.map(({ tokenAddress, amount }) => [tokenAddress, amount]));
  }
}
