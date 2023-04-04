/**
 * Adds `null` as an accepted type to all properties in given type.
 */
export type Nullable<Obj> = { [Key in keyof Obj]: Obj[Key] | null };

type RequiredKeys<Obj> = {
    [Key in keyof Obj]-?: object extends { [K in Key]: Obj[Key] } ? never : Key;
}[keyof Obj];
type OptionalKeys<Obj> = {
    [Key in keyof Obj]-?: object extends { [K in Key]: Obj[Key] } ? Key : never;
}[keyof Obj];
type RequiredProperties<Obj> = Pick<Obj, RequiredKeys<Obj>>;
type OptionalProperties<Obj> = Pick<Obj, OptionalKeys<Obj>>;

/**
 * Adds `null` as an accepted type to all optional properties in given type. Required properties remain unchanged.
 */
export type NullableOptional<Obj> = RequiredProperties<Obj> &
    Nullable<OptionalProperties<Obj>>;
