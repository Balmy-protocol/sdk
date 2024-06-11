import { timeoutPromise } from '@shared/timeouts';
import { IQuoteSource, QuoteSourceSupport } from '../types';

// We will pass the timeout to the quote sources, but sometime they don't have a way to enforce. So the idea will be to
// add a wrapper that can enforce it
export function forcedTimeoutWrapper<
  Support extends QuoteSourceSupport,
  CustomQuoteSourceConfig extends object,
  CustomQuoteSourceData extends Record<string, any>
>(
  source: IQuoteSource<Support, CustomQuoteSourceConfig, CustomQuoteSourceData>
): IQuoteSource<Support, CustomQuoteSourceConfig, CustomQuoteSourceData> {
  return {
    getMetadata: () => source.getMetadata(),
    quote: ({ components, request, config }) => {
      const description = `Quote ${request.sellToken} => ${request.buyToken} on ${request.chain.name} for source ${source.getMetadata().name}`;
      return timeoutPromise(source.quote({ components, request, config }), request.config.timeout, { description });
    },
    buildTx: ({ components, request, config }) => {
      const description = `Tx build ${request.sellToken} => ${request.buyToken} on ${request.chain.name} for source ${
        source.getMetadata().name
      }`;
      return timeoutPromise(source.buildTx({ components, request, config }), request.config.timeout, { description });
    },
    isConfigAndContextValidForQuoting: (config): config is CustomQuoteSourceConfig => {
      return source.isConfigAndContextValidForQuoting(config);
    },
    isConfigAndContextValidForTxBuilding: (config): config is CustomQuoteSourceConfig => {
      return source.isConfigAndContextValidForTxBuilding(config);
    },
  };
}
