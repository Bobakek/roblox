export type SandboxAPI = {
on(event: 'tick' | 'enter' | 'leave', cb: (...args:any[]) => void): void
spawn(name: string, opts: { x:number; y:number; z:number }): number // возвращает entityId
setPosition(id: number, x:number, y:number, z:number): void
getTime(): number
}


// Прокси к движку, предоставляемый воркеру
export const createSandboxAPI = (): SandboxAPI => {
const listeners: Record<string, Function[]> = { tick: [], enter: [], leave: [] }
return {
on(ev, cb) { (listeners[ev] ||= []).push(cb) },
spawn(name, opts) { postMessage({ type: 'spawn', name, opts }); return Math.floor(Math.random()*1e9) },
setPosition(id, x,y,z) { postMessage({ type: 'setPosition', id, x, y, z }) },
getTime() { return performance.now() }
}
}