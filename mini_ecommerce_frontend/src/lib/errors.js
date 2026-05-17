export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err?.response) return 'No internet connection. Please check your network.'
  const data = err.response.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  // DRF field errors: { field: "msg" } or { field: ["msg"] }
  const messages = Object.values(data)
    .flat()
    .filter((v) => typeof v === 'string')
  if (messages.length) return messages[0]
  return fallback
}
