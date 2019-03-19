// external modules
import { EventEmitter } from 'events'
import unwrap from 'async-unwrap'

// internal modules
import auth from './auth'
import connect from './connect'
import Peer from './peer'
import rpcLayer from './rpc-layer'

export default class ZaplinkClient extends EventEmitter {
  constructor (address, options = {}) {
    super()

    const { id, secret } = auth.create()
    this.peerId = id

    const peer = new Peer({
      peerId: id,
      timeout: options.timeout,
      retryCount: options.retryCount
    })
    this.peerKey = peer.key

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
      new Array(socketsToAdd).fill().map(() => createSocket())
    }

    peer.on('socket-lost', fillSockets)
    fillSockets()

    let ready = false

    peer.on('socket-count', count => {
      this.emit('socket-count', count)

      if (count && !ready) {
        ready = true
        this.emit('ready')
      }

      if (!count && ready) {
        ready = false
        this.emit('pause')
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
