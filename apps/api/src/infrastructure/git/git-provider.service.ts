import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export interface CloneOptions {
  url: string;
  branch: string;
  commitSha?: string;
  accessToken?: string;
}

export interface RepoCommit {
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
}

@Injectable()
export class GitProviderService {
  private readonly logger = new Logger(GitProviderService.name);

  constructor(private readonly config: ConfigService) {}

  async clone(options: CloneOptions): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paas-build-'));

    // Inject token into URL for auth (HTTPS only)
    const cloneUrl = options.accessToken
      ? this.injectToken(options.url, options.accessToken)
      : options.url;

    this.logger.log(`Cloning ${options.url} branch=${options.branch} into ${tempDir}`);

    const git: SimpleGit = simpleGit();
    await git.clone(cloneUrl, tempDir, [
      '--branch', options.branch,
      '--single-branch',
      '--depth', '50',
    ]);

    if (options.commitSha) {
      const repoGit = simpleGit(tempDir);
      await repoGit.checkout(options.commitSha);
    }

    return tempDir;
  }

  async getLatestCommit(repoDir: string): Promise<RepoCommit> {
    const git = simpleGit(repoDir);
    const log = await git.log({ maxCount: 1 });
    const latest = log.latest!;

    return {
      sha: latest.hash,
      message: latest.message,
      author: latest.author_name,
      authorEmail: latest.author_email,
      date: latest.date,
    };
  }

  async cleanup(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      this.logger.warn(`Failed to cleanup temp dir: ${dir}`);
    }
  }

  validateWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const secret = this.config.getOrThrow<string>('GITHUB_WEBHOOK_SECRET');
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  private injectToken(url: string, token: string): string {
    const parsed = new URL(url);
    parsed.username = 'x-access-token';
    parsed.password = token;
    return parsed.toString();
  }
}
