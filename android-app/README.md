# RRPoker Android app

A thin Capacitor wrapper around https://rrpoker.vercel.app, mirroring
`../ios-app`. It has no bundled web assets of its own — `capacitor.config.ts`
points the WebView straight at the production site (`server.url`), so
shipping a new build of the Next.js app to Vercel updates what users see
without needing a new Play Store release.

## Building

Building a signed `.aab` requires the Android SDK, which this repo does not
assume you have locally. Use the `Build Android AAB` GitHub Actions workflow
instead — it builds the whole thing on GitHub's servers:

1. Add the four signing secrets described in [`SIGNING.md`](./SIGNING.md).
2. Run the workflow from the "Actions" tab (or push a change under
   `android-app/`).
3. Download the `rrpoker-release-aab` artifact from the completed run.
4. Upload that `.aab` to the Google Play Console.

If you do have the Android SDK installed locally, the usual Capacitor
workflow also works: `npm install`, `npx cap sync android`, then open
`android/` in Android Studio or run `./gradlew bundleRelease` from `android/`.
