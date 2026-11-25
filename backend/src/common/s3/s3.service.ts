import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

const URL_TTL_SECONDS = 15 * 60;

@Injectable()
export class S3Service {
  readonly bucket: string;
  private readonly client: S3Client;

  constructor(config: ConfigService<Env, true>) {
    this.bucket = config.get('S3_BUCKET');
    this.client = new S3Client({
      endpoint: config.get('S3_ENDPOINT'),
      region: config.get('S3_REGION'),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE'),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY'),
        secretAccessKey: config.get('S3_SECRET_KEY'),
      },
    });
  }

  /** Ссылка для загрузки файла напрямую из браузера. */
  uploadUrl(key: string, contentType: string) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: URL_TTL_SECONDS },
    );
  }

  /** Временная ссылка на просмотр файла. */
  downloadUrl(key: string, fileName?: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: fileName
          ? `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
          : undefined,
      }),
      { expiresIn: URL_TTL_SECONDS },
    );
  }

  async deleteMany(keys: string[]) {
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  async ping() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}
