import { Server } from 'socket.io'
import app from '@adonisjs/core/services/app'
import server from '@adonisjs/core/services/server'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

let io: Server

app.ready(() => {
  if (app.getEnvironment() === 'web') {
    io = new Server(server.getNodeServer(), {
      cors: {
        origin: env.get('FRONTEND_URL'),
      },
    })

    io.on('connection', (socket) => {
      socket.on('join-store', (storeId) => {
        logger.info(`Socket ${socket.id} joined store: ${storeId}`)
        socket.join(`store-${storeId}`)
      })
    })

    logger.info('Socket.IO server initialized')
  }
})

export const getSocket = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Ensure app is ready before calling getSocket.')
  }
  return io
}
