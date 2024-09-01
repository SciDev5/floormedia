import { SERVER_HOST, SERVER_HOST_SECURE } from "@/app/env";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { EventBinder } from "./useevent";
import { is_arr, is_bool, is_dict, is_in_union, is_literal, is_number, is_str, is_tuple, try_parse_json } from "./json";
import { SongInfo, CMSG_KEY, CMsgPausePlay, CMsgQueueChange, CMsgSeek, CMsgSongInfo, CMsg, CMsgVideoChange, CMsgVolume, SMsg, SMSG_KEY } from "./connection_types";

const ConnectionContext = createContext<Connection | null>(null)

const is_SongInfo = is_dict({
    name: is_str,
    loaded: is_bool,
}) as (v: unknown) => v is SongInfo

const is_msg_video_change = is_tuple<CMsgVideoChange>([is_literal(CMSG_KEY.VIDEO_CHANGE), is_in_union([is_str, is_literal<null>(null)])])
const is_msg_pauseplay = is_tuple<CMsgPausePlay>([is_literal(CMSG_KEY.PAUSEPLAY), is_bool])
const is_msg_seek = is_tuple<CMsgSeek>([is_literal(CMSG_KEY.SEEK), is_number])
const is_msg_volume = is_tuple<CMsgVolume>([is_literal(CMSG_KEY.VOLUME), is_number])
const is_msg_queue_change = is_tuple<CMsgQueueChange>([is_literal(CMSG_KEY.QUEUE_CHANGED), is_arr(is_str)])
const is_msg_songinfo = is_tuple<CMsgSongInfo>([is_literal(CMSG_KEY.SONG_INFO), is_str, is_SongInfo])
const is_msg = is_in_union<CMsg>(
    [is_msg_video_change, is_msg_pauseplay, is_msg_seek, is_msg_volume, is_msg_queue_change, is_msg_songinfo]
)

class Connection {
    private readonly ws = new WebSocket(`ws${SERVER_HOST_SECURE ? "s" : ""}://${SERVER_HOST}/`)

    readonly on_close = new EventBinder<[]>()
    readonly on_video_change = new EventBinder<[string | null]>()
    readonly on_pauseplay = new EventBinder<[boolean]>()
    readonly on_seek = new EventBinder<[number]>()
    readonly on_volume = new EventBinder<[number]>()
    readonly on_queue_change = new EventBinder<[string[]]>()
    readonly on_songinfo = new EventBinder<[string, SongInfo]>()

    private readonly on_message = (e: MessageEvent) => {
        const data = try_parse_json(e.data, is_msg)
        if (data == null) {
            console.warn("received invalid message", e.data)
            return
        }
        switch (data[0]) {
            case CMSG_KEY.VIDEO_CHANGE: this.on_video_change.dispatch(data[1])
                break
            case CMSG_KEY.PAUSEPLAY: this.on_pauseplay.dispatch(data[1])
                break
            case CMSG_KEY.SEEK: this.on_seek.dispatch(data[1])
                break
            case CMSG_KEY.VOLUME: this.on_volume.dispatch(data[1])
                break
            case CMSG_KEY.QUEUE_CHANGED: this.on_queue_change.dispatch(data[1])
                break
            case CMSG_KEY.SONG_INFO: this.on_songinfo.dispatch(data[1], data[2])
                break
        }
    }

    private send(msg: SMsg) {
        this.ws.send(JSON.stringify(msg))
    }

    send_req_enqueue(id: string) { this.send([SMSG_KEY.ENQUEUE, id]) }
    send_req_skip() { this.send([SMSG_KEY.SKIP]) }
    send_req_pauseplay(playing: boolean) { this.send([SMSG_KEY.PAUSEPLAY, playing]) }
    send_req_seek(time: number) { this.send([SMSG_KEY.SEEK, time]) }
    send_req_volume(volume: number) { this.send([SMSG_KEY.VOLUME, volume]) }
    send_req_queue_change(new_queue: string[]) { this.send([SMSG_KEY.QUEUE_CHANGE, new_queue]) }

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