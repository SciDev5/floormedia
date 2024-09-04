import { SERVER_HOST, SERVER_HOST_SECURE } from "@/app/env";
import { ConnectionProvider, useConnection } from "@/sys/connection";
import { useCallback, useEffect, useRef, useState } from "react";

export function R() {
    return (
        <ConnectionProvider not_connected={<>not connected</>}>
            <RConnected />
        </ConnectionProvider>
    )
}

function RConnected() {
    const [watch_mode, set_watch_mode] = useState(false)
    return (
        watch_mode
            ? <WatchVideo />
            : (
                <div>
                    <button onClick={() => set_watch_mode(true)}>enter watch mode</button>
                    <ControlVideo />
                </div>
            )
    )
}
function ControlVideo() {
    const conn = useConnection()
    useEffect(() => {
        setTimeout(() => conn.send_req_sync())
    }, [conn])
    return (
        <div style={{ display: "flex", flexDirection: "row" }}>
            <div style={{ flex: "1 1" }}>
                playing:
                <ControlVideoPlayerControls />
            </div>
            <div style={{ flex: "1 1" }}>
                request:
                <ControlVideoRequests />
            </div>
            <div style={{ flex: "1 1" }}>
                queue:
                <ControlVideoQueue />
            </div>
            <div style={{ flex: "1 1" }}>
                cached:
                <ControlVideoCached />
            </div>
        </div>
    )
}
function WatchVideo() {
    const ref = useRef<HTMLVideoElement>(null)
    const conn = useConnection()

    const [current, set_current] = useState(conn.last_received.current)
    const [current_discriminator, set_current_discriminator] = useState(conn.last_received.current_discriminator)
    conn.on_video_change.use_bind(useCallback((current, current_discriminator) => {
        set_current(current)
        set_current_discriminator(current_discriminator)
    }, [set_current, set_current_discriminator]))

    useEffect(() => {
        const vid = ref.current
        if (vid == null) { return }
        if (conn.last_received.is_playing) {
            vid.fastSeek((Date.now() - conn.last_received.play_time) / 1000)
            vid.play()
        } else {
            vid.fastSeek((conn.last_received.play_time) / 1000)
        }
        vid.volume = conn.last_received.volume
    }, [current, conn])
    conn.on_pauseplay.use_bind(useCallback(is_playing => {
        const vid = ref.current
        if (vid == null) { return }

        if (is_playing) {
            vid.play()
        } else {
            vid.pause()
        }
    }, []))
    conn.on_volume.use_bind(useCallback(volume => {
        const vid = ref.current
        if (vid == null) { return }

        vid.volume = volume
    }, []))
    conn.on_seek.use_bind(useCallback(time => {
        const vid = ref.current
        if (vid == null) { return }

        vid.fastSeek(time / 1000)
    }, []))

    return (
        current && <video
            style={{ width: "100vw" }}
            src={`http${SERVER_HOST_SECURE ? "s" : ""}://${SERVER_HOST}/song/${current}`}
            autoPlay={conn.last_received.is_playing}
            onEnded={() => {
                conn.send_req_next(current_discriminator)
            }}
            ref={ref}
        />
    )
}


function ControlVideoPlayerControls() {
    const conn = useConnection()
    const [current, set_current] = useState(conn.last_received.current)
    conn.on_video_change.use_bind(useCallback((current, current_discriminator) => {
        set_current(current)
    }, [set_current]))

    const [is_playing, set_is_playing] = useState(conn.last_received.is_playing)
    conn.on_pauseplay.use_bind(set_is_playing)

    const [volume, set_volume] = useState(conn.last_received.volume)
    conn.on_volume.use_bind(set_volume)

    return (
        <div>
            <div>{current}</div>
            <div>
                <button
                    onClick={() => {
                        conn.send_req_pauseplay(!is_playing)
                    }}
                >{is_playing ? "pause" : "play"}</button>
                <button
                    onClick={() => {
                        conn.send_req_skip()
                    }}
                >skip</button>
                <input
                    type="range"
                    min={0.0}
                    max={1.0}
                    step={0.01}
                    value={volume}
                    onChange={e => {
                        conn.send_req_volume(e.currentTarget.valueAsNumber)
                    }}
                />
            </div>
        </div>
    )
}


function ControlVideoQueue() {
    const conn = useConnection()
    const [queue, set_queue] = useState(conn.last_received.queue)
    conn.on_queue_change.use_bind(set_queue)

    return (
        <div>{
            queue.map((id, i) => (
                <div key={i}>
                    {`[${i}] id=${id}`}
                </div>
            ))
        }</div>
    )
}

function ControlVideoCached() {
    const conn = useConnection()
    const [cached, set_cached] = useState([...conn.last_received.cached.entries()])

    conn.on_cache_update.use_bind(useCallback(() => {
        set_cached([...conn.last_received.cached.entries()])
    }, [conn, set_cached]))

    return (
        <div>{
            cached.map(([id, info]) => (
                <div key={id}>
                    <button
                        onClick={() => {
                            conn.send_req_enqueue(id)
                        }}
                        disabled={!info.loaded}
                    >
                        enqueue
                    </button>
                    {`"${info.name}"`}{info.loaded ? <></> : " [< ...loading... >]"}
                </div>
            ))
        }</div>
    )
}

function ControlVideoRequests() {
    const conn = useConnection()
    const [id, set_id] = useState("")

    const submit = useCallback(() => {
        if (id !== "") {
            conn.send_req_enqueue(id)
        }
        set_id("")
    }, [conn, id])

    return (
        <div>
            <input
                value={id}
                onChange={e => set_id(e.currentTarget.value)}
                onKeyDown={e => {
                    if (e.key === "Enter") {
                        submit()
                    }
                }}
            />
            <button
                disabled={id === ""}
                onClick={submit}
            >
                request
            </button>
        </div>
    )
}