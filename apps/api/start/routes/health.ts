import { throttle } from '#start/limiter'
import router from '@adonisjs/core/services/router'
import healthAuth from '#middleware/health_auth_middleware'

const HealthChecksController = () => import('#controllers/health_checks_controller')

export default function healthRoutes() {
  router.get('/health', [HealthChecksController]).use([throttle, healthAuth])
}
