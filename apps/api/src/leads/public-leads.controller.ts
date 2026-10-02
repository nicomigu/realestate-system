import { Body, Controller, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type LeadForm, type LeadFormResponse, LeadFormSchema } from '@realestate-system/shared';
import type { Response } from 'express';
import { Public } from '../auth/auth.decorators.js';
import { ChatTokenService } from '../chat/chat-token.service.js';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { LeadIntakeService } from './lead-intake.service.js';
import { leadSourceFromUtm } from './normalize.js';

@ApiTags('leads')
@Public()
@Controller('public/leads')
@UseGuards(PublicRateLimitGuard)
export class PublicLeadsController {
  constructor(
    private readonly intake: LeadIntakeService,
    private readonly chatTokens: ChatTokenService,
  ) {}

  /** The website's "Find your dream home" form. 201 for a new Lead, 200 for a returning person. */
  @Post()
  async submit(
    @Body(new ZodValidationPipe(LeadFormSchema)) form: LeadForm,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LeadFormResponse> {
    const { leadId, created } = await this.intake.intake({
      name: form.name,
      email: form.email,
      phone: form.phone,
      source: leadSourceFromUtm(form.utmSource),
      details: { channel: 'website-form', utmSource: form.utmSource ?? null },
    });
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return { leadId, chatToken: this.chatTokens.issueFromNow(leadId) };
  }
}
