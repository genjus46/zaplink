// external modules
import EventEmitter from 'events'

// internal modules
import rpcLayer from './rpc-layer'
import Peer from './peer'

export default class ZaplinkServer extends EventEmitter {
  constructor (options = {}) {
    super()

    const peers = {}

    this.addSocket = async (socket) => {
      const rpcSocket = await rpcLayer(socket, options)
      if (rpcSocket.disconnected) return

      const peerKey = rpcSocket.peerId.toString('base64')
      const newPeer = !peers[peerKey]

      if (newPeer) {
        peers[peerKey] = new Peer({
          peerId: rpcSocket.peerId,
          peerKey,
          timeout: options.timeout,
          retryCount: options.retryCount
        })
      }
      const peer = peers[peerKey]

      peer.addSocket(rpcSocket)

      if (newPeer) {
        peer.on('disconnect', () => {
          this.emit('disconnect', peer)
          delete peers[peerKey]
        })

        this.emit('connect', peer)
      }
    }
  }
}
