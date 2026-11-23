# Security, Authorization, Functional & Performance Audit Report — Part 2 (`UDF-AUD-321` to `UDF-AUD-420`)

**Target Repository:** Unique Delta Force HR & Workforce Management Portal (`udf19`)  
**Scope:** Standalone continuation report containing **100 new, distinct, line-verified findings (`UDF-AUD-321` through `UDF-AUD-420`)**, separate from `COMPLETE_AUDIT_REPORT.md` (`UDF-AUD-01` through `UDF-AUD-320`).  
**Severity Breakdown (This Report):** `CRITICAL`: **1** | `HIGH`: **16** | `MEDIUM`: **58** | `LOW`: **25**

## 1. Executive Summary Table (`UDF-AUD-321` – `UDF-AUD-420`)

| ID | Severity | Category | Target File(s) | Exact Line Numbers | Finding Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `UDF-AUD-321` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:55–65` | `hashCandidatePasswordServer` allows any anonymous or unprivileged authenticated user to use the Cloud Function as an unthrottled bcrypt hashing oracle. |
| `UDF-AUD-322` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:72–167` | `checkGlobalUniqueness` allows any anonymous authenticated user to enumerate whether any email or UID exists across all 7 identity collections with zero rate limiting. |
| `UDF-AUD-323` | **HIGH** | Data Integrity / Security | `functions/index.js` | `functions/index.js:173–222` | `resolveExistingAuthEmailConflict` deletes an existing Firebase Auth user without checking `employees.linkedUid`, `employees.linkedGoogleEmail`, or `employees.email`. |
| `UDF-AUD-324` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:1019–1105` | `changeEmployeePassword` has no rate limiting on `currentPassword`, no minimum length check on `newPassword`, no `isActive`/`isDisabled` check, and never revokes refresh tokens. |
| `UDF-AUD-325` | **CRITICAL** | Security Vulnerability | `functions/index.js` | `functions/index.js:1459–1469` | `setupEmployeePassword` updates ALL `employees` and `onboarding_submissions` matching the caller-supplied `employeeId` without verifying that `employeeId` matches the caller's own `docRef`. |
| `UDF-AUD-326` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:1658–1768` | `adminControlEmployeeAuth` never revokes Firebase Auth refresh tokens on `reset_password`, `unlink_google`, or `reset_to_default`, and leaves `authProvider` / `linkedUid` desynced on `update_email`. |
| `UDF-AUD-327` | **MEDIUM** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:1731–1756` | `adminControlEmployeeAuth` (`reset_to_default`) searches `dataObj` for DOB by key name `'birth'`/`'dob'` instead of Form Builder UUID `6e570a01-14e0-4e18-b112-97ddc51d0778`. |
| `UDF-AUD-328` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:2243–2308` | `moveStorageFolder` skips Firestore `isDisabled` check when `token.isAdmin` is set, skips `..` traversal check for staff, and uses `.includes(uid)` for non-admin ownership. |
| `UDF-AUD-329` | **MEDIUM** | Security Vulnerability | `functions/index.js` | `functions/index.js:2541–2549` | `getStorageFolderSizeServer` grants folder-size access to any authenticated user whenever `!dd.isGoogleDraft` or `sd.activeCorrectionToken` is truthy. |
| `UDF-AUD-330` | **MEDIUM** | Security & Accuracy | `functions/index.js` | `functions/index.js:3082, 3199–3204` | `getSystemMetrics` grants access to any `token.isAdmin === true` (including branch supervisors and BGV vendors) and returns fabricated constants for `storageUploads`, `storageDownloads`, `buildMinutes`, and `containerStorage`. |
| `UDF-AUD-331` | **MEDIUM** | Security Vulnerability | `functions/index.js` | `functions/index.js:3237–3280` | `checkForgotPasswordEmployeeStatus` leaks employee existence, `isActive`, `needsProfileCompletion`, and `securityQuestion` to unauthenticated callers with spoofable `x-forwarded-for` rate limiting. |
| `UDF-AUD-332` | **HIGH** | Data Integrity / Security | `functions/index.js` | `functions/index.js:3451–3517` | `syncStaffGoogleLogin` clones `staff_accounts/{originalDoc.id}` to a new `staff_accounts/{uid}` document without deleting or linking the old document, creating duplicate staff accounts. |
| `UDF-AUD-333` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:3924–3950` | `setAdminClaims` matches `staff_accounts` by `request.auth.token.email` without verifying `request.auth.token.email_verified === true`. |
| `UDF-AUD-334` | **MEDIUM** | Security Vulnerability | `functions/index.js` | `functions/index.js:3981–3998` | `refreshAdminClaims` relies solely on `request.auth.token.isSuperAdmin === true` without checking Firestore `staff_accounts`/`users` for `roleId === 'role-super-admin'`, and omits `revokeRefreshTokens`. |
| `UDF-AUD-335` | **MEDIUM** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:4138–4158` | `onSettingsSitesWritten` only compares the global set of supervisor IDs across all sites, so moving a supervisor from Site A to Site B produces `changedSups.size === 0`! |
| `UDF-AUD-336` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:4253–4288` | `verifyCorrectionIdentity` never checks `expiresAt` (allowing expired correction links to be verified and submitted) and skips `email_verified === true` on Google verification. |
| `UDF-AUD-337` | **MEDIUM** | Security Vulnerability | `functions/index.js` | `functions/index.js:4302–4314` | `verifyCorrectionIdentity` updates `failedAttempts` non-transactionally, allowing concurrent brute-force attempts to bypass the 5-attempt lockout. |
| `UDF-AUD-338` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:5926–5932` | `logClientAuditEvent` omits `isDisabled` check, allows any non-guard `roleId` (including BGV vendors) to inject arbitrary audit logs, and lacks length limits on `details`. |
| `UDF-AUD-339` | **MEDIUM** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:7857–7909, 7924–7930` | `recordDailyStreakServer` skips Dual-ID sync on a user's first-ever visit (`!streakSnap.exists`) and skips `userUid` on the first `gamification_logs` entry. |
| `UDF-AUD-340` | **MEDIUM** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:8082` | `redeemRewardServer` returns client-supplied `cost` (`pointsSpent`) instead of `verifiedCost` in the response payload. |
| `UDF-AUD-341` | **MEDIUM** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:8021–8023` | `redeemRewardServer` generates `voucherCode` using `Math.random().toString(36).substring(2, 7)` (only 5 base-36 chars) without uniqueness verification. |
| `UDF-AUD-342` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/driveService.ts` | `driveService.ts:10–58` | 12 exported Google Drive operations (`uploadToDrive`, `moveEmployeeFolder`, `renameEmployeeFolder`, `approveEmployeeFolder`, `createEmployeeFolder`, etc.) are silent no-ops that return success/empty string. |
| `UDF-AUD-343` | **HIGH** | Broken Feature / Functional Bug | `src/services/notificationService.ts` | `notificationService.ts:76–95` | `sendFirestoreNotification` performs a direct client `addDoc(collection(db, 'notifications'), ...)`, which fails `firestore.rules` for non-SuperAdmins. |
| `UDF-AUD-344` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/notificationService.ts` | `notificationService.ts:172–188` | `markAllRead` batches all unread notifications (including `ROLE:*` broadcasts) into a single `writeBatch` without chunking (`>500`) or filtering non-owned targets. |
| `UDF-AUD-345` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/statsService.ts` | `statsService.ts:29–49` | `updatePublicStats` calls direct client `setDoc(doc(db, 'settings', 'public_stats'), ...)` which fails `firestore.rules` for non-SuperAdmin staff. |
| `UDF-AUD-346` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/blogService.ts` | `blogService.ts:23–32` | `getBlogPosts` checks `!!auth?.currentUser` (which is `true` for anonymous Firebase sessions) and executes unbounded `getDocs` without `limit()`. |
| `UDF-AUD-347` | **MEDIUM** | Data Integrity | `src/services/blogService.ts` | `blogService.ts:87–94` | `updateBlogPost` overwrites `timestamp: serverTimestamp()` on every minor typo edit, bumping old blog posts to the top of the feed. |
| `UDF-AUD-348` | **LOW** | Dead Code / Security Hygiene | `src/utils/migrationHelper.ts` | `migrationHelper.ts:10–22` | `createInitialAdmin` writes directly to legacy `'staff'` collection instead of `'staff_accounts'` and omits `usernameLower` and `isDisabled`. |
| `UDF-AUD-349` | **LOW** | Reliability | `src/utils/resilientFetch.ts` | `resilientFetch.ts:50–67` | `resilientFetch` does not handle `AbortSignal` / `AbortError` before sleeping 1.5s and lacks a request timeout. |
| `UDF-AUD-350` | **MEDIUM** | Broken Feature / Functional Bug | `src/utils/subUnitUtils.ts` | `subUnitUtils.ts:46–59` | `buildSubUnitLookupMap` silently overwrites collisions when two sites share a sub-unit name (e.g., `'Main Gate'` or `'Block A'`). |
| `UDF-AUD-351` | **LOW** | Broken Feature / Functional Bug | `src/utils/undoToast.tsx` | `undoToast.tsx:55–66` | `showUndoToast` allows double-clicking `UNDO` before `toast.dismiss(t.id)` unmounts the button, triggering duplicate `restoreFromRecycleBin` calls. |
| `UDF-AUD-352` | **MEDIUM** | Broken Feature / Functional Bug | `utils/formDataHelper.ts` | `formDataHelper.ts:14–39, 97–136` | `getApplicantName` matches `'Father's Name'` / `'Mother's Name'` / `'Bank Name'` via `labelLower.includes('name')`, and `getApplicantPAN` matches `'Company'` / `'Expansion'` via `labelLower.includes('pan')`! |
| `UDF-AUD-353` | **LOW** | Broken Feature / Functional Bug | `utils/imageScanner.ts` | `imageScanner.ts:29–30, 105, 130` | `checkImageBlurry` divides by `count` (which is `0` when `height <= 2` on ultra-wide strips, returning `NaN`) and JSDoc says threshold `12.0` while code hardcodes `50.0`. |
| `UDF-AUD-354` | **MEDIUM** | Broken Feature / Functional Bug | `components/auth/AdminLoginPage.tsx` | `AdminLoginPage.tsx:26–36, 102–125` | Forgot Password modal never resets `resetStatus` / `resetEmail` when reopened after a previous success or error. |
| `UDF-AUD-355` | **MEDIUM** | Broken Feature / Functional Bug | `components/common/PublicHeader.tsx` | `PublicHeader.tsx:160–166, 258, 340` | Desktop/mobile portal links navigate to `/admin/dashboard` or `/employee/dashboard` via SPA `navigate()`, which fails when running on `udfonline.in` (`VITE_APP_TARGET=public`). |
| `UDF-AUD-356` | **LOW** | Accessibility / UX | `components/common/PublicHeader.tsx`<br>`components/common/PublicFooter.tsx` | `PublicHeader.tsx:80–90, 207`<br>`PublicFooter.tsx:39–65` | Navigation items use clickable `<span>` and `<div>` elements instead of semantic `<a>` or `<button>` elements. |
| `UDF-AUD-357` | **MEDIUM** | Broken Feature / Functional Bug | `components/common/PublicFooter.tsx` | `PublicFooter.tsx:88–95, 110–117` | 'Join UDF (Apply Online)' buttons in `PublicFooter` still link to an external Google Form (`https://forms.gle/f86UXjTiusatMUVd7`) instead of the portal's `/join` onboarding workflow. |
| `UDF-AUD-358` | **LOW** | Broken Feature / Functional Bug | `src/components/common/SEOHead.tsx` | `SEOHead.tsx:58–65` | `SEOHead` unconditionally overwrites `<meta name="robots">` to `'index, follow'` on mount, defeating `vite.config.ts`'s `noindex, nofollow` transform on admin/employee subdomains. |
| `UDF-AUD-359` | **MEDIUM** | Broken Feature / Functional Bug | `components/SectionItem.tsx` | `SectionItem.tsx:84–92` | `moveField` passes `sortedFields` indices (`currentIndex`, `newIndex`) to `onReorderFields`, which splices the unsorted `section.fields` array. |
| `UDF-AUD-360` | **LOW** | Broken Feature / Functional Bug | `components/SectionItem.tsx` | `SectionItem.tsx:49, 102–109` | `newName` state is initialized once from `section.name` and never synced if `section.name` changes via Firestore snapshot; also uses deprecated `onKeyPress`. |
| `UDF-AUD-361` | **MEDIUM** | Broken Feature / Functional Bug | `components/events/EmployeeTimelinePage.tsx` | `EmployeeTimelinePage.tsx:21–40, 142` | `useEffect` lacks an unmount cancellation flag (race condition when switching `employeeId` rapidly) and `new Date(event.date).toLocaleDateString()` renders `'Invalid Date'` on missing dates. |
| `UDF-AUD-362` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminStaffProfilePage.tsx` | `AdminStaffProfilePage.tsx:57–59, 75–77` | `assignedSites` and `reportingHierarchy` check only `s.supervisorId === authUser?.id`, ignoring multi-supervisor `s.supervisorIds` and `staffDetails.sitesManaged`. |
| `UDF-AUD-363` | **MEDIUM** | Broken Feature / Functional Bug | `src/components/employeeFormFields/EmployeeFileUploadField.tsx` | `src/components/employeeFormFields/EmployeeFileUploadField.tsx:33–55` | Duplicate legacy `src/components/employeeFormFields/EmployeeFileUploadField.tsx` lacks file-size, MIME-type, and compression checks and has no `accept` attribute on `<Input type="file">`. |
| `UDF-AUD-364` | **HIGH** | Broken Feature / Functional Bug | `src/services/authService.ts` | `authService.ts:260–286` | `getAdminProfile` returns `id: data.username || firebaseUser.uid` instead of `firebaseUser.uid`, breaking all downstream `doc(db, 'users', user.id)` and `staff_accounts/{user.id}` lookups. |
| `UDF-AUD-365` | **HIGH** | Security & Functional Bug | `src/services/authService.ts` | `authService.ts:299–321` | `checkEmailUniquenessGlobal` fails open (`return true`) on any error, allowing duplicate registrations whenever the Cloud Function times out or rejects. |
| `UDF-AUD-366` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/authService.ts` | `authService.ts:345–349` | `loginUser` hardcodes `type: UserType.EMPLOYEE` in its return value even when called by Admins/Staff logging into the management portal. |
| `UDF-AUD-367` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/authService.ts` | `authService.ts:409–466` | `getCurrentUser` does not unsubscribe `onAuthStateChanged` if `timeoutMs` fires first, leaking a permanent Auth listener. |
| `UDF-AUD-368` | **HIGH** | Security Vulnerability | `src/services/recycleBinService.ts` | `recycleBinService.ts:139–141, 200–204` | `restoreFromRecycleBin` falls back to direct client-side Firestore writes when `restoreRecycleBinServer` rejects (even on `permission-denied`), and `case 'EMPLOYEE'` sets `isActive: true` without checking `isRelieved`. |
| `UDF-AUD-369` | **MEDIUM** | Broken Feature / Data Integrity | `src/services/recycleBinService.ts` | `recycleBinService.ts:356–380` | `permanentDeleteFromRecycleBin` deletes the `recycle_bin` entry even if purging the underlying `STAFF`/`EMPLOYEE`/`SUBMISSION` failed, and never purges `SITE`/`VACANCY`/`INVITE`. |
| `UDF-AUD-370` | **LOW** | Security / Configuration | `src/utils/googleAuthHelper.ts` | `googleAuthHelper.ts:48, 110, 157` | Hardcodes the Google OAuth Web Client ID in three separate places instead of reading from `import.meta.env.VITE_GOOGLE_CLIENT_ID`. |
| `UDF-AUD-371` | **MEDIUM** | Performance / Memory Leak | `src/utils/pdfCompression.ts` | `pdfCompression.ts:83–125` | `compressPdf` never destroys `pdfJsDoc` / `page.cleanup()` or zeroes offscreen canvas dimensions, causing browser tab OOM crashes on large multi-page PDFs. |
| `UDF-AUD-372` | **MEDIUM** | Broken Feature / Functional Bug | `src/utils/pdfCompression.ts` | `pdfCompression.ts:13–22` | `dataUrlToUint8Array` calls `atob(dataUrl.split(',')[1])` without guarding empty/malformed canvas output (`data:,`). |
| `UDF-AUD-373` | **HIGH** | Security Vulnerability | `src/utils/sanitizeHtml.ts` | `sanitizeHtml.ts:19, 26–31, 75–80` | `SAFE_URL_PATTERN` allows protocol-relative URLs (`//evil.com/phish`), and the non-DOM fallback regex (`L28–30`) fails to strip `<iframe>`, `<svg onload>`, `<object>`, or `src="javascript:..."`. |
| `UDF-AUD-374` | **MEDIUM** | Broken Feature / Functional Bug | `index.tsx` | `index.tsx:16–21` | Canonical origin redirect (`index.tsx:16–20`) checks `h.includes('-employee')`, whereas `AdminCorrectionRequestsPage.tsx:70` uses `-emp.web.app`! |
| `UDF-AUD-375` | **MEDIUM** | Broken Feature / UX | `index.tsx` | `index.tsx:182–202, 237` | `triggerSafeReload` sets `(window as any).__UDF_UPDATE_PENDING = true` and never clears it if the user closes the toast or cancels, and `setInterval` timers (`L201, L237`) never check `navigator.onLine`. |
| `UDF-AUD-376` | **MEDIUM** | Broken Feature / Functional Bug | `components/ProfileAvatar.tsx` | `ProfileAvatar.tsx:29, 35–58` | `photoURL` local state is initialized once from `currentPhotoURL` (`L29`) and never synced when `currentPhotoURL` prop changes. |
| `UDF-AUD-377` | **LOW** | Broken Feature / Functional Bug | `components/ProfileAvatar.tsx` | `ProfileAvatar.tsx:172, 201` | Uses `id={avatar-upload-${userId}}` for the hidden `<input type="file">`, causing duplicate DOM IDs whenever two `ProfileAvatar` instances for the same user render simultaneously (e.g., header + profile page). |
| `UDF-AUD-378` | **MEDIUM** | Broken Feature / Functional Bug | `components/employee/EmployeeProfileView.tsx` | `EmployeeProfileView.tsx:310, 482` | `isPlaceholderValue` treats `'0'` as a missing/placeholder value, and `L482` reads `(employeeData.data || {})[field.id]` instead of `dataMap[field.id]` (which falls back to `formData`). |
| `UDF-AUD-379` | **LOW** | UX / Accessibility | `components/employee/EmployeeProfileView.tsx` | `EmployeeProfileView.tsx:373–375` | Site Identifier popover close button renders `<ExternalLink>` instead of a close (`X`) icon and lacks `aria-label`. |
| `UDF-AUD-380` | **MEDIUM** | Broken Feature / Functional Bug | `components/EmployeeLoginPage.tsx` | `EmployeeLoginPage.tsx:134–170` | On `employeeGoogleLogin` `not-found` fallback (`L164–167`), `GoogleAuthProvider.credential(googleResult.idToken)` receives a Firebase Auth ID token instead of a Google OAuth ID token! |
| `UDF-AUD-381` | **LOW** | Broken Feature / UX | `components/EmployeeLoginPage.tsx` | `EmployeeLoginPage.tsx:358–366` | Forgot Password Step 2 'Verify' button silently does nothing when any required field is empty, with zero validation error message. |
| `UDF-AUD-382` | **LOW** | Broken Feature / Functional Bug | `components/PrivacyPolicyPage.tsx`<br>`components/TermsOfServicePage.tsx` | `PrivacyPolicyPage.tsx:33`<br>`TermsOfServicePage.tsx:33` | Header 'Careers' nav item on both legal pages navigates to `'/'` instead of `'/careers'`, and both pages omit `PublicHeader`/`PublicFooter`. |
| `UDF-AUD-383` | **LOW** | Security Hygiene | `components/PrivacyPolicyPage.tsx` | `PrivacyPolicyPage.tsx:110` | External `<a target="_blank">` links use `rel="noreferrer"` without `noopener`. |
| `UDF-AUD-384` | **LOW** | Performance / Reliability | `components/AboutPage.tsx` | `AboutPage.tsx:16–29` | `AboutPage` blocks the entire page render behind a full-screen spinner (`if (loading)`) while waiting for `getWebsiteConfig()`, hurting LCP/SEO and failing to cancel on unmount. |
| `UDF-AUD-385` | **MEDIUM** | Broken Feature / Functional Bug | `scripts/search-user.js` | `scripts/search-user.js:19` | `scripts/search-user.js` calls `fs.readFileSync(...)` without importing `fs`, throwing `ReferenceError: fs is not defined`. |
| `UDF-AUD-386` | **MEDIUM** | Security / Privacy Leak | `scripts/search_user_rest.mjs` | `scripts/search_user_rest.mjs:21` | Hardcodes a real personal Gmail address (`arjosarka56r@gmail.com`) and production project ID in a committed repository script. |
| `UDF-AUD-387` | **LOW** | Security / Privacy Leak | `scripts/comprehensive_scanner.cjs`<br>`scripts/backup_current_state.ps1` | `comprehensive_scanner.cjs:8, 157`<br>`backup_current_state.ps1:2, 22, 35` | Hardcodes local developer filesystem paths (`C:/Users/muthy/...`, `z:\HR PORTAL`, `file:///z:/UDF_SUBDOMAINS`) in committed scripts. |
| `UDF-AUD-388` | **MEDIUM** | Performance / Bundle Bloat | `components/BulkImportModal.tsx` | `BulkImportModal.tsx:7` | Synchronously imports `import * as XLSX from 'xlsx';` at top level, pulling the ~500KB SheetJS bundle whenever `BulkImportModal` is loaded. |
| `UDF-AUD-389` | **MEDIUM** | Broken Feature / Functional Bug | `components/BulkImportModal.tsx` | `BulkImportModal.tsx:58–66, 123–126, 185` | Does not enforce the advertised `'Maximum 500 rows per import'` limit, resets file input never (can't re-upload same file), and silently skips duplicate check on error (`L125`). |
| `UDF-AUD-390` | **MEDIUM** | Broken Feature / Functional Bug | `components/common/DocumentCaptureModal.tsx` | `DocumentCaptureModal.tsx:236–247, 291–300` | `handleFileChange` and `handleSaveCrop` ignore the `maxSizeMB` prop (`L70`) and allow selecting non-image files (e.g., PDFs) into `ReactCrop`, causing a broken image preview. |
| `UDF-AUD-391` | **MEDIUM** | Broken Feature / Functional Bug | `components/common/DocumentCaptureModal.tsx` | `DocumentCaptureModal.tsx:119–128` | `rotateImage` effect lacks a cancellation flag and never revokes `blob:` URLs, risking stale rotated images when clicking Rotate rapidly. |
| `UDF-AUD-392` | **MEDIUM** | Security Vulnerability | `package.json` | `package.json:25, 37` | Installs `xlsx` directly from an unpinned third-party tarball URL (`https://cdn.sheetjs.com/xlsx-0.19.3/xlsx-0.19.3.tgz`) without integrity check in `package.json`, and pins pre-release `@codetrix-studio/capacitor-google-auth@^3.4.0-rc.4`. |
| `UDF-AUD-393` | **MEDIUM** | Code Quality / Type Safety | `tsconfig.json` | `tsconfig.json:2–28` | `tsconfig.json` omits `"strict": true`, `"noImplicitAny": true`, and `"strictNullChecks": true`. |
| `UDF-AUD-394` | **HIGH** | Security Vulnerability | `components/AdminMasterEmployeeListPage.tsx`<br>`components/EmployeeFormPage.tsx`<br>`components/employee/DataCorrectionPage.tsx`<br>`src/utils/bulkImportUtils.ts` | `AdminMasterEmployeeListPage.tsx:1875`<br>`EmployeeFormPage.tsx:1885`<br>`DataCorrectionPage.tsx:593`<br>`bulkImportUtils.ts:226` | Four locations construct `new RegExp(userConfiguredPattern)` directly without `try/catch` or ReDoS complexity guards. |
| `UDF-AUD-395` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminMasterEmployeeListPage.tsx`<br>`components/EmployeeFormPage.tsx`<br>`src/services/storageService.ts` | `AdminMasterEmployeeListPage.tsx:255`<br>`EmployeeFormPage.tsx:1204`<br>`storageService.ts:194, 454` | Unguarded or fragile `JSON.parse()` on `localStorage`/`sessionStorage` values can throw `SyntaxError` on corrupted storage. |
| `UDF-AUD-396` | **MEDIUM** | Broken Feature / Functional Bug | `hooks/useFormBuilder.ts` | `hooks/useFormBuilder.ts:9–18` | `addSection` reads `sections.length` from closure instead of `prev.length` inside the functional updater `setSections(prev => ...)`. |
| `UDF-AUD-397` | **LOW** | Security Hygiene | `components/AdminVacancyManager.tsx`<br>`components/BlogPage.tsx` | `AdminVacancyManager.tsx:321`<br>`BlogPage.tsx:418` | External `<a target="_blank">` links omit `noopener` (using only `rel="noreferrer"` or omitting `rel`). |
| `UDF-AUD-398` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminReviewSubmissionsPage.tsx` | `AdminReviewSubmissionsPage.tsx:687` | `window.open('', '_blank', 'width=800,height=1000')` omits `'noopener'` and lacks popup-blocker error feedback when `printWindow` is null. |
| `UDF-AUD-399` | **MEDIUM** | Broken Feature / Functional Bug | `App.tsx` | `App.tsx:999` | `setInterval` poller in `App.tsx:999` lacks a max-timeout / cleanup guard if the waited condition never resolves. |
| `UDF-AUD-400` | **LOW** | Security / Privacy | `components/AdminStaffManagementPage.tsx` | `AdminStaffManagementPage.tsx:245` | Creates staff accounts using an admin-typed plaintext password without enforcing password complexity or requiring a first-login password change. |
| `UDF-AUD-401` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminStaffManagementPage.tsx` | `AdminStaffManagementPage.tsx:460–499` | `handleTransferSites` does not prevent transferring sites from a staff member to themselves (`transferSourceStaff.id === targetStaff.id`). |
| `UDF-AUD-402` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminRoleManagementPage.tsx` | `AdminRoleManagementPage.tsx:722–732` | `saveUserOverrides` optimistically mutates `staffUsers` state (`L722`) BEFORE `await setDoc(...)` (`L724`) and never rolls back React state if `setDoc` fails. |
| `UDF-AUD-403` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/recycleBinService.ts` | `recycleBinService.ts:398–409` | `subscribeToRecycleBin` queries `recycle_bin` ordered by `deletedAt` without `limit()`, loading every soft-deleted record in history on every snapshot. |
| `UDF-AUD-404` | **LOW** | Broken Feature / Functional Bug | `src/services/recycleBinService.ts` | `recycleBinService.ts:44–46` | `moveToRecycleBin` computes 30-day `expiresAt` using `expires.setDate(now.getDate() + 30)` in the client browser's local clock. |
| `UDF-AUD-405` | **MEDIUM** | Security Vulnerability | `src/services/websiteService.ts` | `websiteService.ts:117–121` | `updateWebsiteConfig` overwrites `settings/public_website` via `setDoc(docRef, config)` without stripping `undefined` or validating `contactEmail`/`services`. |
| `UDF-AUD-406` | **LOW** | Broken Feature / Functional Bug | `src/services/blogService.ts` | `blogService.ts:65–69` | In-memory sort in `getBlogPosts` puts pinned posts (`isPinned: true`) in chronological order instead of pinning them to the top. |
| `UDF-AUD-407` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/blogService.ts` | `blogService.ts:96–107` | `deleteBlogPost` calls `deleteStorageFile(imageUrl)` even when `imageUrl` is an external third-party URL (not a Firebase Storage path). |
| `UDF-AUD-408` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/notificationService.ts` | `notificationService.ts:108–111` | `subscribeToNotifications` attaches duplicate Firestore `onSnapshot` listeners when `portalId === userId`. |
| `UDF-AUD-409` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/notificationService.ts` | `notificationService.ts:141–145` | When a notification is removed from one listener's snapshot, `notifMap.delete(change.doc.id)` executes unconditionally after the `snap.forEach` loop. |
| `UDF-AUD-410` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/authService.ts` | `authService.ts:171–243` | `getStaffProfile` queries `staff_accounts` and `staff` by `where('email', '==', firebaseUser.email)` without normalizing `.toLowerCase().trim()`. |
| `UDF-AUD-411` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/authService.ts` | `authService.ts:73, 271` | `getEmployeeProfile` (`L73`) and `getAdminProfile` (`L271`) also query `linkedGoogleEmail` and `email` without `.toLowerCase().trim()`. |
| `UDF-AUD-412` | **MEDIUM** | Security & Privacy | `src/services/authService.ts` | `authService.ts:398–407` | `logoutUser` clears `localStorage['portalType']` and `fileSessionStore`, but does NOT clear `sessionStorage` signed URLs, `activeTimelineEmployeeId`, `adminInvitesActiveTab`, or `onboarding_savedDraftId`. |
| `UDF-AUD-413` | **LOW** | Broken Feature / Functional Bug | `components/AdminStaffProfilePage.tsx` | `AdminStaffProfilePage.tsx:70–73` | `reportingHierarchy` identifies Field Officers by hardcoded role name substring `'field officer'` or ID `'role-field-officer'` and includes disabled staff (`isDisabled: true`). |
| `UDF-AUD-414` | **LOW** | Broken Feature / Functional Bug | `components/events/EmployeeTimelinePage.tsx` | `EmployeeTimelinePage.tsx:70–77` | `displayName` lookup checks literal field labels (`'Applicant Name'`, `'Full Name'`) but omits Form Builder UUID `7debf274-baee-4bac-a137-4b4b46719874`. |
| `UDF-AUD-415` | **LOW** | Broken Feature / Functional Bug | `components/events/EmployeeTimelinePage.tsx` | `EmployeeTimelinePage.tsx:188` | `import { RotateCcw } from 'lucide-react';` is placed at the bottom of the file (`L188`) after `EmployeeTimelinePage` definition. |
| `UDF-AUD-416` | **MEDIUM** | Broken Feature / Functional Bug | `src/utils/googleAuthHelper.ts` | `googleAuthHelper.ts:59, 74` | `getGoogleCredentialSafely` asserts `email: userCred.user.email!` with a non-null assertion without verifying `userCred.user.email` exists. |
| `UDF-AUD-417` | **LOW** | Performance / Memory Leak | `src/utils/googleAuthHelper.ts` | `googleAuthHelper.ts:23–32` | `getSecondaryAuth` initializes a persistent secondary Firebase App (`'GoogleLinkerApp'`) that is never deleted with `deleteApp`. |
| `UDF-AUD-418` | **MEDIUM** | Broken Feature / Functional Bug | `components/BulkImportModal.tsx` | `BulkImportModal.tsx:76–88` | CSV `FileReader` handler (`L76–87`) has no `try/catch` around `parseCSV(content)` and never resets `e.target.value = ''`. |
| `UDF-AUD-419` | **LOW** | Broken Feature / Functional Bug | `components/common/DocumentCaptureModal.tsx` | `DocumentCaptureModal.tsx:1045–1060` | `enumerateDevices()` is called before `getUserMedia()`, returning blank device `label` strings in Chrome/Safari so `backCam` detection (`d.label.toLowerCase().includes('back')`) always fails on first open. |
| `UDF-AUD-420` | **LOW** | Security / Privacy | `components/common/AdSenseUnit.tsx`<br>`components/PrivacyPolicyPage.tsx`<br>`components/AboutPage.tsx` | `AdSenseUnit.tsx:1–19`<br>`PrivacyPolicyPage.tsx:132`<br>`AboutPage.tsx:73, 145` | Disabled `AdSenseUnit` component still receives placeholder slot IDs (`1111111111`, `2222222222`, `5555555555`, `6666666666`) across public pages while `PrivacyPolicyPage` claims a live Cookie Consent Banner and AdSense tracking are active. |

## 2. Detailed Breakdown & Copy-Paste Remediations (`UDF-AUD-321` – `UDF-AUD-420`)

### `UDF-AUD-321` — **HIGH** | Security Vulnerability / `hashCandidatePasswordServer` allows any anonymous or unprivileged authenticated user to use the Cloud Function as an unthrottled bcrypt hashing oracle.
- **Target File(s)**: `functions/index.js` (`functions/index.js:55–65`)
- **Root Cause & Exact Code Trace**:
  - `hashCandidatePasswordServer` (`L55–65`) only checks `if (!request.auth)` (which includes anonymous sessions) with zero rate limiting, max password length check, or caller role/onboarding context check.
- **Real-World Impact**:
  - An attacker can spam large-payload bcrypt hashing calls from anonymous Firebase sessions to exhaust Cloud Function CPU quota and run up billing.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -60,2 +60,5 @@
-    if (!password || typeof password !== 'string' || password.length < 6) {
-        throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters');
+    if (!password || typeof password !== 'string' || password.length < 6 || password.length > 72) {
+        throw new functions.https.HttpsError('invalid-argument', 'Password must be between 6 and 72 characters');
     }
+    if (!checkLookupRateLimit(request.auth.uid)) {
+        throw new functions.https.HttpsError('resource-exhausted', 'Too many requests.');
+    }
```

### `UDF-AUD-322` — **HIGH** | Security Vulnerability / `checkGlobalUniqueness` allows any anonymous authenticated user to enumerate whether any email or UID exists across all 7 identity collections with zero rate limiting.
- **Target File(s)**: `functions/index.js` (`functions/index.js:72–167`)
- **Root Cause & Exact Code Trace**:
  - `checkGlobalUniqueness` (`L74`) only checks `if (!request.auth)` (which anonymous sign-in satisfies) and never calls `checkLookupRateLimit` or verifies non-anonymous status, while `L95–96` omits top-level `employees.email`.
- **Real-World Impact**:
  - Unauthenticated visitors using `signInAnonymously()` can scrape/enumerate every staff and employee email address in the organization, while missing top-level `employees.email` collisions.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -95,1 +95,2 @@
                 { type: 'employees', query: db.collection('employees').where('profileData.personalDetails.email', '==', normalizedEmail).get() },
+                { type: 'employees', query: db.collection('employees').where('email', '==', normalizedEmail).get() },
```

### `UDF-AUD-323` — **HIGH** | Data Integrity / Security / `resolveExistingAuthEmailConflict` deletes an existing Firebase Auth user without checking `employees.linkedUid`, `employees.linkedGoogleEmail`, or `employees.email`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:173–222`)
- **Root Cause & Exact Code Trace**:
  - Lines `188–197` check `employees` by doc ID (`uid`) and `where('uid', '==', uid)`, completely omitting `where('linkedUid', '==', uid)`, `where('linkedGoogleEmail', '==', normalizedEmail)`, and `where('email', '==', normalizedEmail)` before calling `admin.auth().deleteUser(uid)` (`L221`).
- **Real-World Impact**:
  - Creating a staff account with an email already linked to an active employee via `linkedGoogleEmail`/`linkedUid` can mistakenly classify that Auth user as an orphan and delete it.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -193,1 +193,3 @@
         db.collection('employees').where('uid', '==', uid).limit(1).get(),
+        db.collection('employees').where('linkedUid', '==', uid).limit(1).get(),
+        db.collection('employees').where('linkedGoogleEmail', '==', normalizedEmail).limit(1).get(),
```

### `UDF-AUD-324` — **HIGH** | Security Vulnerability / `changeEmployeePassword` has no rate limiting on `currentPassword`, no minimum length check on `newPassword`, no `isActive`/`isDisabled` check, and never revokes refresh tokens.
- **Target File(s)**: `functions/index.js` (`functions/index.js:1019–1105`)
- **Root Cause & Exact Code Trace**:
  - Unlike `setupEmployeePassword` (`L1397`), `changeEmployeePassword` (`L1031`) accepts 1-character `newPassword`, omits `checkAndIncrementFailedAttempts`, skips active/relieved checks, and never calls `revokeRefreshTokens`.
- **Real-World Impact**:
  - A compromised session can brute-force `currentPassword` without lockout, set a 1-character password, or change passwords on a disabled/relieved account.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1031,2 +1031,5 @@
     if (!employeeId || !currentPassword || !newPassword) {
         throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
     }
+    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 72) {
+        throw new functions.https.HttpsError('invalid-argument', 'New password must be 6-72 characters.');
+    }
```

### `UDF-AUD-325` — **CRITICAL** | Security Vulnerability / `setupEmployeePassword` updates ALL `employees` and `onboarding_submissions` matching the caller-supplied `employeeId` without verifying that `employeeId` matches the caller's own `docRef`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:1459–1469`)
- **Root Cause & Exact Code Trace**:
  - Lines `1409–1421` resolve `docRef` by `callerUid` without comparing `empSnap.data().employeeId === employeeId`. Then `L1462–1469` blindly updates every `employees` and `onboarding_submissions` doc matching the caller-supplied `employeeId`!
- **Real-World Impact**:
  - Any logged-in employee can pass ANOTHER employee's `employeeId` to `setupEmployeePassword` and overwrite that victim's `passwordHash`, achieving full horizontal account takeover.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1462,2 +1462,6 @@
-        const cleanId = employeeId.trim().toUpperCase();
+        const ownSnap = await docRef.get();
+        const cleanId = String(ownSnap.data()?.employeeId || '').trim().toUpperCase();
+        if (!cleanId || cleanId !== employeeId.trim().toUpperCase()) {
+            throw new functions.https.HttpsError('permission-denied', 'Employee ID does not match your account.');
+        }
```

### `UDF-AUD-326` — **HIGH** | Security Vulnerability / `adminControlEmployeeAuth` never revokes Firebase Auth refresh tokens on `reset_password`, `unlink_google`, or `reset_to_default`, and leaves `authProvider` / `linkedUid` desynced on `update_email`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:1658–1768`)
- **Root Cause & Exact Code Trace**:
  - All five actions in `adminControlEmployeeAuth` update Firestore documents via `ref.update(...)` (`L1677, 1687, 1698, 1714, 1766`) without calling `admin.auth().revokeRefreshTokens()` and without logging an immutable server-side audit entry.
- **Real-World Impact**:
  - After a SuperAdmin resets a compromised employee's password or unlinks Google SSO, the attacker's existing Firebase session stays active and the action leaves no server audit log.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1677,1 +1677,2 @@
             await Promise.all(docRefs.map(ref => ref.update(updates)));
+            await Promise.all(docRefs.map(ref => admin.auth().revokeRefreshTokens(ref.id).catch(() => {})));
```

### `UDF-AUD-327` — **MEDIUM** | Broken Feature / Functional Bug / `adminControlEmployeeAuth` (`reset_to_default`) searches `dataObj` for DOB by key name `'birth'`/`'dob'` instead of Form Builder UUID `6e570a01-14e0-4e18-b112-97ddc51d0778`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:1731–1756`)
- **Root Cause & Exact Code Trace**:
  - Lines `1734–1752` scan `dataObj` keys for `'birth'`/`'dob'`, falling back to ANY date between 1950 and 2010 (which can match a parent's DOB or graduation date) or `'123'`.
- **Real-World Impact**:
  - Generated default passwords on admin reset frequently contain the wrong year (`123` or a non-DOB date), causing login confusion.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1732,2 +1732,3 @@
                 let year = '123';
                 const dataObj = sourceData.data || sourceData.formData || {};
+                const directDob = dataObj['6e570a01-14e0-4e18-b112-97ddc51d0778'] || sourceData.dob;
+                if (typeof directDob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(directDob)) year = directDob.split('-')[0];
```

### `UDF-AUD-328` — **HIGH** | Security Vulnerability / `moveStorageFolder` skips Firestore `isDisabled` check when `token.isAdmin` is set, skips `..` traversal check for staff, and uses `.includes(uid)` for non-admin ownership.
- **Target File(s)**: `functions/index.js` (`functions/index.js:2243–2308`)
- **Root Cause & Exact Code Trace**:
  - Line `2260` trusts `token.isAdmin` if no Firestore doc matched, `L2266` only checks `..` inside `if (!isAdminOrStaff)`, and `L2301–2302` uses `cleanSource.includes(uid)` / `cleanDest.includes(uid)` so an employee can move files to `public/${uid}/...` or `employees/other/${uid}`.
- **Real-World Impact**:
  - Employees can move private documents into `public/*` (making them world-readable via `storage.rules:36`) or overwrite arbitrary folders containing their UID substring.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -2301,2 +2301,2 @@
-            const ownsSource = (sourceId && allowedIds.has(sourceId)) || cleanSource.includes(uid);
-            const ownsDest = (destId && allowedIds.has(destId)) || cleanDest.includes(uid);
+            const ownsSource = ['onboarding', 'employees', 'draft_submissions'].includes(sourceParts[0]) && !!sourceId && allowedIds.has(sourceId);
+            const ownsDest = ['onboarding', 'employees', 'draft_submissions'].includes(destParts[0]) && !!destId && allowedIds.has(destId);
```

### `UDF-AUD-329` — **MEDIUM** | Security Vulnerability / `getStorageFolderSizeServer` grants folder-size access to any authenticated user whenever `!dd.isGoogleDraft` or `sd.activeCorrectionToken` is truthy.
- **Target File(s)**: `functions/index.js` (`functions/index.js:2541–2549`)
- **Root Cause & Exact Code Trace**:
  - Lines `2543` and `2547` authorize any caller (including anonymous users) to query Storage folder sizes for any guest draft (`!dd.isGoogleDraft`) or any submission with an active correction token without verifying ownership.
- **Real-World Impact**:
  - Exposes storage metadata/existence of candidate folders to unrelated authenticated users and can be abused to trigger expensive `bucket.getFiles({ prefix })` bucket listings.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -2543,1 +2543,1 @@
-                if (!dd.ownerUid || dd.ownerUid === uid || dd.linkedUid === uid || dd.activeSessionUid === uid || !dd.isGoogleDraft) isAuthorized = true;
+                if (dd.ownerUid === uid || dd.linkedUid === uid || dd.activeSessionUid === uid) isAuthorized = true;
```

### `UDF-AUD-330` — **MEDIUM** | Security & Accuracy / `getSystemMetrics` grants access to any `token.isAdmin === true` (including branch supervisors and BGV vendors) and returns fabricated constants for `storageUploads`, `storageDownloads`, `buildMinutes`, and `containerStorage`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:3082, 3199–3204`)
- **Root Cause & Exact Code Trace**:
  - Line `3082` allows any `token.isAdmin` (whereas the Firestore fallback at `L3090–3091` restricts to SuperAdmin), and `L3199–3204` returns synthetic guesses (`writes * 0.1`, `5.2`, `180MB`) as live GCP metrics (`isMock: false`).
- **Real-World Impact**:
  - Low-privilege staff/BGV vendors can query GCP billing telemetry, and SuperAdmins receive fabricated storage/build figures labeled as live data.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3082,1 +3082,1 @@
-        let isAdmin = token.isAdmin === true || token.isSuperAdmin === true || token.roleId === 'role-super-admin';
+        let isAdmin = token.isSuperAdmin === true || token.roleId === 'role-super-admin';
```

### `UDF-AUD-331` — **MEDIUM** | Security Vulnerability / `checkForgotPasswordEmployeeStatus` leaks employee existence, `isActive`, `needsProfileCompletion`, and `securityQuestion` to unauthenticated callers with spoofable `x-forwarded-for` rate limiting.
- **Target File(s)**: `functions/index.js` (`functions/index.js:3237–3280`)
- **Root Cause & Exact Code Trace**:
  - Line `3239` reads `rawReq.headers['x-forwarded-for']` before `rawReq.ip`, uses an in-memory `Map` (`lookupRateLimits`), and returns `{ exists, isActive, needsProfileCompletion, securityQuestion }` (`L3270–3276`).
- **Real-World Impact**:
  - Attackers can spoof `X-Forwarded-For` to enumerate all valid Employee IDs, active statuses, and security questions.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3239,1 +3239,1 @@
-    const clientIp = (rawReq && (rawReq.headers['x-forwarded-for'] || rawReq.ip || rawReq.connection?.remoteAddress)) || 'unknown-client';
+    const clientIp = (rawReq && (rawReq.ip || rawReq.connection?.remoteAddress)) || 'unknown-client';
```

### `UDF-AUD-332` — **HIGH** | Data Integrity / Security / `syncStaffGoogleLogin` clones `staff_accounts/{originalDoc.id}` to a new `staff_accounts/{uid}` document without deleting or linking the old document, creating duplicate staff accounts.
- **Target File(s)**: `functions/index.js` (`functions/index.js:3451–3517`)
- **Root Cause & Exact Code Trace**:
  - Lines `3482–3489` copy all fields of `originalDoc` into a brand-new `staff_accounts/{uid}` document while leaving `originalDoc` active in `staff_accounts`. Later disabling `originalDoc.id` in Admin Staff Manager does NOT disable `staff_accounts/{uid}`!
- **Real-World Impact**:
  - A disabled staff member can still log in via their cloned `staff_accounts/{uid}` doc, and `AdminStaffManagementPage` shows duplicate rows for the same staff member.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3489,1 +3489,2 @@
             }, { merge: true });
+            if (originalDoc.id !== uid) await originalDoc.ref.delete();
```

### `UDF-AUD-333` — **HIGH** | Security Vulnerability / `setAdminClaims` matches `staff_accounts` by `request.auth.token.email` without verifying `request.auth.token.email_verified === true`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:3924–3950`)
- **Root Cause & Exact Code Trace**:
  - Line `3924` reads `request.auth.token.email` and queries `staff_accounts.where('email', '==', email)` (`L3931`) without checking `request.auth.token.email_verified === true`.
- **Real-World Impact**:
  - If an unverified email/password Firebase Auth account matches a staff email, it can claim that staff member's admin JWT custom claims.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3924,1 +3924,1 @@
-    const email = (request.auth.token && request.auth.token.email) ? request.auth.token.email.toLowerCase().trim() : '';
+    const email = (request.auth.token && request.auth.token.email && request.auth.token.email_verified === true) ? request.auth.token.email.toLowerCase().trim() : '';
```

### `UDF-AUD-334` — **MEDIUM** | Security Vulnerability / `refreshAdminClaims` relies solely on `request.auth.token.isSuperAdmin === true` without checking Firestore `staff_accounts`/`users` for `roleId === 'role-super-admin'`, and omits `revokeRefreshTokens`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:3981–3998`)
- **Root Cause & Exact Code Trace**:
  - Line `3981` checks only the JWT claim `isSuperAdmin === true` (failing for newly promoted SuperAdmins with stale tokens) and does not stamp `claimsUpdatedAt` on `targetUid`'s Firestore doc.
- **Real-World Impact**:
  - Target users do not receive the `AuthContext` real-time `claimsUpdatedAt` trigger to refresh their token after `refreshAdminClaims` is called.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3997,1 +3997,2 @@
         const res = await computeAndApplyUserClaims(targetUid);
+        await db.collection('staff_accounts').doc(targetUid).set({ claimsUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
```

### `UDF-AUD-335` — **MEDIUM** | Broken Feature / Functional Bug / `onSettingsSitesWritten` only compares the global set of supervisor IDs across all sites, so moving a supervisor from Site A to Site B produces `changedSups.size === 0`!
- **Target File(s)**: `functions/index.js` (`functions/index.js:4138–4158`)
- **Root Cause & Exact Code Trace**:
  - `extractSupervisors(sites)` (`L4123–4130`) returns a flat `Set` of supervisor IDs without tracking which site IDs each supervisor manages. If supervisor X is removed from Site A and added to Site B in one edit, `beforeSups` and `afterSups` both contain X, so `changedSups` is empty!
- **Real-World Impact**:
  - Reassigning a supervisor from one site to another leaves their JWT `sitesManaged` claim stale until they manually re-login.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4123,6 +4123,6 @@
-    const extractSupervisors = (sites) => { const sups = new Set(); ... return sups; };
+    const extractSupSiteMap = (sites) => { const m = new Map(); for (const s of sites) { for (const id of new Set([s?.supervisorId, ...(s?.supervisorIds || [])].filter(Boolean))) { if (!m.has(id)) m.set(id, new Set()); m.get(id).add(s.id); } } return m; };
```

### `UDF-AUD-336` — **HIGH** | Security Vulnerability / `verifyCorrectionIdentity` never checks `expiresAt` (allowing expired correction links to be verified and submitted) and skips `email_verified === true` on Google verification.
- **Target File(s)**: `functions/index.js` (`functions/index.js:4253–4288`)
- **Root Cause & Exact Code Trace**:
  - Unlike `getCorrectionChallenge` (`L4195–4201`), `verifyCorrectionIdentity` (`L4255–4277`) never checks `data.expiresAt < new Date()`. Furthermore, `L4266` checks `request.auth.token.email` without `request.auth.token.email_verified === true`.
- **Real-World Impact**:
  - Expired correction links remain permanently usable for identity verification and data modification.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4261,1 +4261,4 @@
     if (data.status === 'locked' || (data.failedAttempts || 0) >= 5) {
         throw new functions.https.HttpsError('permission-denied', 'This correction link is locked due to too many failed attempts.');
     }
+    if (data.expiresAt && (data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)) < new Date()) {
+        throw new functions.https.HttpsError('failed-precondition', 'This correction link has expired.');
+    }
```

### `UDF-AUD-337` — **MEDIUM** | Security Vulnerability / `verifyCorrectionIdentity` updates `failedAttempts` non-transactionally, allowing concurrent brute-force attempts to bypass the 5-attempt lockout.
- **Target File(s)**: `functions/index.js` (`functions/index.js:4302–4314`)
- **Root Cause & Exact Code Trace**:
  - Line `4247` reads `data.failedAttempts` outside a transaction and `L4305` writes `(data.failedAttempts || 0) + 1` via `docRef.update`.
- **Real-World Impact**:
  - Parallel requests against a correction token can guess DOB + phone well beyond the 5-attempt limit.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4303,5 +4303,4 @@
-            const newAttempts = (data.failedAttempts || 0) + 1;
-            await docRef.update({ failedAttempts: newAttempts, ...(isNowLocked ? { status: 'locked' } : {}) });
+            const newAttempts = await db.runTransaction(async (tx) => { const s = await tx.get(docRef); const n = (s.data()?.failedAttempts || 0) + 1; tx.update(docRef, { failedAttempts: n, ...(n >= 5 ? { status: 'locked' } : {}) }); return n; });
```

### `UDF-AUD-338` — **HIGH** | Security Vulnerability / `logClientAuditEvent` omits `isDisabled` check, allows any non-guard `roleId` (including BGV vendors) to inject arbitrary audit logs, and lacks length limits on `details`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:5926–5932`)
- **Root Cause & Exact Code Trace**:
  - Line `5926` authorizes any token with `token.roleId && token.roleId !== 'none' && token.roleId !== 'role-security-guard'` without checking `token.isDisabled === true` or live Firestore status, and `L5946` writes unbounded `String(details)`.
- **Real-World Impact**:
  - Disabled staff or external BGV vendors can flood or poison corporate `audit_logs` with huge or misleading entries.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -5925,2 +5925,5 @@
+    if (token.isDisabled === true) {
+        throw new functions.https.HttpsError('permission-denied', 'Account is disabled.');
+    }
     const isStaffOrAdmin = token.isAdmin || token.isSuperAdmin || (token.roleId && token.roleId !== 'none' && token.roleId !== 'role-security-guard' && token.roleId !== 'role-bgv-vendor');
```

### `UDF-AUD-339` — **MEDIUM** | Broken Feature / Functional Bug / `recordDailyStreakServer` skips Dual-ID sync on a user's first-ever visit (`!streakSnap.exists`) and skips `userUid` on the first `gamification_logs` entry.
- **Target File(s)**: `functions/index.js` (`functions/index.js:7857–7909, 7924–7930`)
- **Root Cause & Exact Code Trace**:
  - Inside `if (!streakSnap.exists)` (`L7857–7882`), the function returns early without syncing `user_engagement/{uid}` when `targetDocId !== uid` and omits `userUid: uid` from the `gamification_logs` entry (`L7873–7880`), unlike `L7924–7942`.
- **Real-World Impact**:
  - On an employee's first visit, `user_engagement/{uid}` and `user_engagement/{employeeId}` start out desynchronized.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -7872,3 +7872,4 @@
             transaction.set(logRef, {
                 userId: targetDocId,
+                userUid: uid,
                 type: 'STREAK',
```

### `UDF-AUD-340` — **MEDIUM** | Broken Feature / Functional Bug / `redeemRewardServer` returns client-supplied `cost` (`pointsSpent`) instead of `verifiedCost` in the response payload.
- **Target File(s)**: `functions/index.js` (`functions/index.js:8082`)
- **Root Cause & Exact Code Trace**:
  - Line `8082` returns `pointsSpent: cost` (the untrusted client input) instead of `verifiedCost` (which was actually deducted at `L8037`).
- **Real-World Impact**:
  - If the client's cached reward price differs from server `gamification_rules`, the UI toast/state displays the wrong deducted amount.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -8082,1 +8082,1 @@
-        pointsSpent: cost,
+        pointsSpent: verifiedCost,
```

### `UDF-AUD-341` — **MEDIUM** | Broken Feature / Functional Bug / `redeemRewardServer` generates `voucherCode` using `Math.random().toString(36).substring(2, 7)` (only 5 base-36 chars) without uniqueness verification.
- **Target File(s)**: `functions/index.js` (`functions/index.js:8021–8023`)
- **Root Cause & Exact Code Trace**:
  - Line `8021` uses non-cryptographic `Math.random()` producing a short 5-character suffix that can be guessed or collide across redemptions.
- **Real-World Impact**:
  - Voucher codes are predictable and risk duplicate redemption code collisions.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -8021,1 +8021,2 @@
-    const randToken = Math.random().toString(36).substring(2, 7).toUpperCase();
+    const crypto = require('crypto');
+    const randToken = crypto.randomBytes(4).toString('hex').toUpperCase();
```

### `UDF-AUD-342` — **MEDIUM** | Broken Feature / Functional Bug / 12 exported Google Drive operations (`uploadToDrive`, `moveEmployeeFolder`, `renameEmployeeFolder`, `approveEmployeeFolder`, `createEmployeeFolder`, etc.) are silent no-ops that return success/empty string.
- **Target File(s)**: `src/services/driveService.ts` (`driveService.ts:10–58`)
- **Root Cause & Exact Code Trace**:
  - All 12 functions in `src/services/driveService.ts:10–58` only call `log.log(...)` and resolve immediately without calling any Cloud Function.
- **Real-World Impact**:
  - Callers across `employeeService.ts` and `App.tsx` believe Drive folders were created, renamed, moved, or archived to Recycle Bin when nothing happened in Google Drive.
- **Remediation (`diff`)**:
```diff
--- a/src/services/driveService.ts
+++ b/src/services/driveService.ts
@@ -31,3 +31,4 @@
 export const renameEmployeeFolder = async (oldName: string, newName: string): Promise<void> => {
-    log.log(`[DRIVE_SERVICE] Rename bypassed: ${oldName} -> ${newName} (server-managed).`);
+    const fn = httpsCallable(functions, 'syncEmployeeToGoogleDriveServer');
+    await fn({ recordId: newName, oldName });
 };
```

### `UDF-AUD-343` — **HIGH** | Broken Feature / Functional Bug / `sendFirestoreNotification` performs a direct client `addDoc(collection(db, 'notifications'), ...)`, which fails `firestore.rules` for non-SuperAdmins.
- **Target File(s)**: `src/services/notificationService.ts` (`notificationService.ts:76–95`)
- **Root Cause & Exact Code Trace**:
  - Line `83` writes directly to `notifications` via `addDoc` instead of invoking `sendNotificationServer`, and catches/swallows the resulting `permission-denied` error silently (`L92–94`).
- **Real-World Impact**:
  - Notifications sent through `sendFirestoreNotification` fail silently for regular staff and employees.
- **Remediation (`diff`)**:
```diff
--- a/src/services/notificationService.ts
+++ b/src/services/notificationService.ts
@@ -83,9 +83,3 @@
-        await addDoc(collection(db, NOTIF_COL), { ... });
+        const fn = httpsCallable(functions, 'sendNotificationServer');
+        await fn({ targetUserId, message, type, link: link || null });
```

### `UDF-AUD-344` — **MEDIUM** | Broken Feature / Functional Bug / `markAllRead` batches all unread notifications (including `ROLE:*` broadcasts) into a single `writeBatch` without chunking (`>500`) or filtering non-owned targets.
- **Target File(s)**: `src/services/notificationService.ts` (`notificationService.ts:172–188`)
- **Root Cause & Exact Code Trace**:
  - Line `178` adds `batch.update(ref, { read: true })` for every unread item, including shared `ROLE:*` broadcasts where one user marking read marks it read for ALL users in that role (or fails `firestore.rules` and aborts the entire batch).
- **Real-World Impact**:
  - One unreadable/shared notification in `currentNotifs` causes `batch.commit()` to fail atomically, preventing users from marking any notification as read.
- **Remediation (`diff`)**:
```diff
--- a/src/services/notificationService.ts
+++ b/src/services/notificationService.ts
@@ -174,1 +174,1 @@
-    const unread = currentNotifs.filter(n => !n.read);
+    const unread = currentNotifs.filter(n => !n.read && n.targetUserId === userId).slice(0, 450);
```

### `UDF-AUD-345` — **MEDIUM** | Broken Feature / Functional Bug / `updatePublicStats` calls direct client `setDoc(doc(db, 'settings', 'public_stats'), ...)` which fails `firestore.rules` for non-SuperAdmin staff.
- **Target File(s)**: `src/services/statsService.ts` (`statsService.ts:29–49`)
- **Root Cause & Exact Code Trace**:
  - Line `42` writes `settings/public_stats` directly from the browser whenever triggered by `AdminPortalPage`, failing with `permission-denied` for branch managers and silently swallowing the error (`L46–47`).
- **Real-World Impact**:
  - Public active employee count on the homepage becomes stale unless a SuperAdmin triggers `updatePublicStats`.
- **Remediation (`diff`)**:
```diff
--- a/src/services/statsService.ts
+++ b/src/services/statsService.ts
@@ -29,2 +29,4 @@
 export const updatePublicStats = async (): Promise<void> => {
+    // Should only be invoked by SuperAdmin or scheduled Cloud Function
```

### `UDF-AUD-346` — **MEDIUM** | Broken Feature / Functional Bug / `getBlogPosts` checks `!!auth?.currentUser` (which is `true` for anonymous Firebase sessions) and executes unbounded `getDocs` without `limit()`.
- **Target File(s)**: `src/services/blogService.ts` (`blogService.ts:23–32`)
- **Root Cause & Exact Code Trace**:
  - Line `23` treats anonymous sessions as authenticated staff/employees, and `L28` / `L31` fetch the entire `blog_posts` collection without pagination or `limit()`.
- **Real-World Impact**:
  - Anonymous onboarding visitors receive internal private blog posts, and every blog page load downloads the full HTML content of all historical posts.
- **Remediation (`diff`)**:
```diff
--- a/src/services/blogService.ts
+++ b/src/services/blogService.ts
@@ -23,1 +23,1 @@
-        const isAuth = !!auth?.currentUser;
+        const isAuth = !!auth?.currentUser && !auth.currentUser.isAnonymous;
```

### `UDF-AUD-347` — **MEDIUM** | Data Integrity / `updateBlogPost` overwrites `timestamp: serverTimestamp()` on every minor typo edit, bumping old blog posts to the top of the feed.
- **Target File(s)**: `src/services/blogService.ts` (`blogService.ts:87–94`)
- **Root Cause & Exact Code Trace**:
  - Line `91` sets `timestamp: serverTimestamp()` inside `updateBlogPost` instead of `updatedAt: serverTimestamp()`.
- **Real-World Impact**:
  - Editing an old article's spelling or tags reorders it above newly published articles.
- **Remediation (`diff`)**:
```diff
--- a/src/services/blogService.ts
+++ b/src/services/blogService.ts
@@ -91,1 +91,1 @@
-        timestamp: serverTimestamp(),
+        updatedAt: serverTimestamp(),
```

### `UDF-AUD-348` — **LOW** | Dead Code / Security Hygiene / `createInitialAdmin` writes directly to legacy `'staff'` collection instead of `'staff_accounts'` and omits `usernameLower` and `isDisabled`.
- **Target File(s)**: `src/utils/migrationHelper.ts` (`migrationHelper.ts:10–22`)
- **Root Cause & Exact Code Trace**:
  - Line `12` calls `setDoc(doc(db, 'staff', userId), ...)` using the deprecated `staff` collection without `usernameLower` or `isDisabled: false`.
- **Real-World Impact**:
  - If invoked, creates an incomplete legacy staff record that bypasses `staff_accounts` checks.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/migrationHelper.ts
+++ b/src/utils/migrationHelper.ts
@@ -12,1 +12,1 @@
-        await setDoc(doc(db, 'staff', userId), {
+        await setDoc(doc(db, 'staff_accounts', userId), {
```

### `UDF-AUD-349` — **LOW** | Reliability / `resilientFetch` does not handle `AbortSignal` / `AbortError` before sleeping 1.5s and lacks a request timeout.
- **Target File(s)**: `src/utils/resilientFetch.ts` (`resilientFetch.ts:50–67`)
- **Root Cause & Exact Code Trace**:
  - If a caller passes an `AbortController` signal or the browser hangs on a stalled mobile TCP socket, `resilientFetch` either waits indefinitely or sleeps 1.5s before retrying an aborted call.
- **Real-World Impact**:
  - Hung network probes or canceled component fetches can stall for minutes or retry after unmount.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/resilientFetch.ts
+++ b/src/utils/resilientFetch.ts
@@ -18,1 +18,2 @@
+    if (err?.name === 'AbortError' || init?.signal?.aborted) throw err;
     const isNetworkDrop = err?.name === 'TypeError' || (typeof navigator !== 'undefined' && !navigator.onLine);
```

### `UDF-AUD-350` — **MEDIUM** | Broken Feature / Functional Bug / `buildSubUnitLookupMap` silently overwrites collisions when two sites share a sub-unit name (e.g., `'Main Gate'` or `'Block A'`).
- **Target File(s)**: `src/utils/subUnitUtils.ts` (`subUnitUtils.ts:46–59`)
- **Root Cause & Exact Code Trace**:
  - Lines `51` and `54` key a flat `Map` by `subUnit.name.toLowerCase().trim()` alone without scoping by parent site.
- **Real-World Impact**:
  - Bulk imports resolving common sub-unit names like `'Gate 1'` or `'Main Block'` silently assign employees to whichever site appeared last in `settings/sites`.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/subUnitUtils.ts
+++ b/src/utils/subUnitUtils.ts
@@ -51,1 +51,2 @@
             map.set(subUnit.name.toLowerCase().trim(), { site, subUnit });
+            map.set(`${site.name.toLowerCase().trim()}::${subUnit.name.toLowerCase().trim()}`, { site, subUnit });
```

### `UDF-AUD-351` — **LOW** | Broken Feature / Functional Bug / `showUndoToast` allows double-clicking `UNDO` before `toast.dismiss(t.id)` unmounts the button, triggering duplicate `restoreFromRecycleBin` calls.
- **Target File(s)**: `src/utils/undoToast.tsx` (`undoToast.tsx:55–66`)
- **Root Cause & Exact Code Trace**:
  - Line `56` lacks a local `inFlight` guard or `disabled` state on the `UNDO` button.
- **Real-World Impact**:
  - Rapid double-clicks on `UNDO` fire two concurrent `restoreFromRecycleBin` calls, with the second throwing `'Record not found in Recycle Bin'`.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/undoToast.tsx
+++ b/src/utils/undoToast.tsx
@@ -38,1 +38,2 @@
+  let clicked = false;
   toast.custom((t) => (
@@ -56,1 +57,2 @@
           onClick={async () => {
+            if (clicked) return; clicked = true;
```

### `UDF-AUD-352` — **MEDIUM** | Broken Feature / Functional Bug / `getApplicantName` matches `'Father's Name'` / `'Mother's Name'` / `'Bank Name'` via `labelLower.includes('name')`, and `getApplicantPAN` matches `'Company'` / `'Expansion'` via `labelLower.includes('pan')`!
- **Target File(s)**: `utils/formDataHelper.ts` (`formDataHelper.ts:14–39, 97–136`)
- **Root Cause & Exact Code Trace**:
  - Line `15` includes generic `'name'` in `nameFieldLabels.full` (`L26`) so the first field whose label contains `'name'` (e.g. `'Father Name'` or `'Bank Name'`) immediately breaks out as `fullName`. Likewise, `L126` checks `labelLower.includes('pan')`, matching `'Company Name'`!
- **Real-World Impact**:
  - Applicant name extraction and PAN extraction can silently pull `'Bank Name'` or `'Company Name'` depending on section/field order.
- **Remediation (`diff`)**:
```diff
--- a/utils/formDataHelper.ts
+++ b/utils/formDataHelper.ts
@@ -15,1 +15,1 @@
-    full: ['full name', 'applicant name', 'name'],
+    full: ['full name', 'applicant name', 'employee name'],
@@ -126,1 +126,1 @@
-      if (labelLower.includes('pan card') || labelLower.includes('pan no') || labelLower.includes('pan') || labelLower.includes('permanent account number')) {
+      if (/(^|\b)pan(\b|\s*(card|no|number))|permanent account number/i.test(labelLower)) {
```

### `UDF-AUD-353` — **LOW** | Broken Feature / Functional Bug / `checkImageBlurry` divides by `count` (which is `0` when `height <= 2` on ultra-wide strips, returning `NaN`) and JSDoc says threshold `12.0` while code hardcodes `50.0`.
- **Target File(s)**: `utils/imageScanner.ts` (`imageScanner.ts:29–30, 105, 130`)
- **Root Cause & Exact Code Trace**:
  - Line `63` computes `sum / count` and `L73` computes `varianceSum / count` without guarding `count === 0`, and `L15` documents `12.0` while `L74` uses `50.0`.
- **Real-World Impact**:
  - Extreme aspect-ratio images produce `NaN` blur scores, and the `50.0` threshold produces false blur warnings on clean low-contrast ID cards.
- **Remediation (`diff`)**:
```diff
--- a/utils/imageScanner.ts
+++ b/utils/imageScanner.ts
@@ -62,1 +62,2 @@
+    if (count === 0) return { score: 0, isBlurry: false };
     const mean = sum / count;
```

### `UDF-AUD-354` — **MEDIUM** | Broken Feature / Functional Bug / Forgot Password modal never resets `resetStatus` / `resetEmail` when reopened after a previous success or error.
- **Target File(s)**: `components/auth/AdminLoginPage.tsx` (`AdminLoginPage.tsx:26–36, 102–125`)
- **Root Cause & Exact Code Trace**:
  - Closing the modal (`L105, L119`) only calls `setShowResetModal(false)` without resetting `resetStatus` to `'idle'` or clearing `resetEmail`.
- **Real-World Impact**:
  - Reopening 'Forgot your password?' after one reset attempt stays permanently stuck on `'Password reset email sent!'` with no input form.
- **Remediation (`diff`)**:
```diff
--- a/components/auth/AdminLoginPage.tsx
+++ b/components/auth/AdminLoginPage.tsx
@@ -66,1 +66,1 @@
-                        <button type="button" onClick={() => setShowResetModal(true)} className="font-medium text-blue-600 hover:text-blue-500">
+                        <button type="button" onClick={() => { setResetStatus('idle'); setResetEmail(''); setShowResetModal(true); }} className="font-medium text-blue-600 hover:text-blue-500">
```

### `UDF-AUD-355` — **MEDIUM** | Broken Feature / Functional Bug / Desktop/mobile portal links navigate to `/admin/dashboard` or `/employee/dashboard` via SPA `navigate()`, which fails when running on `udfonline.in` (`VITE_APP_TARGET=public`).
- **Target File(s)**: `components/common/PublicHeader.tsx` (`PublicHeader.tsx:160–166, 258, 340`)
- **Root Cause & Exact Code Trace**:
  - `PublicHeader.tsx:162` links employees to `/dashboard` and `L258`/`L340` call `navigate('/admin/dashboard')` or `navigate('/employee/dashboard')` instead of subdomain URLs.
- **Real-World Impact**:
  - Logged-in admins/employees clicking their portal link on the main marketing site hit broken/redirecting routes.
- **Remediation (`diff`)**:
```diff
--- a/components/common/PublicHeader.tsx
+++ b/components/common/PublicHeader.tsx
@@ -258,1 +258,1 @@
-                                                            navigate(user.type === 'Admin' ? '/admin/dashboard' : '/employee/dashboard');
+                                                            window.location.href = user.type === 'Admin' ? 'https://admin.udfonline.in/dashboard' : 'https://employee.udfonline.in/dashboard';
```

### `UDF-AUD-356` — **LOW** | Accessibility / UX / Navigation items use clickable `<span>` and `<div>` elements instead of semantic `<a>` or `<button>` elements.
- **Target File(s)**: `components/common/PublicHeader.tsx`<br>`components/common/PublicFooter.tsx` (`PublicHeader.tsx:80–90, 207`<br>`PublicFooter.tsx:39–65`)
- **Root Cause & Exact Code Trace**:
  - All header and footer nav links (`PublicHeader.tsx:81–88`, `PublicFooter.tsx:40–65`) are `<span>` tags with `onClick` handlers.
- **Real-World Impact**:
  - Prevents keyboard Tab navigation, screen-reader link announcements, right-click 'Open in new tab', and search engine crawlability.
- **Remediation (`diff`)**:
```diff
--- a/components/common/PublicFooter.tsx
+++ b/components/common/PublicFooter.tsx
@@ -40,1 +40,1 @@
-                                <span onClick={() => navigate('/')} className="hover:text-blue-400 transition-colors cursor-pointer">Home</span>
+                                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="hover:text-blue-400 transition-colors">Home</a>
```

### `UDF-AUD-357` — **MEDIUM** | Broken Feature / Functional Bug / 'Join UDF (Apply Online)' buttons in `PublicFooter` still link to an external Google Form (`https://forms.gle/f86UXjTiusatMUVd7`) instead of the portal's `/join` onboarding workflow.
- **Target File(s)**: `components/common/PublicFooter.tsx` (`PublicFooter.tsx:88–95, 110–117`)
- **Root Cause & Exact Code Trace**:
  - Lines `89` and `111` hardcode `href="https://forms.gle/f86UXjTiusatMUVd7"`, bypassing the portal's Firestore onboarding, duplicate detection, and BGV pipeline.
- **Real-World Impact**:
  - Candidates clicking 'Join UDF' from the footer are sent off-site to a legacy Google Form instead of `/join`.
- **Remediation (`diff`)**:
```diff
--- a/components/common/PublicFooter.tsx
+++ b/components/common/PublicFooter.tsx
@@ -89,1 +89,1 @@
-                                href="https://forms.gle/f86UXjTiusatMUVd7"
+                                href="/join"
```

### `UDF-AUD-358` — **LOW** | Broken Feature / Functional Bug / `SEOHead` unconditionally overwrites `<meta name="robots">` to `'index, follow'` on mount, defeating `vite.config.ts`'s `noindex, nofollow` transform on admin/employee subdomains.
- **Target File(s)**: `src/components/common/SEOHead.tsx` (`SEOHead.tsx:58–65`)
- **Root Cause & Exact Code Trace**:
  - Line `64` sets `robotsEl.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow')` with default `noindex = false`, without checking `VITE_APP_TARGET`.
- **Real-World Impact**:
  - If any page rendering `SEOHead` mounts on `admin.udfonline.in` or `employee.udfonline.in`, it flips `robots` back to `index, follow`.
- **Remediation (`diff`)**:
```diff
--- a/src/components/common/SEOHead.tsx
+++ b/src/components/common/SEOHead.tsx
@@ -64,1 +64,2 @@
-        robotsEl.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');
+        const isPrivatePortal = ['admin', 'employee'].includes(import.meta.env.VITE_APP_TARGET || '');
+        robotsEl.setAttribute('content', (noindex || isPrivatePortal) ? 'noindex, nofollow' : 'index, follow');
```

### `UDF-AUD-359` — **MEDIUM** | Broken Feature / Functional Bug / `moveField` passes `sortedFields` indices (`currentIndex`, `newIndex`) to `onReorderFields`, which splices the unsorted `section.fields` array.
- **Target File(s)**: `components/SectionItem.tsx` (`SectionItem.tsx:84–92`)
- **Root Cause & Exact Code Trace**:
  - `SectionItem.tsx:84` sorts a copy (`sortedFields`) and passes its indices to `onReorderFields` (`L91`), while `useFormBuilder.ts:115` splices `Array.from(section.fields)` directly.
- **Real-World Impact**:
  - When `section.fields` is not already stored in `order`-sorted sequence, clicking Up/Down moves the wrong field.
- **Remediation (`diff`)**:
```diff
--- a/hooks/useFormBuilder.ts
+++ b/hooks/useFormBuilder.ts
@@ -115,1 +115,1 @@
-          const result = Array.from(section.fields);
+          const result = [...section.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
```

### `UDF-AUD-360` — **LOW** | Broken Feature / Functional Bug / `newName` state is initialized once from `section.name` and never synced if `section.name` changes via Firestore snapshot; also uses deprecated `onKeyPress`.
- **Target File(s)**: `components/SectionItem.tsx` (`SectionItem.tsx:49, 102–109`)
- **Root Cause & Exact Code Trace**:
  - Line `49` sets `useState(section.name)` without a syncing `useEffect`, and `L106` uses deprecated React `onKeyPress` instead of `onKeyDown`.
- **Real-World Impact**:
  - Editing a section name after a remote update can revert the title to the stale initial string.
- **Remediation (`diff`)**:
```diff
--- a/components/SectionItem.tsx
+++ b/components/SectionItem.tsx
@@ -106,1 +106,1 @@
-                onKeyPress={(e) => e.key === 'Enter' && handleNameSave()}
+                onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
```

### `UDF-AUD-361` — **MEDIUM** | Broken Feature / Functional Bug / `useEffect` lacks an unmount cancellation flag (race condition when switching `employeeId` rapidly) and `new Date(event.date).toLocaleDateString()` renders `'Invalid Date'` on missing dates.
- **Target File(s)**: `components/events/EmployeeTimelinePage.tsx` (`EmployeeTimelinePage.tsx:21–40, 142`)
- **Root Cause & Exact Code Trace**:
  - Lines `22–38` set `employee` and `events` unconditionally when async calls resolve, and `L142` does not validate `!isNaN(d.getTime())`.
- **Real-World Impact**:
  - Switching between employees quickly can overwrite the current employee's timeline with the previous employee's slower response.
- **Remediation (`diff`)**:
```diff
--- a/components/events/EmployeeTimelinePage.tsx
+++ b/components/events/EmployeeTimelinePage.tsx
@@ -21,2 +21,3 @@
     useEffect(() => {
+        let cancelled = false;
         const fetchData = async () => {
@@ -27,2 +28,2 @@
-                setEmployee(empData as unknown as FirestoreEmployee);
+                if (!cancelled) setEmployee(empData as unknown as FirestoreEmployee);
```

### `UDF-AUD-362` — **MEDIUM** | Broken Feature / Functional Bug / `assignedSites` and `reportingHierarchy` check only `s.supervisorId === authUser?.id`, ignoring multi-supervisor `s.supervisorIds` and `staffDetails.sitesManaged`.
- **Target File(s)**: `components/AdminStaffProfilePage.tsx` (`AdminStaffProfilePage.tsx:57–59, 75–77`)
- **Root Cause & Exact Code Trace**:
  - Lines `58` and `76` filter `sites` exclusively by `s.supervisorId === id`, ignoring `s.supervisorIds?.includes(id)` and `sitesManaged`.
- **Real-World Impact**:
  - Co-supervisors see `0 Assigned Sites` and `0 Total Guards` on their Staff Profile page and in the Field Operations Hierarchy.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminStaffProfilePage.tsx
+++ b/components/AdminStaffProfilePage.tsx
@@ -58,1 +58,1 @@
-    return sites.filter(s => s.supervisorId === authUser?.id && s.status === 'Active');
+    return sites.filter(s => (s.supervisorId === authUser?.id || (s as any).supervisorIds?.includes(authUser?.id) || staffDetails?.sitesManaged?.includes(s.id)) && s.status === 'Active');
```

### `UDF-AUD-363` — **MEDIUM** | Broken Feature / Functional Bug / Duplicate legacy `src/components/employeeFormFields/EmployeeFileUploadField.tsx` lacks file-size, MIME-type, and compression checks and has no `accept` attribute on `<Input type="file">`.
- **Target File(s)**: `src/components/employeeFormFields/EmployeeFileUploadField.tsx` (`src/components/employeeFormFields/EmployeeFileUploadField.tsx:33–55`)
- **Root Cause & Exact Code Trace**:
  - Unlike `components/employeeFormFields/EmployeeFileUploadField.tsx`, this duplicate file (`L33–55`) uploads any file type/size directly to `uploadSubmissionDocument` without validation.
- **Real-World Impact**:
  - Any consumer importing from `src/components/employeeFormFields/` allows arbitrary file types and oversized uploads.
- **Remediation (`diff`)**:
```diff
--- a/src/components/employeeFormFields/EmployeeFileUploadField.tsx
+++ b/src/components/employeeFormFields/EmployeeFileUploadField.tsx
@@ -37,2 +37,5 @@
         if (file) {
+            if (file.size > 10 * 1024 * 1024) { setUploadError('File must be under 10MB.'); return; }
+            if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { setUploadError('Only images and PDFs allowed.'); return; }
```

### `UDF-AUD-364` — **HIGH** | Broken Feature / Functional Bug / `getAdminProfile` returns `id: data.username || firebaseUser.uid` instead of `firebaseUser.uid`, breaking all downstream `doc(db, 'users', user.id)` and `staff_accounts/{user.id}` lookups.
- **Target File(s)**: `src/services/authService.ts` (`authService.ts:260–286`)
- **Root Cause & Exact Code Trace**:
  - Lines `263` and `282` set `id: data.username || firebaseUser.uid`. Because `AuthContext.tsx:153, 159` listens to `doc(db, 'staff_accounts', user.id)` and `doc(db, 'users', user.id)`, passing a `username` string causes listeners and `ProfileAvatar` writes to target the wrong document!
- **Real-World Impact**:
  - SuperAdmins with a `username` field fail real-time claim listeners and profile photo updates.
- **Remediation (`diff`)**:
```diff
--- a/src/services/authService.ts
+++ b/src/services/authService.ts
@@ -263,1 +263,1 @@
-                id: data.username || firebaseUser.uid,
+                id: firebaseUser.uid,
```

### `UDF-AUD-365` — **HIGH** | Security & Functional Bug / `checkEmailUniquenessGlobal` fails open (`return true`) on any error, allowing duplicate registrations whenever the Cloud Function times out or rejects.
- **Target File(s)**: `src/services/authService.ts` (`authService.ts:299–321`)
- **Root Cause & Exact Code Trace**:
  - Lines `314–319` catch all errors (including `unauthenticated` or network errors) and return `true` (unique).
- **Real-World Impact**:
  - Duplicate candidate accounts with already-registered emails can bypass uniqueness validation during transient outages.
- **Remediation (`diff`)**:
```diff
--- a/src/services/authService.ts
+++ b/src/services/authService.ts
@@ -314,6 +314,2 @@
     } catch (e) {
         log.warn("Global email uniqueness check service error:", e);
-        return true;
+        throw new Error('Unable to verify email uniqueness right now. Please try again.');
     }
```

### `UDF-AUD-366` — **MEDIUM** | Broken Feature / Functional Bug / `loginUser` hardcodes `type: UserType.EMPLOYEE` in its return value even when called by Admins/Staff logging into the management portal.
- **Target File(s)**: `src/services/authService.ts` (`authService.ts:345–349`)
- **Root Cause & Exact Code Trace**:
  - Line `346` always returns `{ type: UserType.EMPLOYEE, ... }` regardless of `portalType`.
- **Real-World Impact**:
  - Any caller relying on `loginUser`'s returned `User` object misclassifies Admins as `UserType.EMPLOYEE` until `AuthContext` re-hydrates.
- **Remediation (`diff`)**:
```diff
--- a/src/services/authService.ts
+++ b/src/services/authService.ts
@@ -345,5 +345,5 @@
-        return {
-            type: UserType.EMPLOYEE,
-            id: userCredential.user.uid,
-            name: userCredential.user.displayName || 'User'
-        };
+        const admin = await getAdminProfile(userCredential.user) || await getStaffProfile(userCredential.user);
+        return admin || await getEmployeeProfile(userCredential.user);
```

### `UDF-AUD-367` — **MEDIUM** | Broken Feature / Functional Bug / `getCurrentUser` does not unsubscribe `onAuthStateChanged` if `timeoutMs` fires first, leaking a permanent Auth listener.
- **Target File(s)**: `src/services/authService.ts` (`authService.ts:409–466`)
- **Root Cause & Exact Code Trace**:
  - Lines `412–417` resolve `null` on timeout without calling `unsubscribe()`.
- **Real-World Impact**:
  - If Firebase Auth takes longer than 5 seconds on slow mobile networks, `getCurrentUser` resolves `null` and leaks an active `onAuthStateChanged` listener.
- **Remediation (`diff`)**:
```diff
--- a/src/services/authService.ts
+++ b/src/services/authService.ts
@@ -412,6 +412,7 @@
+        let unsubscribe = () => {};
         const timeout = setTimeout(() => {
             if (!resolved) {
                 resolved = true;
+                unsubscribe();
                 resolve(null);
             }
         }, timeoutMs);
```

### `UDF-AUD-368` — **HIGH** | Security Vulnerability / `restoreFromRecycleBin` falls back to direct client-side Firestore writes when `restoreRecycleBinServer` rejects (even on `permission-denied`), and `case 'EMPLOYEE'` sets `isActive: true` without checking `isRelieved`.
- **Target File(s)**: `src/services/recycleBinService.ts` (`recycleBinService.ts:139–141, 200–204`)
- **Root Cause & Exact Code Trace**:
  - Lines `139–141` catch ALL errors from `restoreRecycleBinServer` and run local client-side restore (`L143–341`), where `L237` unconditionally sets `isActive: true, status: 'Active'` on relieved employees.
- **Real-World Impact**:
  - A server-side `permission-denied` rejection triggers a client fallback attempt, and restoring a soft-deleted relieved employee reactivates them.
- **Remediation (`diff`)**:
```diff
--- a/src/services/recycleBinService.ts
+++ b/src/services/recycleBinService.ts
@@ -139,3 +139,4 @@
   } catch (serverErr: any) {
+    if (serverErr?.code === 'functions/permission-denied') throw serverErr;
     console.warn('[RECYCLE_BIN] Server restore failed, falling back to local restore:', serverErr);
   }
```

### `UDF-AUD-369` — **MEDIUM** | Broken Feature / Data Integrity / `permanentDeleteFromRecycleBin` deletes the `recycle_bin` entry even if purging the underlying `STAFF`/`EMPLOYEE`/`SUBMISSION` failed, and never purges `SITE`/`VACANCY`/`INVITE`.
- **Target File(s)**: `src/services/recycleBinService.ts` (`recycleBinService.ts:356–380`)
- **Root Cause & Exact Code Trace**:
  - Lines `374–376` catch and ignore purge errors, then `L379` executes `await deleteDoc(binDocRef)` anyway.
- **Real-World Impact**:
  - If `permanentDeleteEmployee` or `deleteStaffUser` fails, the Recycle Bin entry vanishes while the underlying account and Storage files remain orphaned.
- **Remediation (`diff`)**:
```diff
--- a/src/services/recycleBinService.ts
+++ b/src/services/recycleBinService.ts
@@ -374,3 +374,3 @@
       } catch (purgeErr) {
-        console.warn(`Could not purge underlying ${binData.itemType} (${originalId}):`, purgeErr);
+        throw new Error(`Underlying ${binData.itemType} purge failed; keeping Recycle Bin entry.`);
       }
```

### `UDF-AUD-370` — **LOW** | Security / Configuration / Hardcodes the Google OAuth Web Client ID in three separate places instead of reading from `import.meta.env.VITE_GOOGLE_CLIENT_ID`.
- **Target File(s)**: `src/utils/googleAuthHelper.ts` (`googleAuthHelper.ts:48, 110, 157`)
- **Root Cause & Exact Code Trace**:
  - Lines `48`, `110`, and `157` duplicate the literal OAuth client ID `'1020534793994-rgenpapsrvjdbt2r6hicnkolfd28rdup.apps.googleusercontent.com'`.
- **Real-World Impact**:
  - Rotating or separating staging vs. production OAuth client IDs requires editing three hardcoded strings.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/googleAuthHelper.ts
+++ b/src/utils/googleAuthHelper.ts
@@ -48,1 +48,1 @@
-                clientId: '1020534793994-rgenpapsrvjdbt2r6hicnkolfd28rdup.apps.googleusercontent.com',
+                clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
```

### `UDF-AUD-371` — **MEDIUM** | Performance / Memory Leak / `compressPdf` never destroys `pdfJsDoc` / `page.cleanup()` or zeroes offscreen canvas dimensions, causing browser tab OOM crashes on large multi-page PDFs.
- **Target File(s)**: `src/utils/pdfCompression.ts` (`pdfCompression.ts:83–125`)
- **Root Cause & Exact Code Trace**:
  - Inside the loop (`L83–124`), each page allocates a up-to-2400px canvas and keeps `pdfjs-dist` worker memory alive without calling `page.cleanup()`, `canvas.width = 0`, or `await pdfJsDoc.destroy()`.
- **Real-World Impact**:
  - Compressing a 15–30 page scanned PDF on mobile Android browsers can crash the tab with Out-Of-Memory.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/pdfCompression.ts
+++ b/src/utils/pdfCompression.ts
@@ -123,2 +123,5 @@
             });
+            page.cleanup();
+            canvas.width = 0; canvas.height = 0;
         }
+        await pdfJsDoc.destroy();
```

### `UDF-AUD-372` — **MEDIUM** | Broken Feature / Functional Bug / `dataUrlToUint8Array` calls `atob(dataUrl.split(',')[1])` without guarding empty/malformed canvas output (`data:,`).
- **Target File(s)**: `src/utils/pdfCompression.ts` (`pdfCompression.ts:13–22`)
- **Root Cause & Exact Code Trace**:
  - If canvas allocation fails on a memory-constrained mobile device, `canvas.toDataURL()` returns `'data:,'`, causing `atob('')` -> 0-byte JPEG -> `embedJpg` crash.
- **Real-World Impact**:
  - Aborts PDF compression unexpectedly instead of skipping or falling back cleanly.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/pdfCompression.ts
+++ b/src/utils/pdfCompression.ts
@@ -14,2 +14,3 @@
     const base64 = dataUrl.split(',')[1];
+    if (!base64) throw new Error('Empty canvas export');
     const binary = atob(base64);
```

### `UDF-AUD-373` — **HIGH** | Security Vulnerability / `SAFE_URL_PATTERN` allows protocol-relative URLs (`//evil.com/phish`), and the non-DOM fallback regex (`L28–30`) fails to strip `<iframe>`, `<svg onload>`, `<object>`, or `src="javascript:..."`.
- **Target File(s)**: `src/utils/sanitizeHtml.ts` (`sanitizeHtml.ts:19, 26–31, 75–80`)
- **Root Cause & Exact Code Trace**:
  - `/^...|\//` matches `//evil.com` because it starts with `/`. In Node/SSR fallback (`L26–31`), only `<script>`, `on*=`, and `href=javascript:` are stripped, leaving `src=javascript:`, `<iframe>`, and `<svg>` intact.
- **Real-World Impact**:
  - Allows external resource hijacking via protocol-relative URLs and XSS if `sanitizeHtml` is ever called in a Node/SSR build script.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/sanitizeHtml.ts
+++ b/src/utils/sanitizeHtml.ts
@@ -19,1 +19,1 @@
-const SAFE_URL_PATTERN = /^(https?:\/\/|\/|#|mailto:|tel:)/i;
+const SAFE_URL_PATTERN = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;
```

### `UDF-AUD-374` — **MEDIUM** | Broken Feature / Functional Bug / Canonical origin redirect (`index.tsx:16–20`) checks `h.includes('-employee')`, whereas `AdminCorrectionRequestsPage.tsx:70` uses `-emp.web.app`!
- **Target File(s)**: `index.tsx` (`index.tsx:16–21`)
- **Root Cause & Exact Code Trace**:
  - If Firebase Hosting's employee target uses `-emp.web.app`, `h.includes('-employee')` (`index.tsx:19`, `index.html:18`) evaluates to `false` and redirects employee links to `udfonline.in` instead of `employee.udfonline.in`.
- **Real-World Impact**:
  - Employee portal links on `*-emp.web.app` redirect to the wrong domain (`udfonline.in`).
- **Remediation (`diff`)**:
```diff
--- a/index.tsx
+++ b/index.tsx
@@ -19,1 +19,1 @@
-    else if (h.includes('-employee')) target = 'employee.udfonline.in';
+    else if (h.includes('-employee') || h.includes('-emp')) target = 'employee.udfonline.in';
```

### `UDF-AUD-375` — **MEDIUM** | Broken Feature / UX / `triggerSafeReload` sets `(window as any).__UDF_UPDATE_PENDING = true` and never clears it if the user closes the toast or cancels, and `setInterval` timers (`L201, L237`) never check `navigator.onLine`.
- **Target File(s)**: `index.tsx` (`index.tsx:182–202, 237`)
- **Root Cause & Exact Code Trace**:
  - Line `146` sets a global flag that suppresses all future update prompts for the lifetime of the tab, and the 15-minute `setInterval` polls `/version.json` even when offline.
- **Real-World Impact**:
  - Users who dismiss an update prompt while editing a form are never prompted again even for subsequent deployments.
- **Remediation (`diff`)**:
```diff
--- a/index.tsx
+++ b/index.tsx
@@ -210,1 +210,2 @@
   const checkVersionProbe = async () => {
+    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
```

### `UDF-AUD-376` — **MEDIUM** | Broken Feature / Functional Bug / `photoURL` local state is initialized once from `currentPhotoURL` (`L29`) and never synced when `currentPhotoURL` prop changes.
- **Target File(s)**: `components/ProfileAvatar.tsx` (`ProfileAvatar.tsx:29, 35–58`)
- **Root Cause & Exact Code Trace**:
  - If a parent component switches from Employee A to Employee B without changing React `key`, `ProfileAvatar` continues rendering Employee A's avatar!
- **Real-World Impact**:
  - Viewing different employee profiles in sequence displays the wrong person's profile photo.
- **Remediation (`diff`)**:
```diff
--- a/components/ProfileAvatar.tsx
+++ b/components/ProfileAvatar.tsx
@@ -34,1 +34,4 @@
+    React.useEffect(() => {
+        setPhotoURL(currentPhotoURL);
+    }, [currentPhotoURL]);
```

### `UDF-AUD-377` — **LOW** | Broken Feature / Functional Bug / Uses `id={avatar-upload-${userId}}` for the hidden `<input type="file">`, causing duplicate DOM IDs whenever two `ProfileAvatar` instances for the same user render simultaneously (e.g., header + profile page).
- **Target File(s)**: `components/ProfileAvatar.tsx` (`ProfileAvatar.tsx:172, 201`)
- **Root Cause & Exact Code Trace**:
  - Lines `172` and `201` build the DOM ID solely from `userId` without React's `useId()`.
- **Real-World Impact**:
  - Clicking the camera overlay on one avatar can trigger the wrong hidden file input element.
- **Remediation (`diff`)**:
```diff
--- a/components/ProfileAvatar.tsx
+++ b/components/ProfileAvatar.tsx
@@ -32,1 +32,2 @@
     const fileInputRef = useRef<HTMLInputElement>(null);
+    const inputId = React.useId();
```

### `UDF-AUD-378` — **MEDIUM** | Broken Feature / Functional Bug / `isPlaceholderValue` treats `'0'` as a missing/placeholder value, and `L482` reads `(employeeData.data || {})[field.id]` instead of `dataMap[field.id]` (which falls back to `formData`).
- **Target File(s)**: `components/employee/EmployeeProfileView.tsx` (`EmployeeProfileView.tsx:310, 482`)
- **Root Cause & Exact Code Trace**:
  - Line `49` flags `'0'` (e.g., `'0'` years experience or `'0'` dependents) as a placeholder needing update, and `L482` ignores `employeeData.formData` even though `L263` defined `dataMap = employeeData.data || employeeData.formData || {}`.
- **Real-World Impact**:
  - Submissions/profiles storing values in `formData` render completely blank in `EmployeeProfileView`, and numeric `0` values show false `'Needs Update'` warnings.
- **Remediation (`diff`)**:
```diff
--- a/components/employee/EmployeeProfileView.tsx
+++ b/components/employee/EmployeeProfileView.tsx
@@ -482,1 +482,1 @@
-                        {renderReadOnlyField(field, (employeeData.data || {})[field.id])}
+                        {renderReadOnlyField(field, dataMap[field.id])}
```

### `UDF-AUD-379` — **LOW** | UX / Accessibility / Site Identifier popover close button renders `<ExternalLink>` instead of a close (`X`) icon and lacks `aria-label`.
- **Target File(s)**: `components/employee/EmployeeProfileView.tsx` (`EmployeeProfileView.tsx:373–375`)
- **Root Cause & Exact Code Trace**:
  - Line `374` uses `<ExternalLink size={14} />` on the button that calls `setPopoverSite(null)`.
- **Real-World Impact**:
  - Users think the close button opens an external link rather than dismissing the popover.
- **Remediation (`diff`)**:
```diff
--- a/components/employee/EmployeeProfileView.tsx
+++ b/components/employee/EmployeeProfileView.tsx
@@ -373,3 +373,3 @@
-                  <button onClick={() => setPopoverSite(null)} className="text-white/60 hover:text-white transition-colors">
-                    <ExternalLink size={14} />
+                  <button onClick={() => setPopoverSite(null)} aria-label="Close" className="text-white/60 hover:text-white transition-colors">
+                    ×
                   </button>
```

### `UDF-AUD-380` — **MEDIUM** | Broken Feature / Functional Bug / On `employeeGoogleLogin` `not-found` fallback (`L164–167`), `GoogleAuthProvider.credential(googleResult.idToken)` receives a Firebase Auth ID token instead of a Google OAuth ID token!
- **Target File(s)**: `components/EmployeeLoginPage.tsx` (`EmployeeLoginPage.tsx:134–170`)
- **Root Cause & Exact Code Trace**:
  - `getGoogleCredentialSafely()` (`googleAuthHelper.ts:73`) returns `userCred.user.getIdToken()` (a **Firebase** JWT), NOT the raw Google OAuth `idToken`. Passing a Firebase JWT into `GoogleAuthProvider.credential(...)` (`L165`) throws `auth/invalid-credential`!
- **Real-World Impact**:
  - Public candidates signing in with Google on `/login` crash with `auth/invalid-credential` instead of seeing the `'Google Login Successful / Join Now'` screen.
- **Remediation (`diff`)**:
```diff
--- a/components/EmployeeLoginPage.tsx
+++ b/components/EmployeeLoginPage.tsx
@@ -165,2 +165,2 @@
-          const credential = GoogleAuthProvider.credential(googleResult.idToken);
-          await signInWithCredential(auth, credential);
+          const { googleSignIn } = await import('../src/utils/googleAuthHelper');
+          await googleSignIn();
```

### `UDF-AUD-381` — **LOW** | Broken Feature / UX / Forgot Password Step 2 'Verify' button silently does nothing when any required field is empty, with zero validation error message.
- **Target File(s)**: `components/EmployeeLoginPage.tsx` (`EmployeeLoginPage.tsx:358–366`)
- **Root Cause & Exact Code Trace**:
  - Lines `363–365` check `if (resetDetails.name && resetDetails.mobile && resetDetails.aadhar && resetDetails.dob) setResetStep(3);` with no `else` branch setting `resetErrorMsg`.
- **Real-World Impact**:
  - Users who miss one field click 'Verify' repeatedly with no feedback.
- **Remediation (`diff`)**:
```diff
--- a/components/EmployeeLoginPage.tsx
+++ b/components/EmployeeLoginPage.tsx
@@ -364,1 +364,2 @@
-                        if (resetDetails.name && resetDetails.mobile && resetDetails.aadhar && resetDetails.dob) setResetStep(3);
+                        if (resetDetails.name && resetDetails.mobile && resetDetails.aadhar && resetDetails.dob) { setResetErrorMsg(''); setResetStep(3); }
+                        else { setResetErrorMsg('Please fill in all 4 verification fields.'); setResetStatus('error'); }
```

### `UDF-AUD-382` — **LOW** | Broken Feature / Functional Bug / Header 'Careers' nav item on both legal pages navigates to `'/'` instead of `'/careers'`, and both pages omit `PublicHeader`/`PublicFooter`.
- **Target File(s)**: `components/PrivacyPolicyPage.tsx`<br>`components/TermsOfServicePage.tsx` (`PrivacyPolicyPage.tsx:33`<br>`TermsOfServicePage.tsx:33`)
- **Root Cause & Exact Code Trace**:
  - `PrivacyPolicyPage.tsx:33` and `TermsOfServicePage.tsx:33` have `onClick={() => navigate('/')}` on the `'Careers'` link.
- **Real-World Impact**:
  - Clicking 'Careers' from Privacy Policy or Terms of Service takes users to the homepage instead of `/careers`.
- **Remediation (`diff`)**:
```diff
--- a/components/PrivacyPolicyPage.tsx
+++ b/components/PrivacyPolicyPage.tsx
@@ -33,1 +33,1 @@
-                            <span onClick={() => navigate('/')} className="text-sm text-gray-600 hover:text-blue-600 font-medium cursor-pointer">Careers</span>
+                            <span onClick={() => navigate('/careers')} className="text-sm text-gray-600 hover:text-blue-600 font-medium cursor-pointer">Careers</span>
```

### `UDF-AUD-383` — **LOW** | Security Hygiene / External `<a target="_blank">` links use `rel="noreferrer"` without `noopener`.
- **Target File(s)**: `components/PrivacyPolicyPage.tsx` (`PrivacyPolicyPage.tsx:110`)
- **Root Cause & Exact Code Trace**:
  - Line `110` sets `target="_blank" rel="noreferrer"` on both external links (`settings.google.com/ads` and `optout.aboutads.info`).
- **Real-World Impact**:
  - Inconsistent tabnabbing protection on legacy browsers.
- **Remediation (`diff`)**:
```diff
--- a/components/PrivacyPolicyPage.tsx
+++ b/components/PrivacyPolicyPage.tsx
@@ -110,1 +110,1 @@
- ... target="_blank" rel="noreferrer" ...
+ ... target="_blank" rel="noopener noreferrer" ...
```

### `UDF-AUD-384` — **LOW** | Performance / Reliability / `AboutPage` blocks the entire page render behind a full-screen spinner (`if (loading)`) while waiting for `getWebsiteConfig()`, hurting LCP/SEO and failing to cancel on unmount.
- **Target File(s)**: `components/AboutPage.tsx` (`AboutPage.tsx:16–29`)
- **Root Cause & Exact Code Trace**:
  - Lines `31–37` return a blank spinner until Firestore responds instead of rendering `DEFAULT_CONFIG` immediately.
- **Real-World Impact**:
  - Delays First Contentful Paint / SEO crawler rendering of the About page.
- **Remediation (`diff`)**:
```diff
--- a/components/AboutPage.tsx
+++ b/components/AboutPage.tsx
@@ -13,1 +13,1 @@
-    const [loading, setLoading] = useState(true);
+    const [loading, setLoading] = useState(false);
```

### `UDF-AUD-385` — **MEDIUM** | Broken Feature / Functional Bug / `scripts/search-user.js` calls `fs.readFileSync(...)` without importing `fs`, throwing `ReferenceError: fs is not defined`.
- **Target File(s)**: `scripts/search-user.js` (`scripts/search-user.js:19`)
- **Root Cause & Exact Code Trace**:
  - Lines `1–4` import `admin`, `dotenv`, `path`, and `fileURLToPath`—omitting `import fs from 'fs';`—yet `L19` executes `fs.readFileSync(saPath, 'utf-8')`.
- **Real-World Impact**:
  - Running `node scripts/search-user.js` without `FIREBASE_SERVICE_ACCOUNT` crashes with `ReferenceError`.
- **Remediation (`diff`)**:
```diff
--- a/scripts/search-user.js
+++ b/scripts/search-user.js
@@ -1,2 +1,3 @@
 import admin from 'firebase-admin';
+import fs from 'fs';
 import dotenv from 'dotenv';
```

### `UDF-AUD-386` — **MEDIUM** | Security / Privacy Leak / Hardcodes a real personal Gmail address (`arjosarka56r@gmail.com`) and production project ID in a committed repository script.
- **Target File(s)**: `scripts/search_user_rest.mjs` (`scripts/search_user_rest.mjs:21`)
- **Root Cause & Exact Code Trace**:
  - Line `21` commits `const email = 'arjosarka56r@gmail.com';` directly in source control.
- **Real-World Impact**:
  - Leaks personal user PII in git history and repository snapshots.
- **Remediation (`diff`)**:
```diff
--- a/scripts/search_user_rest.mjs
+++ b/scripts/search_user_rest.mjs
@@ -21,1 +21,1 @@
-  const email = 'arjosarka56r@gmail.com';
+  const email = process.argv[2]; if (!email) process.exit(1);
```

### `UDF-AUD-387` — **LOW** | Security / Privacy Leak / Hardcodes local developer filesystem paths (`C:/Users/muthy/...`, `z:\HR PORTAL`, `file:///z:/UDF_SUBDOMAINS`) in committed scripts.
- **Target File(s)**: `scripts/comprehensive_scanner.cjs`<br>`scripts/backup_current_state.ps1` (`comprehensive_scanner.cjs:8, 157`<br>`backup_current_state.ps1:2, 22, 35`)
- **Root Cause & Exact Code Trace**:
  - Both scripts fail on any other developer's machine and expose local Windows username and drive topology.
- **Real-World Impact**:
  - Breaks CI/team portability and leaks developer workstation paths.
- **Remediation (`diff`)**:
```diff
--- a/scripts/comprehensive_scanner.cjs
+++ b/scripts/comprehensive_scanner.cjs
@@ -8,1 +8,1 @@
-const REPORT_PATH = path.resolve(process.env.APPDATA_DIR || 'C:/Users/muthy/.gemini/antigravity-ide/brain/24acec6e-4378-4891-a22b-b905a6a9df6e', 'CODE_SCAN_REPORT.md');
+const REPORT_PATH = path.resolve(ROOT_DIR, 'CODE_SCAN_REPORT.md');
```

### `UDF-AUD-388` — **MEDIUM** | Performance / Bundle Bloat / Synchronously imports `import * as XLSX from 'xlsx';` at top level, pulling the ~500KB SheetJS bundle whenever `BulkImportModal` is loaded.
- **Target File(s)**: `components/BulkImportModal.tsx` (`BulkImportModal.tsx:7`)
- **Root Cause & Exact Code Trace**:
  - Line `7` imports `xlsx` statically instead of dynamically inside `if (isExcel)` (`L53`).
- **Real-World Impact**:
  - Increases JS parse/download cost even for CSV-only imports.
- **Remediation (`diff`)**:
```diff
--- a/components/BulkImportModal.tsx
+++ b/components/BulkImportModal.tsx
@@ -7,1 +7,0 @@
-import * as XLSX from 'xlsx';
@@ -57,1 +56,2 @@
+                    const XLSX = await import('xlsx');
                     const workbook = XLSX.read(data, { type: 'array', raw: false });
```

### `UDF-AUD-389` — **MEDIUM** | Broken Feature / Functional Bug / Does not enforce the advertised `'Maximum 500 rows per import'` limit, resets file input never (can't re-upload same file), and silently skips duplicate check on error (`L125`).
- **Target File(s)**: `components/BulkImportModal.tsx` (`BulkImportModal.tsx:58–66, 123–126, 185`)
- **Root Cause & Exact Code Trace**:
  - Line `185` states max 500 rows, but `handleFileUpload` (`L47–90`) accepts unlimited rows; `L125` proceeds straight to `handleStartImport()` if `checkForDatabaseDuplicates` throws.
- **Real-World Impact**:
  - Uploading >500 rows exceeds Firestore batch limits / Cloud Function timeouts, and transient network errors bypass duplicate detection.
- **Remediation (`diff`)**:
```diff
--- a/components/BulkImportModal.tsx
+++ b/components/BulkImportModal.tsx
@@ -63,2 +63,5 @@
                     const rows = parseCSV(csvContent);
+                    if (rows.length > 500) { alert('Maximum 500 rows allowed per import.'); return; }
                     setParsedData(rows);
```

### `UDF-AUD-390` — **MEDIUM** | Broken Feature / Functional Bug / `handleFileChange` and `handleSaveCrop` ignore the `maxSizeMB` prop (`L70`) and allow selecting non-image files (e.g., PDFs) into `ReactCrop`, causing a broken image preview.
- **Target File(s)**: `components/common/DocumentCaptureModal.tsx` (`DocumentCaptureModal.tsx:236–247, 291–300`)
- **Root Cause & Exact Code Trace**:
  - Line `70` accepts `maxSizeMB = 5` but never checks `file.size > maxSizeMB * 1024 * 1024` or `file.type.startsWith('image/')` in `handleFileChange` (`L236–247`).
- **Real-World Impact**:
  - Oversized or non-image files load into the cropper without validation and fail silently.
- **Remediation (`diff`)**:
```diff
--- a/components/common/DocumentCaptureModal.tsx
+++ b/components/common/DocumentCaptureModal.tsx
@@ -239,1 +239,3 @@
     if (!file) return;
+    if (!file.type.startsWith('image/')) { setScanError('Please select an image file.'); return; }
+    if (file.size > maxSizeMB * 1024 * 1024) { setScanError(`Image exceeds ${maxSizeMB}MB limit.`); return; }
```

### `UDF-AUD-391` — **MEDIUM** | Broken Feature / Functional Bug / `rotateImage` effect lacks a cancellation flag and never revokes `blob:` URLs, risking stale rotated images when clicking Rotate rapidly.
- **Target File(s)**: `components/common/DocumentCaptureModal.tsx` (`DocumentCaptureModal.tsx:119–128`)
- **Root Cause & Exact Code Trace**:
  - Lines `119–128` call async `rotateImage(imageSrc, rotation).then(...)` without checking if `rotation` or `imageSrc` changed before the Promise resolved.
- **Real-World Impact**:
  - Clicking Rotate 90° multiple times quickly can render an out-of-order rotation.
- **Remediation (`diff`)**:
```diff
--- a/components/common/DocumentCaptureModal.tsx
+++ b/components/common/DocumentCaptureModal.tsx
@@ -119,5 +119,7 @@
   useEffect(() => {
+    let active = true;
     if (imageSrc) {
       rotateImage(imageSrc, rotation).then((res) => {
-        if (isSafeUrl(res)) setRotatedImageSrc(res);
+        if (active && isSafeUrl(res)) setRotatedImageSrc(res);
       });
     }
+    return () => { active = false; };
   }, [imageSrc, rotation]);
```

### `UDF-AUD-392` — **MEDIUM** | Security Vulnerability / Installs `xlsx` directly from an unpinned third-party tarball URL (`https://cdn.sheetjs.com/xlsx-0.19.3/xlsx-0.19.3.tgz`) without integrity check in `package.json`, and pins pre-release `@codetrix-studio/capacitor-google-auth@^3.4.0-rc.4`.
- **Target File(s)**: `package.json` (`package.json:25, 37`)
- **Root Cause & Exact Code Trace**:
  - `package.json:37` pulls SheetJS 0.19.3 (which has known prototype pollution / ReDoS CVEs in older releases) from an external CDN tarball, and `L25` uses an unmaintained RC plugin.
- **Real-World Impact**:
  - Supply-chain risk and known parser vulnerabilities when admins upload untrusted `.xlsx` files.
- **Remediation (`diff`)**:
```diff
--- a/package.json
+++ b/package.json
@@ -37,1 +37,1 @@
-    "xlsx": "https://cdn.sheetjs.com/xlsx-0.19.3/xlsx-0.19.3.tgz"
+    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

### `UDF-AUD-393` — **MEDIUM** | Code Quality / Type Safety / `tsconfig.json` omits `"strict": true`, `"noImplicitAny": true`, and `"strictNullChecks": true`.
- **Target File(s)**: `tsconfig.json` (`tsconfig.json:2–28`)
- **Root Cause & Exact Code Trace**:
  - Without `strictNullChecks`, TypeScript failed to catch dozens of `undefined.toLowerCase()` crashes (e.g., `AdminAuditLogPage`, `AdminCorrectionRequestsPage`, `AdminRoleManagementPage`, `App.tsx:1084`).
- **Real-World Impact**:
  - Permits null-dereference runtime crashes to pass `tsc` silently.
- **Remediation (`diff`)**:
```diff
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -12,1 +12,2 @@
     "skipLibCheck": true,
+    "strictNullChecks": true,
```

### `UDF-AUD-394` — **HIGH** | Security Vulnerability / Four locations construct `new RegExp(userConfiguredPattern)` directly without `try/catch` or ReDoS complexity guards.
- **Target File(s)**: `components/AdminMasterEmployeeListPage.tsx`<br>`components/EmployeeFormPage.tsx`<br>`components/employee/DataCorrectionPage.tsx`<br>`src/utils/bulkImportUtils.ts` (`AdminMasterEmployeeListPage.tsx:1875`<br>`EmployeeFormPage.tsx:1885`<br>`DataCorrectionPage.tsx:593`<br>`bulkImportUtils.ts:226`)
- **Root Cause & Exact Code Trace**:
  - An admin entering an invalid or catastrophic-backtracking regex in Client ID Library or Form Builder crashes the entire React form (`SyntaxError: Invalid regular expression`) or freezes the browser tab.
- **Real-World Impact**:
  - A single malformed regex pattern in Form Builder or Client ID Config breaks onboarding/editing for all employees.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminMasterEmployeeListPage.tsx
+++ b/components/AdminMasterEmployeeListPage.tsx
@@ -1875,1 +1875,1 @@
-    if (def.pattern) isValid = new RegExp(def.pattern).test(value);
+    if (def.pattern) { try { isValid = new RegExp(def.pattern).test(value); } catch { isValid = true; } }
```

### `UDF-AUD-395` — **MEDIUM** | Broken Feature / Functional Bug / Unguarded or fragile `JSON.parse()` on `localStorage`/`sessionStorage` values can throw `SyntaxError` on corrupted storage.
- **Target File(s)**: `components/AdminMasterEmployeeListPage.tsx`<br>`components/EmployeeFormPage.tsx`<br>`src/services/storageService.ts` (`AdminMasterEmployeeListPage.tsx:255`<br>`EmployeeFormPage.tsx:1204`<br>`storageService.ts:194, 454`)
- **Root Cause & Exact Code Trace**:
  - `AdminMasterEmployeeListPage.tsx:255`, `EmployeeFormPage.tsx:1204`, and `storageService.ts:454` parse browser storage strings without schema validation.
- **Real-World Impact**:
  - Corrupted `localStorage` entries can crash page initialization for returning users.
- **Remediation (`diff`)**:
```diff
--- a/src/services/storageService.ts
+++ b/src/services/storageService.ts
@@ -454,1 +454,1 @@
-    draftId = typeof raw === 'string' && raw.startsWith('"') ? JSON.parse(raw) : raw;
+    try { draftId = typeof raw === 'string' && raw.startsWith('"') ? JSON.parse(raw) : raw; } catch { draftId = undefined; }
```

### `UDF-AUD-396` — **MEDIUM** | Broken Feature / Functional Bug / `addSection` reads `sections.length` from closure instead of `prev.length` inside the functional updater `setSections(prev => ...)`.
- **Target File(s)**: `hooks/useFormBuilder.ts` (`hooks/useFormBuilder.ts:9–18`)
- **Root Cause & Exact Code Trace**:
  - Lines `13` and `18` depend on `sections.length` outside `setSections(prev => ...)`, causing duplicate `order` values if `addSection` is called twice in the same tick.
- **Real-World Impact**:
  - Rapidly adding sections creates colliding `order` indices.
- **Remediation (`diff`)**:
```diff
--- a/hooks/useFormBuilder.ts
+++ b/hooks/useFormBuilder.ts
@@ -9,9 +9,9 @@
-  const addSection = useCallback((name: string) => {
-    const newSection: FormSection = { id: uuidv4(), name, order: sections.length, fields: [], isDisabled: false };
-    setSections(prev => [...prev, newSection]);
-  }, [sections.length]);
+  const addSection = useCallback((name: string) => {
+    setSections(prev => [...prev, { id: uuidv4(), name, order: prev.length, fields: [], isDisabled: false }]);
+  }, []);
```

### `UDF-AUD-397` — **LOW** | Security Hygiene / External `<a target="_blank">` links omit `noopener` (using only `rel="noreferrer"` or omitting `rel`).
- **Target File(s)**: `components/AdminVacancyManager.tsx`<br>`components/BlogPage.tsx` (`AdminVacancyManager.tsx:321`<br>`BlogPage.tsx:418`)
- **Root Cause & Exact Code Trace**:
  - `AdminVacancyManager.tsx:321` renders `href={activeSite.googleMapsLink} target="_blank" rel="noreferrer"` without validating that `googleMapsLink` starts with `https://`.
- **Real-World Impact**:
  - Allows `javascript:` URI injection if a malicious URL is saved into `site.googleMapsLink`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminVacancyManager.tsx
+++ b/components/AdminVacancyManager.tsx
@@ -321,1 +321,1 @@
- <a href={activeSite.googleMapsLink} target="_blank" rel="noreferrer"
+ <a href={/^https?:\/\//i.test(activeSite.googleMapsLink || '') ? activeSite.googleMapsLink : '#'} target="_blank" rel="noopener noreferrer"
```

### `UDF-AUD-398` — **MEDIUM** | Broken Feature / Functional Bug / `window.open('', '_blank', 'width=800,height=1000')` omits `'noopener'` and lacks popup-blocker error feedback when `printWindow` is null.
- **Target File(s)**: `components/AdminReviewSubmissionsPage.tsx` (`AdminReviewSubmissionsPage.tsx:687`)
- **Root Cause & Exact Code Trace**:
  - Line `687` opens the Biodata print window without `noopener`.
- **Real-World Impact**:
  - Leaves `window.opener` accessible from the spawned window.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminReviewSubmissionsPage.tsx
+++ b/components/AdminReviewSubmissionsPage.tsx
@@ -687,1 +687,1 @@
-    const printWindow = window.open('', '_blank', 'width=800,height=1000');
+    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=800,height=1000');
```

### `UDF-AUD-399` — **MEDIUM** | Broken Feature / Functional Bug / `setInterval` poller in `App.tsx:999` lacks a max-timeout / cleanup guard if the waited condition never resolves.
- **Target File(s)**: `App.tsx` (`App.tsx:999`)
- **Root Cause & Exact Code Trace**:
  - If the awaited state in `App.tsx:999` never flips (e.g., due to a failed background fetch), the `setInterval` continues ticking indefinitely.
- **Real-World Impact**:
  - Leaks a background timer for the entire browser session.
- **Remediation (`diff`)**:
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -999,2 +999,4 @@
+    let elapsed = 0;
     const checker = setInterval(() => {
+      elapsed += 200; if (elapsed > 15000) { clearInterval(checker); resolve(); }
```

### `UDF-AUD-400` — **LOW** | Security / Privacy / Creates staff accounts using an admin-typed plaintext password without enforcing password complexity or requiring a first-login password change.
- **Target File(s)**: `components/AdminStaffManagementPage.tsx` (`AdminStaffManagementPage.tsx:245`)
- **Root Cause & Exact Code Trace**:
  - `handleAddStaff` (`L207–263`) sends the admin-entered password to `createStaffUser` without minimum length/strength validation (`password.length < 8`) or `mustChangePassword` flag.
- **Real-World Impact**:
  - Weak staff passwords (e.g., `'123456'`) are accepted for privileged HR/Admin accounts.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminStaffManagementPage.tsx
+++ b/components/AdminStaffManagementPage.tsx
@@ -212,1 +212,4 @@
     }
+    if (password.length < 8) {
+      onNotify("Password must be at least 8 characters long", "error"); return;
+    }
```

### `UDF-AUD-401` — **MEDIUM** | Broken Feature / Functional Bug / `handleTransferSites` does not prevent transferring sites from a staff member to themselves (`transferSourceStaff.id === targetStaff.id`).
- **Target File(s)**: `components/AdminStaffManagementPage.tsx` (`AdminStaffManagementPage.tsx:460–499`)
- **Root Cause & Exact Code Trace**:
  - In `REPLACE` mode (`L466–470`), if `targetStaff.id === transferSourceStaff.id`, step 1 writes `sitesManaged: newTargetSites` and step 2 immediately overwrites `sitesManaged: []` (`newSourceSites`), wiping all their sites!
- **Real-World Impact**:
  - Selecting the same staff member as target in `REPLACE` mode erases all their assigned sites.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminStaffManagementPage.tsx
+++ b/components/AdminStaffManagementPage.tsx
@@ -445,1 +445,2 @@
     if (!targetStaff) return;
+    if (targetStaff.id === transferSourceStaff.id) { onNotify('Cannot transfer sites to the same staff member.', 'error'); return; }
```

### `UDF-AUD-402` — **MEDIUM** | Broken Feature / Functional Bug / `saveUserOverrides` optimistically mutates `staffUsers` state (`L722`) BEFORE `await setDoc(...)` (`L724`) and never rolls back React state if `setDoc` fails.
- **Target File(s)**: `components/AdminRoleManagementPage.tsx` (`AdminRoleManagementPage.tsx:722–732`)
- **Root Cause & Exact Code Trace**:
  - If Firestore rejects the write (`permission-denied` or offline), the UI continues showing the unsaved overrides as active while notifying an error.
- **Real-World Impact**:
  - Admins see misleading permission overrides in the UI that were never saved to Firestore.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminRoleManagementPage.tsx
+++ b/components/AdminRoleManagementPage.tsx
@@ -722,4 +722,4 @@
-      setStaffUsers(prev => prev.map(s => s.id === updatedUser.id ? updatedUser : s));
       try {
         await setDoc(doc(db, 'staff_accounts', updatedUser.id), { permissionOverrides: updatedUser.permissionOverrides || {} }, { merge: true });
+        setStaffUsers(prev => prev.map(s => s.id === updatedUser.id ? updatedUser : s));
```

### `UDF-AUD-403` — **MEDIUM** | Broken Feature / Functional Bug / `subscribeToRecycleBin` queries `recycle_bin` ordered by `deletedAt` without `limit()`, loading every soft-deleted record in history on every snapshot.
- **Target File(s)**: `src/services/recycleBinService.ts` (`recycleBinService.ts:398–409`)
- **Root Cause & Exact Code Trace**:
  - Line `399` executes `query(collection(db, RECYCLE_BIN_COLLECTION), orderBy('deletedAt', 'desc'))` with no `limit()`.
- **Real-World Impact**:
  - Large recycle bins cause high read costs and slow rendering in `AdminRecycleBinPage`.
- **Remediation (`diff`)**:
```diff
--- a/src/services/recycleBinService.ts
+++ b/src/services/recycleBinService.ts
@@ -399,1 +399,1 @@
-  const q = query(collection(db, RECYCLE_BIN_COLLECTION), orderBy('deletedAt', 'desc'));
+  const q = query(collection(db, RECYCLE_BIN_COLLECTION), orderBy('deletedAt', 'desc'), limit(200));
```

### `UDF-AUD-404` — **LOW** | Broken Feature / Functional Bug / `moveToRecycleBin` computes 30-day `expiresAt` using `expires.setDate(now.getDate() + 30)` in the client browser's local clock.
- **Target File(s)**: `src/services/recycleBinService.ts` (`recycleBinService.ts:44–46`)
- **Root Cause & Exact Code Trace**:
  - If an admin's system clock is skewed, `expiresAt` is written with a wrong date while `autoDeleteRecycleBin` purges based on `deletedAt`.
- **Real-World Impact**:
  - The `'days left'` countdown in Recycle Bin can disagree with the actual server purge schedule.
- **Remediation (`diff`)**:
```diff
--- a/src/services/recycleBinService.ts
+++ b/src/services/recycleBinService.ts
@@ -45,2 +45,1 @@
-  const expires = new Date();
-  expires.setDate(now.getDate() + RETENTION_DAYS);
+  const expires = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
```

### `UDF-AUD-405` — **MEDIUM** | Security Vulnerability / `updateWebsiteConfig` overwrites `settings/public_website` via `setDoc(docRef, config)` without stripping `undefined` or validating `contactEmail`/`services`.
- **Target File(s)**: `src/services/websiteService.ts` (`websiteService.ts:117–121`)
- **Root Cause & Exact Code Trace**:
  - Line `119` passes `config` directly to `setDoc` without `merge: true` or `stripUndefined`.
- **Real-World Impact**:
  - Any undefined field throws a Firestore write error, and partial updates overwrite unrelated CMS fields.
- **Remediation (`diff`)**:
```diff
--- a/src/services/websiteService.ts
+++ b/src/services/websiteService.ts
@@ -119,1 +119,1 @@
-    await setDoc(docRef, config);
+    await setDoc(docRef, config, { merge: true });
```

### `UDF-AUD-406` — **LOW** | Broken Feature / Functional Bug / In-memory sort in `getBlogPosts` puts pinned posts (`isPinned: true`) in chronological order instead of pinning them to the top.
- **Target File(s)**: `src/services/blogService.ts` (`blogService.ts:65–69`)
- **Root Cause & Exact Code Trace**:
  - Lines `65–69` sort strictly by `timeB - timeA` and never compare `a.isPinned` vs `b.isPinned`.
- **Real-World Impact**:
  - Pinning an older announcement in Website Manager does not keep it at the top of `getBlogPosts()`.
- **Remediation (`diff`)**:
```diff
--- a/src/services/blogService.ts
+++ b/src/services/blogService.ts
@@ -65,2 +65,3 @@
         return posts.sort((a, b) => {
+            if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
             const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.date).getTime() || 0);
```

### `UDF-AUD-407` — **MEDIUM** | Broken Feature / Functional Bug / `deleteBlogPost` calls `deleteStorageFile(imageUrl)` even when `imageUrl` is an external third-party URL (not a Firebase Storage path).
- **Target File(s)**: `src/services/blogService.ts` (`blogService.ts:96–107`)
- **Root Cause & Exact Code Trace**:
  - Line `98` checks `if (imageUrl)` without checking whether `imageUrl` belongs to Firebase Storage.
- **Real-World Impact**:
  - Deleting a blog post that uses an external image URL triggers an unnecessary failed Cloud Function call (`deleteStoragePath`).
- **Remediation (`diff`)**:
```diff
--- a/src/services/blogService.ts
+++ b/src/services/blogService.ts
@@ -97,1 +97,1 @@
-    if (imageUrl) {
+    if (imageUrl && !imageUrl.startsWith('http://') && (!imageUrl.startsWith('https://') || imageUrl.includes('firebasestorage'))) {
```

### `UDF-AUD-408` — **MEDIUM** | Broken Feature / Functional Bug / `subscribeToNotifications` attaches duplicate Firestore `onSnapshot` listeners when `portalId === userId`.
- **Target File(s)**: `src/services/notificationService.ts` (`notificationService.ts:108–111`)
- **Root Cause & Exact Code Trace**:
  - Lines `108–110` push `userId` and `portalId` into `targets` without deduplicating via `new Set(...)`.
- **Real-World Impact**:
  - Employees whose `portalId === userId` double their Firestore notification listener reads.
- **Remediation (`diff`)**:
```diff
--- a/src/services/notificationService.ts
+++ b/src/services/notificationService.ts
@@ -108,3 +108,4 @@
-    const targets = [userId];
-    if (roleId) targets.push(`ROLE:${roleId}`);
-    if (portalId) targets.push(portalId);
+    const targets = Array.from(new Set([userId, roleId ? `ROLE:${roleId}` : '', portalId || ''].filter(Boolean)));
```

### `UDF-AUD-409` — **MEDIUM** | Broken Feature / Functional Bug / When a notification is removed from one listener's snapshot, `notifMap.delete(change.doc.id)` executes unconditionally after the `snap.forEach` loop.
- **Target File(s)**: `src/services/notificationService.ts` (`notificationService.ts:141–145`)
- **Root Cause & Exact Code Trace**:
  - If a single `notifMap` is shared across multiple listeners, clearing stale items from one target works only for `removed` events and never purges documents that aged past `limit(50)`.
- **Real-World Impact**:
  - Long-lived sessions accumulate >50 stale notifications in memory.
- **Remediation (`diff`)**:
```diff
--- a/src/services/notificationService.ts
+++ b/src/services/notificationService.ts
@@ -147,1 +147,1 @@
-            const notifs = Array.from(notifMap.values());
+            const notifs = Array.from(notifMap.values()).slice(0, 100);
```

### `UDF-AUD-410` — **MEDIUM** | Broken Feature / Functional Bug / `getStaffProfile` queries `staff_accounts` and `staff` by `where('email', '==', firebaseUser.email)` without normalizing `.toLowerCase().trim()`.
- **Target File(s)**: `src/services/authService.ts` (`authService.ts:171–243`)
- **Root Cause & Exact Code Trace**:
  - Line `201` passes raw `firebaseUser.email` (which may contain uppercase letters on some identity providers), whereas `createStaffUser` stores `email.toLowerCase().trim()`.
- **Real-World Impact**:
  - Case-mismatched Google/Email logins fail to match the staff profile and drop the staff member to `UserType.PUBLIC`.
- **Remediation (`diff`)**:
```diff
--- a/src/services/authService.ts
+++ b/src/services/authService.ts
@@ -201,1 +201,1 @@
-                const q = query(collection(db, collName), where("email", "==", firebaseUser.email), limit(1));
+                const q = query(collection(db, collName), where("email", "==", firebaseUser.email.toLowerCase().trim()), limit(1));
```

### `UDF-AUD-411` — **MEDIUM** | Broken Feature / Functional Bug / `getEmployeeProfile` (`L73`) and `getAdminProfile` (`L271`) also query `linkedGoogleEmail` and `email` without `.toLowerCase().trim()`.
- **Target File(s)**: `src/services/authService.ts` (`authService.ts:73, 271`)
- **Root Cause & Exact Code Trace**:
  - Both queries compare raw `firebaseUser.email` against lowercase-normalized Firestore fields.
- **Real-World Impact**:
  - Users whose provider returns mixed-case emails fail profile resolution.
- **Remediation (`diff`)**:
```diff
--- a/src/services/authService.ts
+++ b/src/services/authService.ts
@@ -73,1 +73,1 @@
-                const emailQuery = query(collection(db, 'employees'), where("linkedGoogleEmail", "==", firebaseUser.email), limit(1));
+                const emailQuery = query(collection(db, 'employees'), where("linkedGoogleEmail", "==", firebaseUser.email.toLowerCase().trim()), limit(1));
```

### `UDF-AUD-412` — **MEDIUM** | Security & Privacy / `logoutUser` clears `localStorage['portalType']` and `fileSessionStore`, but does NOT clear `sessionStorage` signed URLs, `activeTimelineEmployeeId`, `adminInvitesActiveTab`, or `onboarding_savedDraftId`.
- **Target File(s)**: `src/services/authService.ts` (`authService.ts:398–407`)
- **Root Cause & Exact Code Trace**:
  - Lines `398–407` leave cached Storage signed URLs and draft PII keys in browser storage after logout.
- **Real-World Impact**:
  - On shared office/kiosk computers, the next user can inspect signed document URLs and draft identifiers left in browser storage.
- **Remediation (`diff`)**:
```diff
--- a/src/services/authService.ts
+++ b/src/services/authService.ts
@@ -400,1 +400,2 @@
     localStorage.removeItem('portalType');
+    try { sessionStorage.clear(); } catch {}
```

### `UDF-AUD-413` — **LOW** | Broken Feature / Functional Bug / `reportingHierarchy` identifies Field Officers by hardcoded role name substring `'field officer'` or ID `'role-field-officer'` and includes disabled staff (`isDisabled: true`).
- **Target File(s)**: `components/AdminStaffProfilePage.tsx` (`AdminStaffProfilePage.tsx:70–73`)
- **Root Cause & Exact Code Trace**:
  - Lines `70–73` never filter `!s.isDisabled`, so terminated/disabled Field Officers remain listed in the active Field Operations Hierarchy.
- **Real-World Impact**:
  - Managers see disabled/former Field Officers in their active hierarchy dashboard.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminStaffProfilePage.tsx
+++ b/components/AdminStaffProfilePage.tsx
@@ -70,2 +70,3 @@
     const fieldOfficers = staffUsers.filter(s => {
+      if (s.isDisabled) return false;
       const role = roles.find(r => r.id === s.roleId);
```

### `UDF-AUD-414` — **LOW** | Broken Feature / Functional Bug / `displayName` lookup checks literal field labels (`'Applicant Name'`, `'Full Name'`) but omits Form Builder UUID `7debf274-baee-4bac-a137-4b4b46719874`.
- **Target File(s)**: `components/events/EmployeeTimelinePage.tsx` (`EmployeeTimelinePage.tsx:70–77`)
- **Root Cause & Exact Code Trace**:
  - Lines `70–77` fall back to `'Employee Record'` for any employee whose name is stored only under the Form Builder UUID.
- **Real-World Impact**:
  - Timeline header shows generic `'Employee Record'` instead of the employee's name.
- **Remediation (`diff`)**:
```diff
--- a/components/events/EmployeeTimelinePage.tsx
+++ b/components/events/EmployeeTimelinePage.tsx
@@ -72,1 +72,2 @@
         || (employee as any)?.profileData?.applicantName 
+        || (employee as any)?.data?.['7debf274-baee-4bac-a137-4b4b46719874']
```

### `UDF-AUD-415` — **LOW** | Broken Feature / Functional Bug / `import { RotateCcw } from 'lucide-react';` is placed at the bottom of the file (`L188`) after `EmployeeTimelinePage` definition.
- **Target File(s)**: `components/events/EmployeeTimelinePage.tsx` (`EmployeeTimelinePage.tsx:188`)
- **Root Cause & Exact Code Trace**:
  - Non-standard ES module import placement at the bottom of the file reduces readability and violates lint rules (`import/first`).
- **Real-World Impact**:
  - Can break static analysis tools and future refactors.
- **Remediation (`diff`)**:
```diff
--- a/components/events/EmployeeTimelinePage.tsx
+++ b/components/events/EmployeeTimelinePage.tsx
@@ -8,1 +8,1 @@
-    ChevronRight, ExternalLink
+    ChevronRight, ExternalLink, RotateCcw
@@ -187,3 +187,0 @@
-// Helper for icon
-import { RotateCcw } from 'lucide-react';
```

### `UDF-AUD-416` — **MEDIUM** | Broken Feature / Functional Bug / `getGoogleCredentialSafely` asserts `email: userCred.user.email!` with a non-null assertion without verifying `userCred.user.email` exists.
- **Target File(s)**: `src/utils/googleAuthHelper.ts` (`googleAuthHelper.ts:59, 74`)
- **Root Cause & Exact Code Trace**:
  - If a Google Workspace/custom provider omits email, `email!` passes `null` to `selfLinkGoogleAccount` / `employeeGoogleLogin`.
- **Real-World Impact**:
  - Produces cryptic downstream backend errors instead of a clear client validation message.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/googleAuthHelper.ts
+++ b/src/utils/googleAuthHelper.ts
@@ -74,1 +74,2 @@
+            if (!userCred.user.email) throw new Error('Google account did not return an email address.');
             const res = { uid: userCred.user.uid, email: userCred.user.email, idToken };
```

### `UDF-AUD-417` — **LOW** | Performance / Memory Leak / `getSecondaryAuth` initializes a persistent secondary Firebase App (`'GoogleLinkerApp'`) that is never deleted with `deleteApp`.
- **Target File(s)**: `src/utils/googleAuthHelper.ts` (`googleAuthHelper.ts:23–32`)
- **Root Cause & Exact Code Trace**:
  - Lines `23–32` keep `'GoogleLinkerApp'` resident in memory for the lifetime of the browser tab.
- **Real-World Impact**:
  - Minor memory overhead across repeated Google linking flows.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/googleAuthHelper.ts
+++ b/src/utils/googleAuthHelper.ts
@@ -75,1 +75,1 @@
             await secAuth.signOut();
```

### `UDF-AUD-418` — **MEDIUM** | Broken Feature / Functional Bug / CSV `FileReader` handler (`L76–87`) has no `try/catch` around `parseCSV(content)` and never resets `e.target.value = ''`.
- **Target File(s)**: `components/BulkImportModal.tsx` (`BulkImportModal.tsx:76–88`)
- **Root Cause & Exact Code Trace**:
  - Unlike the Excel branch (`L56–71`), the CSV branch has no error handling, and failing to clear `e.target.value` prevents re-selecting the same filename after fixing errors.
- **Real-World Impact**:
  - Malformed CSVs fail silently, and admins cannot re-upload a corrected file with the same name without refreshing.
- **Remediation (`diff`)**:
```diff
--- a/components/BulkImportModal.tsx
+++ b/components/BulkImportModal.tsx
@@ -76,4 +76,6 @@
             reader.onload = (event) => {
+                try {
                 const content = event.target?.result as string;
                 const rows = parseCSV(content);
+                } catch (err) { alert('Failed to parse CSV file.'); }
```

### `UDF-AUD-419` — **LOW** | Broken Feature / Functional Bug / `enumerateDevices()` is called before `getUserMedia()`, returning blank device `label` strings in Chrome/Safari so `backCam` detection (`d.label.toLowerCase().includes('back')`) always fails on first open.
- **Target File(s)**: `components/common/DocumentCaptureModal.tsx` (`DocumentCaptureModal.tsx:1045–1060`)
- **Root Cause & Exact Code Trace**:
  - Browsers hide camera labels until camera permission is granted via `getUserMedia()`. Calling `enumerateDevices()` first (`L146`) yields `label: ''` for every camera.
- **Real-World Impact**:
  - On dual-camera phones, the modal defaults to `videoDevices[0]` (often the front selfie camera) instead of the rear document camera.
- **Remediation (`diff`)**:
```diff
--- a/components/common/DocumentCaptureModal.tsx
+++ b/components/common/DocumentCaptureModal.tsx
@@ -152,2 +152,2 @@
-            const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
-            setSelectedCamera(backCam ? backCam.deviceId : videoDevices[0].deviceId);
+            const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
+            if (backCam) setSelectedCamera(backCam.deviceId);
```

### `UDF-AUD-420` — **LOW** | Security / Privacy / Disabled `AdSenseUnit` component still receives placeholder slot IDs (`1111111111`, `2222222222`, `5555555555`, `6666666666`) across public pages while `PrivacyPolicyPage` claims a live Cookie Consent Banner and AdSense tracking are active.
- **Target File(s)**: `components/common/AdSenseUnit.tsx`<br>`components/PrivacyPolicyPage.tsx`<br>`components/AboutPage.tsx` (`AdSenseUnit.tsx:1–19`<br>`PrivacyPolicyPage.tsx:132`<br>`AboutPage.tsx:73, 145`)
- **Root Cause & Exact Code Trace**:
  - `AdSenseUnit.tsx` returns `null`, yet `PrivacyPolicyPage.tsx:100–111` states Google AdSense/DoubleClick cookies and a Cookie Consent Banner are deployed.
- **Real-World Impact**:
  - Legal disclosure mismatch with actual site behavior and dead placeholder component mounts across public routes.
- **Remediation (`diff`)**:
```diff
--- a/components/PrivacyPolicyPage.tsx
+++ b/components/PrivacyPolicyPage.tsx
@@ -131,3 +131,0 @@
-                    <div className="my-8">
-                        <AdSenseUnit slot="1111111111" format="auto" />
-                    </div>
```

