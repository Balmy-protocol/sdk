import { GasSpeed, SupportedGasValues } from '@services/gas/types';
import { BaseTokenMetadata } from '@services/metadata/types';
import { Address, BigIntish, ChainId, SupportInChain, TimeString, TokenAddress, BuiltTransaction, AmountsOfToken } from '@types';
import { Either } from '@utility-types';
import { CompareQuotesBy, CompareQuotesUsing } from './quote-compare';
import { QuoteSourceMetadata, QuoteSourceSupport } from './quote-sources/types';
import { SourceConfig } from './source-registry';

export type GlobalQuoteSourceConfig = {
  referrer?: {
    address: Address;
    name: string;
  };
  disableValidation?: boolean;
};

export type SourceId = string;
export type SourceMetadata = QuoteSourceMetadata<QuoteSourceSupport>;
export type IQuoteService = {
  supportedSources(): Record<SourceId, SourceMetadata>;
  supportedChains(): ChainId[];
  supportedSourcesInChain(_: { chainId: ChainId }): Record<SourceId, SourceMetadata>;
  supportedGasSpeeds(): Record<ChainId, SupportInChain<SupportedGasValues>>;

  estimateQuotes(_: { request: EstimatedQuoteRequest; config?: { timeout?: TimeString } }): Record<SourceId, Promise<EstimatedQuoteResponse>>;
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
  }): Promise<IgnoreFailedResponses<IgnoreFailed, EstimatedQuoteResponse>[]>;
  getQuotes(_: { request: QuoteRequest; config?: { timeout?: TimeString } }): Record<SourceId, Promise<QuoteResponse>>;
  getAllQuotes<IgnoreFailed extends boolean = true>(_: {
    request: QuoteRequest;
    config?: {
      ignoredFailed?: IgnoreFailed;
      sort?: {
        by: CompareQuotesBy;
        using?: CompareQuotesUsing;
      };
      timeout?: TimeString;
    };
  }): Promise<IgnoreFailedResponses<IgnoreFailed, QuoteResponse>[]>;
  getBestQuote(_: {
    request: QuoteRequest;
    config?: {
      choose?: {
        by: CompareQuotesBy;
        using?: CompareQuotesUsing;
      };
      timeout?: TimeString;
    };
  }): Promise<QuoteResponse>;

  buildTxs(_: {
    quotes: Record<SourceId, Promise<QuoteResponse>> | Record<SourceId, QuoteResponse>;
    sourceConfig?: SourceConfig;
    config?: { timeout?: TimeString };
  }): Record<SourceId, Promise<QuoteTransaction>>;
  buildAllTxs<IgnoreFailed extends boolean = true>(_: {
    quotes: Record<SourceId, Promise<QuoteResponse>> | Promise<Record<SourceId, QuoteResponse>> | Record<SourceId, QuoteResponse>;
    sourceConfig?: SourceConfig;
    config?: {
      timeout?: TimeString;
      ignoredFailed?: IgnoreFailed;
    };
  }): Promise<Record<SourceId, IgnoreFailedResponses<IgnoreFailed, QuoteTransaction>>>;
};

export type QuoteRequest = {
  chainId: ChainId;
  sellToken: TokenAddress;
  buyToken: TokenAddress;
  order: { type: 'sell'; sellAmount: BigIntish } | { type: 'buy'; buyAmount: BigIntish };
  slippagePercentage: number;
  takerAddress: Address;
  recipient?: Address;
  gasSpeed?: { speed: GasSpeed; requirement?: 'required' | 'best effort' };
  txValidFor?: TimeString;
  filters?: Either<{ includeSources: SourceId[] }, { excludeSources: SourceId[] }>;
  includeNonTransferSourcesWhenRecipientIsSet?: boolean;
  estimateBuyOrdersWithSellOnlySources?: boolean;
  sourceConfig?: SourceConfig;
};

type TokenWithOptionalPrice = BaseTokenMetadata & { address: TokenAddress; price?: number };
export type QuoteResponse<CustomQuoteSourceData extends Record<string, any> = Record<string, any>> = {
  chainId: ChainId;
  sellToken: TokenWithOptionalPrice;
  buyToken: TokenWithOptionalPrice;
  sellAmount: AmountsOfToken;
  buyAmount: AmountsOfToken;
  maxSellAmount: AmountsOfToken;
  minBuyAmount: AmountsOfToken;
  gas?: {
    estimatedGas: bigint;
    estimatedCost: bigint;
    estimatedCostInUnits: string;
    gasTokenSymbol: string;
    estimatedCostInUSD?: string;
    gasTokenPrice?: number;
  };
  accounts: { takerAddress: Address; recipient: Address };
  source: { id: SourceId; allowanceTarget: Address; name: string; logoURI: string };
  type: 'sell' | 'buy';
  customData: CustomQuoteSourceData;
};

export type QuoteTransaction = BuiltTransaction & { from: Address };

export type EstimatedQuoteRequest = Omit<QuoteRequest, 'takerAddress' | 'recipient' | 'txValidFor'>;
export type EstimatedQuoteResponse = Omit<QuoteResponse, 'accounts' | 'customData'>;

export type IgnoreFailedResponses<IgnoredFailed extends boolean, Response> = IgnoredFailed extends true ? Response : Response | FailedResponse;

export type FailedResponse = { failed: true; source: { id: string; name: string; logoURI: string }; error: any };
