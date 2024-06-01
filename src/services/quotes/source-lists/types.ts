import { GasPrice } from '@services/gas/types';
import { BaseTokenMetadata } from '@services/metadata/types';
import { ITriggerablePromise } from '@shared/triggerable-promise';
import { Address, TimeString } from '@types';
import { QuoteRequest, SourceMetadata, SourceId, QuoteTransaction, QuoteResponse } from '../types';
import { SourceConfig } from '../source-registry';

export type IQuoteSourceList = {
  supportedSources(): Record<SourceId, SourceMetadata>;
  getQuotes(request: SourceListQuoteRequest): Record<SourceId, Promise<SourceListQuoteResponse>>;
  buildTxs(request: SourceListBuildTxRequest): Record<SourceId, Promise<QuoteTransaction>>;
};

export type SourceListBuildTxRequest = {
  sourceConfig?: SourceConfig;
  quotes: Record<SourceId, Promise<QuoteResponse>>;
  quoteTimeout?: TimeString;
};

export type SourceListQuoteRequest = Omit<QuoteRequest, 'filters' | 'gasSpeed'> & {
  sources: SourceId[];
  external: {
    tokenData: ITriggerablePromise<{
      sellToken: BaseTokenMetadata;
      buyToken: BaseTokenMetadata;
    }>;
    gasPrice: ITriggerablePromise<GasPrice>;
  };
  sourceConfig?: SourceConfig;
  quoteTimeout?: TimeString;
};

export type SourceListQuoteResponse<CustomQuoteSourceData extends Record<string, any> = Record<string, any>> = {
  sellAmount: bigint;
  buyAmount: bigint;
  maxSellAmount: bigint;
  minBuyAmount: bigint;
  estimatedGas?: bigint;
  type: 'sell' | 'buy';
  recipient: Address;
  source: { id: SourceId; allowanceTarget: Address; name: string; logoURI: string };
  customData: CustomQuoteSourceData;
};
