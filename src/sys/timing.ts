const recent_pings: { t_local: number, t_remote: number }[] = []
const MAX_RECENT_PINGS = 3
export function register_ping(t_local: number, t_remote: number) {
    recent_pings.push({ t_local, t_remote })
    if (recent_pings.length > MAX_RECENT_PINGS)
        recent_pings.splice(0, recent_pings.length - MAX_RECENT_PINGS)
}
/**
 * The number of milliseconds on average that the local time has been
 * lagging behind the remote time.
 * 
 * `= mean(t_remote - t_local)`
 */
function mean_local_lag() {
    return Math.round(
        recent_pings
            .map(({ t_local, t_remote }) => t_remote - t_local)
            .reduce((a, b) => a + b, 0)
        / Math.max(1, recent_pings.length)
    )
}

/**
 * Get the current time, synchronized with the server and all other clients.
 * 
 * Does not guarantee continuity over time, jumps will occur.
 */
export function synchronized_now() {
    return Date.now() + mean_local_lag()
}