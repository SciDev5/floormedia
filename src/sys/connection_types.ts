export interface SongInfo {
    title: string,
    uploader: string,
    loaded: boolean,
    failed: boolean,
    deleted: boolean,
    length: number,
}
export type PlayState = {
    playing: true,
    time_start: number,
} | {
    playing: false,
    time_at: number,
}

export const CMSG_KEY = {
    VIDEO_CHANGE: "c",
    PLAY_STATE: "p",
    VOLUME: "v",
    QUEUE_CHANGED: "q",
    SONG_INFO: "i",
} as const
export const SMSG_KEY = {
    ENQUEUE: "e",
    QUEUE_CHANGE: "q",
    PLAY_STATE: "p",
    SKIP: "k",
    NEXT: "n",
    VOLUME: "v",
    REQ_SYNC: "y",
} as const

export type CMsgVideoChange = [typeof CMSG_KEY.VIDEO_CHANGE, string | null, number]
export type CMsgPlayState = [typeof CMSG_KEY.PLAY_STATE, PlayState]
export type CMsgVolume = [typeof CMSG_KEY.VOLUME, number]
export type CMsgQueueChange = [typeof CMSG_KEY.QUEUE_CHANGED, string[]]
export type CMsgSongInfo = [typeof CMSG_KEY.SONG_INFO, string, SongInfo]
export type CMsg = CMsgVideoChange | CMsgPlayState | CMsgVolume | CMsgQueueChange | CMsgSongInfo


export type SMsgEnqueue = [typeof SMSG_KEY.ENQUEUE, string]
export type SMsgSkip = [typeof SMSG_KEY.SKIP]
export type SMsgNext = [typeof SMSG_KEY.NEXT, number]
export type SMsgPlayState = [typeof SMSG_KEY.PLAY_STATE, PlayState]
export type SMsgVolume = [typeof SMSG_KEY.VOLUME, number]
export type SMsgQueueChange = [typeof SMSG_KEY.QUEUE_CHANGE, string[]]
export type SMsgReqSync = [typeof SMSG_KEY.REQ_SYNC]
export type SMsg = SMsgEnqueue | SMsgSkip | SMsgNext | SMsgPlayState | SMsgVolume | SMsgQueueChange | SMsgReqSync
