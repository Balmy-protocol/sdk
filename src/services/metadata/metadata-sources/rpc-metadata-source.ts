import { Address, ChainId, ContractCall, FieldsRequirements, SupportInChain, TimeString, TokenAddress } from '@types';
import { getChainByKey } from '@chains';
import { IMulticallService } from '@services/multicall/types';
import { Addresses } from '@shared/constants';
import { filterRejectedResults, isSameAddress } from '@shared/utils';
import { timeoutPromise } from '@shared/timeouts';
import { BaseTokenMetadata, IMetadataSource, MetadataResult } from '../types';
import { calculateFieldRequirements } from '@shared/requirements-and-support';
import ERC20_ABI from '@shared/abis/erc20';

export type RPCMetadataProperties = BaseTokenMetadata & { name: string };
const SUPPORT: SupportInChain<RPCMetadataProperties> = { symbol: 'present', decimals: 'present', name: 'present' };
export class RPCMetadataSource implements IMetadataSource<RPCMetadataProperties> {
  constructor(private readonly multicallService: IMulticallService) {}

  async getMetadata<Requirements extends FieldsRequirements<RPCMetadataProperties>>({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { fields?: Requirements; timeout: TimeString };
  }) {
    const promises = Object.entries(addresses).map<
      Promise<[ChainId, Record<TokenAddress, MetadataResult<RPCMetadataProperties, Requirements>>]>
    >(async ([chainId, addresses]) => [
      Number(chainId),
      await timeoutPromise(this.fetchMetadataInChain(Number(chainId), addresses, config?.fields), config?.timeout, { reduceBy: '100' }),
    ]);
    return Object.fromEntries(await filterRejectedResults(promises));
  }

  supportedProperties() {
    return Object.fromEntries(this.multicallService.supportedChains().map((chainId) => [chainId, SUPPORT]));
  }

  private async fetchMetadataInChain<Requirements extends FieldsRequirements<RPCMetadataProperties>>(
    chainId: ChainId,
    addresses: Address[],
    requirements: Requirements | undefined
  ) {
    const chain = getChainByKey(chainId);
    const addressesWithoutNativeToken = addresses.filter((address) => !isSameAddress(address, Addresses.NATIVE_TOKEN));
    const fieldRequirements = calculateFieldRequirements(SUPPORT, requirements);
    const fieldsToFetch = Object.entries(fieldRequirements)
      .filter(([, requirement]) => requirement !== 'can ignore')
      .map(([field]) => field as keyof RPCMetadataProperties);
    if (fieldsToFetch.length === 0) return {};
    const calls: ContractCall[] = [];
    for (const field of fieldsToFetch) {
      calls.push(...addressesWithoutNativeToken.map((address) => ({ address, functionName: field, abi: { json: ERC20_ABI } })));
    }
    const multicallResults = await this.multicallService.readOnlyMulticall({ chainId, calls });
    const result: Record<TokenAddress, MetadataResult<RPCMetadataProperties, Requirements>> = {};
    for (let i = 0; i < addressesWithoutNativeToken.length; i++) {
      const address = addressesWithoutNativeToken[i];
      const tokenMetadata = Object.fromEntries(
        fieldsToFetch.map((field, j) => [field, multicallResults[addressesWithoutNativeToken.length * j + i]])
      ) as MetadataResult<RPCMetadataProperties, Requirements>;
      result[address] = tokenMetadata;
    }

    if (addressesWithoutNativeToken.length !== addresses.length) {
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
