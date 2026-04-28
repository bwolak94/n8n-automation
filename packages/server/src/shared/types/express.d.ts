import type { TenantMemberRole } from "@automation-hub/shared";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
      tenantId?: string;
      tenantRole?: TenantMemberRole;
    }
  }
}

export {};
