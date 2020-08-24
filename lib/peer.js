// external modules
import { EventEmitter } from 'events'
import unwrap from 'async-unwrap'

// internal modules
import createReplyHandler from './reply-handler'

export default class ZaplinkPeer extends EventEmitter {
  constructor (options) {
    super()

    const replyHandler = createReplyHandler(options)

    this.id = options.peerId || null
    this.key = options.peerKey || null
    this.retryCount = Number(options.retryCount) || 5

    const sockets = []
    const handlers = {}

    let disconnected = false

    const socketCount = () => sockets.length
    this.socketCount = socketCount

    const addHandler = (name, handler) => {
      if (!handlers[name]) handlers[name] = []
      handlers[name].push(handler)
    }

    const removeHandler = (name, handler) => {
      if (!handlers[name]) return
      handlers[name] = handlers[name].filter(h => h !== handler)
    }

    this.addHandler = addHandler
    this.removeHandler = removeHandler

    let disconnecting = null

    const addSocket = (socket) => {
      if (disconnected) {
        socket.disconnect()
        return
      }

      sockets.push(socket)

      if (disconnecting) {
        clearTimeout(disconnecting)
        disconnecting = null
      }

      socket.on('message', (message) => handleIncoming(message))
      socket.on('disconnect', () => {
        let index
        while (~(index = sockets.indexOf(socket))) sockets.splice(index, 1)

        this.emit('socket-lost')
        this.emit('socket-count', sockets.length)

        if (!sockets.length) {
          disconnecting = setTimeout(() => this.emit('disconnect'), options.timeout || 1000)
        }
      })

      this.emit('socket-added')
      this.emit('socket-count', sockets.length)
    }
    this.addSocket = addSocket

    const disconnect = () => {
      disconnected = true
      sockets.map(socket => setImmediate(() => socket.disconnect()))
    }
    this.disconnect = disconnect

    const waitForSocket = () => {
      if (sockets.length) return

      return new Promise((resolve, reject) => {
        this.once('socket-added', () => resolve())

        const timeout = options.timeout || 1000
        if (timeout) {
          setTimeout(() => reject(new createReplyHandler.TimeoutError('Connection timed out')), timeout)
        }
      })
    }

    const sendMessage = (message) => {
      const socket = sockets.shift()
      sockets.push(socket)

      socket.send(message)
    }

    const peerTimeout = options.timeout

    const sendOnce = async (name, data, options = {}) => {
      if (!sockets.length) await waitForSocket()

      const { reqId, promise } = replyHandler.createRequest(options.timeout != null ? options.timeout : peerTimeout)
      const message = { type: 'request', reqId, name, data }

      if (options.broadcast) sockets.map(socket => socket.send(message))
      else sendMessage(message)

      return promise
    }

    const send = async (name, data, options = {}) => {
      let result = null
      let err = null

      for (let i = 0; i < (options.retryCount || this.retryCount); i++) {
        ;[err, result] = await sendOnce(name, data, options)[unwrap]

        if (!err || !(err instanceof createReplyHandler.TimeoutError)) break
      }

      if (err) throw err
      return result
    }

    this.send = send

    const handleIncoming = async (message) => {
      if (message.type === 'response') replyHandler.handleResolve(message.reqId, message.data)
      if (message.type === 'error') replyHandler.handleReject(message.reqId, message.data)

      if (message.type === 'request') {
        const currentHandlers = handlers[message.name] || []
        const reqId = message.reqId

        if (!currentHandlers.length) return sendMessage({ type: 'error', reqId, data: `No handler for call '${message.name}'` })

        let result = message.data
        for (const handler of currentHandlers) {
          try {
            result = await handler(message.data)
          } catch (err) {
            return sendMessage({ type: 'error', reqId, data: err.message })
          }
        }

        sendMessage({ type: 'response', reqId, data: result })
      }
    }

    let ready = false

    this.on('socket-count', count => {
      if (count && !ready) {
        ready = true
        this.emit('ready')
      }

      if (!count && ready) {
        ready = false
        this.emit('pause')
      }
    })

    Object.defineProperty(this, 'ready', {
      get: () => ready
    })
  }
}
