import ms from 'ms';
import { Address, BigIntish, ChainId, TimeString, TokenAddress } from '@types';
import { formatUnits, parseUnits, toHex, trim } from 'viem';

export function wait(time: TimeString | number) {
  return new Promise((resolve) => setTimeout(resolve, ms(`${time}`)));
}

export function isSameAddress(address1: Address | undefined, address2: Address | undefined) {
  return !!address1 && !!address2 && address1.toLowerCase() === address2.toLowerCase();
}

export function substractPercentage(amount: BigIntish, slippagePercentage: number, rounding: 'up' | 'down'): bigint {
  const percentage = mulDivByNumber(amount, slippagePercentage, 100, rounding);
  return BigInt(amount) - percentage;
}

export function addPercentage(amount: BigIntish, slippagePercentage: number, rounding: 'up' | 'down'): bigint {
  const percentage = mulDivByNumber(amount, slippagePercentage, 100, rounding);
  return BigInt(amount) + percentage;
}

const PRECISION = 10000000;
export function mulDivByNumber(amount: BigIntish, mul: number, div: number, rounding: 'up' | 'down'): bigint {
  const round = (num: number) => BigInt(Math.round(num * PRECISION));
  const numerator = BigInt(amount) * round(mul);
  const denominator = round(div);
  const result = numerator / denominator;
  return numerator % denominator !== 0n && rounding === 'up' ? result + 1n : result;
}

export function calculateDeadline(txValidFor: TimeString): number;
export function calculateDeadline(txValidFor: undefined): undefined;
export function calculateDeadline(txValidFor: TimeString | undefined): number | undefined;
export function calculateDeadline(txValidFor: TimeString | undefined): number | undefined {
  return txValidFor ? Math.floor((Date.now() + ms(txValidFor)) / 1000) : undefined;
}

export function timeToSeconds(time: TimeString) {
  return Math.floor(ms(time) / 1000);
}

export function toUnits(amount: BigIntish, decimals: number, precision: number = 5): string {
  const units = formatUnits(BigInt(amount), decimals);
  const regex = new RegExp('^-?\\d+(?:.\\d{0,' + (precision || -1) + '})?');
  return units.match(regex)![0];
}

const USD_PRECISION = 8;
export function amountToUSD<Price extends number | undefined>(
  decimals: number,
  amount: BigIntish,
  usdPrice: Price,
  precision: number = 3
): undefined extends Price ? undefined : string {
  if (!!usdPrice) {
    const priceBN = parseUnits(`${usdPrice.toFixed(USD_PRECISION)}` as `${number}`, USD_PRECISION);
    const magnitude = parseUnits('1', decimals);
    const amountUSDBN = (priceBN * BigInt(amount)) / magnitude;
    return toUnits(amountUSDBN.toString(), USD_PRECISION, precision) as undefined extends Price ? undefined : string;
  }
  return undefined as undefined extends Price ? undefined : string;
}

export async function filterRejectedResults<T>(promises: Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(promises);
  return results.filter((result): result is PromiseFulfilledResult<Awaited<T>> => result.status === 'fulfilled').map(({ value }) => value);
}

export function ruleOfThree({ a, matchA, b }: { a: BigIntish; matchA: BigIntish; b: BigIntish }): bigint {
  const matchABN = BigInt(matchA);
  const bBN = BigInt(b);
  if (bBN === 0n || matchABN === 0n) return 0n;
  return (bBN * matchABN) / BigInt(a);
}

export type TokenInChain = `${ChainId}:${TokenAddress}`;
export function toTokenInChain(chainId: ChainId, address: TokenAddress): TokenInChain {
  return `${chainId}:${address}`;
}

export function fromTokenInChain(tokenInChain: TokenAddress): { chainId: ChainId; address: TokenAddress } {
  const [chainId, address] = tokenInChain.split(':');
  return { chainId: parseInt(chainId), address };
}

export function toTrimmedHex(value: BigIntish) {
  const trimmed = trim(toHex(value));
  return trimmed.startsWith('0x0') && trimmed !== '0x0' ? trimmed.replace('0x0', '0x') : trimmed;
}

export function splitInChunks<T>(list: T[], chunkSize: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    result.push(list.slice(i, i + chunkSize));
  }
  return result;
}
