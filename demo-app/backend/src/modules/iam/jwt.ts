import jwt from "jsonwebtoken";
import { JwtPayload, DEFAULT_AUTH_POLICY } from "./types";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${DEFAULT_AUTH_POLICY.sessionDurationMinutes}m`,
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
