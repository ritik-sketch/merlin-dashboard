# Merlin Bug & Error Dashboard

A self-hosted dashboard that brings production errors from multiple monitoring tools into one place, removes duplicates, sorts them by priority, and lets a QA/engineering team track each error through its lifecycle. Built to replace the manual work of checking each error source separately and scrolling through noisy alert channels.

**Live demo:** https://your-demo-link.vercel.app
*(Login is restricted to a single company domain. For the demo, the dashboard is loaded with sample/fake data.)*

---

## The Problem

In most teams, production errors are scattered and noisy:

- System and backend errors live in one tool (e.g. Rollbar), frontend network errors in another (e.g. PostHog).
- The same alerts also flood a Slack channel as an endless stream, the same error can appear hundreds of times, pushing everything else out of view.
- There is no single place that answers: what is breaking right now, how often, how serious, and is anyone already working on it?

Slack shows errors as they happen, but it does not manage them. There is no deduplication, no priority view, no status, no history.

## The Solution

This dashboard turns that noise into signal. It pulls errors from every source, deduplicates them, ranks them by priority, and tracks each one as a lightweight ticket, so the team has one screen that always shows the current state of production health.

## Features

- Pulls errors automatically from multiple sources (currently Rollbar and PostHog)
- Deduplication: the same error reported many times shows as one entry with a count, not hundreds of rows
- Priority sorting: P0 critical errors on top
- Status / ticket lifecycle: mark each error New, In progress, or Done; add notes (Working on it, Known issue, Cannot reproduce, Need more info); archive resolved ones
- Google OAuth login: access restricted to a single company domain, so only team members can open the dashboard
- Auto-imports new errors on a schedule (no manual pulling)
- Auto-refreshes the dashboard every 30 seconds, with a last-updated time shown
- Filter by source, status, and priority
- Charts for errors by source and errors by priority
- Click any error to see full details: endpoint, method, page, browser, count, dates
- Download filtered results as CSV

## Screenshots

Add screenshots here, for example the login screen, the main dashboard with charts, and an error detail view.

## Tech Stack

- Backend: Node.js, Express
- Database: MongoDB (Atlas), Mongoose
- Auth: Passport.js with Google OAuth 2.0, session storage in MongoDB (connect-mongo)
- Frontend: HTML, CSS, vanilla JavaScript (single page), Chart.js for charts
- Data sources: Rollbar API, PostHog API
- Deployment: Vercel (serverless), with a secured import endpoint for scheduled error pulls

## How Deduplication Works

Each error gets a unique signature. When an error comes in:

- If the signature already exists in the database, the existing entry is updated (count and last-seen time).
- If it is new, a new entry is created.

This is done with a single database operation (findOneAndUpdate with upsert), so running the import again never creates duplicates.

A key learning here: every source gives data differently. Rollbar gives summarized items (one error with a total count). PostHog gives raw events (one record per occurrence), so those have to be grouped and counted manually before saving. The real challenge was not fetching the data, it was giving different-shaped data one consistent format.

## How Auth Works

Login uses Google OAuth via Passport.js. The strategy only allows email addresses ending in the configured company domain, anyone else is rejected even with a valid Google account. Sessions are stored in MongoDB so they survive server restarts, and every page and API route is protected behind the login check. The scheduled import endpoint is the one exception: it is protected by a secret token instead of a login, so an external scheduler can trigger it.

## Project Structure

- server.js: Express server, API routes, auth middleware, import endpoint
- auth.js: Passport Google OAuth strategy (domain restriction)
- db.js: MongoDB connection
- models/Bug.js: the Bug schema (endpoint, message, source, priority, count, status, ticket fields, notes, and more)
- importRollbar.js: fetches and maps Rollbar errors
- importPosthog.js: fetches, groups, and maps PostHog events
- seed.js: loads sample/fake data for the demo
- index.html / login.html: the dashboard UI and login page

## Setup

1. Install dependencies:

   npm install

2. Create a .env file in the root with these keys (use your own values). The .env file is gitignored and never committed:

   MONGO_URI=your-mongodb-connection-string
   SESSION_SECRET=any-long-random-string
   GOOGLE_CLIENT_ID=your-google-oauth-client-id
   GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
   ROLLBAR_TOKEN=your-rollbar-token
   POSTHOG_KEY=your-posthog-key
   POSTHOG_PROJECT_ID=your-posthog-project
   CRON_SECRET=any-long-random-string

3. Load demo data (sample errors, so the dashboard is not empty):

   npm run seed

4. Start the server:

   npm start

5. Open http://localhost:3000 and sign in with a Google account on the allowed domain.

## A Note on Sources

DevRev was also evaluated as a source. On inspection, its data turned out to be customer-support tickets (appointments, order confirmations, customer queries) rather than technical errors, so it was deliberately left out. Putting non-error data into an error dashboard would reduce its usefulness. It can be revisited if DevRev starts holding actual engineering issues, or if a reliable way to filter error-tickets is added.

## Roadmap

- Merge the same error appearing across multiple sources into one entry (source as a list)
- Show newest errors more prominently (sort or highlight by recency)
- Backend pagination and database indexing for scale, as error volume grows
- Alerts to notify on new P0 errors
- Deeper ticket lifecycle: assignees, linked pull requests, and resolution timeline

---

Built as a QA/engineering tooling project. All data shown in the live demo is sample data.
