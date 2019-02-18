import { Socket } from "net"

const binding = <any>require("../build/Release/binding")

export const getOriginalDestination = (socket: Socket): [string, number] => {
    return binding.getOriginalDest((<any>socket)["_handle"].fd)
}

/*
Packet format:
- Type  Byte   Type of packet
- Id    Byte   ID of socket connection
- Data  Buffer (optional)

Packet types:
0: Create connection (has port and address as data)
1: Close connection
2: Send data
*/

export function encodePacket(type: number, id: number, data?: Buffer) {
    let buffer = Buffer.alloc(2)
    buffer.writeUInt8(type, 0)
    buffer.writeUInt8(id, 1)
    if (data) buffer = Buffer.concat([buffer, data])
    return buffer
}

export function log(title: string, text: string) {
    const isoDate = new Date().toISOString()
    const time = isoDate.match(/T([0-9:]+)\./)![1]
    console.log(time, title.padEnd(16), text)
}
