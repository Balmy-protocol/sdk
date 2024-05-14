import { Address, ChainId, ContractCall, FieldsRequirements, SupportInChain, TimeString, TokenAddress } from '@types';
import { Address as ViemAddress } from 'viem';
import { getChainByKey } from '@chains';
import { Addresses } from '@shared/constants';
import { filterRejectedResults, groupByChain, isSameAddress } from '@shared/utils';
import { timeoutPromise } from '@shared/timeouts';
import { BaseTokenMetadata, IMetadataSource, MetadataInput, MetadataResult } from '../types';
import { calculateFieldRequirements } from '@shared/requirements-and-support';
import ERC20_ABI from '@shared/abis/erc20';
import { IProviderService } from '@services/providers';
import { MULTICALL_ADDRESS } from '@services/providers/utils';

export type RPCMetadataProperties = BaseTokenMetadata & { name: string };
const SUPPORT: SupportInChain<RPCMetadataProperties> = { symbol: 'present', decimals: 'present', name: 'present' };
export class RPCMetadataSource implements IMetadataSource<RPCMetadataProperties> {
  constructor(private readonly providerService: IProviderService) {}

  async getMetadata<Requirements extends FieldsRequirements<RPCMetadataProperties>>({
    tokens,
    config,
  }: {
    tokens: MetadataInput[];
    config?: { fields?: Requirements; timeout: TimeString };
  }) {
    const groupedByChain = groupByChain(tokens, ({ token }) => token);
    const promises = Object.entries(groupedByChain).map<
      Promise<[ChainId, Record<TokenAddress, MetadataResult<RPCMetadataProperties, Requirements>>]>
    >(async ([chainId, tokens]) => [
      Number(chainId),
      await timeoutPromise(this.fetchMetadataInChain(Number(chainId), tokens, config?.fields), config?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  supportedProperties() {
    return Object.fromEntries(this.providerService.supportedChains().map((chainId) => [chainId, SUPPORT]));
  }

  private async fetchMetadataInChain<Requirements extends FieldsRequirements<RPCMetadataProperties>>(
    chainId: ChainId,
    tokens: TokenAddress[],
    requirements: Requirements | undefined
  ) {
    const chain = getChainByKey(chainId);
    const addressesWithoutNativeToken = tokens.filter((address) => !isSameAddress(address, Addresses.NATIVE_TOKEN));
    const fieldRequirements = calculateFieldRequirements(SUPPORT, requirements);
    const fieldsToFetch = Object.entries(fieldRequirements)
      .filter(([, requirement]) => requirement !== 'can ignore')
      .map(([field]) => field as keyof RPCMetadataProperties);
    if (fieldsToFetch.length === 0) return {};
    const contracts = [];
    for (const field of fieldsToFetch) {
      contracts.push(
        ...addressesWithoutNativeToken.map((address) => ({ address: address as ViemAddress, functionName: field, abi: ERC20_ABI }))
      );
    }
    const multicallResults = contracts.length
      ? await this.providerService
          .getViemPublicClient({ chainId })
          .multicall({ contracts, allowFailure: false, multicallAddress: MULTICALL_ADDRESS, batchSize: 0 })
      : [];
    const result: Record<TokenAddress, MetadataResult<RPCMetadataProperties, Requirements>> = {};
    for (let i = 0; i < addressesWithoutNativeToken.length; i++) {
      const address = addressesWithoutNativeToken[i];
      const tokenMetadata = Object.fromEntries(
        fieldsToFetch.map((field, j) => [field, multicallResults[addressesWithoutNativeToken.length * j + i]])
      ) as MetadataResult<RPCMetadataProperties, Requirements>;
      result[address] = tokenMetadata;
    }

    if (addressesWithoutNativeToken.length !== tokens.length) {
      const nativeResult = {} as MetadataResult<RPCMetadataProperties, Requirements>;
      if (fieldsToFetch.includes('symbol')) {
        nativeResult.symbol = chain?.nativeCurrency?.symbol ?? '???';
      }
      if (fieldsToFetch.includes('decimals')) {
        nativeResult.decimals = 18;
      }
      if (fieldsToFetch.includes('name')) {
        nativeResult.name = chain?.nativeCurrency?.name ?? 'Unknown';
      }
      result[Addresses.NATIVE_TOKEN] = nativeResult;
    }

    return result;
  }
}
