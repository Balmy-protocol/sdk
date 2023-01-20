import { GetCustomConfigFromSource, GetCustomConfigNeededFromSource } from '@services/quotes/sources-list';
import { SourceQuoteRequest, QuoteSourceSupport, QuoteSource, QuoteComponents, SourceQuoteResponse, QuoteType } from '../base';

type AddedBuyOrderSupport<Support extends QuoteSourceSupport> = Pick<Support, 'swapAndTransfer'> & { buyOrders: true };
export function buyToSellOrderWrapper<Support extends QuoteSourceSupport, Source extends QuoteSource<Support, any, any>>(
  source: Source
): QuoteSource<AddedBuyOrderSupport<Support>, GetCustomConfigNeededFromSource<Source>, GetCustomConfigFromSource<Source>> {
  return {
    getCustomConfig: () => source.getCustomConfig(),
    getMetadata: () => {
      const { supports: originalSupport, ...originalMetadata } = source.getMetadata();
      return {
        ...originalMetadata,
        supports: {
          ...originalSupport,
          buyOrders: true,
        },
      };
    },
    getQuote: wrapFunction((components, request) => source.getQuote(components, request)),
    estimateQuote: wrapFunction((components, request) => source.estimateQuote(components, request)),
  };
}

function wrapFunction<Support extends QuoteSourceSupport, QuoteKind extends QuoteType>(
  quote: (components: QuoteComponents, request: SourceQuoteRequest<Support, QuoteKind>) => Promise<SourceQuoteResponse<QuoteKind>>
) {
  return (components: QuoteComponents, request: SourceQuoteRequest<AddedBuyOrderSupport<Support>, QuoteKind>) => {
    if (request.order.type === 'sell') {
      return quote(components, request as SourceQuoteRequest<Support, QuoteKind>);
    } else {
      return executeBuyOrderAsSellOrder(request, (request) => quote(components, request));
    }
  };
}

async function executeBuyOrderAsSellOrder<Support extends QuoteSourceSupport, QuoteKind extends QuoteType>(
  request: SourceQuoteRequest<AddedBuyOrderSupport<Support>, QuoteKind>,
  quote: (request: SourceQuoteRequest<Support, QuoteKind>) => Promise<SourceQuoteResponse<QuoteKind>>
) {
  if (request.order.type === 'sell') {
    throw new Error('We should not be able to get here');
  }
  /*
  The idea here is that we need to buy a certain amount of tokens with our source, but there are a few drawbacks to using a buy order:
  * Not all sources support it
  * We might be left with some unspent tokens and we might not want to
  So the idea is to transform the buy order into a sell order by:
  1. Executing a sell order from `buyToken` to `sellToken`, with the actual `buyAmount` as `sellAmount`
     This would allows us to figure understand how much of `sellToken` is needed to get `buyAmount`
  2. If this quote response says that there is no slippage, then we assume that there will be no slippage when executing the actual sell order
  3. If there was some slippage, then we will asume that the test quote's `buyAmount` + slippage will be enough to get the actual `buyAmount`
  */

  // Try to sell the amount of tokens to 'buy', to get an estimate
  const sellOrder = {
    ...request,
    order: { type: 'sell', sellAmount: request.order.buyAmount },
    sellToken: request.buyToken,
    buyToken: request.sellToken,
  } as SourceQuoteRequest<Support, QuoteKind>;
  const testSellQuote = await quote(sellOrder);
  const slippage = testSellQuote.buyAmount.sub(testSellQuote.minBuyAmount);
  if (slippage.isZero()) {
    // If there was no slippage, then we just execute the sell order
    return quote({ ...request, order: { type: 'sell', sellAmount: testSellQuote.sellAmount } });
  }

  // TODO: there is room for improvement, since we can make a few test quotes around this approx number and find the closest sell quote that produces the actual `buyAmount`
  const sellAmount = testSellQuote.buyAmount.add(slippage);
  return quote({ ...request, order: { type: 'sell', sellAmount: sellAmount } });
}
