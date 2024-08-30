import { download_video } from "@/systems/song_loader";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    return NextResponse.json(await download_video("Tdc8rIiFiUk"), { status: 200 })
}