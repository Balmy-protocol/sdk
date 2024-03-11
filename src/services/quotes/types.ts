import { GasSpeed, SupportedGasValues } from '@services/gas/types';
import { BaseTokenMetadata } from '@services/metadata/types';
import { Address, AmountOfToken, BigIntish, ChainId, SupportInChain, TimeString, TokenAddress, BuiltTransaction, AmountsOfToken } from '@types';
import { Either } from '@utility-types';
import { CompareQuotesBy, CompareQuotesUsing } from './quote-compare';
import { QuoteSourceMetadata, QuoteSourceSupport } from './quote-sources/types';
import { LocalSourceConfig, SourceConfig } from './source-registry';

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
  estimateQuotes(_: {
    request: EstimatedQuoteRequest;
    config?: { timeout?: TimeString };
  }): Promise<IgnoreFailedQuotes<false, EstimatedQuoteResponse>>[];
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
  }): Promise<IgnoreFailedQuotes<IgnoreFailed, EstimatedQuoteResponse>[]>;
  getQuote(_: { sourceId: SourceId; request: IndividualQuoteRequest; config?: { timeout?: TimeString } }): Promise<QuoteResponse>;
  getQuotes(_: { request: QuoteRequest; config?: { timeout?: TimeString } }): Promise<IgnoreFailedQuotes<false, QuoteResponse>>[];
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
  }): Promise<IgnoreFailedQuotes<IgnoreFailed, QuoteResponse>[]>;
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
export type QuoteResponse = {
  sellToken: TokenWithOptionalPrice;
  buyToken: TokenWithOptionalPrice;
  sellAmount: AmountsOfToken;
  buyAmount: AmountsOfToken;
  maxSellAmount: AmountsOfToken;
  minBuyAmount: AmountsOfToken;
  gas?: {
    estimatedGas: AmountOfToken;
    estimatedCost: AmountOfToken;
    estimatedCostInUnits: string;
    gasTokenSymbol: string;
    estimatedCostInUSD?: string;
    gasTokenPrice?: number;
  };
  recipient: Address;
  source: { id: SourceId; allowanceTarget: Address; name: string; logoURI: string; customData?: Record<string, any> };
  type: 'sell' | 'buy';
  tx: QuoteTransaction;
};

export type QuoteTransaction = BuiltTransaction & {
  from: Address;
  maxPriorityFeePerGas?: AmountOfToken;
  maxFeePerGas?: AmountOfToken;
  gasPrice?: AmountOfToken;
  gasLimit?: AmountOfToken;
};

export type IndividualQuoteRequest = Omit<
  QuoteRequest,
  'filters' | 'includeNonTransferSourcesWhenRecipientIsSet' | 'estimateBuyOrdersWithSellOnlySources' | 'sourceConfig'
> & {
  dontFailIfSourceDoesNotSupportTransferAndRecipientIsSet?: boolean;
  estimateBuyOrderIfSourceDoesNotSupportIt?: boolean;
  sourceConfig?: { global?: GlobalQuoteSourceConfig; custom?: LocalSourceConfig };
};

export type EstimatedQuoteRequest = Omit<QuoteRequest, 'takerAddress' | 'recipient' | 'txValidFor'>;
export type EstimatedQuoteResponse = Omit<QuoteResponse, 'recipient' | 'tx'>;

export type IgnoreFailedQuotes<
  IgnoredFailed extends boolean,
  Response extends QuoteResponse | EstimatedQuoteResponse
> = IgnoredFailed extends true ? Response : Response | FailedQuote;

export type FailedQuote = { failed: true; source: { id: string; name: string; logoURI: string }; error: any };
