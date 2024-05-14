import { GasPrice } from '@services/gas/types';
import { BaseTokenMetadata } from '@services/metadata/types';
import { ITriggerablePromise } from '@shared/triggerable-promise';
import { Address, TimeString } from '@types';
import { QuoteRequest, SourceMetadata, SourceId, GlobalQuoteSourceConfig, QuoteTransaction } from '../types';
import { SourceConfig } from '../source-registry';

export type IQuoteSourceList = {
  supportedSources(): Record<SourceId, SourceMetadata>;
  getQuotes(request: SourceListRequest): Record<SourceId, Promise<SourceListResponse>>;
};

export type SourceListRequest = Omit<QuoteRequest, 'filters' | 'gasSpeed'> & {
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

export type SourceListResponse = {
  sellAmount: bigint;
  buyAmount: bigint;
  maxSellAmount: bigint;
  minBuyAmount: bigint;
  estimatedGas?: bigint;
  type: 'sell' | 'buy';
  recipient: Address;
  source: { id: SourceId; allowanceTarget: Address; name: string; logoURI: string; customData?: Record<string, any> };
  tx: QuoteTransaction;
};

export type StringifiedSourceListResponse = StringifyBigInt<SourceListResponse>;
type StringifyBigInt<T extends any> = T extends object ? { [K in keyof T]: bigint extends T[K] ? `${bigint}` : StringifyBigInt<T[K]> } : T;
