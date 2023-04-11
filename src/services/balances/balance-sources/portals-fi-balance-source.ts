import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { IFetchService } from '@services/fetch';
import { PORTALS_FI_CHAIN_ID_TO_KEY, PORTALS_FI_KEY_TO_CHAIN_ID, PORTALS_FI_SUPPORTED_CHAINS } from '@shared/portals-fi';
import { BalanceQueriesSupport, IBalanceSource } from '../types';
import { constants } from 'ethers';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';

export class PortalsFiBalanceSource implements IBalanceSource {
  constructor(private readonly fetchService: IFetchService, private readonly key: string) {}

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const entries = PORTALS_FI_SUPPORTED_CHAINS.map((chainId) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: true }]);
    return Object.fromEntries(entries);
  }

  async getTokensHeldByAccounts({
    accounts,
    config,
  }: {
    accounts: Record<ChainId, Address[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    const chainsPerAccount: Record<Address, ChainId[]> = {};
    for (const chainId in accounts) {
      for (const account of accounts[chainId]) {
        if (!(account in chainsPerAccount)) chainsPerAccount[account] = [];
        chainsPerAccount[account].push(Number(chainId));
      }
    }
    const allResults = await Promise.all(
      Object.entries(chainsPerAccount).map(([account, chainIds]) => this.fetchTokensHeldByAccount(account, chainIds, config?.timeout))
    );
    const merged: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>> = {};
    for (const result of allResults) {
      for (const chainId in result) {
        if (!(chainId in merged)) merged[chainId] = {};
        for (const account in result[chainId]) {
          if (!(account in merged[chainId])) merged[chainId][account] = {};
          for (const token in result[chainId][account]) {
            merged[chainId][account][token] = result[chainId][account][token];
          }
        }
      }
    }
    return merged;
  }

  async getBalancesForTokens({
    tokens,
    config,
  }: {
    tokens: Record<ChainId, Record<Address, TokenAddress[]>>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    const entries: [ChainId, Address[]][] = Object.entries(tokens).map(([chainId, tokens]) => [Number(chainId), Object.keys(tokens)]);
    const tokensHeldByAccount = await this.getTokensHeldByAccounts({ accounts: Object.fromEntries(entries), config });
    const result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>> = {};
    for (const chainId in tokens) {
      result[chainId] = {};
      for (const account in tokens[chainId]) {
        result[chainId][account] = {};
        for (const token of tokens[chainId][account]) {
          result[chainId][account][token] = tokensHeldByAccount?.[chainId]?.[account]?.[token] ?? '0';
        }
      }
    }
    return result;
  }

  private async fetchTokensHeldByAccount(
    account: Address,
    chains: ChainId[],
    timeout?: TimeString
  ): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    const keys = chains
      .map((chainId) => PORTALS_FI_CHAIN_ID_TO_KEY[chainId])
      .filter((key) => !!key)
      .join('&networks=');
    const response = await this.fetchService.fetch(`https://api.portals.fi/v2/account?ownerAddress=${account}&networks=${keys}`, {
      timeout,
      headers: { 'x-api-key': this.key },
    });
    const { balances }: Result = await response.json();
    const result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>> = {};
    for (const { key, rawBalance } of balances) {
      const { chainId, token } = fromKey(key);
      if (!(chainId in result)) result[chainId] = {};
      if (!(account in result[chainId])) result[chainId][account] = {};
      result[chainId][account][token] = rawBalance;
    }
    return result;
  }
}

function fromKey(key: string): { chainId: ChainId; token: TokenAddress } {
  const [chainKey, token] = key.split(':');
  return {
    chainId: PORTALS_FI_KEY_TO_CHAIN_ID[chainKey],
    token: isSameAddress(token, constants.AddressZero) ? Addresses.NATIVE_TOKEN : token,
  };
}

type Result = {
  balances: { key: string; rawBalance: AmountOfToken }[];
};
