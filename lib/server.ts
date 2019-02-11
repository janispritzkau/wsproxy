import { Socket, connect } from "net"
import { createServer } from "https"
import * as WebSocket from "ws"
import * as dgram from "dgram"

export default (port: number, ssl?: { cert: string, key: string }) => {
    const server = ssl && createServer({ cert: ssl.cert, key: ssl.key })

    const wss = ssl ? new WebSocket.Server({ server }) : new WebSocket.Server({ port })

    wss.on("connection", async (ws, { connection }) => {
        const remoteAddress = [connection.remoteAddress.replace("::ffff:127.0.0.1", "localhost"), connection.remotePort].join(":")
        console.log("[Connected]", remoteAddress)

        let isDns = false
        let socket: Socket
        ws.onmessage = ({ data }) => {
            if (!socket && !isDns) {
                const { type, host, port } = JSON.parse(data.toString())
                if (type == "dns") return isDns = true

                console.log(`[Redirect] ${remoteAddress} -> ${host}:${port}`)

                socket = connect({ host, port }, () => {
                    socket.on("data", data => ws.readyState == 1 && ws.send(data))
                    socket.on("end", () => ws.close())
                    ws.onclose = () => {
                        socket.end()
                        console.log("[Disconnected]", remoteAddress)
                    }
                })
                return socket.on("error", err => console.error(err))
            }
            if (isDns) {
                let msg = Buffer.from(data as any)
                let parts = [], offset = 12, len = 0
                while (true) {
                    len = msg.readUInt8(offset), offset++
                    if (len == 0) break
                    parts.push(msg.slice(offset, offset + len).toString()), offset += len
                }
                console.log("[DNS]", parts.join("."))
                dgram.createSocket("udp4", msg => {
                    ws.send(msg)
                    ws.close()
                }).send(msg, 53, "8.8.8.8")
            } else {
                socket.write(data)
            }
        }
    })
    if (server) server.listen(port)
}
