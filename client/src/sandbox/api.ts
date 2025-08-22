export type SandboxAPI = {
  on(event: 'tick' | 'enter' | 'leave', cb: (...args: any[]) => void): void
  spawn(name: string, opts: { x: number; y: number; z: number }): number // возвращает entityId
  setPosition(id: number, x: number, y: number, z: number): void
  getTime(): number
}

export type Sandbox = {
  api: SandboxAPI
  emit: (event: 'tick' | 'enter' | 'leave', ...args: any[]) => void
  sandbox: any
  reset: () => void
}

// Прокси к движку и ограниченный глобальный объект
export const createSandbox = (): Sandbox => {
  const listeners: Record<string, Function[]> = { tick: [], enter: [], leave: [] }
  const api: SandboxAPI = {
    on(ev, cb) { (listeners[ev] ||= []).push(cb) },
    spawn(name, opts) {
      postMessage({ type: 'spawn', name, opts })
      return Math.floor(Math.random() * 1e9)
    },
    setPosition(id, x, y, z) { postMessage({ type: 'setPosition', id, x, y, z }) },
    getTime() { return performance.now() }
  }

  const allowedGlobals: Record<string, any> = { api, console, Math }
  const MAX_OPS = 10_000
  let opCount = 0

  const sandbox = new Proxy(allowedGlobals, {
    has(target, prop) {
      return prop in target
    },
    get(target, prop: string) {
      opCount++
      if (opCount > MAX_OPS) {
        throw new Error('Operation limit exceeded')
      }
      if (prop in target) {
        return (target as any)[prop]
      }
      throw new Error(`Access to global '${String(prop)}' is denied`)
    }
  })

  const emit = (ev: keyof typeof listeners, ...args: any[]) => {
    for (const cb of listeners[ev]) cb(...args)
  }

  const reset = () => { opCount = 0 }

  return { api, emit, sandbox, reset }
}

