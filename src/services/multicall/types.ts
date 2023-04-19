import { Address, ChainId } from '@types';

export type IMulticallService = {
  supportedChains(): ChainId[];
  readOnlyMulticall({
    chainId,
    calls,
  }: {
    chainId: ChainId;
    calls: { target: Address; decode: string[]; calldata: string }[];
    at?: ExecuteCallAt;
  }): Promise<ReadonlyArray<any>[]>;
  tryReadOnlyMulticall({
    chainId,
    calls,
  }: {
    chainId: ChainId;
    calls: { target: Address; decode: string[]; calldata: string }[];
    at?: ExecuteCallAt;
  }): Promise<TryMulticallResult<any>[]>;
};

export type TryMulticallResult<T> = { success: true; result: ReadonlyArray<T> } | { success: false };
export type ExecuteCallAt = { block: { number: number } };
