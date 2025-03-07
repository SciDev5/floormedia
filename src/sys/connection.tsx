import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { EventBinder } from "./useevent";
import { is_arr, is_bool, is_dict, is_in_union, is_literal, is_number, is_str, is_tuple, try_parse_json } from "./json";
import { SongInfo, CMSG_KEY, CMsgQueueChange, CMsgSongInfo, CMsg, CMsgVideoChange, CMsgVolume, SMsg, SMSG_KEY, CMsgPlayState, PlayState, CMsgPing } from "./connection_types";
import { register_ping, synchronized_now } from "./timing";

export const SERVER = {
    get HOST() {
        if (_SERVER_HOST == null) {
            _SERVER_HOST = location.hostname + ":3001"
        }
        return _SERVER_HOST
    },
    get SECURE() {
        if (_SERVER_HOST_SECURE == null) {
            _SERVER_HOST_SECURE = window.isSecureContext && location.hostname !== "localhost"
        }
        return _SERVER_HOST_SECURE
    },
}
let _SERVER_HOST: string | null = null
let _SERVER_HOST_SECURE: boolean | null = null

const ConnectionContext = createContext<Connection | null>(null)

const is_SongInfo = is_dict({
    title: is_str,
    uploader: is_str,
    loaded: is_bool,
    failed: is_bool,
    deleted: is_bool,
    length: is_number,
}) as (v: unknown) => v is SongInfo

const is_PlayState = is_in_union<PlayState>([
    is_dict({
        playing: is_literal<true>(true),
        time_start: is_number,
        rate: is_number,
    }),
    is_dict({
        playing: is_literal<false>(false),
        time_at: is_number,
        rate: is_number,
    }),
]) as (v: unknown) => v is PlayState

const is_msg_video_change = is_tuple<CMsgVideoChange>([is_literal(CMSG_KEY.VIDEO_CHANGE), is_in_union([is_str, is_literal<null>(null)]), is_number])
const is_msg_playstate = is_tuple<CMsgPlayState>([is_literal(CMSG_KEY.PLAY_STATE), is_PlayState])
const is_msg_volume = is_tuple<CMsgVolume>([is_literal(CMSG_KEY.VOLUME), is_number])
const is_msg_queue_change = is_tuple<CMsgQueueChange>([is_literal(CMSG_KEY.QUEUE_CHANGED), is_arr(is_str)])
const is_msg_songinfo = is_tuple<CMsgSongInfo>([is_literal(CMSG_KEY.SONG_INFO), is_str, is_SongInfo])
const is_msg_ping = is_tuple<CMsgPing>([is_literal(CMSG_KEY.PING), is_number, is_number])
const is_msg = is_in_union<CMsg>(
    [is_msg_video_change, is_msg_playstate, is_msg_volume, is_msg_queue_change, is_msg_songinfo, is_msg_ping]
)

class Connection {
    private readonly ws = new WebSocket(`ws${SERVER.SECURE ? "s" : ""}://${SERVER.HOST}/ws`)

    private sync_interval_id: NodeJS.Timeout | number = -1

    readonly on_close = new EventBinder<[]>()
    readonly on_video_change = new EventBinder<[string | null, number]>()
    readonly on_playstate_change = new EventBinder<[PlayState]>()
    readonly on_pauseplay = new EventBinder<[boolean]>()
    readonly on_rate = new EventBinder<[number]>()
    readonly on_volume = new EventBinder<[number]>()
    readonly on_queue_change = new EventBinder<[string[]]>()
    readonly on_cache_update = new EventBinder<[]>()
    readonly last_received: {
        queue: string[],
        readonly cached: Map<string, SongInfo>,
        current: string | null,
        current_discriminator: number,
        volume: number,
        playstate: PlayState,
    } = {
            queue: [],
            cached: new Map(),
            current: null,
            current_discriminator: -1,
            volume: 0.0,
            playstate: { playing: false, time_at: 0, rate: 1, },
        }

    private readonly on_message = (e: MessageEvent) => {
        const data = try_parse_json(e.data, is_msg)
        if (data == null) {
            console.warn("received invalid message", e.data)
            return
        }
        switch (data[0]) {
            case CMSG_KEY.VIDEO_CHANGE:
                this.last_received.current = data[1]
                this.last_received.current_discriminator = data[2]
                this.on_video_change.dispatch(data[1], data[2])
                break
            case CMSG_KEY.PLAY_STATE:
                const last_playstate = this.last_received.playstate
                this.last_received.playstate = data[1]
                if (last_playstate.playing !== data[1].playing) {
                    this.on_pauseplay.dispatch(data[1].playing)
                }
                if (last_playstate.rate !== data[1].rate) {
                    this.on_rate.dispatch(data[1].rate)
                }
                this.on_playstate_change.dispatch(data[1])
                break
            case CMSG_KEY.VOLUME:
                this.last_received.volume = data[1]
                this.on_volume.dispatch(data[1])
                break
            case CMSG_KEY.QUEUE_CHANGED:
                this.last_received.queue = [...data[1]]
                this.on_queue_change.dispatch(data[1])
                break
            case CMSG_KEY.SONG_INFO:
                this.last_received.cached.set(data[1], data[2])
                this.on_cache_update.dispatch()
                break
            case CMSG_KEY.PING: {
                const local_time_bounce = 0.5 * (Date.now() + data[1])
                const remote_time_bounce = data[2]

                register_ping(local_time_bounce, remote_time_bounce)
                break
            }
        }
    }

    private send(msg: SMsg) {
        this.ws.send(JSON.stringify(msg))
    }

    send_req_enqueue(id: string) { this.send([SMSG_KEY.ENQUEUE, id]) }
    send_req_skip() { this.send([SMSG_KEY.SKIP]) }
    send_req_next(from_discriminator: number) { this.send([SMSG_KEY.NEXT, from_discriminator]) }
    send_req_playstate(playstate: PlayState) { this.send([SMSG_KEY.PLAY_STATE, playstate]) }
    send_req_volume(volume: number) { this.send([SMSG_KEY.VOLUME, volume]) }
    send_req_queue_change(new_queue: string[]) { this.send([SMSG_KEY.QUEUE_CHANGE, new_queue]) }
    send_req_sync() { this.send([SMSG_KEY.REQ_SYNC]) }

    req_pauseplay(playing: boolean) {
        const last = this.last_received.playstate
        if (playing) {
            if (last.playing) {
                return
            } else {
                this.send_req_playstate({ playing, time_start: synchronized_now() - last.time_at / last.rate, rate: last.rate })
            }
        } else {
            if (last.playing) {
                this.send_req_playstate({ playing, time_at: (synchronized_now() - last.time_start) * last.rate, rate: last.rate })
            } else {
                return
            }
        }
    }
    req_seek(time_at: number) {
        const last = this.last_received.playstate
        this.send_req_playstate(last.playing
            ? { playing: true, time_start: synchronized_now() - time_at / last.rate, rate: last.rate }
            : { playing: false, time_at, rate: last.rate }
        )
    }
    req_rate(rate: number) {
        const last = this.last_received.playstate
        this.send_req_playstate(last.playing
            ? { playing: true, time_start: synchronized_now() - (synchronized_now() - last.time_start) * last.rate / rate, rate }
            : { playing: false, time_at: last.time_at, rate }
        )
    }

    n_sync_sent = 0
    readonly do_sync = () => {
        if (this.n_sync_sent > 32 && (this.n_sync_sent % 4 !== 0)) { return } // only do every fourth ping after the 32nd ping
        this.send([SMSG_KEY.PING, Date.now()])
    }

    constructor(res: () => void, rej: () => void) {
        this.ws.addEventListener("open", () => {
            this.sync_interval_id = setInterval(this.do_sync, 500)
            res()
        })
        this.ws.addEventListener("error", () => rej())
        this.ws.addEventListener("close", () => {
            clearInterval(this.sync_interval_id)
            this.on_close.dispatch()
        })
        this.ws.addEventListener("message", this.on_message)
    }
    drop() {
        this.ws.close()
    }
}

export function usePlayState(conn: Connection): { playing: boolean, get_time: () => number, rate: number } {
    const [playstate, set_playstate] = useState(conn.last_received.playstate)
    conn.on_playstate_change.use_bind(useCallback(playstate => {
        set_playstate(playstate)
    }, []))

    return {
        playing: playstate.playing,
        get_time: playstate.playing
            ? () => (synchronized_now() - playstate.time_start) * playstate.rate
            : () => playstate.time_at,
        rate: playstate.rate,
    }
}

export function useConnection() {
    return useContext(ConnectionContext) ?? (() => { throw new Error("useConnection used out of context") })()
}

export function ConnectionProvider({ children, not_connected }: { children: ReactNode, not_connected: ReactNode }) {
    const [conn, set_conn] = useState<Connection | null | false>(false)

    useEffect(() => {
        let conn: Connection | null = null
        let unloaded = false
        const on_close = () => {
            if (unloaded) { return }
            set_conn(false)
            conn?.drop()
            conn = null

            setTimeout(() => do_connect(), 500)
        }
        const do_connect = () => {
            let died = false
            const conn_new = new Connection(
                () => { if (!unloaded) set_conn(conn_new) },
                () => {
                    if (!unloaded) {
                        set_conn(false)
                        conn = null
                        died = true

                        setTimeout(() => do_connect(), 5000)
                    }
                },
            )
            conn_new.on_close.bind(on_close)
            if (!died) { conn = conn_new }
        }
        do_connect()
        return () => {
            conn?.on_close.unbind(on_close)
            unloaded = true
            set_conn(false)
            conn?.drop()
            conn = null
        }
    }, [])

    return conn == false ? (
        not_connected
    ) : (
        <ConnectionContext.Provider value={conn}>
            {children}
        </ConnectionContext.Provider>
    )
}