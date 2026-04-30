import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private readonly buildsBucket: string;

  constructor(private readonly config: ConfigService) {
    this.buildsBucket = config.get('MINIO_BUCKET_BUILDS', 'paas-build-logs');
  }

  async onModuleInit() {
    this.client = new Minio.Client({
      endPoint: this.config.getOrThrow('MINIO_ENDPOINT'),
      port: Number(this.config.get('MINIO_PORT', '9000')),
      useSSL: this.config.get('MINIO_USE_SSL') === 'true',
      accessKey: this.config.getOrThrow('MINIO_ACCESS_KEY'),
      secretKey: this.config.getOrThrow('MINIO_SECRET_KEY'),
    });

    await this.ensureBucket(this.buildsBucket);
  }

  async uploadBuildLog(buildId: string, content: string): Promise<string> {
    const objectName = `builds/${buildId}/build.log`;
    const buffer = Buffer.from(content, 'utf8');

    await this.client.putObject(this.buildsBucket, objectName, buffer, buffer.length, {
      'Content-Type': 'text/plain',
    });

    return objectName;
  }

  async getBuildLog(buildId: string): Promise<string> {
    const objectName = `builds/${buildId}/build.log`;
    const stream = await this.client.getObject(this.buildsBucket, objectName);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
  }

  async getPresignedUrl(objectName: string, expiry = 3600): Promise<string> {
    return this.client.presignedGetObject(this.buildsBucket, objectName, expiry);
  }

  private async ensureBucket(name: string): Promise<void> {
    const exists = await this.client.bucketExists(name);
    if (!exists) {
      await this.client.makeBucket(name);
      this.logger.log(`Created bucket: ${name}`);
    }
  }
}
