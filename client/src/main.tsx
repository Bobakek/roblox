import React from 'react'
import { createRoot } from 'react-dom/client'
import { createScene } from './scene/engine'
import { createWorld } from 'bitecs'
import { NetClient } from './net/ws'
import { babylonSyncSystem } from './ecs/systems/babylonSync'
import { netApplySystem } from './ecs/systems/netApply'
import { interpolateSystem } from './ecs/systems/interpolate'

const world = createWorld()
const net = new NetClient()

function App() {
const ref = React.useRef<HTMLCanvasElement>(null)
React.useEffect(() => {
if (ref.current) {
const { engine, scene } = createScene(ref.current)
const babylonSync = babylonSyncSystem(world)
const interpolate = interpolateSystem(world, net)
engine.runRenderLoop(() => {
interpolate()
babylonSync()
scene.render()
})
net.connect().then(() => {
const ws = (net as any).ws as WebSocket
const prev = ws.onmessage
ws.onmessage = (ev) => {
prev(ev)
const snap = JSON.parse(ev.data)
netApplySystem(world, { entities: snap.entities.map((e: any) => ({ id: e.id.toString(), x: e.x, y: e.y, z: e.z })) })
}
})

const keys = { w: false, a: false, s: false, d: false }
const send = () => {
const ax = (keys.d ? 1 : 0) - (keys.a ? 1 : 0)
const az = (keys.w ? 1 : 0) - (keys.s ? 1 : 0)
net.sendInput({ t: Date.now(), ax, ay: 0, az })
}
const down = (e: KeyboardEvent) => {
const k = e.key.toLowerCase()
if (k in keys && !keys[k as keyof typeof keys]) {
keys[k as keyof typeof keys] = true
send()
}
}
const up = (e: KeyboardEvent) => {
const k = e.key.toLowerCase()
if (k in keys && keys[k as keyof typeof keys]) {
keys[k as keyof typeof keys] = false
send()
}
}
window.addEventListener('keydown', down)
window.addEventListener('keyup', up)
return () => {
window.removeEventListener('keydown', down)
window.removeEventListener('keyup', up)
}
}
}, [])
return <canvas ref={ref} style={{ width: '100vw', height: '100vh', display: 'block' }} />
}

createRoot(document.getElementById('root')!).render(<App />)

