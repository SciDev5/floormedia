import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { EventBinder } from "./useevent";
import { is_arr, is_bool, is_dict, is_in_union, is_literal, is_number, is_str, is_tuple, try_parse_json } from "./json";
import { SongInfo, CMSG_KEY, CMsgPausePlay, CMsgQueueChange, CMsgSeek, CMsgSongInfo, CMsg, CMsgVideoChange, CMsgVolume, SMsg, SMSG_KEY } from "./connection_types";

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
}) as (v: unknown) => v is SongInfo

const is_msg_video_change = is_tuple<CMsgVideoChange>([is_literal(CMSG_KEY.VIDEO_CHANGE), is_in_union([is_str, is_literal<null>(null)]), is_number])
const is_msg_pauseplay = is_tuple<CMsgPausePlay>([is_literal(CMSG_KEY.PAUSEPLAY), is_bool])
const is_msg_seek = is_tuple<CMsgSeek>([is_literal(CMSG_KEY.SEEK), is_number])
const is_msg_volume = is_tuple<CMsgVolume>([is_literal(CMSG_KEY.VOLUME), is_number])
const is_msg_queue_change = is_tuple<CMsgQueueChange>([is_literal(CMSG_KEY.QUEUE_CHANGED), is_arr(is_str)])
const is_msg_songinfo = is_tuple<CMsgSongInfo>([is_literal(CMSG_KEY.SONG_INFO), is_str, is_SongInfo])
const is_msg = is_in_union<CMsg>(
    [is_msg_video_change, is_msg_pauseplay, is_msg_seek, is_msg_volume, is_msg_queue_change, is_msg_songinfo]
)

class Connection {
    private readonly ws = new WebSocket(`ws${SERVER.SECURE ? "s" : ""}://${SERVER.HOST}/`)

    readonly on_close = new EventBinder<[]>()
    readonly on_video_change = new EventBinder<[string | null, number]>()
    readonly on_pauseplay = new EventBinder<[boolean]>()
    readonly on_seek = new EventBinder<[number]>()
    readonly on_volume = new EventBinder<[number]>()
    readonly on_queue_change = new EventBinder<[string[]]>()
    readonly on_cache_update = new EventBinder<[]>()
    readonly last_received: {
        queue: string[],
        readonly cached: Map<string, SongInfo>,
        current: string | null,
        current_discriminator: number,
        volume: number,
        is_playing: boolean,
        play_time: number,
    } = {
            queue: [],
            cached: new Map(),
            current: null,
            current_discriminator: -1,
            volume: 0.0,
            is_playing: false,
            play_time: 0.0,
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
            case CMSG_KEY.PAUSEPLAY:
                if (this.last_received.is_playing != data[1]) {
                    this.last_received.is_playing = data[1]
                    const is_playing = this.last_received.is_playing
                    if (is_playing) {
                        this.last_received.play_time = Date.now() - this.last_received.play_time
                    } else {
                        this.last_received.play_time = this.last_received.play_time - Date.now()
                    }
                }
                this.on_pauseplay.dispatch(data[1])
                break
            case CMSG_KEY.SEEK:
                if (this.last_received.is_playing) {
                    this.last_received.play_time = Date.now() - data[1]
                } else {
                    this.last_received.play_time = data[1]
                }
                this.on_seek.dispatch(data[1])
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
    send_req_pauseplay(playing: boolean) { this.send([SMSG_KEY.PAUSEPLAY, playing]) }
    send_req_seek(time: number) { this.send([SMSG_KEY.SEEK, time]) }
    send_req_volume(volume: number) { this.send([SMSG_KEY.VOLUME, volume]) }
    send_req_queue_change(new_queue: string[]) { this.send([SMSG_KEY.QUEUE_CHANGE, new_queue]) }
    send_req_sync() { this.send([SMSG_KEY.REQ_SYNC]) }

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