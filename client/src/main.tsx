import React from 'react'
import { createRoot } from 'react-dom/client'
import { createScene } from './scene/engine'
import { createWorld } from 'bitecs'
import { NetClient } from './net/ws'
import { babylonSyncSystem } from './ecs/systems/babylonSync'
import { netApplySystem } from './ecs/systems/netApply'

const world = createWorld()
const net = new NetClient()

function App() {
const ref = React.useRef<HTMLCanvasElement>(null)
React.useEffect(() => {
if (ref.current) {
const { engine, scene } = createScene(ref.current)
const babylonSync = babylonSyncSystem(world)
engine.runRenderLoop(() => {
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
}
}, [])
return <canvas ref={ref} style={{ width: '100vw', height: '100vh', display: 'block' }} />
}

createRoot(document.getElementById('root')!).render(<App />)

