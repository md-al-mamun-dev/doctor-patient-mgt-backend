import { app } from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';

const startServer = async () => {
  try {
    await connectDatabase();

    const server = app.listen(config.PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${config.PORT} in ${config.NODE_ENV} mode`);
    });

    const shutdown = () => {
      console.log('Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

