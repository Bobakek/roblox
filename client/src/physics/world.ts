import { loadRapier } from './rapier'

const worldReady = (async () => {
  const RAPIER = await loadRapier()
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 })
  const minX = -100, maxX = 100
  const minY = 0, maxY = 100
  const minZ = -100, maxZ = 100
  const halfX = (maxX - minX) / 2
  const halfY = (maxY - minY) / 2
  const halfZ = (maxZ - minZ) / 2
  // left and right walls
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(1, halfY, halfZ).setTranslation(minX - 1, halfY + minY, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  )
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(1, halfY, halfZ).setTranslation(maxX + 1, halfY + minY, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  )
  // bottom and top
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfX, 1, halfZ).setTranslation(0, minY - 1, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  )
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfX, 1, halfZ).setTranslation(0, maxY + 1, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  )
  // front and back
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfX, halfY, 1).setTranslation(0, halfY + minY, minZ - 1),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  )
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfX, halfY, 1).setTranslation(0, halfY + minY, maxZ + 1),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  )
  return { RAPIER, world }
})()

export function getPhysicsWorld() {
  return worldReady
}
