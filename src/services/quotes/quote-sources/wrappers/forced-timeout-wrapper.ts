import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { QuoteSource, QuoteSourceSupport } from '../base';

// We will pass the timeout to the quote sources, but sometime they don't have a way to enforce. So the idea will be to
// add a wrapper that can enforce it
export function forcedTimeoutWrapper<Support extends QuoteSourceSupport, CustomQuoteSourceConfig>(
  source: QuoteSource<Support, CustomQuoteSourceConfig>
): QuoteSource<Support, CustomQuoteSourceConfig> {
  return {
    getCustomConfig: () => source.getCustomConfig(),
    getMetadata: () => source.getMetadata(),
    quote: (components, request) => {
      const description = `Quote ${request.sellToken} => ${request.buyToken} on ${request.chain.name} for source ${source.getMetadata().name}`;
      const reduced = reduceTimeout(request.config.timeout, '100'); // We reduce the timeout a little bit, so the list doesn't get timeouted
      return timeoutPromise(source.quote(components, request), reduced, { description });
    },
  };
}
