// external modules
const fs = require('fs')
const Koa = require('koa')
const path = require('path')
const websocket = require('koa-easy-ws')

// this module
const zaplink = require('..')

const app = new Koa()
const server = new zaplink.Server()

const html = fs.readFileSync(path.resolve(__dirname, 'browser.html'))
const script = fs.readFileSync(path.resolve(__dirname, '..', 'build', 'zaplink-browser.js'))

server.on('connect', peer => {
  console.log(`Peer ${peer.key} connected`)
  peer.addHandler('hello there', () => 'general kenobi')
})

server.on('disconnect', peer => {
  console.log(`Peer ${peer.key} disconnected`)
})

app.use(websocket())
app.use(async ctx => {
  if (!ctx.ws) {
    if (ctx.path.endsWith('.js')) {
      ctx.type = 'js'
      ctx.body = script
    } else {
      ctx.type = 'html'
      ctx.body = html
    }

    return
  }

  const socket = await ctx.ws()
  server.addSocket(socket)
})

app.listen(8080, () => console.log('Server listening'))
