export type Input = { t: number; ax: number; ay: number; az: number }
export type Snapshot = { t: number; entities: Array<{ id: number; x:number; y:number; z:number }> }


export class NetClient {
private ws?: WebSocket
private pending: Input[] = []
private lastAck = 0


connect(url = 'ws://localhost:8080/ws'): Promise<void> {
return new Promise((res, rej) => {
this.ws = new WebSocket(url)
this.ws.onopen = () => res()
this.ws.onerror = (e) => rej(e)
this.ws.onmessage = (ev) => {
const snap: Snapshot = JSON.parse(ev.data)
this.lastAck = snap.t
// TODO: reconcile локальное состояние
}
})
}


sendInput(inp: Input) {
this.pending.push(inp)
this.ws?.send(JSON.stringify({ type: 'input', data: inp }))
}
}