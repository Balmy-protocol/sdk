import { TriggerablePromise } from '@shared/triggerable-promise';
import { SourceQuoteRequest, QuoteSourceSupport, IQuoteSource, SourceQuoteResponse } from '../types';
import { mulDivByNumber } from '@shared/utils';

type AddedBuyOrderSupport<Support extends QuoteSourceSupport> = Pick<Support, 'swapAndTransfer'> & { buyOrders: true };
export function buyToSellOrderWrapper<
  Support extends QuoteSourceSupport,
  CustomQuoteSourceConfig extends object,
  CustomQuoteSourceData extends Record<string, any>,
  Source extends IQuoteSource<Support, CustomQuoteSourceConfig, CustomQuoteSourceData>
>(source: Source): IQuoteSource<AddedBuyOrderSupport<Support>, CustomQuoteSourceConfig, CustomQuoteSourceData> {
  return {
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
    quote: ({ components, request, config }) => {
      if (request.order.type === 'sell') {
        return source.quote({ components, request: request as SourceQuoteRequest<Support>, config });
      } else {
        return executeBuyOrderAsSellOrder(request, (request) => source.quote({ components, request, config }));
      }
    },
    buildTx: (args) => {
      return source.buildTx(args);
    },
    isConfigAndContextValid: (config): config is CustomQuoteSourceConfig => {
      return source.isConfigAndContextValid(config);
    },
  };
}

async function executeBuyOrderAsSellOrder<Support extends QuoteSourceSupport, CustomQuoteSourceData extends Record<string, any>>(
  request: SourceQuoteRequest<AddedBuyOrderSupport<Support>>,
  quote: (request: SourceQuoteRequest<Support>) => Promise<SourceQuoteResponse<CustomQuoteSourceData>>
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
  2. With this new information, create a sell order close to the buy order
  */

  // We know that in a sell order, we will get a certain amount of tokens. Based on the slippage, we will be guaranteed
  // a smaller amount. So we calculate how much buy tokens we should get as `buyAmount`, so that the `minBuyAmount` is
  // greater than (or equal) to what we need
  const needed = mulDivByNumber(request.order.buyAmount, 100, 100 - request.config.slippagePercentage, 'up');
  // Try to sell the amount of tokens to 'buy', to get an estimate
  const sellOrder = {
    ...request,
    order: { type: 'sell', sellAmount: needed },
    sellToken: request.buyToken,
    buyToken: request.sellToken,
    external: {
      gasPrice: request.external.gasPrice,
      tokenData: new TriggerablePromise(() =>
        // We need to reverse the tokens here
        request.external.tokenData.request().then(({ sellToken, buyToken }) => ({ sellToken: buyToken, buyToken: sellToken }))
      ),
    },
  } as SourceQuoteRequest<Support>;
  const testSellQuote = await quote(sellOrder);
  // Note: there is room for improvement here. We could could execute a few sell quotes to see which one is closer to the buy
  //       amount. We are starting simple
  return quote({ ...request, order: { type: 'sell', sellAmount: testSellQuote.buyAmount } });
}
