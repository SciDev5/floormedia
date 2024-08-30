import { exec, ChildProcess } from "child_process";


async function async_join(proc: ChildProcess): Promise<boolean> {
    return new Promise(res => {
        proc.once("error", () => res(false))
        proc.once("exit", (code) => res((code ?? 0) === 0))
        proc.stdout?.pipe(process.stdout)
    })
}

const TEMP_DATA_FOLDER = "./tmp"
const YTDLP = "yt-dlp"
const FFMPEG = "ffmpeg"

/// Downloads the video and returns true if it succeeded.
export async function download_video(id: string, file_name: string = id): Promise<boolean> {
    return await async_join(exec(`${YTDLP} https://youtu.be/${id} -o ${TEMP_DATA_FOLDER}/${file_name}`))
}

/// Removes the video from the downloaded content, leaving just audio. Returns true if it succeded.
export async function make_audio_only(file_name: string): Promise<boolean> {
    const TEMP_NAME_EXT = "tmpconvertaudio"
    return (
        await async_join(exec(`${FFMPEG} -i ${file_name}.webm -vn ${TEMP_DATA_FOLDER}/${file_name}.${TEMP_NAME_EXT}.webm -n`)) &&
        await async_join(exec(`mv ${TEMP_DATA_FOLDER}/${file_name}.${TEMP_NAME_EXT}.webm ${TEMP_DATA_FOLDER}/${file_name}.webm`))
    )
}
