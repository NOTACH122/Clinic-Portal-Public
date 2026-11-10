import "server-only";
import { randomInt } from "crypto";

const CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";

const PASSWORD_LENGTH = 6;

export function generatePassword(): string {
  let password = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    password += CHARS[randomInt(0, CHARS.length)];
  }
  return password;
}
