import { Address, BigIntish, ChainId, ContractCall, SupportInChain, TimeString, TokenAddress, BuiltTransaction } from '@types';
import { PERMIT2_BATCH_TRANSFER_FROM_TYPES, PERMIT2_TRANSFER_FROM_TYPES } from './utils/eip712-types';
import {
  CompareQuotesBy,
  CompareQuotesUsing,
  EstimatedQuoteRequest,
  EstimatedQuoteResponse,
  SourceId,
  SourceMetadata,
  QuoteResponse,
  QuoteTransaction,
} from '@services/quotes';
import { SupportedGasValues } from '@services/gas/types';
import { IgnoreFailedResponses } from '@services/quotes/types';

export type IPermit2Service = {
  permit2ContractAddress(chainId: ChainId): Address;
  arbitrary: IPermit2ArbitraryService;
  quotes: IPermit2QuoteService;
  calculateNonce(params: { chainId: ChainId; appId: BigIntish; user: Address }): Promise<bigint>;
  preparePermitData(params: GenericSinglePermitParams): Promise<PermitData>;
  prepareBatchPermitData(params: GenericBatchPermitParams): Promise<BatchPermitData>;
};

export type IPermit2ArbitraryService = {
  contractAddress(chainId: ChainId): Address;
  preparePermitData(params: SinglePermitParams): Promise<PermitData>;
  prepareBatchPermitData(params: BatchPermitParams): Promise<BatchPermitData>;
  buildArbitraryCallWithPermit(params: ArbitraryCallWithPermitParams): BuiltTransaction;
  buildArbitraryCallWithBatchPermit(params: ArbitraryCallWithBatchPermitParams): BuiltTransaction;
  buildArbitraryCallWithoutPermit(params: ArbitraryCallWithoutPermitParams): BuiltTransaction;
};

export type EstimatedQuoteResponseWithTx = EstimatedQuoteResponse & { estimatedTx: QuoteTransaction };
export type QuoteResponseWithTx = Omit<QuoteResponse, 'customData'> & { tx: QuoteTransaction };

export type IPermit2QuoteService = {
  contractAddress(chainId: ChainId): Address;
  preparePermitData(params: SinglePermitParams): Promise<PermitData>;
  supportedSources(): Record<SourceId, SourceMetadata>;
  supportedChains(): ChainId[];
  supportedSourcesInChain(_: { chainId: ChainId }): Record<SourceId, SourceMetadata>;
  supportedGasSpeeds(): Record<ChainId, SupportInChain<SupportedGasValues>>;
  estimateQuotes(_: {
    request: EstimatedQuoteRequest;
    config?: { timeout?: TimeString };
  }): Record<SourceId, Promise<EstimatedQuoteResponseWithTx>>;
  estimateAllQuotes<IgnoreFailed extends boolean = true>(_: {
    request: EstimatedQuoteRequest;
    config?: {
      ignoredFailed?: IgnoreFailed;
      sort?: {
        by: CompareQuotesBy;
        using?: CompareQuotesUsing;
      };
      timeout?: TimeString;
    };
  }): Promise<IgnoreFailedResponses<IgnoreFailed, EstimatedQuoteResponseWithTx>[]>;
  buildAndSimulateQuotes<IgnoreFailed extends boolean = true>(
    _: {
      chainId: ChainId;
      quotes: EstimatedQuoteResponseWithTx[];
      takerAddress: Address;
      recipient?: Address;
      config?: {
        ignoredFailed?: IgnoreFailed;
        sort?: {
          by: CompareQuotesBy;
          using?: CompareQuotesUsing;
        };
      };
    } & (
      | { permitData: PermitData['permitData'] & { signature: string }; txValidFor?: undefined }
      | { txValidFor?: TimeString; permitData?: undefined }
    )
  ): Promise<IgnoreFailedResponses<IgnoreFailed, QuoteResponseWithTx>[]>;
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
        amount: bigint;
      };
      spender: Address;
      nonce: bigint;
      deadline: bigint;
    };
    primaryType: 'PermitTransferFrom';
  };
  permitData: {
    token: Address;
    amount: bigint;
    nonce: bigint;
    deadline: bigint;
  };
};

export type BatchPermitData = {
  dataToSign: {
    types: typeof PERMIT2_BATCH_TRANSFER_FROM_TYPES;
    domain: Domain;
    message: {
      permitted: {
        token: TokenAddress;
        amount: bigint;
      }[];
      spender: Address;
      nonce: bigint;
      deadline: bigint;
    };
    primaryType: 'PermitBatchTransferFrom';
  };
  permitData: {
    tokens: { token: TokenAddress; amount: bigint }[];
    nonce: bigint;
    deadline: bigint;
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
  chainId: ChainId;
};

export type ArbitraryCallWithoutPermitParams = {
  calls: GenericContractCall[];
  txValidFor: TimeString;
  allowanceTargets?: { token: TokenAddress; target: Address }[];
  distribution?: Record<TokenAddress, DistributionTarget[]>;
  chainId: ChainId;
};

export type GenericContractCall = (EncodedContractCall | ContractCall) & { value?: BigIntish };
export type DistributionTarget = { recipient: Address; shareBps: number };
type EncodedContractCall = { to: Address; data: string };
