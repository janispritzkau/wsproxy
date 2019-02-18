import * as WebSocket from "ws"
import { createServer, Socket } from "net"
import { encodePacket, log, getOriginalDestination } from "./utils"

export default async (wsUrl: string, port = 9696) => {
    const ws = new WebSocket(wsUrl)
    ws.on("error", err => log("proxy error", err.message))

    await new Promise(res => ws.onopen = res)

    const sockets: Map<number, Socket> = new Map

    ws.onmessage = ({ data }) => {
        if (!(data instanceof Buffer)) return

        const type = data.readUInt8(0)
        const id = data.readUInt8(1)

        if (type == 1) {
            const socket = sockets.get(id)
            if (socket) socket.end()
            sockets.delete(id)
        } else if (type == 2) {
            const socket = sockets.get(id)
            if (socket) socket.write(data.slice(2))
        }
    }

    ws.onclose = () => process.exit()

    let nextId = 0

    createServer(socket => {
        const [host, port] = getOriginalDestination(socket)

        log("connect", `${host}:${port}`)

        let id: number
        while (true) {
            id = nextId, nextId = (nextId + 1) % 256
            if (sockets.has(id)) continue
            sockets.set(id, socket)
            break
        }

        let buffer = Buffer.alloc(2 + host.length)
        buffer.writeUInt16LE(port, 0)
        buffer.write(host, 2)

        ws.send(encodePacket(0, id, buffer))

        socket.on("data", data => ws.send(encodePacket(2, id, data)))

        socket.on("close", () => {
            if (!sockets.has(id)) return
            ws.send(encodePacket(1, id))
            sockets.delete(id)
            log("disconnect", `${host}:${port}`)
        })

        socket.on("error", err => log("error", err.message))
    }).listen(port)
}
