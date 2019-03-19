// external modules
import toBuffer from 'blob-to-buffer'
import { EventEmitter } from 'events'
import Socket from 'ws'

const BrowserSocket = global.WebSocket || null

const browserConnect = (address) => {
  return new Promise((resolve, reject) => {
    const emitter = new EventEmitter()
    const socket = new BrowserSocket(address)

    socket.onmessage = (message) => toBuffer(message.data, (err, buffer) => {
      if (err) throw err

      emitter.emit('message', buffer)
    })

    emitter.send = (message) => socket.send(message)
    emitter.close = () => socket.close()

    Object.defineProperty(emitter, 'readyState', {
      get: () => socket.readyState
    })

    socket.onopen = () => resolve(emitter)
    socket.onerror = (err) => reject(err)
  })
}

const connect = (address) => {
  if (BrowserSocket) return browserConnect(address)

  return new Promise((resolve, reject) => {
    const socket = new Socket(address)

    socket.on('open', () => resolve(socket))
    socket.on('error', (err) => reject(err))
  })
}

export default connect
