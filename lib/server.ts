import { Socket, connect } from "net"
import { createServer } from "https"
import * as WebSocket from "ws"
import { encodePacket, log } from "./utils"

export default (port: number, host?: string, ssl?: { cert: string, key: string }) => {
    const server = ssl && createServer({ cert: ssl.cert, key: ssl.key })

    const wss = ssl ? new WebSocket.Server({ server }) : new WebSocket.Server({ host, port })

    let nextConnectionId = 0

    wss.on("connection", async (ws, req) => {
        let sockets: Map<number, Socket> = new Map

        let proxyAddr = req.connection.remoteAddress!
        if (["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(proxyAddr)) {
            proxyAddr = req.headers['x-forwarded-for'] as string || proxyAddr
        }

        let connectionId = nextConnectionId++

        log("proxy connect", `${connectionId} ${proxyAddr}`)

        ws.onerror = err => {
            log("proxy error", `${connectionId} ${err.message}`)
        }

        ws.onclose = () => {
            sockets.forEach(socket => socket.end())
            sockets.clear()
            log("proxy disconnect", `${connectionId} ${proxyAddr}`)
        }

        ws.onmessage = ({ data }) => {
            if (!(data instanceof Buffer)) return

            const type = data.readUInt8(0)
            const id = data.readUInt8(1)

            if (type == 0) {
                // Build connection
                const port = data.readUInt16LE(2)
                const host = data.toString("ascii", 4)

                log("connect", `${connectionId} ${host}:${port}`)

                const socket = connect({ host, port })
                sockets.set(id, socket)

                socket.on("close", () => {
                    log("disconnect", `${connectionId} ${host}:${port}`)
                    if (!sockets.has(id)) return
                    ws.send(encodePacket(1, id))
                    sockets.delete(id)
                })

                socket.on("data", data => {
                    if (ws.readyState != WebSocket.OPEN) return
                    ws.send(encodePacket(2, id, data))
                })
                socket.on("error", err => log("error", `${connectionId} ${err.message}`))
            } else if (type == 1) {
                // Close connection
                const socket = sockets.get(id)
                if (socket) socket.end()
                sockets.delete(id)
            } else if (type == 2) {
                // Write data to socket
                const socket = sockets.get(id)
                if (socket) socket.write(data.slice(2))
                else ws.send(encodePacket(1, id))
            } else if (type == 3) {
                ws.send(encodePacket(3, id))
            }
        }
    })
    if (server) server.listen(port, host)
    log("proxy", `Server listening on ${host || "0.0.0.0"}:${port}`)
}
