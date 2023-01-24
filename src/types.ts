import { ArrayOneOrMoreReadonly } from '@utility-types';
import { StringValue } from 'ms';

export type Address = string;
export type TokenAddress = Address;
export type ChainId = number;
export type TimeString = StringValue;
export type AmountOfToken = string;
export type Chain = Readonly<{
  chainId: ChainId;
  name: string;
  ids: ArrayOneOrMoreReadonly<string>;
  currencySymbol: string;
  wToken: string;
  publicRPCs?: Readonly<string[]>;
  explorer: string;
  testnet?: boolean;
}>;
