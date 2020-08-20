// external modules
import createHmac from 'create-hmac'
import randomBytes from 'randombytes'
import scmp from 'scmp'

const hash = secret => {
  return createHmac('sha256', 'correct horse battery staple').update(secret).digest()
}

const padSecret = [
  25, 105, 190, 89,
  74, 170, 170, 202,
  107, 159, 162, 222,
  13, 211, 209, 197,
  230, 165, 49, 202,
  239, 176, 141, 79,
  97, 88, 65, 184,
  99, 115, 112, 23
]

const pad = (array) => {
  const result = new Uint8Array(32)
  for (let i = 0; i < 32; i++) result[i] = padSecret[i] ^ array[i]
  return result
}

const getLocalSecret = () => {
  try {
    const hasSecret = window.localStorage.getItem('__zaplink-secret')
    if (!hasSecret || !/^\d+(?::\d+){31}$/.test(hasSecret)) window.localStorage.setItem('__zaplink-secret', randomBytes(32).join(':'))

    return pad(new Uint8Array(window.localStorage.getItem('__zaplink-secret').split(':')))
  } catch (err) {
    return null
  }
}

const createPair = (options = {}) => {
  const localSecret = options.useLocalSecret ? getLocalSecret() : null

  const secret = (options.useLocalSecret && localSecret) ? localSecret : randomBytes(32)
  const id = hash(secret)

  return { id, secret }
}

const verifyPair = (id, secret) => {
  try {
    return scmp(id, hash(secret))
  } catch (err) {
    return false
  }
}

export default {
  create: createPair,
  verify: verifyPair,
  pad
}
