// external modules
import createHmac from 'create-hmac'
import randomBytes from 'randombytes'
import scmp from 'scmp'

const hash = secret => {
  return createHmac('sha256', 'correct horse battery staple').update(secret).digest()
}

const createPair = () => {
  const secret = randomBytes(32)
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
  verify: verifyPair
}
