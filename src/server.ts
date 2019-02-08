import { Socket, connect } from "net"
import { createServer } from "https"
import { readFileSync } from "fs"
import * as WebSocket from "ws"

const PORT = process.argv[2] ? parseInt(process.argv[2]) : 443

const server = createServer({
    cert: readFileSync("cert.pem"),
    key: readFileSync("key.pem")
})

const wss = new WebSocket.Server({ server })

wss.on("connection", async (ws, { connection }) => {
    const remoteAddress = [connection.remoteAddress.replace("::ffff:127.0.0.1", "localhost"), connection.remotePort].join(":")
    console.log("[Connected]", remoteAddress)

    let socket: Socket
    ws.onmessage = ({ data }) => {
        if (!socket) {
            const { host, port } = JSON.parse(data.toString())
            console.log(`[Redirect] ${remoteAddress} -> ${host}:${port}`)

            return socket = connect({ host, port }, () => {
                socket.on("data", data => ws.send(data))
                socket.on("end", () => ws.close())
                ws.onclose = () => {
                    socket.end()
                    console.log("[Disconnected]", remoteAddress)
                }
            })
        }
        socket.write(data)
    }
})

server.listen(PORT)
