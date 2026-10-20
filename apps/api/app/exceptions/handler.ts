import app from '@adonisjs/core/services/app'
import { ExceptionHandler } from '@adonisjs/core/http'
import { HttpContext } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'
import { errors as coreErrors } from '@adonisjs/core'
import { errors as lucidErrors } from '@adonisjs/lucid'
import { errors as authErrors } from '@adonisjs/auth'
import { errors as bouncerErrors } from '@adonisjs/bouncer'
import { errors as limiterErrors } from '@adonisjs/limiter'
import { errors as allyErrors } from '@adonisjs/ally'
import AppException from '#exceptions/app_exception'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    const response = ctx.response

    // VALIDATION ERROR
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      return response.status(422).send({
        success: false,
        error: error.messages?.[0]?.message ?? 'Erro de validação',
        code: 'E_VALIDATION_ERROR',
        details: error.messages?.[0],
      })
    }

    // AUTH ERRORS
    if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
      return response.status(400).send({
        success: false,
        error: 'Email ou senha inválidos.',
        code: 'E_INVALID_CREDENTIALS',
      })
    }

    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      return response.status(401).send({
        success: false,
        error: 'Você precisa estar autenticado para acessar este recurso.',
        code: 'E_UNAUTHORIZED_ACCESS',
      })
    }

    if (error instanceof allyErrors.E_OAUTH_MISSING_CODE) {
      return response.status(400).send({
        success: false,
        error: 'Código OAuth ausente na resposta do provedor.',
        code: 'E_OAUTH_MISSING_CODE',
      })
    }

    // BOUNCER ERRORS
    if (error instanceof bouncerErrors.E_AUTHORIZATION_FAILURE) {
      return response.status(403).send({
        success: false,
        error: 'Você não está autorizado a acessar este recurso.',
        code: 'E_AUTHORIZATION_FAILURE',
      })
    }

    // DATABASE
    if (error instanceof lucidErrors.E_ROW_NOT_FOUND) {
      return response.status(404).send({
        success: false,
        error: 'O recurso solicitado não foi encontrado.',
        code: 'E_ROW_NOT_FOUND',
      })
    }

    // ROUTE
    if (error instanceof coreErrors.E_ROUTE_NOT_FOUND) {
      return response.status(404).send({
        success: false,
        error: 'Rota não encontrada.',
        code: 'E_ROUTE_NOT_FOUND',
      })
    }

    // RATE LIMITER
    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS) {
      const headers = error.getDefaultHeaders()

      Object.keys(headers).forEach((header) => {
        response.header(header, headers[header])
      })

      return response.status(429).send({
        success: false,
        error: 'Muitas requisições. Por favor, tente novamente mais tarde.',
        code: 'E_TOO_MANY_REQUESTS',
      })
    }

    // OUTROS ERROS CONHECIDOS
    if (error instanceof coreErrors.E_CANNOT_LOOKUP_ROUTE) {
      return response.status(500).send({
        success: false,
        error: 'Erro interno ao resolver rota.',
        code: 'E_CANNOT_LOOKUP_ROUTE',
      })
    }

    if (error instanceof coreErrors.E_HTTP_EXCEPTION) {
      return response.status(error.status ?? 500).send({
        success: false,
        error: 'Erro na requisição HTTP.',
        code: 'E_HTTP_EXCEPTION',
      })
    }

    if (error instanceof coreErrors.E_INSECURE_APP_KEY) {
      return response.status(500).send({
        success: false,
        error: 'Chave de aplicação insegura. Verifique sua configuração.',
        code: 'E_INSECURE_APP_KEY',
      })
    }

    if (error instanceof coreErrors.E_MISSING_APP_KEY) {
      return response.status(500).send({
        success: false,
        error: 'Chave de aplicação ausente. Configure a variável APP_KEY.',
        code: 'E_MISSING_APP_KEY',
      })
    }

    if (error instanceof coreErrors.E_INVALID_ENV_VARIABLES) {
      return response.status(500).send({
        success: false,
        error: 'Variáveis de ambiente inválidas.',
        code: 'E_INVALID_ENV_VARIABLES',
        details: error.help,
      })
    }

    // DEFAULT (ERRO DESCONHECIDO)
    if (error instanceof AppException)
      return ctx.response.status(error.status).send({
        success: false,
        status: error.status,
        error: error.message,
        code: error.code ?? 'APP_EXCEPTION',
        stack: this.debug ? (error as any).stack : undefined,
      })
    else
      return response.status(500).send({
        success: false,
        error: 'Algo deu errado. Tente novamente mais tarde.',
        code: 'INTERNAL_SERVER_ERROR',
      })
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
