import init, * as RAPIER from '@dimforge/rapier3d-compat'


let ready: Promise<typeof RAPIER> | null = null
export function loadRapier() {
if (!ready) ready = init().then(() => RAPIER)
return ready
}