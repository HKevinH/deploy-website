import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { ApiKey } from './entities/api-key.entity';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';

export interface GithubRepository {
  id: number;
  fullName: string;
  cloneUrl: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
}

export interface RepoDetection {
  type: 'dockerfile' | 'nextjs' | 'nestjs' | 'node' | 'turbo' | 'static' | 'unknown';
  label: string;
  dockerfilePath: string;
  dockerContext: string;
  port: number;
  notes: string[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(ApiKey) private readonly apiKeysRepo: Repository<ApiKey>,
    private readonly crypto: CryptoService,
  ) {}

  async create(email: string, password: string): Promise<User> {
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.usersRepo.create({ email, passwordHash });
    return this.usersRepo.save(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }): Promise<User> {
    const user = await this.findById(userId);
    user.name = data.name?.trim() || null;
    user.avatarUrl = data.avatarUrl?.trim() || null;
    return this.usersRepo.save(user);
  }

  async updateGithubToken(userId: string, token: string, username: string): Promise<void> {
    const encryptedToken = this.crypto.encrypt(token);
    await this.usersRepo.update(userId, {
      githubToken: encryptedToken,
      githubUsername: username,
    });
  }

  async connectGithub(userId: string, token: string): Promise<{ provider: 'github'; username: string; connected: true }> {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'paas-platform',
      },
    });

    if (!res.ok) {
      throw new BadRequestException('Invalid GitHub token');
    }

    const profile = await res.json() as { login?: string; avatar_url?: string };
    if (!profile.login) throw new BadRequestException('GitHub token did not return a username');

    const encryptedToken = this.crypto.encrypt(token);
    await this.usersRepo.update(userId, {
      githubToken: encryptedToken,
      githubUsername: profile.login,
      avatarUrl: profile.avatar_url ?? null,
    });

    return { provider: 'github', username: profile.login, connected: true };
  }

  async connectGithubOAuth(userId: string, code: string): Promise<{ provider: 'github'; username: string; connected: true }> {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException('GitHub OAuth is not configured');
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'paas-platform',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenPayload = await tokenResponse.json() as { access_token?: string; error_description?: string };
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw new BadRequestException(tokenPayload.error_description ?? 'GitHub authorization failed');
    }

    return this.connectGithub(userId, tokenPayload.access_token);
  }

  async listGitConnections(userId: string): Promise<Array<{ id: string; provider: 'github'; username: string; avatarUrl: string | null }>> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'githubUsername', 'avatarUrl'],
    });

    if (!user?.githubUsername) return [];

    return [{
      id: 'github',
      provider: 'github',
      username: user.githubUsername,
      avatarUrl: user.avatarUrl,
    }];
  }

  async disconnectGithub(userId: string): Promise<void> {
    await this.usersRepo.update(userId, {
      githubToken: null,
      githubUsername: null,
      avatarUrl: null,
    });
  }

  async listGithubRepositories(userId: string): Promise<GithubRepository[]> {
    const token = await this.getDecryptedGithubToken(userId);
    if (!token) throw new BadRequestException('GitHub is not connected');

    const repos: GithubRepository[] = [];
    let page = 1;

    while (page <= 5) {
      const res = await fetch(
        `https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'paas-platform',
          },
        },
      );

      if (!res.ok) {
        throw new BadRequestException('Could not load GitHub repositories');
      }

      const batch = await res.json() as Array<{
        id: number;
        full_name: string;
        clone_url: string;
        private: boolean;
        default_branch: string;
        updated_at: string;
      }>;

      repos.push(...batch.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        cloneUrl: repo.clone_url,
        private: repo.private,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
      })));

      if (batch.length < 100) break;
      page += 1;
    }

    return repos;
  }

  async detectGithubRepository(userId: string, repoFullName: string): Promise<RepoDetection> {
    const token = await this.getDecryptedGithubToken(userId);
    if (!token) throw new BadRequestException('GitHub is not connected');

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'paas-platform',
    };

    const rootRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents`, { headers });
    if (!rootRes.ok) throw new BadRequestException('Could not inspect repository');

    const rootFiles = await rootRes.json() as Array<{ name: string; type: string }>;
    const names = new Set(rootFiles.map((item) => item.name));
    const notes: string[] = [];

    if (names.has('Dockerfile')) {
      notes.push('Dockerfile found at repository root.');
      return { type: 'dockerfile', label: 'Dockerfile', dockerfilePath: 'Dockerfile', dockerContext: '.', port: 3000, notes };
    }

    const pkg = await this.fetchGithubJson<{ scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; workspaces?: unknown }>(
      `https://api.github.com/repos/${repoFullName}/contents/package.json`,
      headers,
    );
    const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
    const scripts = pkg?.scripts ?? {};
    const hasTurbo = names.has('turbo.json') || Boolean(deps.turbo);

    if (hasTurbo) {
      notes.push('Turbo monorepo detected.');
      return { type: 'turbo', label: 'Turbo monorepo', dockerfilePath: 'Dockerfile', dockerContext: '.', port: 3000, notes };
    }

    if (deps.next) {
      notes.push('Next.js dependency detected.');
      return { type: 'nextjs', label: 'Next.js app', dockerfilePath: 'Dockerfile', dockerContext: '.', port: 3000, notes };
    }

    if (deps['@nestjs/core']) {
      notes.push('NestJS dependency detected.');
      return { type: 'nestjs', label: 'NestJS API', dockerfilePath: 'Dockerfile', dockerContext: '.', port: 3000, notes };
    }

    if (pkg) {
      notes.push(scripts.start ? 'Node start script detected.' : 'package.json detected.');
      return { type: 'node', label: 'Node.js app', dockerfilePath: 'Dockerfile', dockerContext: '.', port: 3000, notes };
    }

    if (names.has('index.html')) {
      notes.push('Static HTML detected.');
      return { type: 'static', label: 'Static site', dockerfilePath: 'Dockerfile', dockerContext: '.', port: 80, notes };
    }

    return {
      type: 'unknown',
      label: 'Custom Dockerfile',
      dockerfilePath: 'Dockerfile',
      dockerContext: '.',
      port: 3000,
      notes: ['No framework preset detected.'],
    };
  }

  private async fetchGithubJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
    const res = await fetch(url, { headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new BadRequestException('Could not inspect repository files');

    const payload = await res.json() as { content?: string; encoding?: string };
    if (!payload.content || payload.encoding !== 'base64') return null;

    return JSON.parse(Buffer.from(payload.content, 'base64').toString('utf8')) as T;
  }

  async getDecryptedGithubToken(userId: string): Promise<string | null> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'githubToken'],
    });
    if (!user?.githubToken) return null;
    return this.crypto.decrypt(user.githubToken);
  }

  // ─── API Keys ─────────────────────────────────────────────────────────────

  async createApiKey(userId: string, name: string): Promise<{ key: string; record: ApiKey }> {
    const rawKey = this.crypto.generateApiKey();
    const keyHash = this.crypto.hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    const record = this.apiKeysRepo.create({
      userId,
      name,
      keyHash,
      keyPrefix,
    });

    await this.apiKeysRepo.save(record);
    return { key: rawKey, record };
  }

  async findByApiKey(rawKey: string): Promise<User | null> {
    const keyHash = this.crypto.hashApiKey(rawKey);
    const apiKey = await this.apiKeysRepo.findOne({
      where: { keyHash },
      relations: ['user'],
    });

    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    await this.apiKeysRepo.update(apiKey.id, { lastUsedAt: new Date() });
    return apiKey.user;
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeysRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    await this.apiKeysRepo.delete({ id: keyId, userId });
  }
}
