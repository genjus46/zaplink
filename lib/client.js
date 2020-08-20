// external modules
import createDebug from 'debug'
import { EventEmitter } from 'events'
import unwrap from 'async-unwrap'

// internal modules
import auth from './auth'
import connect from './connect'
import Peer from './peer'
import rpcLayer from './rpc-layer'

const debug = createDebug('zaplink:client')

export default class ZaplinkClient extends EventEmitter {
  constructor (address, options = {}) {
    super()

    const { id, secret } = auth.create({ useLocalSecret: true })
    this.peerId = id
    this.peerKey = id.toString('base64')

    const peer = new Peer({
      peerId: id,
      peerKey: this.peerKey,
      timeout: options.timeout,
      retryCount: options.retryCount
    })
    this.peerKey = peer.key

    debug('Client created with key %s', this.peerKey)

    this.concurrency = Number(options.concurrency) || 8

    let connecting = 0

    const createSocket = async () => {
      connecting++

      const [err, socket] = await connect(address)[unwrap]
      if (err) return setTimeout(refill, options.timeout || 1000)

      const rpcSocket = await rpcLayer(socket, {
        peerId: id,
        peerSecret: secret,
        timeout: options.timeout
      })
      if (rpcSocket.disconnected) return refill()

      rpcSocket.once('disconnect', refill)
      peer.addSocket(rpcSocket)
    }

    const refill = () => {
      connecting--
      fillSockets()
    }

    const fillSockets = () => {
      const socketsWanted = this.concurrency
      const socketsGot = peer.socketCount() + connecting

      const socketsToAdd = Math.max(socketsWanted - socketsGot, 0)

      debug('Creating %d sockets (client %s)', socketsToAdd, this.peerKey)
      new Array(socketsToAdd).fill().map(() => createSocket())
    }

    peer.on('socket-lost', fillSockets)
    fillSockets()

    let ready = false

    peer.on('socket-count', count => {
      this.emit('socket-count', count)
      debug('concurrent sockets: %d (client %s)', count, this.peerKey)

      if (count && !ready) {
        ready = true
        this.emit('ready')
        debug('connection ready (client %s)', this.peerKey)
      }

      if (!count && ready) {
        ready = false
        this.emit('pause')
        debug('connection paused (client %s)', this.peerKey)
      }
    })

    this.addHandler = peer.addHandler
    this.removeHandler = peer.removeHandler
    this.send = peer.send
    this.disconnect = () => {
      this.concurrency = 0
      peer.disconnect()
    }

    this.close = this.disconnect

    Object.defineProperty(this, 'ready', {
      get: () => ready
    })
  }
}
