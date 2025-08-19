import { defineComponent, Types } from 'bitecs'


export const Transform = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 })
export const Renderable = defineComponent({ meshId: Types.ui32 })
export const Velocity = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 })
export const PlayerTag = defineComponent()
export const RenderTransform = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 })
