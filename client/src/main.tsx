import React from 'react'
import { createRoot } from 'react-dom/client'
import { createScene } from './scene/engine'


function App() {
const ref = React.useRef<HTMLCanvasElement>(null)
React.useEffect(() => {
if (ref.current) createScene(ref.current)
}, [])
return <canvas ref={ref} style={{ width: '100vw', height: '100vh', display: 'block' }} />
}


createRoot(document.getElementById('root')!).render(<App />)