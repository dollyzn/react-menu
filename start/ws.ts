import { Server } from 'socket.io'
import app from '@adonisjs/core/services/app'
import server from '@adonisjs/core/services/server'
import logger from '@adonisjs/core/services/logger'

let io: Server

app.ready(() => {
  if (app.getEnvironment() === 'web') {
    io = new Server(server.getNodeServer())

    io.on('connection', (socket) => {
      socket.on('join-store', (storeId) => {
        console.log(`Socket ${socket.id} joined store: ${storeId}`)
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
