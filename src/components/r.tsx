import { ConnectionProvider, useConnection } from "@/sys/connection";
import { useCallback, useState } from "react";

export function R() {
    return (
        <ConnectionProvider not_connected={<>not connected</>}>
            <RConnected />
        </ConnectionProvider>
    )
}

function RConnected() {
    const conn = useConnection()
    const [current_video_id, set_current_video_id] = useState<null | string>(null)
    conn.on_video_change.use_bind(useCallback(video_id => {
        set_current_video_id(video_id)
    }, []))
    return (
        <div>
            {current_video_id ? current_video_id : "no video playing"}
        </div>
    )
}