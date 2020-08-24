Zaplink is a robust, pooled WebSocket connection library with two-way RPC
capability. It uses multiple concurrenct sockets to minimize head of the line
blocking, automatically retries requests that failed due to protocol errors,
supports binary data, and provides a quick and easy way to implement real-time
services.

# Example Usage

On the client:

```javascript
const zaplink = require('zaplink')

const client = new zaplink.Client('ws://example.com/your/endpoint')

client.send('foo')
  .then(response => console.log(response))
```

And on the server

```javascript
const zaplink = require('zaplink')

const server = new zaplink.Server()

server.on('connect', peer => {
  peer.addHandler('foo', async () => 'bar')
})

// somehow acquire sockets, then add them to the server
// zaplink will handle the rest
server.addSocket(socket)
```

You can find more elaborate examples in the [examples](examples) folder.

# Compatibility

Zaplink is fully functional in both Node and the browser.

There is not much point in creating a Zaplink Server in the browser because
you'll have no way of feeding it with sockets, but it's technically possible. In
a more realistic scenario, you can use its server-side implementation in Node
and the client-side in either Node or the browser.

# Installation

```
npm install --save zaplink
```

If for whatever reason you don't use NPM, you can use the prebuilt,
browser-ready version at `build/zaplink-browser.js` in this repository, or at
the following link:

```
https://cdn.jsdelivr.net/npm/zaplink/build/zaplink-browser.js
```

# Usage

## Structure

Zaplink has three main concepts:

 - a **Peer** represents a connection to a remote node
 - a **Client** manages one connection to a node reachable on an address
 - a **Server** can have many peers connecting to it

With these, you can use Zaplink in two ways, either as a client initiating
connections to servers or as a server receiving connections.

Each Peer or Client can both send and respond to requests. Sending a request
is simple:

### `Peer.send(name: string, data: any, options?: object): Promise<any>`

- `name` is the name of your request, which will be used for handlers
- `data` is an arbitrary object passed through. Note that binary objects such as
  Buffer and typed arrays are also supported, the full list can be found
  [here](https://www.npmjs.com/package/msgpack-lite#extension-types).
- `options` is an object containing some request-specific settings

The resulting promise can resolve if the remote handles the request, reject if
an unhandled error occurs on the remote, or reject if the request times out. If
the received error is a timeout, the request will be retried multiple times
before rejecting the promise.

Requests are handled through, well, request handlers. This is how you can add
them to a Peer or a Client:

### `Peer.addHandler(name: string, handler: async (data: any) => any)`

- `name` is the name of the request to handle
- `handler` is a potentially async function that handles the request and returns
  a value that will be forwarded to the remote peer

If multiple handlers are defined to the same request, they will be called
sequentially, in the order they were added, each receiving the result of the
previous one.

## Client Side Usage

On the client side, you can create a Zaplink Client object that automatically
manages a connection to a remote server. The Client works both in Node and the
browser.

### `zaplink.Client(address: string, options?: object)`

- `address` is a WebSocket URL (starts with either `ws://` or `wss://`)
- `options` is an object containing some settings for the client

From this point, the Client will manage a set of WebSocket connections, monitor
them, replace them if necessary, and use them in a round-robin fashion to send
messages.

For sending and handling requests, Client mirrors Peer's API.

## Server Side Usage

The server side is slightly more complex. You can create a Server object:

### `zaplink.Server(options?: object)`

- `options` is an object with some settings for the server

However, this does not bind to any network port by itself. Instead, you will
need to acquire and add sockets manually with the following method:

### `Server.addSocket(socket: Socket)`

Zaplink has been built with [`ws`](https://github.com/websockets/ws), but it
works with any socket that meets these requirements:

- `socket.send(data: Buffer)` **must** send binary data to the remote
- `socket.close()` **must** close the connection
- `socket.readyState` **must** be 1 (OPEN) when the socket can send data
- the socket **must** have the event `message` which has a `data: Buffer`
  parameter containing binary data received on the socket
- the socket **should** fire a `close` event if it closes

The point of having to add sockets manually is that this way Zaplink is
compatible with most WebSocket implementations and it can be inserted at any
point of the process.

From this point, Zaplink will handle the rest, including identification and
authentication of the peer and grouping connections together. It will fire
two events:

- `connect`, when a new peer is connected
- `disconnect`, when a peer disconnected and did not reconnect

Both events have one `peer: Peer` parameter. Note that the `disconnect` event is
not fired immediately when all sockets are closed because there is still a short
period while the peer can reconnect and resume the connection.

## Options

Several Zaplink classes and methods take an options object, allowing you to
customize the behavior of the library. Here are a few options you can use:

- `timeout`: Defines how long async operations such as `send()` calls,
  connections, or pings can take. You can use this option almost anywhere, and
  it follows the order of specificity, for example a `send()` specifying its own
  timeout will override a timeout specified on the `Client` or `Server`. This
  option defaults to `1000`, and you can set it to `false` to allow the
  call to take forever (not recommended).
- `retryCount`: Defines how many times a timed-out request is retried. Can be
  used on `Client`, `Server`, or `send()`. Defaults to 5.
- `concurrency`: An option for `Client`, controls the amount of concurrent
  WebSocket connections. All connections are pinged on both sides, closed if
  failure is detected, and the client replaces broken connections up to the
  level of concurrency specified. Defaults to 8.

# API Reference

Two classes are exposed, `ZaplinkClient` on `zaplink.Client` and `ZaplinkServer`
on `zaplink.Server`. A third class, `ZaplinkPeer` is also returned at some point
but it should neer be created by the user. All three classes extend
`EventEmitter`.

## `ZaplinkPeer`

`ZaplinkPeer` is the core of the library. It sends and handles requests through
multiple WebSocket connections, managing them in the process.

> Note: there is no constructor defined because this class is only constructed
> by the library. Futhermore, it has some methods not listed here. Using those
> methods is not supported, it is possible they will change without notice,
> which is not considered a breaking change.

### `ZaplinkPeer.addHandler(name: string, handler: async (any) => any)`

Adds a handler for requests using the specified name. You can add multiple
handlers and they'll be invoked sequentially. For example:

```javascript
const six = 6

server.addHandler('question', nine => six * nine)
server.addHandler('question', answer => `the answer is ${answer}`)

client.send('question', 7) // returns 'the answer is 42'
```

### `ZaplinkPeer.removeHandler(name: string, handler: async (any) => any)`

Removes a handler previously associated with a request name.

### `ZaplinkPeer.send(name: string, data: any, options?: object)`

Sends a request with the specified name. `data` is forwarded to the handler, and
`options` allows you to set the following parameters:

- `timeout`: Specifies how long the request can take. Note that this does not
  affect the connection, if the Peer has no sockets alive when `send()` is
  called reconnecting will time out based on the settings of the parent Client
  or Server. Defaults to the parent's settings or `1000`.
- `retryCount`: Defines how many times the request is retried before a timeout
  error is returned. Defaults to the parent's settings or `5`. Each individual
  attempt can utilize the full timeout, for example a request on default
  settings can take 5000 milliseconds before giving up, not counting the
  reconnection timeout.
- `broadcast`: If true, sends a message through every available socket instead
  of just one of them. Should be used with caution, it _will_ trigger the
  handler on the other side multiple times.

### `ZaplinkPeer.disconnect()`

Disconnects the peer, closing all sockets.

### `ZaplinkPeer.id`

The raw binary identifier of the peer. Read-only. On the server, this holds the
client's `peerId`.

### `ZaplinkPeer.key`

A string representation of the `peerId`.

### `ZaplinkPeer.ready`

Boolean, `true` if there are open connections, `false` otherwise. Read-only. You
can still send requests when the connection is not yet ready, but if the
connections are closed due to some failure, those requests will most likely time
out.

### Event `ready`

Fires when the client enters `ready` state (when the first connection opens).

### Event `pause`

Fires when the client exists `ready` state (when the last connections closes).

### Event `socket-count`

Fires when the number of alive sockets changes. Could be used for monitoring the
peer.

## `ZaplinkClient`

`ZaplinkClient` defines and manages a connection to a remote server. Has an
underlying `ZaplinkPeer` with some methods forwarded:

Method on ZaplinkClient         | Method on ZaplinkPeer
--------------------------------| -----------------------------
`ZaplinkClient.addHandler()`    | `ZaplinkPeer.addHandler()`
`ZaplinkClient.removeHandler()` | `ZaplinkPeer.removeHandler()`
`ZaplinkClient.send()`          | `ZaplinkPeer.send()`

### `ZaplinkClient(address: string, options?: object)`

- `address` is a WebSocket URL (begins with `ws://` or `wss://`)
- `options` is an object, containing the following parameters:
  - `timeout`: a timeout used for connections, pings, and requests on the
    Client. Defaults to `1000`.
  - `concurrency`: defines the amount of concurrent WebSocket connections.
    Defaults to `8`.
  - `retryCount`: controls how many times requests are retried. Defaults to `5`.

### `ZaplinkClient.disconnect()`

Disconnects the client, closing all sockets. Aliased to `ZaplinkClient.close()`.

### `ZaplinkClient.peerId`

ID of the current connection, used to link multiple WebSockets together.
Read-only.

> Note that this parameter cannot be controlled, it corresponds to an underlying
> `peerSecret` and it's used to authenticate the client. You can use `peerId`,
> but sharing `peerSecret` could allow anyone to take over your Peer. Therefore,
> `peerSecret` is never exposed to prevent misuse.

### `ZaplinkClient.peerKey`

A string representation of the binary `peerId`.

### `ZaplinkClient.ready`

Boolean, `true` if there are open connections, `false` otherwise. Read-only. You
can still send requests when the connection is not yet ready, but if the
connections are closed due to some failure, those requests will most likely time
out.

### Event `ready`

Fires when the client enters `ready` state (when the first connection opens).

### Event `pause`

Fires when the client exists `ready` state (when the last connections closes).

### Event `socket-count`

Fires when the number of alive sockets changes. Could be used for monitoring the
client.

## `ZaplinkServer`

Defines a server that receives sockets, bundles them together by `peerId`, and
manages connections to them.

### `ZaplinkServer(options?: object)`

- `options` is an object, containing the following parameters:
  - `timeout`: a timeout used for connections, pings, and requests on the
    Server. Defaults to `1000`.
  - `retryCount`: controls how many times requests are retried. Defaults to `5`.

### `ZaplinkServer.addSocket(socket: Socket)`

Adds a WebSocket to the Server. From this point, the server will identify the
peer on the other side of the socket, add it to an existing `Peer`, or create a
new one.

### Event `connect`

Fires when a new peer is connected, has a single `peer: Peer` parameter.

### Event `disconnect`

Fires when a peer is disconnected, has a single `peer: Peer` parameter. Note
that this is one timeout after all connections dropped to the Peer.

# Contributing

Pull requests, issues, and ideas are welcome, feel free use github like it was
reddit. Just a few rules: don't do anything illegal and respect each other.

Zaplink is available under the MIT license.
