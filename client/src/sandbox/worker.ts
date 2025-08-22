import { createSandbox } from './api'

const { sandbox, emit, reset } = createSandbox()
// Глобальная ссылка для importScripts
const api = (sandbox as any).api
// пометим переменную как использованную для компилятора
void api
// сбросить счётчик после начального доступа
reset()

const EXECUTION_TIMEOUT_MS = 1000
let timer: ReturnType<typeof setTimeout> | null = null

const terminate = (reason: string) => {
  postMessage({ type: 'terminated', reason })
  self.close()
}

const runGuarded = (fn: () => void) => {
  reset()
  timer = setTimeout(() => terminate('timeout'), EXECUTION_TIMEOUT_MS)
  try {
    fn()
  } catch (err: any) {
    postMessage({ type: 'error', message: err?.message || String(err) })
    terminate('error')
  } finally {
    if (timer) clearTimeout(timer)
  }
}

self.onmessage = (ev) => {
  const msg = ev.data
  if (msg.type === 'load') {
    runGuarded(() => {
      if (msg.url) {
        importScripts(msg.url)
      } else if (msg.code) {
        const fn = new Function('sandbox', `with(sandbox){${msg.code}}`)
        fn(sandbox)
      }
    })
  } else if (msg.type === 'tick') {
    runGuarded(() => emit('tick'))
  }
}

