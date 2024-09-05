import { SERVER_HOST, SERVER_HOST_SECURE } from "@/app/env";
import { ConnectionProvider, useConnection } from "@/sys/connection";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./r.module.css";
import { Button, LabelText, NumberInput, STYLE_JOIN_TO_RIGHT, TextInput } from "./basic";

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
                    <h1 className={styles.title}>:: clamedia :: <span>media server</span></h1>
                    <Button
                        classes={[styles.enter_watch_mode]}
                        on_click={() => set_watch_mode(true)}
                    >enter watch mode</Button>
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
        <div className={styles.control}>
            <div>
                playing:
                <ControlVideoPlayerControls />
            </div>
            <div>
                request:
                <ControlVideoRequests />
            </div>
            <div>
                queue:
                <ControlVideoQueue />
            </div>
            <div>
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
            vid.currentTime = (Date.now() - conn.last_received.play_time) / 1000
            vid.play()
        } else {
            vid.currentTime = (conn.last_received.play_time) / 1000
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

        vid.currentTime = time / 1000
    }, []))

    return (
        current && <video
            className={styles.watch}
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

    const [cached, set_cached] = useState(new Map(conn.last_received.cached))
    conn.on_cache_update.use_bind(() => set_cached(new Map(conn.last_received.cached)))

    return (
        <div>
            {current != null
                ? (<div>{`"${cached.get(current)!.title}" [${cached.get(current)!.uploader}]`}</div>)
                : <div>no song playing</div>
            }
            <div>
                <Button
                    on_click={() => {
                        conn.send_req_pauseplay(!is_playing)
                    }}
                    classes={[STYLE_JOIN_TO_RIGHT]}
                >{is_playing ? "pause" : "play"}</Button>
                <Button
                    on_click={() => {
                        conn.send_req_skip()
                    }}
                >skip</Button>
                <NumberInput
                    label={<LabelText>volume</LabelText>}
                    // is_slider
                    min={0.0}
                    max={1.0}
                    step={0.01}
                    value={volume}
                    set_value={volume => conn.send_req_volume(Math.max(0, Math.min(1, volume)))}
                />
            </div>
        </div>
    )
}


function ControlVideoQueue() {
    const conn = useConnection()
    const [queue, set_queue] = useState(conn.last_received.queue)
    conn.on_queue_change.use_bind(set_queue)
    const [cached, set_cached] = useState(new Map(conn.last_received.cached))
    conn.on_cache_update.use_bind(() => set_cached(new Map(conn.last_received.cached)))

    return (
        <div>{
            queue.map((id, i) => {
                const { title, uploader } = cached.get(id)!
                return (
                    <div key={i}>
                        {`${i.toString().padStart(3, "0")} : "${title}" [${uploader}]`}
                    </div>
                )
            })
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
        <div className={styles.cached_videos_list}>{
            cached.map(([id, info]) => (
                <Button key={id}
                    on_click={() => {
                        conn.send_req_enqueue(id)
                    }}
                    disabled={!info.loaded}
                >
                    {`"${info.title}" [${info.uploader}]`}{info.loaded ? <></> : " [< ...loading... >]"}
                </Button>
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
            <TextInput
                value={id}
                set_value={set_id}
                on_enter={submit}
                classes={[STYLE_JOIN_TO_RIGHT]}
            />
            <Button
                disabled={id === ""}
                on_click={submit}
            >
                request
            </Button>
        </div>
    )
}