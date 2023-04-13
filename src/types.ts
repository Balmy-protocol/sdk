import { ArrayOneOrMoreReadonly, If, KeysWithValue } from '@utility-types';
import { StringValue } from 'ms';

export type Address = string;
export type TokenAddress = Address;
export type ChainId = number;
export type TimeString = StringValue;
export type AmountOfToken = string;
export type AmountOfTokenLike = string | number | bigint;
export type Chain = Readonly<{
  chainId: ChainId;
  name: string;
  ids: ArrayOneOrMoreReadonly<string>;
  nativeCurrency: { symbol: string; name: string };
  wToken: string;
  publicRPCs: Readonly<string[]>;
  explorer: string;
  testnet?: boolean;
}>;
export type Transaction = {
  from: Address;
  to: Address;
  data?: string;
  value?: AmountOfTokenLike;
  nonce?: number;
  maxPriorityFeePerGas?: AmountOfTokenLike;
  maxFeePerGas?: AmountOfTokenLike;
  gasPrice?: AmountOfTokenLike;
  gasLimit?: AmountOfTokenLike;
};

export type SupportRecord<Values extends object> = { [K in keyof Values]-?: undefined extends Values[K] ? 'optional' : 'present' };
export type SupportInChain<Values extends object> = {
  [K in keyof SupportRecord<Values>]: SupportRecord<Values>[K] extends 'present' ? 'present' : 'optional' | 'present';
};
export type FieldRequirementOptions = 'required' | 'best effort' | 'can ignore';
export type FieldsRequirements<Values extends object> = {
  requirements?: Partial<Record<keyof Values, FieldRequirementOptions>>;
  default?: FieldRequirementOptions;
};
export type DefaultRequirements<Values extends object> = {
  requirements: { [K in keyof Values]: SupportRecord<Values>[K] extends 'present' ? 'required' : 'best effort' };
};

export type BasedOnRequirements<Values extends object, Requirements extends FieldsRequirements<Values>> = Partial<Values> &
  Required<Pick<Values, PresentKeys<Values, Requirements>>>;

type PresentKeys<Values extends object, Requirements extends FieldsRequirements<Values>> = Exclude<
  KeysWithValue<SupportRecord<Values>, 'present'> | RequiredKeys<Values, Requirements>,
  CanIgnoreKeys<Values, Requirements>
> &
  keyof Values;
type UnspecifiedKeys<Values extends object, Requirements extends FieldsRequirements<Values>> = Exclude<
  keyof Values,
  undefined extends Requirements['requirements'] ? never : keyof NonNullable<Requirements['requirements']>
>;
type RequiredKeys<Values extends object, Requirements extends FieldsRequirements<Values>> =
  | (undefined extends Requirements['requirements'] ? never : KeysWithValue<NonNullable<Requirements['requirements']>, 'required'>)
  | If<IsDefault<Requirements, 'required'>, UnspecifiedKeys<Values, Requirements>>;

type CanIgnoreKeys<Values extends object, Requirements extends FieldsRequirements<Values>> =
  | (undefined extends Requirements['requirements'] ? never : KeysWithValue<NonNullable<Requirements['requirements']>, 'can ignore'>)
  | If<IsDefault<Requirements, 'can ignore'>, UnspecifiedKeys<Values, Requirements>>;
type IsDefault<Requirements extends FieldsRequirements<object>, Check extends FieldRequirementOptions> = Requirements['default'] extends Check
  ? true
  : false;
