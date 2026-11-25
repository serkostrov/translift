import { z } from 'zod';

export const envSchema = z.object({
  API_PORT: z.coerce.number().default(3000),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5174'),
  /** На сервере за HTTPS — true */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Часовой пояс заказчика: от него считаются «сегодня», сроки и просрочки */
  APP_TIMEZONE: z.string().default('Europe/Moscow'),
  DATABASE_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;
