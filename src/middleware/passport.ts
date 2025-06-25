import "dotenv/config";
import passport, { Profile } from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth2";
import UserAccount from "../models/UserAccount";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL:
        "https://nutrisight-backend.onrender.com/auth/google/callback",
      passReqToCallback: true,
    },
    async (
      _request: any,
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done: any
    ) => {
      try {
        // for debugging purposes, you can log the request and profile
        // console.log({
        //   request,
        //   accessToken,
        //   refreshToken,
        //   profile,
        // });
        let user = await UserAccount.findOne({ gmailId: profile.id });
        if (!user) {
          user = await UserAccount.create({
            gmailId: profile.id,
            name: profile?.displayName || undefined,
            isVerified: true,
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserAccount.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
