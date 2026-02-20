# PRD: CI/CD for Desktop Distributions (Windows MSI + macOS DMG) with Code Signing

## 1. Goal
Build branded desktop installers for distro `ISGuce` on branch `is/desktop-brending`:
- Windows installer: `.msi`
- macOS installer: `.dmg`

Additionally:
- Define a production-grade signing strategy
- Provide a fallback local-signing process if cloud signing is unavailable
- Define required GitHub Actions secrets/variables

## 2. Background and Constraints
- We already rebranded/localized desktop app.
- Existing upstream workflows build ZIP/Linux artifacts and use Block-specific signing infrastructure.
- For our distro we must minimize divergence from upstream behavior and only add the required distribution outputs.
- We should avoid hardcoding org-specific defaults in app runtime code; CI configuration should be done via GitHub secrets/variables.

## 3. In Scope
- GitHub Actions workflows for:
  - macOS DMG build
  - Windows MSI build
- Signing options:
  - Fully automated in GitHub Actions
  - Local signing fallback
- Release artifact publishing model
- Secret/variable inventory and environment model

## 4. Out of Scope
- Linux packaging (`.deb/.rpm/.flatpak`)
- App Store distribution
- Installer UX customization beyond required metadata
- Refactor of unrelated existing workflows

## 5. Target CI/CD Design

### 5.1 Workflows to Add/Keep
1. Reusable workflow `bundle-desktop-macos-dmg.yml`
- Trigger: `workflow_call` + optional `workflow_dispatch`
- Runner: `macos-latest`
- Outputs: `.dmg` artifact(s)
- Inputs:
  - `ref` (optional)
  - `version` (optional)
  - `signing` (bool)
  - `arch` (`arm64` default; optional matrix with `x64`)

2. Reusable workflow `bundle-desktop-windows-msi.yml`
- Trigger: `workflow_call` + optional `workflow_dispatch`
- Runner: `windows-latest`
- Outputs: `.msi` artifact
- Inputs:
  - `ref` (optional)
  - `version` (optional)
  - `signing` (bool)

3. Orchestrator workflow `release-desktop-installers.yml`
- Trigger:
  - `workflow_dispatch`
  - optional tag trigger for release tags
- Calls two reusable workflows above
- Downloads artifacts
- Publishes to GitHub Release (draft or final)

### 5.2 Packaging Requirements in Desktop Config
In `ui/desktop` config:
- Add maker: `@electron-forge/maker-dmg`
- Add maker: `@electron-forge/maker-wix` (MSI)
- Keep current env-driven naming behavior (`GOOSE_BUNDLE_NAME`) unchanged

Expected artifact paths (default forge layout):
- macOS: `ui/desktop/out/make/**/*.dmg`
- Windows: `ui/desktop/out/make/wix/x64/*.msi`

## 6. Signing Strategy

### 6.1 Preferred: Fully automated signing in GitHub Actions

#### macOS signing + notarization
- Sign `.app` with `Developer ID Application`
- Notarize via `xcrun notarytool`
- Staple notarization ticket (`xcrun stapler staple`)
- Build and publish `.dmg` from notarized app

Authentication variants for notarytool:
1. App Store Connect API key (preferred for CI)
2. Apple ID + app-specific password + Team ID

#### Windows signing
Two supported approaches:
1. **Azure Trusted Signing** (preferred cloud-native)
2. **Traditional Authenticode certificate** (OV/EV) + SignTool

Signing requirements:
- SHA-256 file digest
- RFC3161 timestamp (`/tr` + `/td sha256`)

### 6.2 Fallback: Build in CI unsigned, sign locally
If CI signing infra is unavailable:
1. CI produces unsigned `.msi` and `.dmg`
2. Release manager signs on controlled local machine:
   - Windows: `signtool sign ...`
   - macOS: `codesign` + `notarytool submit --wait` + `stapler`
3. Signed artifacts are uploaded/replaced in release

This fallback is mandatory for continuity, especially while onboarding certs.

## 7. Required GitHub Secrets and Variables

### 7.1 Repository Variables (non-sensitive)
- `GITHUB_OWNER` = `redsquad-tech`
- `GITHUB_REPO` = `is-goose`
- `GOOSE_BUNDLE_NAME` = `ISGuce` (optional but recommended for consistency)
- `GOOSE_LOCALE` = `ru` (optional if we want CI defaults explicit)

### 7.2 Secrets for macOS signing (choose one auth model)
Common:
- `APPLE_TEAM_ID`
- `APPLE_DEVELOPER_ID_APP_CERT_P12_BASE64`
- `APPLE_DEVELOPER_ID_APP_CERT_PASSWORD`

If using Apple ID auth:
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`

If using API key auth:
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER_ID`
- `APPLE_API_PRIVATE_KEY_P8_BASE64`

### 7.3 Secrets for Windows signing
Option A: Traditional certificate
- `WINDOWS_CODESIGN_CERT_PFX_BASE64`
- `WINDOWS_CODESIGN_CERT_PASSWORD`
- `WINDOWS_CERT_SUBJECT_NAME` (optional)

Option B: Azure Trusted Signing
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_TRUSTED_SIGNING_ACCOUNT`
- `AZURE_TRUSTED_SIGNING_PROFILE`

## 8. How to Obtain Signing Capability

### 8.1 macOS (Developer ID + Notarization)
1. Enroll organization in Apple Developer Program.
2. Account Holder creates `Developer ID Application` certificate in Apple Developer portal.
3. Export cert+private key as `.p12` from Keychain on trusted macOS machine.
4. Obtain Team ID from Apple Developer account.
5. Setup notarization credentials:
   - Either App Store Connect API key (recommended CI)
   - Or Apple app-specific password (requires 2FA on Apple account).
6. Validate locally:
   - `codesign --verify --deep --strict --verbose=2 <App>.app`
   - `xcrun notarytool submit <zip-or-dmg> --wait ...`
   - `xcrun stapler staple <App-or-dmg>`

### 8.2 Windows (Authenticode)
1. Choose trust model:
   - Purchase OV/EV code-signing certificate from trusted CA, or
   - Use Azure Trusted Signing service.
2. For OV/EV cert model:
   - Acquire publisher certificate after organization verification.
   - Ensure access to private key (PFX or hardware token/HSM policy).
3. Validate local signing process:
   - `signtool sign /fd SHA256 /tr <timestamp-url> /td SHA256 ...`
   - `signtool verify /pa /v <file>`
4. For CI, define secure key handling policy:
   - Prefer non-exportable key via cloud service/HSM.
   - If using PFX secret, limit environment access and approvals.

## 9. Security Model
- Use GitHub Environments (`release`) with required reviewers for production signing.
- Keep signing secrets only at environment scope, not global repo scope.
- Use short-lived cloud credentials (OIDC) where possible.
- Restrict tag/branch conditions for signing jobs.
- Store no certificates or private keys in repo.

## 10. Rollout Plan
1. Phase 1: Unsiged build pipelines
- Implement MSI + DMG workflows
- Verify artifact integrity and naming

2. Phase 2: macOS signing
- Integrate cert import + notarization + stapling
- Validate on clean macOS host

3. Phase 3: Windows signing
- Integrate Trusted Signing or PFX signing
- Verify trust/signature with `signtool verify`

4. Phase 4: Release hardening
- Add protected environment approvals
- Add release provenance/attestation (optional)

## 11. Acceptance Criteria
- CI produces:
  - `*.msi` for Windows x64
  - `*.dmg` for macOS arm64 (and optional x64)
- Release workflow publishes both artifacts.
- Signing mode works in at least one of:
  - Full CI signing
  - Local signing fallback documented and tested
- Secret inventory documented and applied in GitHub settings.

## 12. Operational Runbook (Short)
- If signing fails:
  - Continue with unsigned artifacts for QA only.
  - Perform local signing on trusted machine.
  - Replace release assets with signed files.
- If certificate expires/revoked:
  - Rotate certificate.
  - Re-run signing stage for latest release candidate.

## 13. External References (official)
- Apple Developer ID certificates:
  - https://developer.apple.com/help/account/certificates/create-developer-id-certificates/
- Apple notarization / notarytool:
  - https://developer.apple.com/developer-id/
  - https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- Apple app-specific passwords:
  - https://support.apple.com/102654
- Microsoft SignTool:
  - https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool
- Microsoft Trusted Signing:
  - https://learn.microsoft.com/en-us/azure/trusted-signing/
  - https://learn.microsoft.com/en-us/azure/trusted-signing/concept-trusted-signing-trust-models
- GitHub Actions secrets/OIDC:
  - https://docs.github.com/en/actions/concepts/security/secrets
  - https://docs.github.com/en/actions/concepts/security/about-security-hardening-with-openid-connect
  - https://docs.github.com/actions/how-tos/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
