import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { Chains } from '@chains';
import { BalanceQueriesSupport } from '../types';
import { IFetchService } from '@services/fetch';
import { utils } from 'ethers';
import { SingleAccountAndChainBaseBalanceSource } from './base/single-account-and-chain-base-balance-source';

const SUPPORTED_CHAINS = [Chains.ETHEREUM, Chains.POLYGON, Chains.BNB_CHAIN, Chains.AVALANCHE, Chains.FANTOM, Chains.ARBITRUM, Chains.CRONOS];

export class MoralisBalanceSource extends SingleAccountAndChainBaseBalanceSource {
  constructor(private readonly fetchService: IFetchService, private readonly apiKey: string) {
    super();
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    const entries = SUPPORTED_CHAINS.map(({ chainId }) => [chainId, { getBalancesForTokens: true, getTokensHeldByAccount: true }]);
    return Object.fromEntries(entries);
  }

  protected async fetchERC20TokensHeldByAccountInChain(
    chainId: ChainId,
    account: Address,
    config?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const balances: { token_address: string; balance: string }[] = await this.fetch(
      `https://deep-index.moralis.io/api/v2/${account}/erc20?chain=${chainIdToValidChain(chainId)}`,
      config?.timeout
    );
    return toRecord(balances);
  }

  protected async fetchERC20BalancesForAccountInChain(
    chainId: ChainId,
    account: Address,
    addresses: TokenAddress[],
    config?: { timeout?: TimeString }
  ): Promise<Record<TokenAddress, AmountOfToken>> {
    const url = `https://deep-index.moralis.io/api/v2/${account}/erc20?chain=${chainIdToValidChain(chainId)}&token_addresses=${addresses.join(
      ','
    )}`;
    const balances: { token_address: string; balance: string }[] = await this.fetch(url, config?.timeout);
    return toRecord(balances);
  }

  protected async fetchNativeBalanceInChain(chainId: ChainId, account: Address, config?: { timeout?: TimeString }): Promise<AmountOfToken> {
    const { balance }: { balance: string } = await this.fetch(
      `https://deep-index.moralis.io/api/v2/${account}/balance?chain=${chainIdToValidChain(chainId)}`,
      config?.timeout
    );
    return balance;
  }

  private async fetch(url: string, timeout?: TimeString): Promise<any> {
    const response = await this.fetchService.fetch(url, {
      headers: { 'X-API-Key': this.apiKey },
      timeout,
    });
    return response.json();
  }
}

function chainIdToValidChain(chainId: ChainId) {
  return utils.hexStripZeros(utils.hexlify(chainId));
}

function toRecord(balances: { token_address: string; balance: string }[]) {
  return Object.fromEntries(balances.map(({ token_address, balance }) => [token_address, balance]));
}
