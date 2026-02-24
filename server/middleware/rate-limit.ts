import rateLimit from "express-rate-limit";

const standardHeaders = true;
const legacyHeaders = false;

const RATE_LIMIT_MESSAGE = { message: "Too many requests. Please try again later." };

/** Login: 10 requests per minute per IP */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders,
  legacyHeaders,
  message: RATE_LIMIT_MESSAGE,
});

/** Forgot & reset password: 5 requests per minute per IP */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders,
  legacyHeaders,
  message: RATE_LIMIT_MESSAGE,
});
