import { defineQuery, enterQuery, exitQuery, IWorld } from 'bitecs'
import { Transform, Velocity } from '../components'


export function movementSystem(world: IWorld) {
const q = defineQuery([Transform, Velocity])
const enter = enterQuery(q)
const exit = exitQuery(q)


return (dt: number) => {
for (const eid of q(world)) {
Transform.x[eid] += Velocity.x[eid] * dt
Transform.y[eid] += Velocity.y[eid] * dt
Transform.z[eid] += Velocity.z[eid] * dt
}
enter(world); exit(world)
return world
}
}