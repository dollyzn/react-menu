import hash from '@adonisjs/core/services/hash'
import limiter from '@adonisjs/limiter/services/main'
import AppException from '#exceptions/app_exception'
import type User from '#models/user'

/**
 * Checks the signed-in user's own password where a screen asks for it again
 * (change password, turn the authenticator app on or off). Wrong guesses
 * share one limit (5 in 15 minutes), so a session left open can't be used to
 * guess the password through any of them.
 */
export async function assertOwnPassword(
  user: User,
  password: string,
  message = 'A senha não confere.'
) {
  const guard = limiter.use({ requests: 5, duration: '15 min', blockDuration: '15 min' })
  const [error] = await guard.penalize(`own_password_${user.id}`, async () => {
    if (!(await hash.verify(user.password, password))) {
      throw new AppException(message, 422, 'E_WRONG_PASSWORD')
    }
  })
  if (error) throw new AppException('Muitas tentativas. Tente de novo em alguns minutos.', 429)
}
