import { BigNumber, BigNumberish, constants, utils } from 'ethers';
import ms from 'ms';
import { Address, Chain, TimeString } from '@types';

export function wait(time: TimeString | number) {
  return new Promise((resolve) => setTimeout(resolve, ms(`${time}`)));
}

export function isSameAddress(address1: Address | undefined, address2: Address | undefined) {
  return !!address1 && !!address2 && address1.toLowerCase() === address2.toLowerCase();
}

export function substractPercentage(amount: BigNumberish, slippagePercentage: number) {
  const percentage = mulDivByNumber(amount, slippagePercentage, 100, 'down');
  return BigNumber.from(amount).sub(percentage);
}

export function addPercentage(amount: BigNumberish, slippagePercentage: number) {
  const percentage = mulDivByNumber(amount, slippagePercentage, 100, 'up');
  return BigNumber.from(amount).add(percentage);
}

const PRECISION = 10000000;
export function mulDivByNumber(amount: BigNumberish, mul: number, div: number, rounding: 'up' | 'down' = 'down') {
  const round = (num: number) => Math.round(num * PRECISION);
  const numerator = BigNumber.from(amount).mul(round(mul));
  const denominator = round(div);
  const result = numerator.div(denominator);
  return !numerator.mod(denominator).isZero() && rounding === 'up' ? result.add(1) : result;
}

export function calculateDeadline(txValidFor?: TimeString) {
  return txValidFor ? Math.floor((Date.now() + ms(txValidFor)) / 1000) : undefined;
}

export function timeToSeconds(time: TimeString) {
  return Math.floor(ms(time) / 1000);
}

export function toUnits(amount: BigNumber, decimals: number, precision: number = 5): string {
  const units = utils.formatUnits(amount, decimals);
  const regex = new RegExp('^-?\\d+(?:.\\d{0,' + (precision || -1) + '})?');
  return units.match(regex)![0];
}

export function calculateGasDetails(chain: Chain, gasCostNativeToken: string, nativeTokenPrice?: number) {
  return {
    estimatedCost: gasCostNativeToken,
    estimatedCostInUnits: utils.formatUnits(gasCostNativeToken, 18),
    estimatedCostInUSD: amountToUSD(18, gasCostNativeToken, nativeTokenPrice),
    gasTokenSymbol: chain.nativeCurrency.symbol,
  };
}

const USD_PRECISION = 8;
export function amountToUSD<Price extends number | undefined>(
  decimals: number,
  amount: BigNumberish,
  usdPrice: Price,
  precision: number = 3
): undefined extends Price ? undefined : string {
  if (!!usdPrice) {
    const priceBN = utils.parseUnits(`${usdPrice.toFixed(USD_PRECISION)}`, USD_PRECISION);
    const magnitude = utils.parseUnits('1', decimals);
    const amountUSDBN = priceBN.mul(amount).div(magnitude);
    return toUnits(amountUSDBN, USD_PRECISION, precision) as undefined extends Price ? undefined : string;
  }
  return undefined as undefined extends Price ? undefined : string;
}

export async function filterRejectedResults<T>(promises: Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(promises);
  return results.filter((result): result is PromiseFulfilledResult<Awaited<T>> => result.status === 'fulfilled').map(({ value }) => value);
}

export function ruleOfThree({ a, matchA, b }: { a: BigNumberish; matchA: BigNumberish; b: BigNumberish }) {
  const matchABN = BigNumber.from(matchA);
  const bBN = BigNumber.from(b);
  if (bBN.isZero() || matchABN.isZero()) return constants.Zero;
  return bBN.mul(matchA).div(a);
}
