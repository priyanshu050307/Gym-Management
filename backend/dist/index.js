import { createServer } from 'http';
import app from './app.js';
import { initSocket } from './config/socket.js';
import logger from './config/logger.js';
const PORT = process.env.PORT || 5000;
// Create HTTP server from Express app (required for Socket.io)
const httpServer = createServer(app);
// Attach Socket.io
initSocket(httpServer);
httpServer.listen(PORT, () => {
    logger.info(`Gymnasium API running`, { port: PORT, env: process.env.NODE_ENV || 'development' });
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    httpServer.close(() => {
        logger.info('Server closed.');
        process.exit(0);
    });
});
