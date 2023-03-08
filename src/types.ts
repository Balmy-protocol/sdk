import { ArrayOneOrMoreReadonly, If, KeysWithValue } from '@utility-types';
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

// TODO: Export
export type SupportRecord<Values extends object> = { [K in keyof Values]-?: undefined extends Values[K] ? 'optional' : 'present' };
export type SupportInChain<Values extends object> = {
  [K in keyof SupportRecord<Values>]: SupportRecord<Values>[K] extends 'present' ? 'present' : 'optional' | 'present';
};
export type FieldRequirementOptions = 'required' | 'best effort' | 'can ignore';
export type FieldsRequirements<Object extends object> = {
  requirements: Partial<Record<keyof Object, FieldRequirementOptions>>;
  default?: FieldRequirementOptions;
};
export type DefaultRequirements<Values extends object> = {
  requirements: { [K in keyof Values]: SupportRecord<Values>[K] extends 'present' ? 'required' : 'best effort' };
};

export type BasedOnRequirements<Values extends object, Requirements extends FieldsRequirements<Values>> = {
  [K in PresentKeys<Values, Requirements>]: Values[K];
} & { [K in OptionalKeys<Values, Requirements>]: Values[K] };

type PresentKeys<Values extends object, Requirements extends FieldsRequirements<Values>> =
  | KeysWithValue<SupportRecord<Values>, 'present'>
  | KeysWithValue<Requirements['requirements'], 'required'>
  | If<IsDefaultRequired<Requirements>, UnspecifiedKeys<Values, Requirements>>;
type OptionalKeys<Values extends object, Requirements extends FieldsRequirements<Values>> = Exclude<
  keyof Values,
  PresentKeys<Values, Requirements>
>;
type UnspecifiedKeys<Values extends Object, Requirements extends FieldsRequirements<Values>> = Exclude<
  keyof Values,
  keyof Requirements['requirements']
>;
type IsDefaultRequired<Requirements extends FieldsRequirements<any>> = Requirements['default'] extends 'required' ? true : false;
