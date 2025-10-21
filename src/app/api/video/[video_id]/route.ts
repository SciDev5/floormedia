import { SONGINFO_STASH, TEMP_DATA_FOLDER } from "@/server/song_loader";
import { openAsBlob } from "fs";
import path from "path";

export async function GET(
    req: Request, { params }: { params: Promise<{ video_id: string }> },
): Promise<Response> {
    const video_id_ = (await params).video_id
    const [, id] = video_id_.match(/^(.*?)\.(?:webm|mp4)$/) ?? [null, video_id_]

    if (/[^a-z0-9_-]/i.test(id)) {
        return new Response("stop that", { status: 404 })
    }

    const data = SONGINFO_STASH.data.get(id)
    if (data == null) {
        return new Response("song missing, try requesting it. also why are you using this endpoint directly lol get real", { status: 404 })
    }
    if (data.deleted) {
        return new Response("deleted", { status: 404 })
    }
    if (data.failed) {
        return new Response("failed", { status: 404 })
    }
    if (!data.loaded) {
        return new Response("not yet loaded", { status: 404 })
    }

    const video_loc = path.join(process.cwd(), TEMP_DATA_FOLDER + "/" + id + "." + (data.format ?? "webm"))
    const blob = await openAsBlob(video_loc, { type: "video/webm" })
    return serve_partial_content(blob, req.headers.get("range"))
}

function serve_partial_content(blob: Blob, range_header_str: string | null): Response {
    const range_header = /^bytes=(\d+)?\-(\d+)?$/.exec(range_header_str ?? "")
    if (range_header != null) {
        let start = 0, end = blob.size - 1
        const range = [range_header[1], range_header[2]]
            .map(v => v != null ? parseInt(v) : null)
        if (range[0] != null) {
            start = range[0]
            if (range[1] != null) {
                end = range[1] + 1
            }
        } else if (range[1] != null) {
            start = blob.size - range[1]
        }
        return new Response(blob.slice(start, end), {
            status: 206, // Partial Content
            headers: {
                "Accept-Ranges": "bytes",
                "Content-Range": `bytes ${start}-${end - 1}/${blob.size}`,
                "Content-Length": (end - start).toString(),
                "Content-Type": blob.type,
            },
        })
    } else {
        return new Response(blob, {
            status: 200, // Ok
            headers: {
                "Accept-Ranges": "bytes",
                "Content-Type": blob.type,
            },
        })
    }
}