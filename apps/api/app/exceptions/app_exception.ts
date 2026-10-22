import { Exception } from '@adonisjs/core/exceptions'

export default class AppException extends Exception {
  constructor(
    message: string,
    status: number = 400,
    code?: string,
    /** Extra data the client needs to react (sent as `details`). */
    public details?: Record<string, unknown>
  ) {
    super(message, {
      status,
      code,
    })

    this.message = message
    this.status = status
    this.code = code
  }
}
