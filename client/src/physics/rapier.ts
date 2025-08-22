import RAPIER, { init } from '@dimforge/rapier3d-compat'

let ready: Promise<typeof RAPIER> | null = null

export function loadRapier() {
  if (!ready) {
    ready = (async () => {
      await init()
      return RAPIER
    })()
  }
  return ready
}
