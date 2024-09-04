export interface SongInfo {
    name: string,
    loaded: boolean,
}

export const CMSG_KEY = {
    VIDEO_CHANGE: "c",
    PAUSEPLAY: "p",
    SEEK: "s",
    VOLUME: "v",
    QUEUE_CHANGED: "q",
    SONG_INFO: "i",
} as const
export const SMSG_KEY = {
    ENQUEUE: "e",
    QUEUE_CHANGE: "q",
    PAUSEPLAY: "p",
    SEEK: "s",
    SKIP: "k",
    NEXT: "n",
    VOLUME: "v",
    REQ_SYNC: "y",
} as const

export type CMsgVideoChange = [typeof CMSG_KEY.VIDEO_CHANGE, string | null, number]
export type CMsgPausePlay = [typeof CMSG_KEY.PAUSEPLAY, boolean]
export type CMsgSeek = [typeof CMSG_KEY.SEEK, number]
export type CMsgVolume = [typeof CMSG_KEY.VOLUME, number]
export type CMsgQueueChange = [typeof CMSG_KEY.QUEUE_CHANGED, string[]]
export type CMsgSongInfo = [typeof CMSG_KEY.SONG_INFO, string, SongInfo]
export type CMsg = CMsgVideoChange | CMsgPausePlay | CMsgSeek | CMsgVolume | CMsgQueueChange | CMsgSongInfo


export type SMsgEnqueue = [typeof SMSG_KEY.ENQUEUE, string]
export type SMsgSkip = [typeof SMSG_KEY.SKIP]
export type SMsgNext = [typeof SMSG_KEY.NEXT, number]
export type SMsgPausePlay = [typeof SMSG_KEY.PAUSEPLAY, boolean]
export type SMsgSeek = [typeof SMSG_KEY.SEEK, number]
export type SMsgVolume = [typeof SMSG_KEY.VOLUME, number]
export type SMsgQueueChange = [typeof SMSG_KEY.QUEUE_CHANGE, string[]]
export type SMsgReqSync = [typeof SMSG_KEY.REQ_SYNC]
export type SMsg = SMsgEnqueue | SMsgSkip | SMsgNext | SMsgPausePlay | SMsgSeek | SMsgVolume | SMsgQueueChange | SMsgReqSync
