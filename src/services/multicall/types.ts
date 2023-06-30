import { Address, BigIntish, ChainId } from '@types';

export type IMulticallService = {
  supportedChains(): ChainId[];
  readOnlyMulticall<T>(_: MulticallArgs): Promise<T[]>;
  tryReadOnlyMulticall<T = any>(_: MulticallArgs): Promise<CallResult<T>[]>;
};

export type CallResult<T = any> = SuccessfulCall<T> | FailedCall;
export type SuccessfulCall<T = any> = { status: 'success'; result: T; error?: undefined };
export type FailedCall = { status: 'failure'; result?: undefined; error: string };
export type ExecuteCallAt = { block: { number: BigIntish } };
export type MulticallArgs = {
  chainId: ChainId;
  calls: {
    address: Address;
    abi: { humanReadable: string[] } | { json: readonly any[] };
    functionName: string;
    args?: any[];
  }[];
  batching?: { maxSizeInBytes: number };
  at?: ExecuteCallAt;
};
