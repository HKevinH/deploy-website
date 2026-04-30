import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { LoginDto, RegisterDto, CreateApiKeyDto, ConnectGithubDto, GithubOAuthCallbackDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Create a new account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login and get JWT token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  me(@CurrentUser() user: User) {
    return user;
  }

  @Get('api-keys')
  @ApiBearerAuth()
  listApiKeys(@CurrentUser() user: User) {
    return this.usersService.listApiKeys(user.id);
  }

  @Post('api-keys')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new API key (shown once)' })
  async createApiKey(@CurrentUser() user: User, @Body() dto: CreateApiKeyDto) {
    const { key, record } = await this.usersService.createApiKey(user.id, dto.name);
    return { key, id: record.id, name: record.name, createdAt: record.createdAt };
  }

  @Delete('api-keys/:id')
  @ApiBearerAuth()
  revokeApiKey(@CurrentUser() user: User, @Param('id') id: string) {
    return this.usersService.revokeApiKey(user.id, id);
  }

  @Get('git-connections')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List connected Git accounts' })
  listGitConnections(@CurrentUser() user: User) {
    return this.usersService.listGitConnections(user.id);
  }

  @Post('git-connections/github')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect a GitHub account using a personal access token' })
  connectGithub(@CurrentUser() user: User, @Body() dto: ConnectGithubDto) {
    return this.usersService.connectGithub(user.id, dto.token);
  }

  @Get('git-connections/github/start')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start GitHub OAuth connection flow' })
  startGithubOAuth() {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const redirectUri = process.env.GITHUB_OAUTH_CALLBACK_URL ?? 'http://localhost:3001/git/callback';

    if (!clientId) {
      return { configured: false, authorizationUrl: null };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo read:user user:email',
    });

    return {
      configured: true,
      authorizationUrl: `https://github.com/login/oauth/authorize?${params.toString()}`,
    };
  }

  @Post('git-connections/github/callback')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete GitHub OAuth connection flow' })
  completeGithubOAuth(@CurrentUser() user: User, @Body() dto: GithubOAuthCallbackDto) {
    return this.usersService.connectGithubOAuth(user.id, dto.code);
  }

  @Get('git-connections/github/repos')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List repositories available through the connected GitHub account' })
  listGithubRepositories(@CurrentUser() user: User) {
    return this.usersService.listGithubRepositories(user.id);
  }

  @Get('git-connections/github/repos/:owner/:repo/detect')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detect build settings for a GitHub repository' })
  detectGithubRepository(
    @CurrentUser() user: User,
    @Param('owner') owner: string,
    @Param('repo') repo: string,
  ) {
    return this.usersService.detectGithubRepository(user.id, `${owner}/${repo}`);
  }

  @Delete('git-connections/github')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect the GitHub account' })
  disconnectGithub(@CurrentUser() user: User) {
    return this.usersService.disconnectGithub(user.id);
  }
}
