import * as WebSocket from "ws"
import { createServer } from "net"

const config = {
    "host": null,
    "port": null,
    "local-port": "9696",
    "ws": "wss://localhost:8080"
}

let opt = null
for (let arg of process.argv.slice(2)) {
    if (opt) config[opt] = arg, opt = null
    else if (arg.startsWith("--") && arg.length > 2) opt = arg.slice(2)
    else console.error("Invalid argument:", arg), process.exit(1)
    if (opt && !Object.keys(config).includes(opt))
        console.error(`Unknown option '--${opt}'`), process.exit(1)
}
if (opt) console.error(`Missing argument value '--${opt} <value>'`), process.exit(1)
if (!opt.host) console.error("--host is not specified!")
if (!opt.port) console.error("--port is not specified!")

const ADDRESS = config.ws
const HOST = config.host
const PORT = parseInt(config.port)
const LOCAL_PORT = parseInt(config["local-port"])

createServer(socket => {
    const ws = new WebSocket(ADDRESS, { rejectUnauthorized: false })
    const msgs = []

    ws.onopen = () => {
        ws.send(JSON.stringify({ host: HOST, port: PORT }))
        for (let data of msgs) ws.send(data)
    }

    socket.on("data", data => ws.readyState == 1 ? ws.send(data) : msgs.push(data))
    socket.on("end", () => ws.close())

    ws.onmessage = ({ data }) => socket.write(data)
    ws.onclose = () => socket.end()
}).listen(LOCAL_PORT)
