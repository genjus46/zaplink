// external modules
import randomBytes from 'randombytes'

class TimeoutError extends Error {}
TimeoutError.prototype.name = 'TimeoutError'

const createReplyHandler = (options) => {
  const expectedAnswers = {}
  const defaultTimeout = options.timeout !== undefined ? options.timeout : 1000

  const createRequest = (timeout = defaultTimeout, presetId) => {
    const reqId = presetId || randomBytes(8) // safe until 2^32 concurrent requests
    let timeoutId = null

    const promise = new Promise((resolve, reject) => {
      expectedAnswers[reqId] = {
        resolve: (result) => {
          delete expectedAnswers[reqId]
          if (timeoutId) clearTimeout(timeoutId)
          resolve(result)
        },
        reject: (error) => {
          delete expectedAnswers[reqId]
          if (timeoutId) clearTimeout(timeoutId)
          reject(error)
        }
      }

      if (timeout) {
        timeoutId = setTimeout(() => {
          if (!expectedAnswers[reqId]) return
          delete expectedAnswers[reqId]
          reject(new TimeoutError('Request timed out'))
        }, timeout)
      }
    })

    return { reqId, promise }
  }

  const handleResolve = (reqId, data) => expectedAnswers[reqId] && expectedAnswers[reqId].resolve(data)
  const handleReject = (reqId, error) => expectedAnswers[reqId] && expectedAnswers[reqId].reject(error)

  return {
    createRequest,
    handleResolve,
    handleReject
  }
}

createReplyHandler.TimeoutError = TimeoutError
export default createReplyHandler
