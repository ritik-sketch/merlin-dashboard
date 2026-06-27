const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: (process.env.BASE_URL || "http://localhost:3000") + "/auth/google/callback"
}, function (accessToken, refreshToken, profile, done) {
  const email = profile.emails[0].value;
  if (email.endsWith("@company.com")) {
    return done(null, profile);
  } else {
    return done(null, false, { message: "Only @company.com allowed" });
  }
}));

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

module.exports = passport;
