import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../shared/errors/index.js";
import { UserModel } from "./User.model.js";
import { TenantMemberModel } from "../tenants/TenantMember.model.js";
import { TenantMemberRole } from "@automation-hub/shared";

// ─── Password helpers ─────────────────────────────────────────────────────────

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 64 };
const SALT_BYTES = 16;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, SCRYPT_PARAMS.dkLen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    })
    .toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto
    .scryptSync(password, salt, SCRYPT_PARAMS.dkLen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    })
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

// ─── Auth service ─────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  tenantId: string;
  role: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  role?: string;
  tenantId?: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await UserModel.findOne({ email: input.email }).lean();
    if (existing) {
      throw new Error("User already exists");
    }

    const userId = randomUUID();
    const tenantId = input.tenantId ?? randomUUID();
    const role = input.role ?? TenantMemberRole.OWNER;
    const passwordHash = hashPassword(input.password);

    await UserModel.create({ userId, email: input.email, passwordHash, tenantId, role });

    await TenantMemberModel.create({
      tenantId,
      userId,
      email: input.email,
      role,
    });

    const token = jwt.sign({ userId, email: input.email }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    return { token, tenantId, role };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await UserModel.findOne({ email }).lean();
    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const token = jwt.sign(
      { userId: user.userId, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
    );

    return { token, tenantId: user.tenantId, role: user.role };
  }
}
