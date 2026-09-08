import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

/**
 * Connect with bounded retries and linear backoff.
 *
 * On a rebooting server the app often starts before the network stack is ready.
 * Exiting on the first failure would leave pm2 restart-looping against a condition
 * that resolves itself a few seconds later.
 */
export async function connectDB({ retries = 5, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log(`[db] connected — database "${mongoose.connection.name}"`);
      return mongoose.connection;
    } catch (err) {
      const isLastAttempt = attempt === retries;
      console.error(`[db] attempt ${attempt}/${retries} failed: ${err.message}`);

      if (isLastAttempt) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

export async function disconnectDB() {
  await mongoose.connection.close();
  console.log('[db] connection closed');
}

/** 1 === connected, per Mongoose's readyState enum. */
export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));
mongoose.connection.on('error', (err) => console.error(`[db] error: ${err.message}`));
