const express = require("express");
const path = require("path");
const connectDB = require("./db");
const Bug = require("./models/Bug");
const importRollbar = require("./importRollbar");
const importPosthog = require("./importPosthog");
const session = require("express-session");
const passport = require("./auth");
const MongoStore = require("connect-mongo").default;

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));
app.use(passport.initialize());
app.use(passport.session());
function ensureLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}


connectDB();
async function runAllImports() {
  console.log("--- Auto-import shuru:", new Date().toLocaleTimeString(), "---");
  try {
    await importRollbar();
  } catch (e) {
    console.log("Rollbar import fail:", e.message);
  }
  try {
    await importPosthog();
  } catch (e) {
    console.log("PostHog import fail:", e.message);
  }
  console.log("--- Auto-import khatm ---");
}
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect("/login");
  });
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});
app.get("/api/import", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    await runAllImports();
    res.json({ ok: true, message: "Import complete" });
  } catch (error) {
    res.json({ error: error.message });
  }
});
app.use(ensureLoggedIn, express.static(__dirname));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.use("/api", ensureLoggedIn);

app.get("/api/bugs", async (req, res) => {
  try {
    const bugs = await Bug.find();
    res.json(bugs);
  } catch (error) {
    res.json({ error: error.message });
  }
});
app.post("/api/bugs", async (req, res) => {
  try {
    const data = req.body;

    const bug = await Bug.findOneAndUpdate(
      { endpoint: data.endpoint, message: data.message },
      {
        $set: {
          source: data.source,
          priority: data.priority,
          account: data.account
        },
        $inc: { count: 1 },
        $setOnInsert: { status: "New", createdAt: new Date() }
      },
      { upsert: true, returnDocument: "after" }
    );

    res.json(bug);
  } catch (error) {
    res.json({ error: error.message });
  }
});
app.patch("/api/bugs/:id", async (req, res) => {
  try {
    const updateData = { status: req.body.status };
    if (req.body.status === "Done") {
      updateData.resolvedAt = new Date();
    } else {
      updateData.resolvedAt = null;
    }
    const bug = await Bug.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { returnDocument: "after" }
    );

    res.json(bug);
  } catch (error) {
    res.json({ error: error.message });
  }
});
app.patch("/api/bugs/:id/archive", async (req, res) => {
  try {
    const bug = await Bug.findByIdAndUpdate(
      req.params.id,
      { $set: { archived: req.body.archived } },
      { returnDocument: "after" }
    );
    res.json(bug);
  } catch (error) {
    res.json({ error: error.message });
  }
});
app.delete("/api/bugs/:id", async (req, res) => {
  try {
    await Bug.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.patch("/api/bugs/:id/notes", async (req, res) => {
  try {
    const bug = await Bug.findByIdAndUpdate(
      req.params.id,
      { $set: { notes: req.body.notes } },
      { returnDocument: "after" }
    );
    res.json(bug);
  } catch (error) {
    res.json({ error: error.message });
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server ready: http://localhost:3000");

  runAllImports();

  
});
module.exports = app;