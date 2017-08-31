const toArray = v => Array.isArray(v) ? v : Object.keys(v)
const makeCancelAll = listeners =>
  () => listeners.forEach(listener => listener.cancel())

const forwardData = (from, to, keys) => {
  const listeners = toArray(keys)
    .map(key => from.observe(key, value => to.set({ [key]: value }), { init: true }))
  return { cancel: makeCancelAll(listeners) }
}

const forwardEvents = (from, to, eventNames) => {
  const listeners = toArray(eventNames)
    .map(eventName => from.on(eventName, event => to.fire(eventName, event)))
  return { cancel: makeCancelAll(listeners)  }
}

const addMethodsFrom = (from, to, methodNames) => {
  toArray(methodNames).forEach(
    methodName => to[methodName] = (...args) => from[methodName](...args)
  )
}

export {
  forwardData,
  forwardEvents,
  addMethodsFrom
}
