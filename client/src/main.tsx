import React from 'react'
import { createRoot } from 'react-dom/client'
import { createScene } from './scene/engine'
import { createWorld } from 'bitecs'
import { NetClient } from './net/ws'
import { babylonSyncSystem } from './ecs/systems/babylonSync'
import { netApplySystem, syncEntities } from './ecs/systems/netApply'
import { interpolateSystem } from './ecs/systems/interpolate'

const world = createWorld()
const net = new NetClient()

net.onLocalUpdate((state) => {
  netApplySystem(world, { entities: [state] })
})

function DebugHUD() {
  const [state, setState] = React.useState({
    self: net.getSelfState(),
    connected: net.connected,
  })

  React.useEffect(() => {
    let frame: number
    const update = () => {
      setState({ self: net.getSelfState(), connected: net.connected })
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        color: 'white',
        background: 'rgba(0,0,0,0.5)',
        padding: 4,
        fontFamily: 'monospace',
      }}
    >
      <div>connected: {String(state.connected)}</div>
      <div>self: {state.self ? JSON.stringify(state.self) : 'null'}</div>
    </div>
  )
}

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
        const formatted = { entities: snap.entities.map((e: any) => ({ id: e.id.toString(), x: e.x, y: e.y, z: e.z })) }
        syncEntities(world, formatted)
        netApplySystem(world, formatted)
      }
})

const keys = { w: false, a: false, s: false, d: false }
let lastAx = 0
let lastAz = 0
const send = () => {
const ax = (keys.d ? 1 : 0) - (keys.a ? 1 : 0)
const az = (keys.w ? 1 : 0) - (keys.s ? 1 : 0)
if (ax !== lastAx || az !== lastAz) {
lastAx = ax
lastAz = az
net.sendInput({ t: Date.now(), ax, ay: 0, az })
}
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
return (
  <>
    <canvas ref={ref} style={{ width: '100vw', height: '100vh', display: 'block' }} />
    <DebugHUD />
  </>
)
}

createRoot(document.getElementById('root')!).render(<App />)

