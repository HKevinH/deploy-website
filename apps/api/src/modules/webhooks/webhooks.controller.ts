import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github/:serviceId')
  @Public()
  @ApiOperation({ summary: 'GitHub push webhook receiver' })
  async handleGitHub(
    @Param('serviceId') serviceId: string,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: any,
  ) {
    if (!signature) throw new BadRequestException('Missing signature header');

    const rawBody = req.rawBody?.toString() ?? JSON.stringify(payload);
    const valid = this.webhooksService.verifyGithubSignature(rawBody, signature);
    if (!valid) throw new BadRequestException('Invalid webhook signature');

    if (event === 'push') {
      return this.webhooksService.handlePush(serviceId, payload);
    }

    if (event === 'ping') {
      return { ok: true };
    }

    return { ignored: true, event };
  }
}
