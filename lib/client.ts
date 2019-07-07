import * as WebSocket from "ws"
import { createServer, Socket } from "net"
import { encodePacket, log, getOriginalDestination } from "./utils"

export default async (wsUrl: string, port = 9696, defaultAddr?: string) => {
    let defaultHost: string | undefined
    let defaultPort: number | undefined
    if (defaultAddr && defaultAddr.split(":").length == 2) {
        defaultHost = defaultAddr.split(":")[0]
        defaultPort = parseInt(defaultAddr.split(":")[1])
    }

    if (defaultHost) {
        log("info", `Default address: ${defaultHost}:${defaultPort}`)
    }

    const ws = new WebSocket(wsUrl)
    ws.onerror = err => log("proxy error", err.message)

    await new Promise(res => ws.onopen = res)
    ws.send(encodePacket(3, 0))

    const sockets: Map<number, Socket> = new Map

    ws.onmessage = ({ data }) => {
        if (!(data instanceof Buffer)) return

        const type = data.readUInt8(0)
        const id = data.readUInt8(1)

        if (type == 1) {
            // Close connection
            const socket = sockets.get(id)
            if (socket) socket.end()
            sockets.delete(id)
        } else if (type == 2) {
            // Write data to socket
            const socket = sockets.get(id)
            if (socket) socket.write(data.slice(2))
        } else if (type == 3) {
            setTimeout(() => {
                ws.send(encodePacket(3, (Math.random() * 256) | 0))
            }, 2000)
        }
    }

    ws.onclose = () => {
        log("proxy", "Connection closed")
        process.exit()
    }

    let nextId = 0

    createServer(socket => {
        let host: string, port: number
        try {
            [host, port] = getOriginalDestination(socket)
        } catch {
            if (!defaultHost || !defaultPort) return socket.destroy()
            host = defaultHost, port = defaultPort
        }

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
            log("disconnect", `${host}:${port}`)
            if (!sockets.has(id)) return
            ws.send(encodePacket(1, id))
            sockets.delete(id)
        })

        socket.on("error", err => log("error", err.message))
    }).listen(port, () => {
        log("proxy", "Listening on port " + port)
    })
}
