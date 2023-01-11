import { ArrayOneOrMore } from '@utility-types';
import { StringValue } from 'ms';

export type Address = string;
export type TokenAddress = Address;
export type ChainId = number;
export type TimeString = StringValue;
export type Network = Readonly<{
  chainId: ChainId;
  name: string;
  ids: ArrayOneOrMore<string>;
  currencySymbol: string;
  wToken: string;
  publicRPCs?: Readonly<string[]>;
}>;
