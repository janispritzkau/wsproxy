import { Socket, connect } from "net"
import { createServer } from "https"
import * as WebSocket from "ws"
import { encodePacket, log } from "./utils"

export default (port: number, ssl?: { cert: string, key: string }) => {
    const server = ssl && createServer({ cert: ssl.cert, key: ssl.key })

    const wss = ssl ? new WebSocket.Server({ server }) : new WebSocket.Server({ port })

    let nextConnectionId = 0

    wss.on("connection", async (ws, { connection: conn }) => {
        let sockets: Map<number, Socket> = new Map

        let proxyHost = `${conn.remoteAddress}:${conn.remotePort}`
        let connectionId = nextConnectionId++

        log("proxy connect", `${connectionId} ${proxyHost}`)

        ws.onclose = () => {
            sockets.forEach(socket => socket.end())
            sockets.clear()
            log("proxy disconnect", `${connectionId} ${proxyHost}`)
        }

        ws.onmessage = ({ data }) => {
            if (!(data instanceof Buffer)) return

            const type = data.readUInt8(0)
            const id = data.readUInt8(1)

            if (type == 0) {
                const port = data.readUInt16LE(2)
                const host = data.toString("ascii", 4)

                log("connecting", `${connectionId} ${host}:${port}`)

                const socket = connect({ host, port })
                sockets.set(id, socket)

                socket.on("close", () => {
                    if (!sockets.has(id)) return
                    ws.send(encodePacket(1, id))
                    sockets.delete(id)
                    log("disconnect", `${connectionId} ${host}:${port}`)
                })

                socket.on("data", data => ws.send(encodePacket(2, id, data)))
                socket.on("error", err => log("error", `${connectionId} ${err.message}`))
            } else if (type == 1) {
                const socket = sockets.get(id)
                if (socket) socket.end()
                sockets.delete(id)
            } else if (type == 2) {
                const socket = sockets.get(id)
                if (socket) socket.write(data.slice(2))
                else ws.send(encodePacket(1, id))
            }
        }
    })
    if (server) server.listen(port)
}
