import { Engine, Scene, Vector3, HemisphericLight, ArcRotateCamera, MeshBuilder } from '@babylonjs/core'


export function createScene(canvas: HTMLCanvasElement) {
const engine = new Engine(canvas, true)
const scene = new Scene(engine)


const camera = new ArcRotateCamera('cam', Math.PI / 2, Math.PI / 3, 8, Vector3.Zero(), scene)
camera.attachControl(canvas, true)


new HemisphericLight('h', new Vector3(0, 1, 0), scene)
MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene)


engine.runRenderLoop(() => scene.render())
window.addEventListener('resize', () => engine.resize())


return { engine, scene, camera }
}