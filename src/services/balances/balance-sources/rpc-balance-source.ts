import { Hex, parseAbi, Address as ViemAddress } from 'viem';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { BalanceInput, IBalanceSource } from '../types';
import { IProviderService } from '@services/providers/types';
import ERC20_ABI from '@shared/abis/erc20';
import { MULTICALL_CONTRACT } from '@services/providers/utils';
import { filterRejectedResults, groupByChain, isSameAddress } from '@shared/utils';
import { Addresses } from '@shared/constants';
import { timeoutPromise } from '@shared/timeouts';
import { ILogger, ILogsService } from '@services/logs';

export type RPCBalanceSourceConfig = {
  batching?: { maxSizeInBytes: number };
};
export class RPCBalanceSource implements IBalanceSource {
  private readonly logger: ILogger;
  constructor(
    private readonly providerService: IProviderService,
    logs: ILogsService,
    private readonly config?: RPCBalanceSourceConfig | undefined
  ) {
    this.logger = logs.getLogger({ name: 'RPCBalanceSource' });
  }

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
        await timeoutPromise(this.fetchBalancesInChain(Number(chainId), tokens), config?.timeout, {
          reduceBy: '100',
          onTimeout: (timeout) => this.logger.debug(`Fetch balances in chain ${chainId} timeouted after ${timeout}`),
        }),
      ]
    );
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  supportedChains(): ChainId[] {
    return this.providerService.supportedChains();
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

  private async fetchERC20BalancesInChain(
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

  private async fetchNativeBalancesInChain(
    chainId: ChainId,
    accounts: Address[],
    config?: { timeout?: TimeString }
  ): Promise<Record<Address, bigint>> {
    // We are using deployless reads to perform a sort of multicall and fetch all native balances in one call
    const balances =
      accounts.length > 0
        ? await this.providerService.getViemPublicClient({ chainId }).readContract({
            code: BYTECODE,
            abi: ABI,
            functionName: 'getNativeBalances',
            args: [accounts as ViemAddress[]],
            blockTag: 'latest',
          })
        : [];
    return Object.fromEntries(accounts.map((account, i) => [account, balances[i]]));
  }
}

const BYTECODE: Hex =
  '0x608060405234801561001057600080fd5b506102ed806100206000396000f3fe608060405234801561001057600080fd5b506004361061002b5760003560e01c80634c04bf9914610030575b600080fd5b61004361003e3660046101cf565b610059565b604051610050919061023e565b60405180910390f35b60608167ffffffffffffffff81111561009b577f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6040519080825280602002602001820160405280156100c4578160200160208202803683370190505b50905060005b8281101561018d5783838281811061010b577f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b90506020020160208101906101209190610194565b73ffffffffffffffffffffffffffffffffffffffff1631828281518110610170577f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b60209081029190910101528061018581610282565b9150506100ca565b5092915050565b6000602082840312156101a5578081fd5b813573ffffffffffffffffffffffffffffffffffffffff811681146101c8578182fd5b9392505050565b600080602083850312156101e1578081fd5b823567ffffffffffffffff808211156101f8578283fd5b818501915085601f83011261020b578283fd5b813581811115610219578384fd5b866020808302850101111561022c578384fd5b60209290920196919550909350505050565b6020808252825182820181905260009190848201906040850190845b818110156102765783518352928401929184019160010161025a565b50909695505050505050565b60007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8214156102d9577f4e487b710000000000000000000000000000000000000000000000000000000081526011600452602481fd5b506001019056fea164736f6c6343000800000a';
const ABI = parseAbi(['function getNativeBalances(address[] addresses) external view returns (uint256[] balances)']);
