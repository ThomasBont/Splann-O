declare module "passport-google-oauth20" {
  import passport = require("passport");

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  }

  export class Strategy extends passport.Strategy {
    constructor(
      options: StrategyOptions,
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: passport.Profile & {
          emails?: Array<{ value?: string }>;
          photos?: Array<{ value?: string }>;
          displayName?: string;
          id: string;
        },
        done: passport.DoneCallback,
      ) => void | Promise<void>,
    );
    name: string;
  }
}
