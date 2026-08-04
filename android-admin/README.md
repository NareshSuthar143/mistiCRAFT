# mistiCRAFT Admin — Android

A native Android companion to `admin.html`: full store management
(orders, products, artisans, leadership, settings) plus one thing the
web admin can't do — reading your phone's Google Pay (or PhonePe/Paytm)
payment notifications to auto-match and auto-accept orders.

It talks to the **same Supabase project** as the rest of mistiCRAFT.
There are no new tables, columns, or backend changes — see `schema.sql`
at the repo root for the tables this app reads/writes
(`customer_orders`, `products`, `artisans`, `founders`, `settings`,
`admins`).

## Building from a phone only (no PC needed)

Push a commit touching this folder (or trigger it manually), then on
GitHub.com — works fine from a phone browser — go to **Actions** on
this repo, open the *Android build* workflow run, and download the
`misticraft-admin-debug-apk` artifact from the **Artifacts** section
at the bottom of the run page. It downloads as a `.zip` (GitHub always
zips artifacts) containing `app-debug.apk` — extract it and open the
APK to install (you'll need to allow "install unknown apps" for your
browser or file manager the first time).

This also gives you a **real** compiled build — unlike the code in
this folder itself, `.github/workflows/android-build.yml` runs on a
GitHub-hosted runner with an actual Android SDK and full internet
access, so if something doesn't compile, the workflow log tells you
exactly what and where.

One thing to know: the APK built this way has whatever's currently in
`SupabaseConfig.kt` baked in. If that's still the placeholder values,
the app installs and runs but can't talk to Supabase — edit
`SupabaseConfig.kt` with your real project URL/anon key, push, and
download the next build.

## Before you build (in Android Studio): read this

This project was written without access to an Android SDK, emulator,
or the ability to run Gradle in the environment that generated it (that
environment's network policy blocks Google's Maven / Maven Central —
the exact hosts Gradle needs). Every file here was written carefully
and deliberately by hand, matching the supabase-kt 2.x API shape as
documented, but **it has not been compiled**. Treat first build in
Android Studio as the real first test, and expect to possibly fix small
things:

- **Library API drift.** `io.github.jan-tennert.supabase` (supabase-kt)
  evolves between versions. If a call doesn't resolve, check the
  version installed (`app/build.gradle.kts`, `supabaseVersion`) against
  [supabase-kt's docs](https://supabase.com/docs/reference/kotlin/introduction)
  for that exact release — Android Studio's quick-fix/autocomplete will
  usually point you straight to the right rename.
- **Gradle wrapper jar.** `gradle/wrapper/gradle-wrapper.properties` is
  here (pins Gradle 8.7), but the binary `gradle-wrapper.jar` isn't —
  Android Studio regenerates it automatically on first open (or run
  `gradle wrapper` once if you have a local Gradle install).
- **Compose/Kotlin compiler version pairing.** If Android Studio flags
  a Compose compiler mismatch, check the
  [compatibility map](https://developer.android.com/jetpack/androidx/releases/compose-kotlin)
  for the Kotlin version in `build.gradle.kts` and adjust
  `composeOptions.kotlinCompilerExtensionVersion` in `app/build.gradle.kts`
  to match.

## Setup

1. **Open** the `android-admin/` folder as a project in Android Studio
   (Hedgehog/2023.1+ recommended). Let it sync — this is what will
   surface any of the drift above.
2. **Supabase credentials** — edit
   `app/src/main/java/com/misticraft/admin/config/SupabaseConfig.kt`
   and paste your project's real URL + anon key (Supabase Dashboard >
   Project Settings > API), same values already in the web app's
   `supabase-init.js`. The anon key is meant to be public; access
   control comes from the RLS policies in `schema.sql`, not secrecy.
3. **Admin account** — sign in with an account that's already in the
   `admins` table (see the repo root `SETUP-SUPABASE.md`). Anyone can
   authenticate, but only allowlisted accounts get past the login
   screen — same gate as `admin.html`.
4. **Build & run** on a real device, not just an emulator — emulators
   don't have Google Play Services / a real Google Pay app installed,
   so they can't generate real payment notifications to test against.

## Granting notification access

Open **More > Payment Alerts** in the app. Android requires the user
to manually flip on "Notification access" for this app in system
Settings — no app can grant this to itself. The screen deep-links you
straight to the right settings page and shows live granted/not-granted
status. It also offers to exempt the app from battery optimization,
which helps some phones (Xiaomi/MIUI, Samsung, etc.) keep the listener
alive in the background — this reduces but can't 100% eliminate the
risk of an aggressive OEM battery manager killing it; that's a platform
limitation, not something fixable in app code.

## How auto-accept works (and its real limits)

Google Pay's system notification is not a documented, stable API — it
typically shows something like "You paid ₹599 to mistiCRAFT" and does
**not** reliably carry your order's reference number. So:

- If the notification text happens to contain a 12-digit number that
  exactly matches an order's UTR (the same UTR customers already type
  into the checkout popup), that order auto-accepts immediately — a UTR
  match is a real, unique bank transaction id, so it's unambiguous by
  definition regardless of how many other orders are pending.
- Otherwise, if only an amount is found (e.g. "₹599"), the app looks
  for `Pending` orders with that exact total placed in the last 24
  hours. Exactly one match → auto-accept. Zero or more than one match
  → **it will not guess** — instead it posts a local notification
  asking you to confirm which order, and tapping it opens the Orders
  screen pre-filtered to that amount.

This is a genuine, honest limitation of matching a generic OS
notification to your order data — not a bug. Treat auto-accept as a
convenience on top of the UTR/manual-review workflow already in
`admin.html`, not a replacement for spot-checking.

## Testing the real flow

1. Build a debug APK, install on a physical phone with Google Pay
   signed in, grant notification access (above).
2. Place a real order through the storefront's checkout and pay the
   exact amount shown via UPI.
3. Watch for either the "Order auto-accepted" notification (single
   match) or the "Payment detected — tap to confirm" one (ambiguous —
   e.g. you have more than one other Pending order at the same
   amount). Confirm the order's status actually flips to Processing
   either way.

## What's intentionally not here

- No offline cache/local database — same as `admin.html`, this is an
  online-only client against Supabase.
- No push-notifications-when-app-is-fully-closed. The notification
  listener works as long as Android hasn't killed the app process
  (helped by the battery-optimization exemption above); true
  push-when-closed would need a separate service-worker-equivalent —
  a server-side push trigger — which is out of scope here.
