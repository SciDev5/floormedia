import { useEffect } from "react"

export type UseEvent<T extends [...any[]], R> = (callback: (...args: T) => R) => void

export class EventBinder<T extends [...any[]]> {
    private readonly event_set = new Set<(...args: T) => void>()
    constructor() { }
    dispatch(...args: T) {
        this.event_set.forEach(cb => cb(...args))
    }
    bind(callback: (...args: T) => void) {
        this.event_set.add(callback)
    }
    unbind(callback: (...args: T) => void) {
        this.event_set.delete(callback)
    }
    readonly use_bind = gen_useEvent(this.bind.bind(this), this.unbind.bind(this))
}

export function gen_useEvent<T extends [...any[]], R>(
    bind_callback: (callback: (...args: T) => R) => void,
    unbind_callback: (callback: (...args: T) => R) => void,
): UseEvent<T, R> {
    return callback => {
        useEffect(() => {
            bind_callback(callback)
            return () => { unbind_callback(callback) }
        }, [callback])
    }
}