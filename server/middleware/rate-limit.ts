import rateLimit from "express-rate-limit";

const standardHeaders = true;
const legacyHeaders = false;

/** Login: 10 requests per minute per IP */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders,
  legacyHeaders,
  message: { message: "Too many login attempts. Try again later." },
});

/** Forgot & reset password: 5 requests per minute per IP */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders,
  legacyHeaders,
  message: { message: "Too many requests. Try again later." },
});
