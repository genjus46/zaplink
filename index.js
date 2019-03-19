// ugly hack so it works with just require and also plays nice in the browser

const Client = require('./lib/client').default
const Server = require('./lib/server').default

module.exports = { Client, Server }
