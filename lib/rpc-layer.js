// external modules
import { EventEmitter } from 'events'

// internal modules
import auth from './auth'
import encoding from './encoding'
import createReplyHandler from './reply-handler'

const { encode, decode } = encoding
const connectionSymbol = Symbol('connect')

const rpcLayer = async (socket, options = {}) => {
  const replyHandler = createReplyHandler(options)
  const emitter = new EventEmitter()

  emitter.peerId = options.peerId || null
  emitter.disconnected = false

  const send = message => {
    if (socket.readyState !== 1) return
    return socket.send(encode(message))
  }
  emitter.send = send

  const connectionRequest = replyHandler.createRequest(options.timeout, connectionSymbol)

  socket.on('message', async data => {
    const message = decode(data)

    // protocol messages
    if (message.type === 'request') return handleIncoming(message)
    if (message.type === 'response') return handleIncoming(message)
    if (message.type === 'error') return handleIncoming(message)

    // ping requests
    if (message.type === 'ping') return send({ type: 'pong', reqId: message.reqId })
    if (message.type === 'pong') return replyHandler.handleResolve(message.reqId)

    // connection requests
    if (message.type === 'connected') return replyHandler.handleResolve(connectionRequest.reqId)
    if (message.type === 'disconnected') {
      try {
        socket.close()
      } catch (err) {
        // already closed
      }

      return handleDisconnect()
    }
    if (message.type === 'connect') {
      const { id, secret } = message.data || {}

      if (auth.verify(id, secret)) {
        emitter.peerId = id

        send({ type: 'connected' })
        replyHandler.handleResolve(connectionRequest.reqId)
      } else {
        send({ type: 'disconnected' })
      }
    }
  })

  const handleIncoming = async (message) => {
    emitter.emit('message', message)
  }

  const handleDisconnect = () => {
    replyHandler.handleResolve(connectionRequest.reqId)
    if (emitter.disconnected) return

    emitter.disconnected = true
    emitter.emit('disconnect')
  }

  if (options.peerId) {
    send({
      type: 'connect',
      data: {
        id: options.peerId,
        secret: options.peerSecret
      }
    })
  }

  const disconnect = () => {
    try {
      send({ type: 'disconnect' })
      socket.close()
    } catch (err) {
      // already closed
    }
    handleDisconnect()
  }
  emitter.disconnect = disconnect

  socket.on('close', disconnect)

  // start ping loop
  const ping = async () => {
    if (emitter.disconnected) return
    setTimeout(ping, 1000)

    const { reqId, promise } = replyHandler.createRequest(options.timeout)
    send({ type: 'ping', reqId })

    promise.catch(() => disconnect())
  }

  await connectionRequest.promise.catch(() => {
    handleDisconnect()
  })

  ping()
  return emitter
}

export default rpcLayer
