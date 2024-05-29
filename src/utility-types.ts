export type Only<T, U> = { [P in keyof T]: T[P] } & { [P in keyof U]?: never };
export type Either<T, U> = Only<T, U> | Only<U, T>;
export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
export type ArrayOneOrMore<T> = { 0: T } & Array<T>;
export type ArrayTwoOrMore<T> = { 0: T; 1: T } & Array<T>;
export type ArrayOneOrMoreReadonly<T> = { 0: T } & Readonly<Array<T>>;
export type ExcludeKeysWithTypeOf<T, V> = {
  [K in keyof T]: Exclude<T[K], undefined> extends V ? never : K;
}[keyof T];
export type Without<T, V> = Pick<T, ExcludeKeysWithTypeOf<T, V>>;
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };
export type PartialOnly<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type KeysWithValue<T extends Record<string, any>, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];
export type If<Condition extends boolean, IfTrue> = true extends Condition ? IfTrue : never;
export type UnionMerge<T extends object> = {
  [k in CommonKeys<T>]: PickTypeOf<T, k>;
} & {
  [k in NonCommonKeys<T>]?: PickTypeOf<T, k>;
};
export type StringifyBigInt<T extends any> = T extends object
  ? { [K in keyof T]: bigint extends T[K] ? `${bigint}` : StringifyBigInt<T[K]> }
  : T;

type CommonKeys<T extends object> = keyof T;
type AllKeys<T> = T extends any ? keyof T : never;
type Subtract<A, C> = A extends C ? never : A;
type NonCommonKeys<T extends object> = Subtract<AllKeys<T>, CommonKeys<T>>;
type PickType<T, K extends AllKeys<T>> = T extends { [k in K]?: any } ? T[K] : undefined;
type PickTypeOf<T, K extends string | number | symbol> = K extends AllKeys<T> ? PickType<T, K> : never;
