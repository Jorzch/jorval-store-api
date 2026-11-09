import express from 'express';
import { baseLoader } from './infrastructure/loaders';
import { env } from './infrastructure/config/env';
import { logger } from './infrastructure/modules/logger';

async function main() {
  const app = express();

  await baseLoader(app);

  const server = app
    .listen(env.PORT, () => {
      logger.info(`
        ######################################
        🛡️  Server listening on port: ${env.PORT} 🛡️
        ######################################
      `);
    })
    .on('error', (err) => {
      logger.fatal(err);
      process.exit(1);
    });

  process.on('unhandledRejection', (err) => {
    if (err instanceof Error) {
      logger.fatal(err, 'Unhandled Rejection');
    } else {
      logger.fatal('An unhandled rejection occurred, but the reason was not an Error object');
    }

    server.close(() => {
      logger.fatal('Server is closed due to an unhandled rejection');
      process.exit(1);
    });

    setTimeout(() => {
      logger.fatal('Forcefully exiting the process after 5 seconds of grace period due to an unhandled rejection');
      process.exit(1);
    }, 5000).unref();
  });

  process.on('uncaughtException', (err) => {
    logger.fatal(err, 'Uncaught Exception:');

    server.close(() => {
      logger.fatal('Server is closed due to an uncaught exception');
      process.exit(1);
    });

    setTimeout(() => {
      logger.fatal('Forcefully exiting the process after 5 seconds of grace period due to an uncaught exception');
      process.exit(1);
    }, 5000).unref();
  });
}

main();
