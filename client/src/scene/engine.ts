import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  ArcRotateCamera,
  MeshBuilder,
  PointLight,
  DirectionalLight,
} from '@babylonjs/core'


export let engine: Engine
export let scene: Scene
export let camera: ArcRotateCamera


export function createScene(canvas: HTMLCanvasElement) {
engine = new Engine(canvas, true)
scene = new Scene(engine)


camera = new ArcRotateCamera('cam', Math.PI / 2, Math.PI / 3, 8, Vector3.Zero(), scene)
camera.attachControl(canvas, true)

new HemisphericLight('h', new Vector3(0, 1, 0), scene)

const point = new PointLight('p', new Vector3(5, 5, -5), scene)
point.intensity = 0.7

const dir = new DirectionalLight('d', new Vector3(-1, -2, -1), scene)
dir.position = new Vector3(10, 10, 10)

MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene)

const box = MeshBuilder.CreateBox('box', {}, scene)
box.position.y = 0.5

const sphere = MeshBuilder.CreateSphere('sphere', { diameter: 1.5 }, scene)
sphere.position = new Vector3(2, 1.5, 0)

const cyl = MeshBuilder.CreateCylinder('cyl', { height: 2 }, scene)
cyl.position = new Vector3(-2, 1, 0)

window.addEventListener('resize', () => engine.resize())


return { engine, scene, camera }
}
