// external modules
import msgpack from 'msgpack-lite'

const messageTypes = {
  // normal operation
  request: 'R',
  response: 'r',
  error: 'e',
  // ping
  ping: 'P',
  pong: 'p',
  // connection
  connect: 'C',
  connected: 'c',
  disconnected: 'd'
}

const reverseTypes = {}
Object.keys(messageTypes).map(key => (reverseTypes[messageTypes[key]] = key))

const encode = ({ type, name, reqId, data }) => {
  return msgpack.encode({
    t: messageTypes[type],
    n: name,
    r: reqId,
    d: data
  })
}

const decode = (data) => {
  const message = msgpack.decode(data)

  return {
    type: reverseTypes[message.t],
    name: message.n,
    reqId: message.r,
    data: message.d
  }
}

export default {
  encode,
  decode
}
