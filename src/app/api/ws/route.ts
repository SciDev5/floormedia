import { Connection } from "@/server/connection";
import { Player } from "@/server/player";
import { WebSocket } from "ws";

export function GET() {
    const headers = new Headers();
    headers.set('Connection', 'Upgrade');
    headers.set('Upgrade', 'websocket');
    return new Response('Upgrade Required', { status: 426, headers });
}

const player = new Player()

export function UPGRADE(
    ws: WebSocket,
) {
    player.connections.add(new Connection(ws, player))
}