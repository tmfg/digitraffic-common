export type Nullable<Obj> = { [Key in keyof Obj]: Obj[Key] | null };

type RequiredKeys<Obj> = {
    [Key in keyof Obj]-?: object extends { [K in Key]: Obj[Key] } ? never : Key;
}[keyof Obj];
type OptionalKeys<Obj> = {
    [Key in keyof Obj]-?: object extends { [K in Key]: Obj[Key] } ? Key : never;
}[keyof Obj];
type RequiredProperties<Obj> = Pick<Obj, RequiredKeys<Obj>>;
type OptionalProperties<Obj> = Pick<Obj, OptionalKeys<Obj>>;

export type NullableOptional<Obj> = RequiredProperties<Obj> &
    Nullable<OptionalProperties<Obj>>;
