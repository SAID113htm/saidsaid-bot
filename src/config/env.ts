import dotenv from 'dotenv';
dotenv.config();

export const config = {
  bot: {
    token: process.env.BOT_TOKEN || '',
  },
  twelveData: {
    apiKey: process.env.TWELVE_DATA_API_KEY || '',
  },
};