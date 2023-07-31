import { Address, AmountOfToken, BigIntish, ChainId, ContractCall, TimeString, TokenAddress, TransactionResponse } from '@types';
import { PERMIT2_BATCH_TRANSFER_FROM_TYPES, PERMIT2_TRANSFER_FROM_TYPES } from './utils/eip712-types';

export type IPermit2Service = {
  permit2ContractAddress: Address;
  arbitrary: IPermit2ArbitraryService;
  calculateNonce(params: { chainId: ChainId; appId: BigIntish; user: Address }): Promise<string>;
  preparePermitData(params: GenericSinglePermitParams): Promise<PermitData>;
  prepareBatchPermitData(params: GenericBatchPermitParams): Promise<BatchPermitData>;
};

export type IPermit2ArbitraryService = {
  contractAddress: Address;
  preparePermitData(params: SinglePermitParams): Promise<PermitData>;
  prepareBatchPermitData(params: BatchPermitParams): Promise<BatchPermitData>;
  buildArbitraryCallWithPermit(params: ArbitraryCallWithPermitParams): TransactionResponse;
  buildArbitraryCallWithBatchPermit(params: ArbitraryCallWithBatchPermitParams): TransactionResponse;
  buildArbitraryCallWithoutPermit(params: ArbitraryCallWithoutPermitParams): TransactionResponse;
};

export type SinglePermitParams = {
  appId: BigIntish;
  chainId: ChainId;
  signerAddress: Address;
  token: TokenAddress;
  amount: BigIntish;
  signatureValidFor: TimeString;
};
export type GenericSinglePermitParams = { spender: Address } & SinglePermitParams;

export type BatchPermitParams = {
  appId: BigIntish;
  chainId: ChainId;
  signerAddress: Address;
  tokens: Record<TokenAddress, BigIntish>;
  signatureValidFor: TimeString;
};
export type GenericBatchPermitParams = { spender: Address } & BatchPermitParams;

export type PermitData = {
  dataToSign: {
    types: typeof PERMIT2_TRANSFER_FROM_TYPES;
    domain: Domain;
    message: {
      permitted: {
        token: TokenAddress;
        amount: AmountOfToken;
      };
      spender: Address;
      nonce: string;
      deadline: string;
    };
    primaryType: 'PermitTransferFrom';
  };
  permitData: {
    token: Address;
    amount: string;
    nonce: string;
    deadline: string;
  };
};

export type BatchPermitData = {
  dataToSign: {
    types: typeof PERMIT2_BATCH_TRANSFER_FROM_TYPES;
    domain: Domain;
    message: {
      permitted: {
        token: TokenAddress;
        amount: AmountOfToken;
      }[];
      spender: Address;
      nonce: string;
      deadline: string;
    };
    primaryType: 'PermitBatchTransferFrom';
  };
  permitData: {
    tokens: { token: TokenAddress; amount: BigIntish }[];
    nonce: string;
    deadline: string;
  };
};

type Domain = {
  name: 'Permit2';
  verifyingContract: Address;
  chainId: ChainId;
};

export type ArbitraryCallWithPermitParams = BaseArbitraryCallParams & {
  permitData: {
    token: TokenAddress;
    amount: BigIntish;
  };
};

export type ArbitraryCallWithBatchPermitParams = BaseArbitraryCallParams & {
  permitData: { tokens: { token: TokenAddress; amount: BigIntish }[] };
};

export type BaseArbitraryCallParams = {
  permitData: {
    nonce: BigIntish;
    signature: string;
    deadline: BigIntish;
  };
  allowanceTargets?: { token: TokenAddress; target: Address }[];
  calls: GenericContractCall[];
  distribution?: Record<TokenAddress, DistributionTarget[]>;
};

export type ArbitraryCallWithoutPermitParams = {
  calls: GenericContractCall[];
  txValidFor: TimeString;
  allowanceTargets?: { token: TokenAddress; target: Address }[];
  distribution?: Record<TokenAddress, DistributionTarget[]>;
};

export type GenericContractCall = (EncodedContractCall | ContractCall) & { value?: BigIntish };
export type DistributionTarget = { recipient: Address; shareBps: number };
type EncodedContractCall = { to: Address; data: string };
