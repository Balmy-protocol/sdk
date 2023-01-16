import { timeoutPromise } from '@shared/timeouts';
import { QuoteSource, QuoteSourceSupport } from '../base';

// We will pass the timeout to the quote sources, but sometime they don't have a way to enforce. So the idea will be to
// add a wrapper that can enforce it
export function forcedTimeoutWrapper<Support extends QuoteSourceSupport, CustomConfigNeeded extends boolean, CustomQuoteSourceConfig>(
  source: QuoteSource<Support, CustomConfigNeeded, CustomQuoteSourceConfig>
): QuoteSource<Support, CustomConfigNeeded, CustomQuoteSourceConfig> {
  return {
    ...source,
    quote: (components, request) => {
      const description = `Quote ${request.sellToken} => ${request.buyToken} on ${request.chain.name}} for source ${source.getMetadata().name}`;
      return timeoutPromise(source.quote(components, request), request.config.timeout, { description });
    },
  };
}
