import { Mesh, MeshBuilder } from '@babylonjs/core'
import { scene } from './engine'


const meshes = new Map<string, Mesh>()


export function createMeshFor(id: string): Mesh {
const mesh = MeshBuilder.CreateBox(id, {}, scene)
meshes.set(id, mesh)
return mesh
}


export function getMesh(id: string): Mesh | undefined {
return meshes.get(id)
}