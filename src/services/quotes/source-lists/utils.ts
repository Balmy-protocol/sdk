import { BigIntish } from '@types';
import { SourceListQuoteResponse } from './types';
import { QuoteTransaction } from '../types';
import { StringifyBigInt } from '@utility-types';

export function bigintifyQuote(quote: StringifyBigInt<SourceListQuoteResponse>): SourceListQuoteResponse {
  return {
    ...quote,
    sellAmount: BigInt(quote.sellAmount),
    buyAmount: BigInt(quote.buyAmount),
    maxSellAmount: BigInt(quote.maxSellAmount),
    minBuyAmount: BigInt(quote.minBuyAmount),
    estimatedGas: toBigInt(quote.estimatedGas),
  };
}

export function bigintifyTx(tx: StringifyBigInt<QuoteTransaction>): QuoteTransaction {
  return {
    ...tx,
    value: toBigInt(tx.value),
    maxPriorityFeePerGas: toBigInt(tx.maxPriorityFeePerGas),
    maxFeePerGas: toBigInt(tx.maxFeePerGas),
    gasPrice: toBigInt(tx.gasPrice),
    gasLimit: toBigInt(tx.gasLimit),
  };
}

function toBigInt(value: BigIntish | undefined) {
  return value === undefined ? undefined : BigInt(value);
}
