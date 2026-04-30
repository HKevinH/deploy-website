import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { ApiKey } from './entities/api-key.entity';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';

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
