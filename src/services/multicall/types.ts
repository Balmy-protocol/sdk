import { BigIntish, ChainId, ContractCall } from '@types';

export type IMulticallService = {
  supportedChains(): ChainId[];
  readOnlyMulticall<T = any>(_: MulticallArgs): Promise<T[]>;
  tryReadOnlyMulticall<T = any>(_: MulticallArgs): Promise<CallResult<T>[]>;
};

export type CallResult<T = any> = SuccessfulCall<T> | FailedCall;
export type SuccessfulCall<T = any> = { status: 'success'; result: T; error?: undefined };
export type FailedCall = { status: 'failure'; result?: undefined; error: string };
export type ExecuteCallAt = { block: { number: BigIntish } };
export type MulticallArgs = {
  chainId: ChainId;
  calls: ContractCall[];
  batching?: { maxSizeInBytes: number };
  at?: ExecuteCallAt;
};
