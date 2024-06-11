import {
  IQuoteSource,
  QuoteParams,
  QuoteSourceMetadata,
  QuoteSourceSupport,
  SourceQuoteResponse,
  SourceQuoteTransaction,
  BuildTxParams,
} from '../types';

export abstract class AlwaysValidConfigAndContextSource<
  Support extends QuoteSourceSupport,
  CustomQuoteSourceConfig extends object = {},
  CustomQuoteSourceData extends Record<string, any> = Record<string, any>
> implements IQuoteSource<Support, CustomQuoteSourceConfig, CustomQuoteSourceData>
{
  abstract getMetadata(): QuoteSourceMetadata<Support>;
  abstract quote(_: QuoteParams<Support, CustomQuoteSourceConfig>): Promise<SourceQuoteResponse<CustomQuoteSourceData>>;
  abstract buildTx(_: BuildTxParams<CustomQuoteSourceConfig, CustomQuoteSourceData>): Promise<SourceQuoteTransaction>;

  isConfigAndContextValidForQuoting(config: Partial<CustomQuoteSourceConfig> | undefined): config is CustomQuoteSourceConfig {
    return true;
  }

  isConfigAndContextValidForTxBuilding(config: Partial<CustomQuoteSourceConfig> | undefined): config is CustomQuoteSourceConfig {
    return true;
  }
}
