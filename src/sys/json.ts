export function try_parse_json<T>(str: string, is_t: (v: unknown) => v is T): T | null {
    try {
        const v = JSON.parse(str)
        return is_t(v) ? v : null
    } catch {
        return null
    }
}
export function is_str(v: unknown): v is string {
    return typeof v === "string"
}
export function is_bool(v: unknown): v is boolean {
    return typeof v === "boolean"
}
export function is_literal<T>(t: T): (v: unknown) => v is T {
    return (v => v === t) as (v: unknown) => v is T
}
export function is_number(v: unknown): v is number {
    return typeof v === "number"
}
export function is_tuple<T extends [...any[]]>(
    ty: { [i in keyof Pick<T, number>]: (v: unknown) => v is T[i] } & { length: number, every: (v: (v: (v: unknown) => boolean, i: number, a: any[]) => boolean) => boolean },
): (v: unknown) => v is T {
    return (v => (
        v instanceof Array &&
        v.length === ty.length &&
        ty.every((check, i) => check(v[i]))
    )) as (v: unknown) => v is T
}
export function is_arr<T>(
    check: (v: unknown) => v is T,
): (v: unknown) => v is T[] {
    return (v => (
        v instanceof Array &&
        v.every((v) => check(v))
    )) as (v: unknown) => v is T[]
}
export function is_dict<T extends Record<string, unknown>>(
    ty: { [i in keyof T]: (v: unknown) => v is T[i] },
): (v: unknown) => v is T {
    return (v => (
        typeof v === "object" && v !== null &&
        Object.entries(ty).every(([key, check]) => check((v as Record<string, unknown>)[key]))
    )) as (v: unknown) => v is T
}

export function is_in_union<T>(options: ((v: unknown) => v is T)[]): (v: unknown) => v is T {
    return (v => (
        options.some(check => check(v))
    )) as (v: unknown) => v is T
}