import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

export const authThrottle = [middleware.auth(), throttle]
