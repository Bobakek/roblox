import { Mesh, MeshBuilder } from '@babylonjs/core'
import { scene } from './engine'


const meshes = new Map<string, Mesh>()

export interface MeshConfig {
  kind?: 'box' | 'sphere'
  size?: number
  diameter?: number
}

export function createMeshFor(id: string, cfg: MeshConfig = {}): Mesh {
  let mesh: Mesh
  switch (cfg.kind) {
    case 'sphere':
      mesh = MeshBuilder.CreateSphere(id, { diameter: cfg.diameter }, scene)
      break
    default:
      mesh = MeshBuilder.CreateBox(id, { size: cfg.size }, scene)
  }
  meshes.set(id, mesh)
  return mesh
}

export function getMesh(id: string): Mesh | undefined {
  return meshes.get(id)
}

export function removeMesh(id: string) {
  const mesh = meshes.get(id)
  if (mesh) {
    mesh.dispose()
    meshes.delete(id)
  }
}

