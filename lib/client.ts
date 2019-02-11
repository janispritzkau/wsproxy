import * as WebSocket from "ws"
import * as dgram from "dgram"
import { createServer, Socket } from "net"
import * as ffi from "ffi"
import * as ref from "ref"
import * as Struct from "ref-struct"

const lib = ffi.Library(null, {
    'getsockopt': [ 'int', [ 'int', 'int', 'int', 'pointer', 'pointer']],
    'ntohs': ['uint16', ['uint16']],
})

const sockaddr_in = Struct([
    ['int16', 'sin_family'],
    ['uint16', 'sin_port'],
    ['uint32', 'sin_addr'],
    ['uint32', 'trash1'],
    ['uint32', 'trash2'],
])

function getOriginalDest(socket: Socket) {
    let dst = new sockaddr_in
    let dstLen = ref.alloc(ref.types.int, sockaddr_in.size)
    let r = lib.getsockopt(socket["_handle"].fd, 0, 80, dst.ref(), dstLen)
    if (r == -1) throw new Error
    if (dst.sin_family != 2) throw new Error
    let ip = dst.ref();
    let ipaddr = [ip[4], ip[5], ip[6], ip[7]].join(".")
    return [ipaddr, lib.ntohs(dst.sin_port)]
}

export default (wsUrl: string, port = 9696) => {
    createServer(socket => {
        const [host, port] = getOriginalDest(socket)


        const ws = new WebSocket(wsUrl, { rejectUnauthorized: false })
        const msgs = []

        ws.onopen = () => {
            ws.send(JSON.stringify({ host, port }))
            console.log(`[Connected] ${host}:${port}`)
            for (let data of msgs) ws.send(data)
        }
        ws.onerror = err => console.error("Proxy connection error")

        socket.on("error", err => console.error(err.message))
        socket.on("data", data => ws.readyState == 1 ? ws.send(data) : msgs.push(data))
        socket.on("end", () => {
            ws.close()
            console.log(`[Disconnected] ${host}:${port}`)
        })

        ws.onmessage = ({ data }) => socket.writable && socket.write(data)
        ws.onclose = () => socket.end()
    }).listen(port)

    const dnsServer = dgram.createSocket("udp4", (msg, rinfo) => {
        const ws = new WebSocket(wsUrl, { rejectUnauthorized: false })
        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "dns" }))
            let parts = [], offset = 12, len = 0
            while (true) {
                len = msg.readUInt8(offset), offset++
                if (len == 0) break
                parts.push(msg.slice(offset, offset + len).toString()), offset += len
            }
            console.log("[DNS]", parts.join("."))
            ws.send(msg)
            ws.onmessage = ({ data }) => {
                dnsServer.send(data as Buffer, rinfo.port, rinfo.address)
            }
        }
    })
    dnsServer.bind(53)
}
