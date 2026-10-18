# TradePilot iOS build and TestFlight setup

This repository now includes a manual GitHub Actions workflow at `.github/workflows/tradepilot-ios-build.yml`. It runs type checks and tests before asking EAS to build. It does not deploy the database or change existing Raka Gems records.

## One-time prerequisites

1. An Expo account and an Expo EAS project for the app.
2. An Apple Developer Program membership for the registered company, with access to App Store Connect.
3. The bundle identifier `com.rakagems.tradepilotai` must be available and registered to the correct Apple team.
4. The app must be configured with its real EAS `projectId` in `app.json` before EAS can reliably build it from clean GitHub runners. Do not invent a project ID.
5. The Expo project and Apple team must be owned/managed by the company account that will publish TradePilot AI.

## GitHub Actions secrets

Open the repository's **Settings → Secrets and variables → Actions → New repository secret**. Add secrets directly in GitHub; never paste credentials into chat, source files, issue comments, or commits.

Required for cloud builds:
- `EXPO_TOKEN`: an Expo access token created from the Expo account that owns the EAS project.

Required for automated TestFlight submission:
- `APPLE_ID`: the Apple account email authorised for App Store Connect.
- `ASC_APP_ID`: the numeric App Store Connect app ID for TradePilot AI, after the app record is created.
- `APPLE_TEAM_ID`: the Apple Developer Team ID for the company.
- `EXPO_APPLE_APP_SPECIFIC_PASSWORD`: an app-specific password for the Apple ID if using Apple ID authentication.

Keep all credentials private and rotate them if exposed. For a company release, an App Store Connect API key can be preferable to Apple ID/password automation; if switching to API-key auth, update the workflow and EAS submit configuration rather than storing the private key in Git.

## Build workflow

1. Open **Actions → TradePilot iOS build**.
2. Choose **Run workflow** and select `preview` first.
3. Confirm a successful EAS build and test it on a physical iPhone.
4. Only after preview succeeds, create the TradePilot AI app record in App Store Connect and configure the real EAS project ID and Apple identifiers.
5. Run the workflow with `testflight`; EAS builds and submits the app. Wait for Apple's processing, then add internal testers in App Store Connect → TestFlight.

## Important status and safety

- A GitHub TypeScript/Expo check is not an iOS binary build.
- The app's current transaction and Value Addition forms are previews; they do not persist data. Do not use this build as the live financial ledger.
- The new multi-business database schema remains unvalidated and unapplied to production.
- Do not place Supabase service-role keys in the iOS app or public repository.
- Apple may require additional account verification and App Store Connect setup before allowing a build to be processed or distributed.
