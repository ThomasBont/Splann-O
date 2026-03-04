import passport from "passport";
import { randomBytes } from "crypto";
import { userRepo } from "../repositories/userRepo";
import type { Profile as PassportProfile } from "passport";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

type SessionUser = {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileImageUrl: string | null;
  googleId: string | null;
};

declare global {
  namespace Express {
    interface User extends SessionUser {}
  }
}

function slugifyUsernameSeed(input: string): string {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return normalized || "user";
}

function randomSuffix(length = 4): string {
  return randomBytes(length).toString("hex").slice(0, length);
}

async function generateUniqueUsername(seed: string): Promise<string> {
  const base = slugifyUsernameSeed(seed);
  let candidate = base;
  let attempt = 0;

  while (attempt < 20) {
    const existing = await userRepo.findByUsername(candidate);
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${base}_${randomSuffix(4)}`.slice(0, 30);
  }

  return `user_${randomSuffix(8)}`;
}

export function configurePassport(): void {
  let GoogleStrategyCtor: typeof import("passport-google-oauth20").Strategy;
  try {
    GoogleStrategyCtor = require("passport-google-oauth20").Strategy as typeof import("passport-google-oauth20").Strategy;
  } catch {
    console.warn("[auth] passport-google-oauth20 not installed; Google OAuth disabled");
    return;
  }

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    return;
  }

  passport.use(
    new GoogleStrategyCtor(
      {
        clientID,
        clientSecret,
        callbackURL: "/api/auth/google/callback",
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: PassportProfile & {
          id: string;
          emails?: Array<{ value?: string }>;
          photos?: Array<{ value?: string }>;
          displayName?: string;
        },
        done: passport.DoneCallback,
      ) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) {
            return done(new Error("Google account has no email"));
          }

          const profileName = profile.displayName?.trim() || null;
          const emailPrefix = email.split("@")[0] || "user";
          const displayName = profileName || emailPrefix;
          const avatarUrl = profile.photos?.[0]?.value ?? null;

          const byGoogle = await userRepo.findByGoogleId(googleId);
          if (byGoogle) {
            return done(null, byGoogle as SessionUser);
          }

          const byEmail = await userRepo.findByEmail(email);
          if (byEmail) {
            const linked = await userRepo.linkGoogleId(byEmail.id, googleId);
            return done(null, (linked ?? byEmail) as SessionUser);
          }

          const username = await generateUniqueUsername(emailPrefix);
          const created = await userRepo.createUser({
            username,
            email,
            displayName,
            passwordHash: null,
            googleId,
            avatarUrl,
            profileImageUrl: avatarUrl,
          });

          return done(null, created as SessionUser);
        } catch (error) {
          return done(error as Error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await userRepo.findById(Number(id));
      done(null, user ?? false);
    } catch (error) {
      done(error as Error);
    }
  });
}

export default passport;
