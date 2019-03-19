// external modules
const unwrap = require('async-unwrap')

// this module
const zaplink = require('..')

const client = new zaplink.Client('ws://localhost:8080')

const test = async () => {
  const [err, result] = await client.send('hello there')[unwrap]

  console.log(err, result)
  client.disconnect()
}
test()
