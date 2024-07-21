import { Address as ViemAddress } from 'viem';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { BalanceInput } from '../types';
import { IProviderService } from '@services/providers/types';
import { SingleChainBaseBalanceSource } from './base/single-chain-base-balance-source';
import ERC20_ABI from '@shared/abis/erc20';
import { MULTICALL_CONTRACT } from '@services/providers/utils';

export type RPCBalanceSourceConfig = {
  batching?: { maxSizeInBytes: number };
};
export class RPCBalanceSource extends SingleChainBaseBalanceSource {
  constructor(private readonly providerService: IProviderService, private readonly config?: RPCBalanceSourceConfig | undefined) {
    super();
  }

  supportedChains(): ChainId[] {
    return this.providerService.supportedChains();
  }

  protected async fetchERC20BalancesInChain(
    chainId: ChainId,
    tokens: Omit<BalanceInput, 'chainId'>[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, Record<TokenAddress, bigint>>> {
    const contracts = tokens.map(({ account, token }) => ({
      address: token as ViemAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account],
    }));
    const multicallResults = contracts.length
      ? await this.providerService.getViemPublicClient({ chainId }).multicall({
          contracts,
          multicallAddress: MULTICALL_CONTRACT.address(chainId),
          batchSize: this.config?.batching?.maxSizeInBytes ?? 0,
        })
      : [];
    const result: Record<Address, Record<TokenAddress, bigint>> = {};
    for (let i = 0; i < tokens.length; i++) {
      const multicallResult = multicallResults[i];
      if (multicallResult.status === 'failure') continue;
      const { account, token } = tokens[i];
      if (!(account in result)) result[account] = {};
      result[account][token] = multicallResult.result as unknown as bigint;
    }
    return result;
  }

  protected async fetchNativeBalancesInChain(
    chainId: ChainId,
    accounts: Address[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, bigint>> {
    const entries = await Promise.all(accounts.map(async (account) => [account, await this.fetchNativeBalanceInChain(chainId, account)]));
    return Object.fromEntries(entries);
  }

  private fetchNativeBalanceInChain(chainId: ChainId, account: Address, config?: { timeout?: TimeString }) {
    return this.providerService.getViemPublicClient({ chainId }).getBalance({ address: account as ViemAddress, blockTag: 'latest' });
  }
}
