import { createSandboxAPI } from './api'


const api = createSandboxAPI()


// Пример UGC-скрипта (будет заменён загрузчиком пользовательского кода)
api.on('tick', () => {
// dev-скрипт: крутим объект
})


self.onmessage = (ev) => {
const msg = ev.data
if (msg.type === 'tick') {
// вызывать обработчики
}
}