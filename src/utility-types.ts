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
