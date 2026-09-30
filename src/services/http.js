// Thin fetch wrapper. Every backend response has {status, message, ...};
// status === false (or a non-2xx code) becomes an ApiError.
import { appConfig } from '@/config/env'

export class ApiError extends Error {
  constructor(message, httpStatus, data) {
    super(message)
    this.httpStatus = httpStatus
    this.data = data || {}
  }
}

export async function request(method, path, body) {
  let response
  try {
    response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new ApiError('Cannot reach the API. Start it with backend\\manage.bat (option 1).', 0, {})
  }

  let data = {}
  try {
    data = await response.json()
  } catch {
    data = {}
  }

  if (!response.ok || data.status === false) {
    const fallback = response.status === 502 || response.status === 504
      ? 'The API is not running. Start it with backend\\manage.bat (option 1).'
      : `Request failed (${response.status})`
    throw new ApiError(data.message || fallback, response.status, data)
  }
  return data
}
