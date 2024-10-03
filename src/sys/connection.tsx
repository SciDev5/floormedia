import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { EventBinder } from "./useevent";
import { is_arr, is_bool, is_dict, is_in_union, is_literal, is_number, is_str, is_tuple, try_parse_json } from "./json";
import { SongInfo, CMSG_KEY, CMsgQueueChange, CMsgSongInfo, CMsg, CMsgVideoChange, CMsgVolume, SMsg, SMSG_KEY, CMsgPlayState, PlayState } from "./connection_types";

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
    }),
    is_dict({
        playing: is_literal<false>(false),
        time_at: is_number,
    }),
]) as (v: unknown) => v is PlayState

const is_msg_video_change = is_tuple<CMsgVideoChange>([is_literal(CMSG_KEY.VIDEO_CHANGE), is_in_union([is_str, is_literal<null>(null)]), is_number])
const is_msg_playstate = is_tuple<CMsgPlayState>([is_literal(CMSG_KEY.PLAY_STATE), is_PlayState])
const is_msg_volume = is_tuple<CMsgVolume>([is_literal(CMSG_KEY.VOLUME), is_number])
const is_msg_queue_change = is_tuple<CMsgQueueChange>([is_literal(CMSG_KEY.QUEUE_CHANGED), is_arr(is_str)])
const is_msg_songinfo = is_tuple<CMsgSongInfo>([is_literal(CMSG_KEY.SONG_INFO), is_str, is_SongInfo])
const is_msg = is_in_union<CMsg>(
    [is_msg_video_change, is_msg_playstate, is_msg_volume, is_msg_queue_change, is_msg_songinfo]
)

class Connection {
    private readonly ws = new WebSocket(`ws${SERVER.SECURE ? "s" : ""}://${SERVER.HOST}/`)

    readonly on_close = new EventBinder<[]>()
    readonly on_video_change = new EventBinder<[string | null, number]>()
    readonly on_playstate_change = new EventBinder<[PlayState]>()
    readonly on_pauseplay = new EventBinder<[boolean]>()
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
            playstate: { playing: false, time_at: 0 },
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
                this.send_req_playstate({ playing, time_start: Date.now() - last.time_at })
            }
        } else {
            if (last.playing) {
                this.send_req_playstate({ playing, time_at: Date.now() - last.time_start })
            } else {
                return
            }
        }
    }
    req_seek(time_at: number) {
        const last = this.last_received.playstate
        this.send_req_playstate(last.playing
            ? { playing: true, time_start: Date.now() - time_at }
            : { playing: false, time_at }
        )
    }

    constructor(res: () => void, rej: () => void) {
        this.ws.addEventListener("open", () => res())
        this.ws.addEventListener("error", () => rej())
        this.ws.addEventListener("close", () => this.on_close.dispatch())
        this.ws.addEventListener("message", this.on_message)
    }
    drop() {
        this.ws.close()
    }
}

export function usePlayState(conn: Connection): { playing: boolean, get_time: () => number } {
    const [playstate, set_playstate] = useState(conn.last_received.playstate)
    conn.on_playstate_change.use_bind(useCallback(playstate => {
        set_playstate(playstate)
    }, []))

    return {
        playing: playstate.playing,
        get_time: playstate.playing
            ? () => Date.now() - playstate.time_start
            : () => playstate.time_at,
    }
}

export function useConnection() {
    return useContext(ConnectionContext) ?? (() => { throw new Error("useConnection used out of context") })()
}

export function ConnectionProvider({ children, not_connected }: { children: ReactNode, not_connected: ReactNode }) {
    const [conn, set_conn] = useState<Connection | null | false>(false)

    useEffect(() => {
        let unloaded = false
        const conn = new Connection(
            () => { if (!unloaded) set_conn(conn) },
            () => { if (!unloaded) set_conn(false) },
        )
        return () => {
            unloaded = true
            set_conn(false)
            conn.drop()
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