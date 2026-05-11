# iOS Submission Guide

This template generates a fully customised Xcode project alongside the
Android one. Apple's submission process is **partially manual** — no
platform on Earth automates it 100% because Apple requires a human
reviewer for every release. Here's the realistic path.

## Why Android is auto + iOS is not

| Step | Android | iOS |
|------|---------|-----|
| Build the binary | ✅ auto via gradle on Linux CI | ❌ requires macOS + Xcode |
| Sign | ✅ shared keystore | ❌ unique signing identity per app |
| Upload | ✅ Play Console API | ⚠️ Transporter / API but needs cert |
| Review | 2-3 days, mostly automated | 1-7 days, human-reviewed |

So we ship the **ready-to-build Xcode project** in the ZIP and offer
two paths for the final mile.

## Path A — Vendor's own Apple Developer account (recommended)

Cost: $99/year, paid by the vendor.

1. Vendor signs up at developer.apple.com.
2. We email them the Xcode project ZIP.
3. They (or their developer) opens it in Xcode on a Mac.
4. Xcode → Signing & Capabilities → select their team.
5. Product → Archive → Distribute App → App Store Connect.
6. Submit for review.

Pros: vendor owns the App Store listing, can update independently.
Cons: needs macOS + 1-2 hours of attention.

## Path B — Concierge submission (paid add-on)

Cost: We charge an extra fee (recommended: 1,500-2,500 SAR) to handle
submission under the vendor's Apple Developer account (they invite us
as a team member). The vendor still owns the account.

1. Vendor creates the Apple Developer account ($99/year — they pay
   directly to Apple).
2. They invite our Apple ID as an Admin team member.
3. We open the Xcode project, sign with their team, submit.
4. We forward any reviewer questions to the vendor and resubmit.

Pros: no macOS needed by the vendor.
Cons: 5-10 days end-to-end depending on Apple's review queue.

## Path C — Shared "Jdawil Apps" account (NOT recommended)

Theoretically we could publish all vendor apps under one Jdawil
Apple Developer account. **Don't do this** because:

- Apple may reject apps that are "templated copies" of each other.
- The vendor doesn't own their App Store listing → bad for trust.
- One vendor abuse can cause Apple to revoke the entire account,
  taking down every vendor's app at once.

## EAS Build (cloud Mac alternative)

If you want to fully automate iOS builds without owning a Mac:
[Expo Application Services Build](https://expo.dev/eas) builds Xcode
projects on hosted macOS runners (~$99/month for unlimited builds).
Submission still requires the Apple Developer account, but the *build*
becomes one curl command.

Wire-up: replace the GitHub Actions iOS job with `eas build --platform ios`.
Out of scope for the initial product — add when iOS volume justifies it.
