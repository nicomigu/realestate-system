import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@realestate-system/shared';
import type { Request } from 'express';

/** Who made an authenticated request, taken from their verified token. */
export interface RequestUser {
  id: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
}

export const IS_PUBLIC = 'auth:isPublic';
export const ROLES = 'auth:roles';

/** Every route needs a signed-in user unless it's marked public. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Limits a route (or every route of a controller) to these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** The signed-in user, in a controller method: `me(@CurrentUser() user: RequestUser)`. */
export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
});
