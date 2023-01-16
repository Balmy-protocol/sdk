import { Address, ChainId } from '@types';

export type IMulticallService = {
  supportedChains(): ChainId[];
  readOnlyMulticallToSingleTarget({
    chainId,
    target,
    calls,
  }: {
    chainId: ChainId;
    target: Address;
    calls: { calldata: string; decode: string }[];
  }): Promise<any[]>;
  readOnlyMulticall({ chainId, calls }: { chainId: ChainId; calls: { target: Address; decode: string; calldata: string }[] }): Promise<any[]>;
};
