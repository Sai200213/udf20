# Exhaustive Single-Pass Security, Authorization, AST & Functional Code Audit Report

**Target Repository:** Unique Delta Force HR & Workforce Management Portal (`udf19`)  
**Audit Coverage:** 100% line-by-line inspection across all **161 active source and configuration files (74,205 lines total)**, excluding `node_modules` and compiled `dist-*` bundles:
- **Backend & Security Rules (9,062 lines):** `functions/index.js` (8,344 lines, 45 exported Cloud Functions), `functions/googleFormMapping.js` (67 lines), `firestore.rules` (604 lines), `storage.rules` (47 lines)
- **Services, Contexts, Routing & Core Entrypoints (14,265 lines):** All 17 service modules in `src/services/*.ts` (9,735 lines), `src/context/AuthContext.tsx` (196 lines), `src/contexts/DataContext.tsx` (763 lines), `src/contexts/NotificationContext.tsx` (195 lines), `src/routes/AppRoutes.tsx` (320 lines), `src/firebase/config.ts` (155 lines), `App.tsx` (2,684 lines), `index.tsx` (260 lines), `public/sw.js` (14 lines)
- **UI Components, Hooks, Utilities & Types (46,668 lines):** All 93 component files in `components/**/*.tsx` and `src/components/**/*.tsx`, `hooks/useFormBuilder.ts`, `utils/*.ts`, `src/utils/*.ts`, `types.ts` (861 lines), `constants.ts`, `src/constants/*.ts`
- **Google Apps Script, Automation & Build/Hosting Configs (4,210 lines):** `GOOGLE_APPS_SCRIPT_v7.2.js` (461 lines), `AUTOMATED_FORM_CREATOR.js` (167 lines), `scripts/*`, `firebase.json`, `vercel.json`, `netlify.toml`, `vite.config.ts`

## 1. Executive Summary Table

| ID | Severity | Category | Target File(s) | Exact Line Numbers | Finding Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UDF-AUD-01** | `CRITICAL` | Broken Feature / Functional Bug | `App.tsx`<br>`src/contexts/DataContext.tsx` | `App.tsx:1084–1104, 1275–1286`<br>`DataContext.tsx:96, 150, 625` | Uncaught `TypeError: Cannot read properties of null (reading 'leaveTypes')` crashes the entire React tree when `leavePolicy` is `null` while `employees.length > 0`. |
| **UDF-AUD-02** | `CRITICAL` | Broken Feature / Functional Bug | `src/services/employeeService.ts`<br>`firestore.rules` | `employeeService.ts:2124–2184`<br>`firestore.rules:229–237` | Employee personal submission listener `subscribeToSubmissionsByUid` deadlocks forever because `qByEmpId` fails `firestore.rules` with `permission-denied` and its error callback never sets `hasEmpReturned = true` or calls `emit()`. |
| **UDF-AUD-03** | `CRITICAL` | Security Vulnerability | `functions/index.js` | `functions/index.js:1108–1250, 1315–1384, 1480–1625` | Google account linking (`linkEmployeeGoogleAccount`, `selfLinkGoogleAccount`) makes `idToken` verification optional (allowing Google UID/email spoofing), overwrites `uid` with `googleUid`, and wipes `passwordHash: ''`, permanently locking employees out of `unlinkEmployeeGoogleAccount` and `changeEmployeePassword`. |
| **UDF-AUD-04** | `CRITICAL` | Broken Feature / Functional Bug | `functions/index.js`<br>`firestore.rules` | `functions/index.js:507–675, 5321–5357`<br>`firestore.rules:88–111` | `approveOnboardingServer` omits `linkedUid` on `employees/{submissionId}`, and `employeeGoogleLogin` omits `employeeId` and `role` from custom token claims, causing `isOwnerOfPortalId(employeeId)` to evaluate to `false` across all employee collections. |
| **UDF-AUD-05** | `CRITICAL` | Security Vulnerability | `firestore.rules`<br>`components/employee/DataCorrectionPage.tsx`<br>`functions/index.js` | `firestore.rules:134–139, 192–193, 225–226, 493–495`<br>`DataCorrectionPage.tsx:164, 196–219`<br>`functions/index.js:2464–2469, 2547, 3641–3652, 3686–3691` | Unauthenticated PII & verification-answer leak: `correction_requests` (`allow get: if true`) and `hasActiveCorrectionToken` (`employees` / `onboarding_submissions`) expose full employee records (including DOB, phone, Aadhaar, bank account, and `passwordHash`) and allow unverified file overwrites/deletions before identity verification. |
| **UDF-AUD-06** | `CRITICAL` | Security Vulnerability | `firestore.rules`<br>`src/services/bgvService.ts`<br>`components/AdminWebsiteManager.tsx`<br>`components/AdminInvitesPage.tsx` | `firestore.rules:199–203, 219–221, 229, 239–241, 283, 313, 343, 367–375, 453–482, 554`<br>`bgvService.ts:127`<br>`AdminWebsiteManager.tsx:140`<br>`AdminInvitesPage.tsx:328–329` | Multi-tenant branch site isolation (`canStaffViewSite`) is enforced only on `allow get` and is completely missing on `allow list`, `allow update`, and `allow delete` across `employees`, `onboarding_submissions`, `leave_requests`, `account_updates`, `resignations`, `disciplinary_actions`, `bgv_records`, and `attendance`. |
| **UDF-AUD-07** | `HIGH` | Security Vulnerability | `functions/index.js` | `functions/index.js:1842–1864, 2063–2125, 2243–2308, 2391–2473, 3576–3586, 3666, 3698–3744` | Cloud Storage callables (`getSecureDocumentURL`, `getBatchSignedViewUrls`, `moveStorageFolder`, `deleteStoragePath`, `getUploadUrl`) allow cross-site document access when `targetDocId` is an `employeeId` (`!docSite` fails open), arbitrary bucket file movement via `.includes(uid)`, and cross-site folder deletion by any branch admin. |
| **UDF-AUD-08** | `HIGH` | Broken Feature / Functional Bug | `src/contexts/DataContext.tsx`<br>`src/services/employeeService.ts`<br>`src/services/authService.ts`<br>`firestore.rules` | `DataContext.tsx:504–524`<br>`employeeService.ts:2220, 2256, 2275`<br>`authService.ts:72–85, 133–135`<br>`firestore.rules:199–202, 213–218, 229–237` | "Rules Are Not Filters" `permission-denied` failures on employee login and profile hydration when querying `employees` by `employeeId` or `linkedGoogleEmail`, querying `onboarding_submissions` by `employeeId`, or calling `updateDoc(ref, { uid })` on approved employee records. |
| **UDF-AUD-09** | `HIGH` | Broken Feature / Functional Bug | `src/services/bgvService.ts`<br>`firestore.rules` | `bgvService.ts:318–362`<br>`firestore.rules:469–482` | BGV vendor dispatch (`markBgvUnderProcess`) and vendor report upload (`vendorSubmitBgvReport`) fail with `PERMISSION_DENIED` for all non-SuperAdmin staff and external vendors because `firestore.rules` blocks `status` updates and mismatches vendor field names. |
| **UDF-AUD-10** | `HIGH` | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:4746, 5171, 5228–5243, 5506, 5536–5552, 5658, 5661–5683, 5926–5929, 6841–6851, 7257–7296, 7482–7497, 7723–7733, 8235–8244` | Broken Firestore permission fallback for site-scoped staff (reads empty `token.sitesManaged` instead of Firestore `staffDoc.sitesManaged`), role ID typo (`'super-admin'` vs `'role-super-admin'`), missing Firestore fallback in `rejoinEmployeeServer`/`logClientAuditEvent`, and missing site check in `deleteSiteServer`. |
| **UDF-AUD-11** | `HIGH` | Security Vulnerability | `src/contexts/NotificationContext.tsx`<br>`functions/index.js`<br>`App.tsx` | `NotificationContext.tsx:31–61, 114–175`<br>`functions/index.js:8110–8138`<br>`App.tsx:2473–2475` | Public users with `roleId: 'guest'` subscribe to `'all_admins'`/`'admin'` notifications (`permission-denied`), `sendNotification` has a stale closure (`[]` deps), employees miss `ROLE:employee` broadcasts and cannot mark `employeeId`/`portalId` notifications read, and `sendNotificationServer` allows unprivileged users to spam `'all_admins'` and `ROLE:*`. |
| **UDF-AUD-12** | `HIGH` | Broken Feature / Functional Bug | `components/AdminInvitesPage.tsx`<br>`src/services/employeeService.ts`<br>`functions/index.js`<br>`firestore.rules` | `AdminInvitesPage.tsx:294–297, 326–336, 591–595`<br>`employeeService.ts:1035–1043`<br>`functions/index.js:3404–3448, 5442–5445`<br>`firestore.rules:504–528` | Candidate client `updateDoc(inviteRef, { joined: increment(1) })` fails `firestore.rules`, `approveOnboardingServer` crashes with `NOT_FOUND` if the referral invite was deleted, `recordReferralMetricServer` allows unauthenticated `'joined'` spoofing, and extending expiry on an active invite fails `firestore.rules`. |
| **UDF-AUD-13** | `HIGH` | Security Vulnerability | `GOOGLE_APPS_SCRIPT_v7.2.js` | `GOOGLE_APPS_SCRIPT_v7.2.js:73–94, 132, 147–159` | `verifyViaApi` checks only `users/{uid}` (ignoring `staff_accounts/{uid}`), `submit_to_form` is callable by any anonymous Firebase user, and `checkFirestoreAccess` allows unauthorized Google Drive uploads because `firestore.rules` permits `get` on non-existent docs (`resource == null`) and records with active correction tokens. |
| **UDF-AUD-14** | `MEDIUM` | Security Vulnerability | `components/AdminReviewSubmissionsPage.tsx`<br>`src/utils/sanitizeHtml.ts`<br>`scripts/generateStaticPages.js` | `AdminReviewSubmissionsPage.tsx:677–685, 859`<br>`sanitizeHtml.ts:19, 26–31, 75–80`<br>`generateStaticPages.js:52–56, 463, 477, 568` | Unescaped `photoUrl` interpolated into `printWindow.document.write()` in Biodata print view; protocol-relative URL (`//evil.com`) bypass in `sanitizeHtml.ts`; and unescaped `post.imageUrl` / unsanitized `post.slug` path traversal in `generateStaticPages.js`. |
| **UDF-AUD-15** | `MEDIUM` | Broken Feature / Functional Bug | `components/ProfileAvatar.tsx`<br>`components/AdminStaffProfilePage.tsx`<br>`src/services/storageService.ts`<br>`functions/index.js`<br>`firestore.rules` | `ProfileAvatar.tsx:85–97`<br>`AdminStaffProfilePage.tsx:98`<br>`storageService.ts:467, 481, 496, 503–521`<br>`functions/index.js:3698–3724`<br>`firestore.rules:178–188` | Staff profile photo uploads fail in `getUploadUrl` (`context === 'profile'` only checks `employees`, not `staff_accounts`), direct Storage upload fallbacks in `storageService.ts` always fail (`storage.rules` denies all writes), and `ProfileAvatar.tsx` fails `staff_accounts` update rules when `staff.id !== auth.uid`. |
| **UDF-AUD-16** | `MEDIUM` | Broken Feature / Functional Bug | `components/employee/AttendanceCalendar.tsx`<br>`components/employee/EmployeeEngagementHub.tsx`<br>`src/services/engagementService.ts` | `AttendanceCalendar.tsx:113–146`<br>`EmployeeEngagementHub.tsx:105–118`<br>`engagementService.ts:207–246` | Daily attendance points are calculated and logged to console in `AttendanceCalendar.tsx` but never written on either the client or server; meanwhile `EmployeeEngagementHub.tsx` overwrites server-updated `user_engagement` fields (`completedQuizzes`) with stale client state after `completeTrainingQuizServer`. |
| **UDF-AUD-17** | `MEDIUM` | Security Vulnerability | `functions/index.js`<br>`components/employee/ProfileClaimPage.tsx`<br>`components/EmployeeFormPage.tsx` | `functions/index.js:465–493, 2896–3061`<br>`ProfileClaimPage.tsx:88–103`<br>`EmployeeFormPage.tsx:762–797` | Legacy Profile Claim locks users out on their 3rd attempt before validating input (`newCount >= 3` off-by-one), leaks which individual metric failed via sequential error messages, and signs in with a custom token (`uid = employeeId`) that `EmployeeFormPage.tsx` misidentifies as a Google-linked UID. |
| **UDF-AUD-18** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminStaffManagementPage.tsx`<br>`components/AdminRoleManagementPage.tsx`<br>`functions/index.js` | `AdminStaffManagementPage.tsx:258, 319, 360, 460, 468`<br>`AdminRoleManagementPage.tsx:724`<br>`functions/index.js:206–234, 7761` | Direct client updates to `staff_accounts` (`sitesManaged`, `roleId`, `permissionOverrides`) and `createStaffUser` do not invoke `refreshAdminClaims`, leaving target staff with stale JWT custom claims (`firestore.rules` has zero Firestore fallback). |
| **UDF-AUD-19** | `LOW` | Broken Feature / Functional Bug | `src/utils/createAdmin.js`<br>`scripts/check_user_exact.js`<br>`scripts/inspect_test_data.js`<br>`functions/index.js`<br>`src/utils/bulkImportUtils.ts` | `createAdmin.js:10`<br>`check_user_exact.js:1`<br>`inspect_test_data.js:1`<br>`functions/index.js:21, 7503, 7507, 7673, 8021`<br>`bulkImportUtils.ts:545` | Broken relative imports in utility scripts (`../firebase/config.js`, `../functions/node_modules/...`), hardcoded fallback salt `'UDF_PORTAL_SALT_2026_!!'` in `functions/index.js:21`, and predictable `Math.random()` ID/voucher generation. |
| **UDF-AUD-20** | `CRITICAL` | Broken Feature / Functional Bug | `components/employee/DocumentUploadWizard.tsx`<br>`components/BulkImportModal.tsx` | `DocumentUploadWizard.tsx:118–139, 200, 210, 229, 428`<br>`BulkImportModal.tsx:580` | `DocumentUploadWizard` calls `validateDetailsStep()` (which executes `setValidationErrors(errors)`) synchronously inside JSX during render (`L200, 210`), crashing React with `Uncaught Error: Too many re-renders` for every employee with `needsProfileCompletion: true`; also renders `section.title` instead of `section.name`. |
| **UDF-AUD-21** | `HIGH` | Broken Feature / Functional Bug | `src/components/guards/AuthGuard.tsx`<br>`src/context/AuthContext.tsx`<br>`src/routes/AppRoutes.tsx` | `AuthGuard.tsx:27–38`<br>`AuthContext.tsx:86–92`<br>`AppRoutes.tsx:187–197, 245–255` | Infinite React Router redirect loop (`/dashboard` ↔ `/employee/dashboard`) when an anonymous/public user (`user.type === UserType.PUBLIC` from `ensureAuthenticated()`) or cross-portal user visits protected routes on `employee.udfonline.in` or `admin.udfonline.in`. |
| **UDF-AUD-22** | `HIGH` | Broken Feature / Functional Bug | `components/AdminInvitesPage.tsx`<br>`firestore.rules` | `AdminInvitesPage.tsx:325–345, 384, 1218–1221`<br>`firestore.rules:137, 217` | "Referred Candidates" tab & Invite Pipeline counters (`Pending` / `Joined`) fail with `permission-denied` for recruiters (`targetRecruiterIds` includes non-UID `username` in `where('recruitedBy', 'in', ...)`), and silently truncate at the first 50 random employee records for SuperAdmins (`limit(50)` without a `where` filter). |
| **UDF-AUD-23** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminSiteManagementPage.tsx`<br>`src/services/employeeService.ts` | `AdminSiteManagementPage.tsx:93–106`<br>`employeeService.ts:242–268` | Clicking "View Personnel" on any site card in `AdminSiteManagementPage` passes `viewingSite.name` to `getPaginatedEmployees`, which queries `where('currentSiteId', '==', filterValue)` (where `currentSiteId` stores `viewingSite.id`), causing the modal to always display `0` employees. |
| **UDF-AUD-24** | `MEDIUM` | Broken Feature / Functional Bug | `utils/exportUtils.ts` | `utils/exportUtils.ts:50, 66–76` | Excel/CSV export (`exportEmployeesToCSV`) reads only `emp.data` (ignoring `emp.profileData` and `emp.formData`), outputs literal `"[object Object]"` for file-upload fields, and lacks CSV/Excel formula-injection sanitization (`=`, `+`, `-`, `@`). |
| **UDF-AUD-25** | `CRITICAL` | Broken Feature / Functional Bug | `functions/index.js`<br>`src/utils/bulkImportUtils.ts`<br>`src/services/employeeService.ts` | `functions/index.js:7587–7755`<br>`bulkImportUtils.ts:791–805`<br>`employeeService.ts:1314, 1333` | `bulkImportEmployeesServer` omits `needsProfileCompletion`, `assignedSiteIds`, `activeAssignments`, and `data`, rendering 100% of bulk-imported employees invisible in the Master Employee List (`where('needsProfileCompletion', 'in', [false, null])` excludes missing fields), keys `employees` by `empId` instead of `submissionId`, and hashes the wrong default password format. |
| **UDF-AUD-26** | `CRITICAL` | Security Vulnerability | `firestore.rules`<br>`src/services/employeeService.ts`<br>`functions/index.js` | `firestore.rules:238–240`<br>`employeeService.ts:972, 992`<br>`functions/index.js:5322` | `onboarding_submissions` allows unvalidated client `create`/`update` (`allow create: if isAuthenticated()` with zero field/status locks, permitting candidate self-approval), and `submitEmployeeForm` writes ephemeral anonymous Auth UIDs into `linkedUid` (`auth.currentUser?.uid || null`) on Guest submissions. |
| **UDF-AUD-27** | `HIGH` | Broken Feature / Functional Bug | `components/EmployeeDashboardPage.tsx`<br>`src/contexts/DataContext.tsx`<br>`components/employee/EmployeeLeaveRequestPage.tsx` | `EmployeeDashboardPage.tsx:189`<br>`DataContext.tsx:242, 278`<br>`EmployeeLeaveRequestPage.tsx:39, 47, 52, 114` | Employee leave balances always show `0` days remaining and block paid leave submissions because `EmployeeDashboardPage` passes `authUser.id` (`portalId` `"UDF-..."`) while `DataContext` keys `leaveBalances` by `emp.employeeId` (`"HY..."`), and `DataContext` keys `policyBalances` by `lt.label` while `EmployeeLeaveRequestPage` indexes by `lt.typeId`. |
| **UDF-AUD-28** | `HIGH` | Broken Feature / Functional Bug | `App.tsx`<br>`src/services/requestService.ts`<br>`firestore.rules`<br>`functions/index.js` | `App.tsx:1413–1420`<br>`requestService.ts:181–202`<br>`firestore.rules:356–361`<br>`functions/index.js:5002–5010` | `processDueResignations` fails `setDoc(..., { isProcessed: true })` with `PERMISSION_DENIED` for all non-SuperAdmin staff (triggering an infinite `relieveEmployee` loop on every snapshot), and `processRequestReviewServer` auto-relieve omits clearing `assignedSiteIds` and `activeAssignments`. |
| **UDF-AUD-29** | `HIGH` | Security Vulnerability | `functions/index.js` | `functions/index.js:4793–4806, 4850–4921` | Multi-level approval engine (`processRequestReviewServer`) never verifies that `callerRoleId` matches the workflow level's assigned `roleId` and trusts client-supplied `isBypass: true` without checking `isSuperAdmin`, letting any Level 1 approver unilaterally final-approve multi-level requests. |
| **UDF-AUD-30** | `HIGH` | Broken Feature / Functional Bug | `firestore.rules` | `firestore.rules:57–68, 145, 150, 178–182, 411–414, 428–431, 496–498` | Granular RBAC permissions (`MANAGE_ROLES`, `MANAGE_STAFF`, `EMPLOYEES_EDIT_PROFILE`, `EMPLOYEES_CORRECT_ID`, `EMPLOYEES_ACTION_RESTORE`, `SUBMISSIONS_REJECT`, `SUBMISSIONS_ADD_COMMENTS`, `SUBMISSIONS_EDIT_COMMENTS`, `SUBMISSIONS_REVERT_DECISION`, `SUBMISSIONS_CREATE_CORRECTION_LINK`, `SUBMISSIONS_VIEW_CORRECTION_LINKS`, `LEAVES_MANAGE_BALANCES`) are omitted from `firestore.rules` match blocks and fail with `PERMISSION_DENIED`. |
| **UDF-AUD-31** | `MEDIUM` | Broken Feature / Functional Bug | `src/services/employeeService.ts` | `employeeService.ts:4194–4220` | `getSiteHeadcounts` queries `where('data.${unitField.id}', '==', site.name)` instead of `where('currentSiteId', '==', site.id)`, ignoring transfers, reassignments, promotions, and bulk imports that only update `currentSiteId` and `siteName`. |
| **UDF-AUD-32** | `MEDIUM` | Broken Feature / Functional Bug | `App.tsx`<br>`components/EmployeeFormPage.tsx`<br>`src/services/employeeService.ts` | `App.tsx:1001`<br>`EmployeeFormPage.tsx:2178–2180`<br>`employeeService.ts:815, 887–891` | `handleEmployeeFormSubmit` returns `undefined` when `checkWritesBlock()` is active, crashing `EmployeeFormPage.tsx:2180` (`result.success` `TypeError`); additionally, `submitEmployeeForm` omits `submissionId` (`customFolder`) when calling `uploadSubmissionDocument`. |
| **UDF-AUD-33** | `CRITICAL` | Broken Feature / Functional Bug | `src/firebase/config.ts`, `components/AdminMasterEmployeeListPage.tsx`, `components/AdminDisciplinaryPage.tsx`, `components/employee/EmployeeAccountUpdatePage.tsx`, `components/AdminWorkflowConfigPage.tsx`, `src/services/requestService.ts`, `src/services/employeeService.ts` | `config.ts:44–46`, `AdminMasterEmployeeListPage.tsx:1794–1802`, `AdminDisciplinaryPage.tsx:76–86`, `EmployeeAccountUpdatePage.tsx:50–55, 105–113`, `AdminWorkflowConfigPage.tsx:374, 380`, `requestService.ts:19–36`, `employeeService.ts:3021–3022` | Missing `ignoreUndefinedProperties: true` in `initializeFirestore` throws fatal `FirebaseError: Unsupported field value: undefined` across site assignments (without sub-unit), disciplinary actions, account updates, fallback promotions, and Client ID length configs. |
| **UDF-AUD-34** | `CRITICAL` | Broken Feature / Functional Bug | `components/employee/EmployeeAccountUpdatePage.tsx`, `functions/index.js`, `components/EmployeeDashboardPage.tsx` | `EmployeeAccountUpdatePage.tsx:31–44, 50–55, 214–220`, `functions/index.js:5320–5357, 7697–7720`, `EmployeeDashboardPage.tsx:200–209` | Employee "Request Account Updates" page reads `employeeData.originalFormSections` (which is never written to `employees` documents on approval or bulk import and never passed via props), permanently showing *"No fields are currently configured as editable by the Admin"* for 100% of employees. |
| **UDF-AUD-35** | `HIGH` | Broken Feature / Functional Bug | `App.tsx`, `components/AdminPortalPage.tsx`, `components/AdminMasterEmployeeListPage.tsx`, `src/services/employeeService.ts` | `App.tsx:2312`, `AdminPortalPage.tsx:121, 196, 499–526, 650`, `AdminMasterEmployeeListPage.tsx:1361–1367, 1488–1494`, `employeeService.ts:2326–2342` | Prop name mismatch (`onUpdateId` vs `onUpdateSubmissionId`) and omitted `onSyncDrive` prop on `<AdminMasterEmployeeListPage>` make "Correct Employee Number" and "Backup Now / Re-Sync" silent no-ops; `updateSubmissionEmployeeId` also fails to rename the Google Drive folder. |
| **UDF-AUD-36** | `HIGH` | Broken Feature / Functional Bug | `functions/index.js`, `src/services/employeeService.ts` | `functions/index.js:5583–5592, 5692–5803`, `employeeService.ts:2766–2860` | Re-hiring a relieved employee with a New Employee ID (`rejoinEmployeeServer` Path A) leaves Firebase Auth `disabled: true`, duplicates `linkedUid`/`linkedGoogleEmail` on the old relieved record (blocking Google Login with `Account is relieved/inactive`), omits `onboarding_submissions`, and breaks Storage document access. |
| **UDF-AUD-37** | `HIGH` | Broken Feature / Functional Bug | `src/services/employeeService.ts`, `App.tsx` | `employeeService.ts:2344–2409`, `App.tsx:2103–2188` | Reverting an approved submission (`revertSubmissionWorkflow`) looks for files in `employees/${empId}` instead of `employees/${submissionId}/joining` and never rewrites `formData` paths; approving profile completion (`handleApproveProfileCompletion`) uses `linkedUid` instead of `portalId` and ignores string `storagePath` values, breaking all employee documents (404). |
| **UDF-AUD-38** | `HIGH` | Broken Feature / Functional Bug | `src/services/employeeService.ts`, `App.tsx`, `components/AdminPortalPage.tsx`, `src/services/recycleBinService.ts` | `employeeService.ts:2411–2515, 3957–4035`, `App.tsx:1834–1849`, `AdminPortalPage.tsx:433, 865`, `recycleBinService.ts:33–63` | Soft-deleted employees and submissions never call `moveToRecycleBin` (so `AdminRecycleBinPage` always shows `0` employees), bulk soft-delete silently skips employees without submissions when mixed with submission-backed employees, and `AdminPortalPage` blocks `EMPLOYEES_TAB_RECYCLE_BIN` staff from opening `AdminRecycleBinPage`. |
| **UDF-AUD-39** | `HIGH` | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:5510, 5520, 5560–5568, 6806, 6816, 7453, 7466, 7527–7547` | Cloud Function permission & state mismatches: `relieveEmployeeServer` rejects `EMPLOYEES_ACTION_RELIEVE` and leaves `assignedSiteIds` populated; `promoteEmployeeServer` rejects `EMPLOYEES_ACTION_PROMOTE` / `EMPLOYEES_EDIT_PROFILE` and fails to update `assignedSiteIds` on site transfer; `permanentDeleteEmployeeServer` rejects `DELETE_SUBMISSION`. |
| **UDF-AUD-40** | `MEDIUM` | Broken Feature / Functional Bug | `components/BlogDashboardPage.tsx`, `components/employee/EmployeeEngagementHub.tsx`, `functions/index.js` | `BlogDashboardPage.tsx:66, 77–89, 158–184, 403`, `EmployeeEngagementHub.tsx:105–118, 235–242`, `functions/index.js:5975, 5995–6008` | Daily Safety Quiz fails on fallback default question (`questionId: 'default'` / `undefined`), displays false `+10 Points Added` banner when server rejects, resets quiz state on page refresh in `BlogDashboardPage`, and uses UTC instead of IST (`Asia/Kolkata`) in `completeTrainingQuizServer`. |
| **UDF-AUD-41** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminGrievancesPage.tsx`, `src/services/engagementService.ts`, `firestore.rules` | `AdminGrievancesPage.tsx:339–363`, `engagementService.ts:475–498`, `firestore.rules:539–549` | Rejecting an employee reward redemption (`updateRewardRedemptionStatus` with `status: 'rejected'`) never refunds the deducted `pointsSpent` back to `user_engagement`, permanently burning employee points. |
| **UDF-AUD-42** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminWorkflowConfigPage.tsx`, `components/AdminCorrectionRequestsPage.tsx`, `src/services/employeeService.ts` | `AdminWorkflowConfigPage.tsx:327–358`, `AdminCorrectionRequestsPage.tsx:89–104`, `employeeService.ts:5381–5385` | Selecting "Custom Regex Pattern" in Client ID Library (`AdminWorkflowConfigPage`) immediately snaps back to `'none'`, and revoking a correction request (`revokeCorrectionRequest`) leaves `activeCorrectionToken` set on the target employee/submission document. |
| **UDF-AUD-43** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminMasterEmployeeListPage.tsx`, `src/services/employeeService.ts` | `AdminMasterEmployeeListPage.tsx:426–478, 500–510, 1644–1656, 2170–2308`, `employeeService.ts:1340–1349` | Master Employee List drops tab/site filter loads while `isLoading` is true, passes raw `searchTerm` instead of `debouncedSearchTerm` to case-sensitive Firestore prefix query, has a placeholder `alert("Reminder feature coming soon.")` on "Send Nudge", and renders two duplicate "New Employee ID" inputs in the Rejoin modal. |
| **UDF-AUD-44** | `MEDIUM` | Broken Feature / Functional Bug | `App.tsx`, `src/services/employeeService.ts`, `components/AdminLeaveManagementPage.tsx`, `functions/index.js` | `App.tsx:1916–1926`, `employeeService.ts:2295–2324`, `AdminLeaveManagementPage.tsx:113–139`, `functions/index.js:4924–4944` | Approving a leave request (`processRequestReviewServer`) executes `increment(-daysTaken)` on `employees.leaveBalance.<type>`, which turns uninitialized custom/imported leave balances negative (e.g. `-2`) and causes `AdminLeaveManagementPage` to compute `used = total - (-2) = total + 2`. |
| **UDF-AUD-45** | `CRITICAL` | Broken Feature / Functional Bug | `functions/index.js`, `src/components/auth/SetupAccountPage.tsx`, `src/utils/googleAuthHelper.ts` | `functions/index.js:1560–1575`, `SetupAccountPage.tsx:25–41, 66–74`, `googleAuthHelper.ts:57, 72` | `selfLinkGoogleAccount` (`functions/index.js:1561–1569`) rejects 100% of new Google accounts with `already-exists` because `getGoogleCredentialSafely()` (`googleAuthHelper.ts:72`) signs into Firebase Auth first (creating `authUserRecord`) while `empSnapByUid` and `subSnapByUid` are still empty; `SetupAccountPage` also silently no-ops when `user.employeeId` is undefined. |
| **UDF-AUD-46** | `CRITICAL` | Broken Feature / Functional Bug | `components/AdminAuditLogPage.tsx`, `src/services/auditService.ts`, `functions/index.js` | `AdminAuditLogPage.tsx:14, 38, 59–83, 94–96, 107–116, 213–221`, `auditService.ts:102–110`, `functions/index.js:4508–4520, 6959–6968, 7234–7243, 7403–7413, 7563–7573, 7770–7777, 8325–8334` | `AdminAuditLogPage` crashes with `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` because 7 Cloud Functions write `description`/`actorEmail`/`action`/`category` instead of `details`/`actorName`/`actionType`/`targetModule`; also destructures undefined `authUser` from `useAuth()` and has broken client-side edit/delete blocked by `firestore.rules`. |
| **UDF-AUD-47** | `HIGH` | Security Vulnerability | `functions/index.js` | `functions/index.js:5978–5987, 6022–6060` | `completeTrainingQuizServer` writes `userId: targetDocId` (`employeeId`) to `gamification_logs` (`L6054`) but checks `.where('userId', '==', uid)` (`L5979`) for daily rate-limiting, allowing any employee whose `employeeId !== uid` to farm unlimited quiz points per day. |
| **UDF-AUD-48** | `HIGH` | Security Vulnerability | `src/services/blogService.ts`, `firestore.rules` | `blogService.ts:23–32`, `firestore.rules:574–577` | Anonymous Firebase sessions (`signInAnonymously`) satisfy `isAuthenticated()` in `firestore.rules:575` and `!!auth?.currentUser` in `blogService.ts:23`, exposing all internal-only (`isPrivate: true`) blog posts to unverified visitors, while `where('isPrivate', '==', false)` hides public posts missing the `isPrivate` field. |
| **UDF-AUD-49** | `HIGH` | Broken Feature / Functional Bug | `components/employee/SecuritySettingsModal.tsx`, `functions/index.js`, `firestore.rules` | `SecuritySettingsModal.tsx:74–88`, `functions/index.js:507–669, 800–812, 1061–1065`, `firestore.rules:224–228` | `SecuritySettingsModal` (`change_google`) unlinks the current Google account before opening the Google sign-in popup; `employeeLogin` (`L812`) overwrites `uid` (`googleUid`) with `portalId`; `changeEmployeePassword` (`L1063`) rejects Google-logged-in employees (`callerUid` is `portalId` while `uid`/`linkedUid` is `googleUid`); and `firestore.rules:225–227` blocks `onboarding_submissions` `get` by `portalId`. |
| **UDF-AUD-50** | `HIGH` | Broken Feature / Functional Bug | `components/AdminVacancyManager.tsx`, `components/AdminSiteManagementPage.tsx`, `components/EmployeeFormPage.tsx`, `firestore.rules` | `AdminVacancyManager.tsx:16, 21–32, 134–161, 212, 231`, `AdminSiteManagementPage.tsx:69`, `EmployeeFormPage.tsx:217, 1488–1514`, `firestore.rules:445–449` | `firestore.rules:448` blocks `VACANCIES_POST` from saving vacancies; `AdminVacancyManager` destructures undefined `authUser` from `useData()` and passes invalid view string `'ADMIN_PORTAL_SITE_MANAGEMENT'`; `AdminSiteManagementPage:69` ignores `SITES_MANAGE`; `EmployeeFormPage:217` destructures undefined `authUser`/`isSuperAdmin` from `useAuth()`. |
| **UDF-AUD-51** | `MEDIUM` | Broken Feature / Functional Bug | `components/LegacyClaimModal.tsx`, `components/AdminLegacySystemsPage.tsx`, `functions/index.js` | `LegacyClaimModal.tsx:32`, `AdminLegacySystemsPage.tsx:95, 218, 255, 590–598, 656–721`, `functions/index.js:2988, 3008, 3017–3022` | `LegacyClaimModal` asks for Bank Account *Last 4 digits* while `claimEmployeeProfile` checks full account number; `claimEmployeeProfile` sets `claimed: true` before `/join` submission (locking out interrupted claims); `handleFileUpload` has stale `imports = []` closure breaking Smart Merge; Edit Modal omits `fatherName` and `location`. |
| **UDF-AUD-52** | `MEDIUM` | Broken Feature / Functional Bug | `components/EmployeeLoginPage.tsx`, `functions/index.js` | `EmployeeLoginPage.tsx:355, 363–384`, `functions/index.js:887–905, 930, 968–977` | Forgot Password modal (`EmployeeLoginPage.tsx:355`) prompts for Aadhaar `"Last 4 digits or full"` while `verifyAndResetEmployeePassword` (`functions/index.js:968`) requires full 12-digit equality (locking users out after 5 attempts), ignores `empData.formData` on `onboarding_submissions` (`L903–904`), and fakes Step 2 verification on the client (`L363–372`). |
| **UDF-AUD-53** | `CRITICAL` | Broken Feature / Functional Bug | `components/AdminPortalPage.tsx`, `components/AdminDisciplinaryPage.tsx`, `components/AdminMasterEmployeeListPage.tsx`, `components/AdminCorrectionRequestsPage.tsx`, `components/AdminLeaveManagementPage.tsx`, `components/AdminResignationManagementPage.tsx` | `AdminPortalPage.tsx:268, 379–390, 413, 436, 531, 827, 833, 852`, `AdminDisciplinaryPage.tsx:42, 134, 210`, `AdminMasterEmployeeListPage.tsx:628`, `AdminCorrectionRequestsPage.tsx:51, 356, 368`, `AdminLeaveManagementPage.tsx:85`, `AdminResignationManagementPage.tsx:43` | Systemic v1 vs v2 Permission Enum mismatch: `AdminRoleManagementPage` assigns v2 keys (`SUBMISSIONS_VIEW`, `DISCIPLINE_MANAGE`, `EMPLOYEES_VIEW_SENSITIVE_INFO`, etc.), while `AdminPortalPage` and module views check unassigned v1 keys (`VIEW_SUBMISSIONS`, `MANAGE_DISCIPLINE`, `VIEW_SENSITIVE_INFO`), hiding 7 sidebar modules for all custom roles, locking Disciplinary & Correction actions to read-only, and permanently masking Aadhaar/PAN/Bank PII. |
| **UDF-AUD-54** | `CRITICAL` | Broken Feature / Functional Bug | `src/services/bgvService.ts`, `components/AdminBgvManagementPage.tsx`, `functions/index.js`, `firestore.rules` | `bgvService.ts:282, 318–362, 412–473`, `AdminBgvManagementPage.tsx:100, 103`, `functions/index.js:3870–3884, 8199–8201, 8214, 8235–8244`, `firestore.rules:465–482` | BGV pipeline broken for non-SuperAdmins: `firestore.rules:471` blocks `markBgvUnderProcess` and `vendorSubmitBgvReport` status updates; `completeBgvReviewServer` rejects `BGV_UPLOAD_CERTIFICATE` ("Mode A: Upload BGV Certificate") and ignores `BGV_VIEW_SCOPE_ALL`; and `FIRESTORE_RULES_PERMS` strips `BGV_VIEW_SCOPE_ALL` from JWT claims. |
| **UDF-AUD-55** | `HIGH` | Security Vulnerability | `functions/index.js`, `src/utils/workflowHelper.ts`, `components/AdminRoleManagementPage.tsx` | `functions/index.js:3870–3884, 4761–4806, 4846–4921, 4993–5041`, `workflowHelper.ts:51–90`, `AdminRoleManagementPage.tsx:590–600, 719–735` | `processRequestReviewServer` ignores `staffDoc.permissionOverrides` (allowing revoked approvers to approve and blocking granted rejects), fails to escalate unassigned site workflow levels (`1 < 2` remains `Pending` when UI shows `"Final Approval"`), leaves Firebase Auth enabled on immediate resignation approval, fails to revert employee state when reverting approved resignations/account updates, and `saveUserOverrides` drops `allowedPrefillFieldIds`. |
| **UDF-AUD-56** | `HIGH` | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:2682–2754, 2796–2875` | Midnight cron bugs: `processNoticePeriodExitsCron` runs at `00:30 IST` (`19:00 UTC` previous day) and compares `relievingDate` against UTC `new Date().toISOString().split('T')[0]`, delaying every notice-period exit by 24 hours; `autoDeleteRecycleBin` passes submission UUID (`docSnap.id`) instead of badge ID (`data.employeeId`) to `deleteAssociated`, leaving orphaned requests, Storage files, and Auth accounts. |
| **UDF-AUD-57** | `HIGH` | Broken Feature / Functional Bug | `functions/index.js`, `firestore.rules`, `components/AdminWebsiteManager.tsx` | `functions/index.js:5658–5664`, `firestore.rules:150, 589–592`, `AdminWebsiteManager.tsx:193–214` | `rejoinEmployeeServer` checks wrong SuperAdmin role ID (`'super-admin'`) with no Firestore fallback and omits `EMPLOYEES_ACTION_REJOIN`; `firestore.rules:591` blocks `MANAGE_SYSTEM` admins from creating/editing/deleting `safety_quizzes` in Website Manager. |
| **UDF-AUD-58** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminTimelineSearchPage.tsx`, `components/common/Button.tsx`, `components/common/Input.tsx`, `components/BulkImportModal.tsx` | `AdminTimelineSearchPage.tsx:44–60, 87–121`, `Button.tsx:4–42`, `Input.tsx:5–44`, `BulkImportModal.tsx:388` | Employee Inquiry (`AdminTimelineSearchPage`) passes unsupported `text` and `icon` props to `<Button>` (which only renders `{children}`), rendering blank, label-less Search and View Timeline buttons, leaking `icon="[object Object]"` to the DOM, and firing duplicate `onViewTimeline` calls per click. |
| **UDF-AUD-59** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminGrievancesPage.tsx`, `components/BlogDashboardPage.tsx` | `AdminGrievancesPage.tsx:191–198, 393–397`, `BlogDashboardPage.tsx:31, 194` | `AdminGrievancesPage` computes KPI card & tab badge counts (`grievanceStats`) from the unfiltered company-wide `complaints` array instead of site-scoped `filteredComplaints`; `BlogDashboardPage` submits grievances without `siteId`/`siteName`, hiding them from site-scoped supervisors when `userId` is `portalId`. |
| **UDF-AUD-60** | `MEDIUM` | Broken Feature / Functional Bug | `components/EmployeeDashboardPage.tsx`, `components/employee/SecuritySettingsModal.tsx`, `functions/index.js` | `EmployeeDashboardPage.tsx:86, 91–96, 356, 413, 577, 613`, `SecuritySettingsModal.tsx:56–59, 229` | Forced Default-Password modal (`isForcedSecurity`) re-triggers in a loop on `EmployeeDashboardPage` whenever `employeeData` has `isDefaultPassword === true` (including after linking Google in Forced Mode, since `linkGoogleAccount` never clears `isDefaultPassword`), and `securityAction` state type omits `'change_google'`. |
| **UDF-AUD-61** | `HIGH` | Broken Feature / Functional Bug | `App.tsx`, `components/AdminPortalPage.tsx`, `src/contexts/DataContext.tsx`, `src/services/requestService.ts`, `src/services/employeeService.ts` | `App.tsx:1131–1177`, `AdminPortalPage.tsx:223–251`, `DataContext.tsx:171–209, 534–539`, `requestService.ts:59–67, 107–115, 144–152`, `employeeService.ts:1150–1163` | Defeated lazy-loading & redundant full-collection listeners: `App.tsx:1146` subscribes to all `onboarding_submissions` on `ADMIN_DASHBOARD` and tears down/re-subscribes on every tab change (`currentView` in deps); `AdminPortalPage.tsx:225–229` subscribes to all `leave_requests`, `account_updates`, and `resignations` immediately on `ADMIN_DASHBOARD`; and `DataContext` + `App.tsx` attach duplicate `subscribeToSubmissionsByUid` listeners for employees. |
| **UDF-AUD-62** | `HIGH` | Broken Feature / Functional Bug | `src/services/employeeService.ts`, `components/AdminReviewSubmissionsPage.tsx` | `employeeService.ts:1146–1285`, `AdminReviewSubmissionsPage.tsx:1085–1161, 1212–1216` | `getPaginatedSubmissions` downloads the entire `onboarding_submissions` collection + `settings/sites` on every page/filter load for site-scoped staff or search queries, drops submissions storing top-level `siteId`/`siteName`, ignores `id`/`employeeId`/`phoneNumber` in search, drops status-tab changes when `isLoading` is `true`, and groups all pending fields under `'General'` (`sec.title` vs `sec.name`). |
| **UDF-AUD-63** | `HIGH` | Security Vulnerability | `App.tsx` | `App.tsx:1748–1779` | "Deep Purge (Google Re-Auth)" calls `signInWithPopup(auth, provider)`, which immediately replaces `auth.currentUser` with `result.user` before line `1764` reads `activeEmail = auth.currentUser.email`—causing `signedInEmail !== activeEmail` to always evaluate to `false` and corrupting the admin's active Firebase Auth session. |
| **UDF-AUD-64** | `HIGH` | Broken Feature / Functional Bug | `App.tsx`, `src/contexts/DataContext.tsx`, `components/AdminLeaveManagementPage.tsx` | `App.tsx:550–562, 1084–1126, 1274–1291`, `DataContext.tsx:221–287, 497`, `AdminLeaveManagementPage.tsx:50–63, 113–139` | `DataContext.setLeaveBalances` is a silent no-op (`L285`), `DataContext.leaveBalances` is permanently `[]` for Admins (`employees` is only loaded for Employees), and `AdminLeaveManagementPage.tsx:115` fails to match `selectedEmpRecord` when `selectedRequest.employeeId` is a `portalId` (`UDF-...`) while `selectedEmpRecord.id` is `employeeId` (`HY...`), displaying `0` leave balance. |
| **UDF-AUD-65** | `HIGH` | Broken Feature / Functional Bug | `App.tsx`, `src/services/adminService.ts`, `components/AdminPortalPage.tsx` | `App.tsx:620–632, 729–761`, `adminService.ts:44–56`, `AdminPortalPage.tsx:575–595` | Form Builder `Job Details` hardcoded `unitField.order = 1; postField.order = 2` mutates `postField` in place and creates duplicate `order` collisions (`0, 1, 1, 2, 2...`), and `reorderSections` (`App.tsx:623`) splices unsorted `sectionsRef.current` while `AdminPortalPage.tsx:575` passes sorted indices, moving the wrong section. |
| **UDF-AUD-66** | `HIGH` | Broken Feature / Functional Bug | `App.tsx`, `components/AdminPortalPage.tsx`, `components/AdminStaffManagementPage.tsx` | `App.tsx:2227–2331`, `AdminPortalPage.tsx:121, 168, 196, 499–526, 650, 870`, `AdminStaffManagementPage.tsx:579–709` | Prop mismatch (`onUpdateId` vs `onUpdateSubmissionId`) passes `undefined` to `AdminReviewSubmissionsPage:650`; `App.tsx` omits `onRefreshStats` for `AdminRecycleBinPage:870`; and `AdminStaffManagementPage.confirmDelete(mode)` ignores `mode === 'just-user'` and unconditionally wipes site/employee supervisor links without restoring them on Undo. |
| **UDF-AUD-67** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminLeaveManagementPage.tsx`, `components/AdminResignationManagementPage.tsx`, `components/AdminAccountUpdateManagementPage.tsx`, `components/AdminReviewSubmissionsPage.tsx`, `App.tsx` | `AdminLeaveManagementPage.tsx:86`, `AdminResignationManagementPage.tsx:44`, `AdminAccountUpdateManagementPage.tsx:40`, `AdminReviewSubmissionsPage.tsx:2251`, `App.tsx:2234–2259` | `App.tsx:2234–2259` (`adminProps.userRole`) and module-level `hasPermission` helpers ignore `baseRole.isDisabled === true`, allowing staff assigned to a disabled role in Role Manager to continue approving/rejecting leaves, resignations, account updates, and assigning Employee IDs in the UI. |
| **UDF-AUD-68** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminDashboardPage.tsx`, `src/contexts/DataContext.tsx` | `AdminDashboardPage.tsx:44–54, 137–160`, `DataContext.tsx:411, 438` | `AdminDashboardPage.tsx:137–160` displays global `stats.pendingResignations` and `stats.pendingProfiles` to unassigned staff (`isUnassignedStaff`), while `DataContext.tsx:411` omits `EMPLOYEES_VIEW_SCOPE_ALL` from `hasViewScopeAll`, returning `0` dashboard stats for global HR officers without assigned sites. |
| **UDF-AUD-69** | `MEDIUM` | Broken Feature / Functional Bug | `src/components/common/SecureDocumentLink.tsx`, `components/common/RequestCorrectionModal.tsx` | `SecureDocumentLink.tsx:36–60, 78–92`, `RequestCorrectionModal.tsx:35–52, 120–128` | `SecureDocumentLink` calls `window.open(resolvedUrl, '_blank')` on raw `data:` base64 URLs (which modern browsers block with `Not allowed to navigate top frame to data URL`), and `RequestCorrectionModal` ignores prop updates to `initialSelectedFields` after mount and mutates `fieldReasons` state in place. |
| **UDF-AUD-70** | `MEDIUM` | Broken Feature / Functional Bug | `src/services/employeeService.ts`, `components/AdminDraftsManagementPage.tsx`, `src/services/recycleBinService.ts` | `employeeService.ts:342–359, 4265–4284`, `AdminDraftsManagementPage.tsx:58–76`, `recycleBinService.ts:385–393` | Sequential unbatched N+1 delete loops in `purgeAbandonedDrafts`, `handleCleanStaleDrafts`, `purgeEmployeesCollection`, and `emptyRecycleBin` execute hundreds of sequential network round-trips, causing multi-minute UI freezes and partial state on timeout. |
| **UDF-AUD-71** | `CRITICAL` | Broken Feature / Functional Bug | `components/AdminPortalPage.tsx`, `components/AdminSiteManagementPage.tsx`, `src/services/siteService.ts` | `AdminPortalPage.tsx:773`, `AdminSiteManagementPage.tsx:281–291, 390–392, 411–423`, `siteService.ts:58–62` | Catastrophic multi-site data wipe: `AdminPortalPage.tsx:773` passes only the filtered `allowedSiteIds` subset as the `sites` prop to `AdminSiteManagementPage`, which then calls `saveAllSites(updatedSites)` (`setDoc(sitesRef, { sites })`) on any add/edit/designation-delete—wiping out all other sites in the company; `handleSaveEdit` (`L413`) also wipes co-supervisors (`supervisorIds`). |
| **UDF-AUD-72** | `HIGH` | Broken Feature / Functional Bug | `components/employeeFormFields/EmployeeFileUploadField.tsx`, `components/common/DocumentCaptureModal.tsx`, `src/services/storageService.ts`, `src/utils/pdfCompression.ts` | `EmployeeFileUploadField.tsx:144–170, 235, 391, 445–487`, `DocumentCaptureModal.tsx:291–304`, `storageService.ts:436`, `pdfCompression.ts:42` | `EmployeeFileUploadField.tsx:146` rejects PDFs `> 5MB` before `compressPdf` (`storageService.ts:436`) is ever called; cropped images undergo triple lossy JPEG re-encoding (`0.92` -> `0.90` -> `0.90`); the `"Crop / Adjust"` button (`L445`) is unreachable dead code after upload (`isStringVal === true`); and replacing/removing files inside `DataCorrectionPage` or `DocumentUploadWizard` leaks orphaned files in Cloud Storage. |
| **UDF-AUD-73** | `HIGH` | Security Vulnerability | `components/EmployeeFormPage.tsx`, `src/services/employeeService.ts` | `EmployeeFormPage.tsx:413–425, 2045–2075, 2156–2177`, `employeeService.ts:810, 976` | `EmployeeFormPage.tsx:422` writes unencrypted candidate PII (Aadhaar, PAN, Bank Account, DOB, Phone) to persistent `localStorage` on every keystroke; `handleFinalSubmit` (`L2156–2164`) swallows `hashCandidatePassword` errors and submits Guest applications with `passwordHash: ''` (creating accounts that can never log in); and `handleNextStep` (`L2070`) reads stale `formErrors` state. |
| **UDF-AUD-74** | `HIGH` | Broken Feature / Functional Bug | `components/employee/DataCorrectionPage.tsx` | `DataCorrectionPage.tsx:95–119, 244–250, 396–404, 701–738` | `DataCorrectionPage.tsx:107–112` calls `await auth.signOut()` on mount for any non-Admin (`!isManager`), forcibly signing out already-logged-in active employees; pre-fills old values (`L244–249`) and allows submitting without modifying any requested field; and treats `{ storagePath: '' }` objects as non-empty file uploads (`L397`). |
| **UDF-AUD-75** | `HIGH` | Broken Feature / Functional Bug | `src/utils/bulkImportUtils.ts` | `bulkImportUtils.ts:592–597, 791–805, 819–876` | `checkDuplicatesInDatabase` (`L594–595`) queries non-existent `profileData.personalDetails.phoneNumber` and `formData.personalDetails.phoneNumber` paths (missing 100% of phone duplicates); `bulkImportEmployees` (`L796–799`) drops `importMode` (`'pending_profile'`), `defaultStatus`, and `existingConflicts` when calling `bulkImportEmployeesServer`; and client fallback (`L873`) calls `hashCandidatePasswordServer` sequentially per CSV row. |
| **UDF-AUD-76** | `MEDIUM` | Broken Feature / Functional Bug | `src/utils/aadhaarParser.ts` | `aadhaarParser.ts:62–73, 92, 132` | Aadhaar PDF parser (`parseAadhaarText`) fails on UIDAI letters with `Year of Birth: YYYY` or `YYYY-MM-DD` DOB formats (`L69`), truncates Father/Spouse names containing hyphens or apostrophes (`L92`), and can match the first 12 digits of a 16-digit VID when the Aadhaar number is masked (`L62`). |
| **UDF-AUD-77** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminWebsiteManager.tsx` | `AdminWebsiteManager.tsx:28–55, 138–155` | `AdminWebsiteManager.tsx:140` executes an unbounded `getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc')))` with no `limit()` or date filter (downloading every attendance record in company history), and line `45` calls `updateDoc(doc(db, 'settings', 'portal_config'))` which fails with `NOT_FOUND` if the doc does not exist. |
| **UDF-AUD-78** | `MEDIUM` | Broken Feature / Functional Bug | `components/AdminBgvManagementPage.tsx`, `src/services/bgvService.ts` | `AdminBgvManagementPage.tsx:86–104, 215–265`, `bgvService.ts:125–145` | `subscribeToBgvRecords` (`bgvService.ts:127`) opens an unbounded real-time listener on the entire `bgv_records` collection without server-side `siteId` filtering or pagination, and `AdminBgvManagementPage.tsx:86–93` ignores `userRole.isDisabled === true`. |
| **UDF-AUD-79** | `MEDIUM` | Broken Feature / Functional Bug | `src/services/adminService.ts`, `App.tsx` | `adminService.ts:105–134, 255–310`, `App.tsx:1058–1072` | `seedInitialData` (`adminService.ts:266–306`) runs 7 sequential `await getDoc(...)` calls on every SuperAdmin mount and checks legacy `settings/roles` instead of the `roles` collection—if `settings/roles` is missing, `updateRoles(defaultRoles)` deletes all custom roles in `roles` (`L121–126`). |
| **UDF-AUD-80** | `MEDIUM` | Broken Feature / Functional Bug | `src/utils/pdfCompression.ts` | `pdfCompression.ts:72–125` | `compressPdf` renders each PDF page to a `2400px` off-screen `<canvas>` without calling `page.cleanup()`, `pdfJsDoc.destroy()`, or zeroing canvas dimensions (`canvas.width = 0`), leaking WebWorker and GPU canvas memory on multi-page PDFs. |
| **UDF-AUD-81** | `HIGH` | Broken Feature / Functional Bug | `components/CareersPage.tsx`, `components/BlogPage.tsx`, `components/BlogsPage.tsx`, `components/EmployeeFormPage.tsx` | `CareersPage.tsx:48–50`, `BlogPage.tsx:107–109`, `BlogsPage.tsx:165–167`, `EmployeeFormPage.tsx:345–359, 1059–1076, 2331, 2448, 2467` | Public "Apply Now" job vacancy links (`/join?siteId=X&role=Y`) write to `formData.siteId` and `formData.designation` instead of `SITE_FIELD_ID` and `DESIGNATION_FIELD_ID`, and Google Sign-In (`setFormData(cleanPrefills)`) wipes them out completely, leaving the form un-prefilled and "Post of Apply" disabled. |
| **UDF-AUD-82** | `HIGH` | Broken Feature / Security Vulnerability | `functions/index.js`, `components/AdminRoleManagementPage.tsx` | `functions/index.js:1645–1768`, `AdminRoleManagementPage.tsx:199` | `adminControlEmployeeAuth` rejects 100% of delegated HR staff holding `Permission.EMPLOYEES_MANAGE_SECURITY` (`!isSuperAdmin`), fails to strip custom claims or revoke refresh tokens when unlinking Google (`unlink_google`), and generates weak fallback passwords (`firstName123`) on `reset_to_default` because it ignores `profileData`. |
| **UDF-AUD-83** | `HIGH` | Security Vulnerability & Broken Feature | `functions/index.js`, `components/AdminRoleManagementPage.tsx` | `functions/index.js:7053–7228`, `AdminRoleManagementPage.tsx:191` | `restoreRecycleBinServer` omits `EMPLOYEES_ACTION_RESTORE`, allows any staff with `EMPLOYEES_TAB_RECYCLE_BIN` to restore `SITE`, `DESIGNATION`, `VACANCY`, and `INVITE` records across all sites without module permissions, and fails to re-enable Firebase Auth (`disabled: false`) or resolve `submissionId` when restoring an `EMPLOYEE`. |
| **UDF-AUD-84** | `HIGH` | Security Vulnerability & Broken Feature | `functions/index.js`, `components/AdminInvitesPage.tsx` | `functions/index.js:7276–7380`, `AdminInvitesPage.tsx:1215–1216, 1322` | `deleteSiteServer` allows any site supervisor with `SITES_MANAGE` to delete any company site (zero `sitesManaged` or `SITES_DELETE` check), and permanently blocks deleting any site that ever had a calendar-expired or single-use-consumed referral invite because `status` remains `'Active'` in Firestore while the UI hides the "Revoke" button. |
| **UDF-AUD-85** | `HIGH` | Broken Feature & Security Vulnerability | `functions/index.js` | `functions/index.js:4660–4667, 6222–6587` | `syncRecordToDriveAndSheetsCore` permanently deadlocks `driveBackupStatus: 'in_progress'` on timeout/error (especially inside the 60s/256MiB `onSubmissionCreated` trigger), stamps `googleFormSyncStatus: 'synced'` even when Sheets/Form sync fails, writes employee Drive URLs to `data` instead of `profileData`/`formData`, and enables Google Sheets Formula Injection via `valueInputOption: 'USER_ENTERED'`. |
| **UDF-AUD-86** | `HIGH` | Broken Feature / Data Loss | `src/services/engagementService.ts`, `functions/index.js`, `firestore.rules` | `engagementService.ts:425–459`, `functions/index.js:7813–7822, 7857–7881, 7983–7992`, `firestore.rules:539–549, 566–570` | Client fallback in `createRewardRedemption` deducts employee points in `user_engagement` (`allowed` by `firestore.rules:543`) and then crashes on `addDoc(reward_redemptions)` (`allow create: if false` at `firestore.rules:569`), permanently burning employee points without creating a reward request; meanwhile `recordDailyStreakServer` and `redeemRewardServer` fail to resolve `employees` docs keyed by `submissionId` and skip Day-1 Dual-ID sync. |
| **UDF-AUD-87** | `HIGH` | Security Vulnerability & Broken Feature | `functions/index.js` | `functions/index.js:4238–4526` | `verifyCorrectionIdentity` and `submitCorrectionServer` never enforce `data.expiresAt`, `submitCorrectionServer` never checks `sessionToken === reqData.activeSessionToken`, fails to reset submission `status` to `'Pending'` or re-run `duplicateMatches`, and leaves `onboarding_submissions` and `formData` out of sync when correcting an `employee`. |
| **UDF-AUD-88** | `MEDIUM` | Broken Feature / Rules Mismatch | `components/AdminInvitesPage.tsx`, `firestore.rules` | `AdminInvitesPage.tsx:167, 572–605, 1215–1216, 1304`, `firestore.rules:507, 516` | `AdminInvitesPage.tsx` ignores `userRole.isDisabled` and `permissionOverrides`, and `firestore.rules` blocks `INVITES_REACTIVATE` on 100% of calendar-expired and single-use-consumed referral links because their stored Firestore `status` is still `'Active'` (`resource.data.status != 'Active'` evaluates to `false`). |
| **UDF-AUD-89** | `MEDIUM` | Security Vulnerability & Performance / Cost | `components/AdminGrievancesPage.tsx`, `src/services/engagementService.ts`, `firestore.rules` | `AdminGrievancesPage.tsx:76, 116–140, 178–188, 242–265`, `engagementService.ts:350, 463, 516`, `firestore.rules:168, 560–571` | `firestore.rules` allows any `isAdmin()` to read, modify, and delete all `complaints`, `reward_redemptions`, and `contact_messages` across all sites without module permissions or site isolation; `AdminGrievancesPage` opens 3 unbounded full-collection listeners on mount, omits site filtering on `filteredRewards`, and allows read-only viewers to mutate business inquiries. |
| **UDF-AUD-90** | `MEDIUM` | Broken Feature / Custom Claims Sync Bug | `functions/index.js`, `firestore.rules` | `functions/index.js:3870–3902, 4015–4054, 4118–4165`, `firestore.rules:168, 448, 560–571` | `computeAndApplyUserClaims` strips 15+ active permissions omitted from `FIRESTORE_RULES_PERMS` and silently `.pop()`-truncates tail permissions (`GAMIFICATION_MANAGE`, `DISCIPLINE_*`, `INVITES_*`, `BGV_*`) when claims exceed 900 bytes; `onRoleWritten` skips `users`, and `onSettingsSitesWritten` fails when `supervisorId` is a non-UID staff doc ID or username. |
| **UDF-AUD-91** | **HIGH** | Broken Feature / Crash & RBAC | `components/AdminDisciplinaryPage.tsx`, `src/services/requestService.ts` | `L76–86, 110–112, 168, 202`; `L19–35, 90–98, 127–135, 222–230` | Filing a disciplinary action without an attachment (`document: undefined`) or with empty `siteId` (`siteId: undefined`) crashes `setDoc()` because `uploadFilesInObject` preserves `undefined` keys; `AdminDisciplinaryPage` leaks records with missing `siteId` across sites and hardcodes `{isSuperAdmin}` on Delete instead of checking `Permission.DISCIPLINE_DELETE` |
| **UDF-AUD-92** | **HIGH** | Broken Feature / Functional Bug & Leak | `src/services/employeeService.ts`, `components/events/EmployeeTimelinePage.tsx` | `L4404–4629, 4632–4715`; `L48–49` | `getEmployeeTimeline` queries non-existent `submissionId` and `targetFieldLabels` on `correction_requests` (instead of `targetId` / `requestedFields`), omits `account_updates` and `resignations` entirely despite UI support, never fetches prior stint documents (`previousEmployeeId`), and `searchAllEmployees` leaks employees across all sites without `allowedSiteIds` filtering |
| **UDF-AUD-93** | **HIGH** | Broken Feature / Functional Bug & RBAC | `components/AdminDraftsManagementPage.tsx`, `components/EmployeeFormPage.tsx` | `L94–115, 240–248`; `L45` | `getDraftName` checks only `firstName`/`lastName`/`name` instead of the onboarding form's UUID field `'7debf274-baee-4bac-a137-4b4b46719874'`, causing 100% of real drafts to render as `"Incomplete Applicant"` and breaking name search; Delete button is exposed to read-only `SUBMISSIONS_VIEW_DRAFTS` viewers |
| **UDF-AUD-94** | **HIGH** | Broken Feature / RBAC & State Bug | `components/AdminCorrectionRequestsPage.tsx`, `src/services/employeeService.ts` | `L51, 94, 112, 356, 368`; `L5381–5411` | `AdminCorrectionRequestsPage` checks deprecated `Permission.MANAGE_SUBMISSIONS`, locking out all non-SuperAdmin staff from Revoke/Delete; `revokeCorrectionRequest` never clears `activeCorrectionToken` on the employee/submission; `deleteCorrectionRequest` queries `doc(db, 'employees', targetId)` directly instead of `resolveEmployeeDoc(targetId)` |
| **UDF-AUD-95** | **HIGH** | Security / Data Corruption | `src/services/recycleBinService.ts`, `functions/index.js` | `L122–393`; `L7108–7113` | `restoreFromRecycleBin` falls back to unvalidated client writes when `restoreRecycleBinServer` throws `permission-denied`; restoring a site unconditionally sets `status: 'Open'` on historical closed vacancies; `permanentDeleteFromRecycleBin` orphans soft-deleted vacancies on site/vacancy purge and blindly deletes active recreated records |
| **UDF-AUD-96** | **HIGH** | Security / Cross-Tenant Cache & Quota | `src/services/employeeService.ts` | `L4223–4260` | `getEmployeeLookupMap` uses a single global `_empLookupCache` across different `allowedSiteIds` scopes, truncates site filters at `.slice(0, 10)` (dropping sites 11+), ignores `siteId`/`assignedSiteIds`, and downloads the entire `employees` collection when `allowedSiteIds` is omitted |
| **UDF-AUD-97** | **MEDIUM** | Broken Feature / RBAC & Audit Attribution | `components/AdminVacancyManager.tsx`, `src/services/vacancyService.ts` | `L21–28, 174–183`; `L13–28` | `AdminVacancyManager` ignores `userRole.isDisabled` and `permissionOverrides`, logs `deletedByUid: 'user'` and `deletedByName: 'Admin'` (`authUser.uid`/`displayName` instead of `id`/`name`), and `getVacancies` returns soft-deleted vacancies (`isDeleted: true`) |
| **UDF-AUD-98** | **MEDIUM** | Broken Feature / Dead Route & Auth Bug | `src/components/auth/SetupAccountPage.tsx`, `functions/index.js`, `src/routes/AppRoutes.tsx` | `L29–41, 66–74, 94`; `L1388–1448`; `L96` | `SetupAccountPage` has no route mounted in `AppRoutes.tsx` (hitting `*` redirect), reads `user?.applicantName` instead of `user?.name`, and `setupEmployeePassword` (`functions/index.js:1405–1448`) never checks `linkedUid == callerUid` or `portalId == callerUid`, rejecting password setup with `permission-denied` for Google-onboarded employees |
| **UDF-AUD-99** | **MEDIUM** | Broken Feature / Form Builder State Bugs | `hooks/useFormBuilder.ts`, `components/FieldEditorModal.tsx` | `L9–18`; `L106–110, 120–121, 204` | `useFormBuilder.addSection` uses stale outer `sections.length` closure for `order`; `FieldEditorModal` spreads `{ ...existingField, ...fieldData }` while omitting cleared optional validation rules (`minLength`, `maxLength`, `allowedFileTypes`, `maxFileSizeMB`, `minAge`), making previously saved constraints impossible to remove |
| **UDF-AUD-100** | **MEDIUM** | Broken Feature / RBAC Lockout | `components/AdminLeaveManagementPage.tsx`, `components/AdminAccountUpdateManagementPage.tsx`, `components/AdminResignationManagementPage.tsx` | `L86, 205–214, 330`; `L40`; `L44` | `AdminLeaveManagementPage` gates the Leave Policy tab behind `{isSuperAdmin}` despite `firestore.rules:150` granting write access to `MANAGE_LEAVE_TYPES` / `LEAVES_APPROVE`, and all three request management pages ignore `userRole.isDisabled` and `authUser.permissionOverrides` |
| **UDF-AUD-101** | **HIGH** | Security / Unscoped Admin Rules | `firestore.rules` | `L384–402, 417–425, 493–498, 531–571` | `leave_balances`, `attendance`, `user_engagement`, `complaints`, `reward_redemptions`, `correction_requests`, and `notifications` grant full read/update/delete access to any `isAdmin()` user across all branches without checking granular permissions or `canStaffViewSite()` |
| **UDF-AUD-102** | **HIGH** | Broken Feature / Leave Balance Loss | `App.tsx`, `components/AdminLeaveManagementPage.tsx`, `src/contexts/DataContext.tsx` | `L1907–1943`; `L67, 101–111, 368`; `L591` | `handleDeleteWorkflowRequest` searches `DataContext.leaveRequests` (which subscribes only to `Pending` requests) when deleting an `Approved` leave from `AdminLeaveManagementPage.historicalRequests`, so `req` is always `undefined`, the employee's leave balance is never refunded, and the deleted row stays in `historicalRequests` |
| **UDF-AUD-103** | **HIGH** | Broken Feature / Account Lockout & Orphans | `src/services/employeeService.ts`, `App.tsx` | `L2326–2342`; `L1616–1625` | `updateSubmissionEmployeeId` updates `employeeId` only on `onboarding_submissions` and `employees` without updating Firebase Auth custom claims (`token.employeeId`), Storage paths (`employees/{oldId}`), or linked records in `leave_balances`, `leave_requests`, `account_updates`, `resignations`, `disciplinary_actions`, and `attendance` |
| **UDF-AUD-104** | **HIGH** | Security & Lifecycle Desync | `src/services/employeeService.ts` | `L2931–3131` | `relieveFromSite` marks an employee relieved on their last site via client `updateDoc` without calling `relieveEmployeeServer` (leaving their Firebase Auth account and `onboarding_submissions` active); `assignToSite` creates duplicate `PRIMARY` assignments; `promoteEmployee` swallows `permission-denied` and crashes `updateDoc` when `siteId`/`siteName` is `undefined` |
| **UDF-AUD-105** | **HIGH** | Broken Feature / Profile View & RBAC | `components/employee/EmployeeProfileView.tsx` | `L263, 287–294, 350–359, 459–489` | `EmployeeProfileView` reads `(employeeData.data || {})[field.id]` instead of `dataMap`/`profileData` (rendering `"Not Provided"`), ignores `userRole.fieldVisibility` (`HIDDEN`), hardcodes `editable={true}` and `collection="employees"` on `ProfileAvatar`, and exposes `"Request Profile Correction"` to all admins without permission checks |
| **UDF-AUD-106** | **HIGH** | Broken Feature / Unscoped Requests & Crash | `components/employee/EmployeeLeaveRequestPage.tsx`, `components/employee/EmployeeResignationPage.tsx`, `components/employee/EmployeeAccountUpdatePage.tsx` | `L125–130`; `L91–107, 152`; `L50–55, 105–113` | `EmployeeLeaveRequestPage` and `EmployeeResignationPage` pass `siteId: ''` when `activeAssignments` is empty; `EmployeeResignationPage` allows unlimited duplicate `Pending`/`Approved` resignations; `EmployeeAccountUpdatePage` crashes on `employeeData.data[selectedFieldId]` when `data` is `undefined` |
| **UDF-AUD-107** | **HIGH** | Broken Feature / RBAC Field Visibility Dead Code | `components/EmployeeFormPage.tsx`, `src/context/AuthContext.tsx` | `L217, 1488–1514`; `L4–12` | `EmployeeFormPage` destructures non-existent `{ authUser, isSuperAdmin }` from `useAuth()` (which exports `{ user, loading, setUser }`), causing `authUser` and `isSuperAdmin` to be permanently `undefined` and rendering role-based `fieldVisibility` (`HIDDEN` / `READ_ONLY`) 100% dead code |
| **UDF-AUD-108** | **HIGH** | Security & Notification Bugs | `functions/index.js`, `src/contexts/NotificationContext.tsx`, `src/services/notificationService.ts` | `L8092–8158`; `L148–175`; `L98–119` | `sendNotificationServer` allows anonymous callers to broadcast spoofed alerts to `all_admins`/`ROLE:*` and overwrite existing notification IDs via `.set(notifDoc)`; `markAllNotificationsAsRead` ignores `employeeId`, `portalId`, and `ROLE:` targets while mutating shared broadcasts as `read: true` for all staff |
| **UDF-AUD-109** | **MEDIUM** | Broken Feature / Cascade Delete Gaps | `src/services/employeeService.ts`, `firestore.rules` | `L3469–3635`; `L483, 601` | `deleteAssociatedRecords` omits `daily_quiz_logs` and `gamification_logs`, and issues client-side `deleteDoc` calls on `bgv_records` that fail with `permission-denied` for non-SuperAdmin staff (`firestore.rules:483`) |
| **UDF-AUD-110** | **MEDIUM** | Broken Feature / Form Rules & Recycle Bin UI | `src/utils/applyValidationRules.ts`, `components/AdminRecycleBinPage.tsx` | `L32–90, 170`; `L24–73, 135–142, 293–301` | `applyValidationRules.ts` assigns `allowedPattern: 'alphabets'` to personal/bank/branch name fields (blocking periods, hyphens, and initials) and overwrites `settings/form_sections` without `{ merge: true }`, while `AdminRecycleBinPage` omits filter tabs for `VACANCY` and `ROLE` items |
| **UDF-AUD-111** | **HIGH** | Broken Feature / Leave Requests Blocked | `components/EmployeeDashboardPage.tsx`, `components/employee/EmployeeLeaveRequestPage.tsx`, `src/contexts/DataContext.tsx` | `L189, 202, 213`; `L46–48, 114–118`; `L278` | `EmployeeDashboardPage` passes `employeeId={authUser?.id || ''}` (Firebase UID / submission doc ID) instead of `authUser?.employeeId`, while `DataContext.leaveBalances` keys entries by `emp.employeeId` (`HY...`), causing `currentBalance` in `EmployeeLeaveRequestPage` to be `null` (`0 / 0` balance) and blocking all paid leave requests |
| **UDF-AUD-112** | **HIGH** | Broken Feature / Attendance Points Never Awarded | `components/employee/AttendanceCalendar.tsx`, `src/services/engagementService.ts`, `functions/index.js` | `L107–146`; `L274–277`; `L7796–7915` | `AttendanceCalendar` fetches `attendancePoints` (`5` pts) and logs `Awarded +5 points`, but writes `streakData` without adding `pointsToAdd` (`SEC-17`), while `recordDailyStreakServer` only awards `streakPoints` (`1` pt) once per day on dashboard load—so marking shift attendance awards 0 points |
| **UDF-AUD-113** | **HIGH** | Broken Feature / Dual Engagement Hub Desync | `components/BlogDashboardPage.tsx`, `components/employee/EmployeeEngagementHub.tsx`, `functions/index.js` | `L106–123, 158–194, 237–239`; `L39–46, 74–84`; `L7985–7989` | `BlogDashboardPage` (`/dashboard`) queries `safety_quizzes` without `orderBy('createdAt', 'desc')` and indexes by `getDate() % length` instead of epoch days (`Math.floor(Date.now() / 86400000) % length`), never restores `lastQuizDate === today` on reload, omits `siteId` on grievances, and hardcodes a 1-user leaderboard |
| **UDF-AUD-114** | **HIGH** | Broken Feature / B2B Quote Loss & CMS Desync | `components/BusinessSolutionsPage.tsx`, `components/ServicesPage.tsx`, `src/routes/AppRoutes.tsx` | `L25, 48–84, 152–162, 314–330`; `L34–49`; `L287` | `BusinessSolutionsPage` ("Get a Service Quote") has a dummy `onSubmit` that only shows `alert()` and discards all B2B leads, ignores CMS `config.services` and headcount stats, never renders its imported `SEOHead`, and `/services` redirects to `/business` leaving `ServicesPage.tsx` dead code |
| **UDF-AUD-115** | **HIGH** | Broken Feature / Correction Modal State Bugs | `components/common/RequestCorrectionModal.tsx` | `L35–52, 115–128, 365–368` | `RequestCorrectionModal` never syncs `selectedFields`/`fieldReasons` when `targetId` or `initialSelectedFields` changes, directly mutates `delete fieldReasons[id]` inside `setSelectedFields`, and lists disabled/hidden fields (`isDisabled` / `fieldVisibility: 'HIDDEN'`) |
| **UDF-AUD-116** | **MEDIUM** | Broken Feature / Stale Avatar & Submission Desync | `components/ProfileAvatar.tsx` | `L28, 34–57, 86–97` | `ProfileAvatar` initializes `photoURL` from `currentPhotoURL` in `useState` without a `useEffect` syncing prop updates (showing stale avatars across profile switches), and uploading an employee avatar never updates `onboarding_submissions.profilePhotoURL` |
| **UDF-AUD-117** | **MEDIUM** | Broken Feature / Contact Form Rule Rejection | `components/ContactPage.tsx`, `firestore.rules` | `L47–71, 189–255`; `L158–169` | `ContactPage` lacks client-side length validation and `.trim()` matching `firestore.rules` (`name` 2–100 chars, `email` 5–120 chars, `message` 5–3000 chars), causing short inquiries to fail with `permission-denied` and a generic hotline error |
| **UDF-AUD-118** | **MEDIUM** | Broken Feature / Legacy External Form in Footer | `components/common/PublicFooter.tsx`, `components/common/PublicHeader.tsx` | `L89–95, 111–117`; `L151–152, 229–230` | `PublicFooter` links `"Join UDF (Apply Online)"` to an external legacy Google Form (`https://forms.gle/f86UXjTiusatMUVd7`) instead of `/join`, bypassing the portal onboarding workflow |
| **UDF-AUD-119** | **MEDIUM** | Broken Feature / Subdomain Redirect Loop & Missing Route | `src/routes/AppRoutes.tsx`, `src/components/guards/AuthGuard.tsx`, `components/AdDemoPage.tsx` | `L188–197, 246–255, 281–292`; `L45–53`; `L21` | When `appTarget === 'admin'` has an Employee session (or `appTarget === 'employee'` has an Admin session), `AuthGuard` redirects to `/employee/dashboard` or `/admin/dashboard` which hits `/*` in the same subdomain app target in an infinite loop; `AdDemoPage` (`/ad-demo`) has no route in `AppRoutes.tsx` |
| **UDF-AUD-120** | **MEDIUM** | Broken Feature / `resolveEmployeeDoc` UID Gap & Script Crash | `src/services/employeeService.ts`, `scripts/search-user.js` | `L73–110`; `L19` | `resolveEmployeeDoc` checks doc ID, `employeeId`, `portalId`, and `submissionId` but never queries `uid` or `linkedUid`, returning `null` when called with a Firebase Auth UID; `scripts/search-user.js:19` calls `fs.readFileSync` without importing `fs` |
| **UDF-AUD-121** | **HIGH** | Broken Feature / CSV Export & RBAC | `components/AdminMasterEmployeeListPage.tsx`, `components/AdminPortalPage.tsx` | `L911`, `L940–943`, `L1212–1213`; `L268` | `"Export CSV"` exports only the current 25-row page (`employees`) ignoring filters, `AdminPortalPage.tsx:268` checks legacy `VIEW_SENSITIVE_INFO` instead of `EMPLOYEES_VIEW_SENSITIVE_INFO`, `"Joined On"` column prioritizes `emp.timestamp` over `emp.joiningDate`, and the Site Filter dropdown lists all company sites when `!hasViewScopeAll`. |
| **UDF-AUD-122** | **HIGH** | Broken Feature / Staff Profile & Avatar | `components/AdminStaffProfilePage.tsx`, `src/services/authService.ts` | `L37–40`, `L57–59`, `L76`, `L95`; `L187–285` | `AdminStaffProfilePage` filters assigned sites only by legacy `s.supervisorId === authUser?.id` (ignoring `s.supervisorIds` and `sitesManaged`), `getStaffProfile`/`getAdminProfile` never copy `profilePhotoURL` onto `authUser` (causing uploaded avatars to vanish on refresh), and `hasPermission` ignores `isDisabled` & `permissionOverrides`. |
| **UDF-AUD-123** | **HIGH** | Security & Broken Feature / Private Blogs | `components/BlogPage.tsx`, `components/BlogsPage.tsx` | `L79–84`, `L142`, `L273`; `L42`, `L77`, `L141`, `L198` | Public homepage `BlogPage.tsx` (`recentPosts = posts.slice(0, 3)`) never filters out `post.isPrivate` for signed-in `UserType.PUBLIC` applicants, while `BlogsPage.tsx` locks out all `UserType.ADMIN` users from viewing their own private posts and reads non-existent `selectedPost?.coverImage` instead of `imageUrl`. |
| **UDF-AUD-124** | **MEDIUM** | Broken Feature / Workflow & Client ID Config | `components/AdminWorkflowConfigPage.tsx` | `L34`, `L103`, `L158`, `L167–175`, `L272`, `L374–388` | `addLevel` and reviewer dropdowns include disabled roles (`r.isDisabled`), clearing `minLength`/`maxLength` passes `undefined` into `clientIdDefinitions` array objects (crashing `setDoc`), and `isRequiredByDefault` (`"Required for New Sites"`) is never read when creating sites. |
| **UDF-AUD-125** | **HIGH** | Broken Feature / Master List Modals & RBAC | `components/AdminMasterEmployeeListPage.tsx` | `L1649–1651`, `L1739–1745`, `L1763`, `L1802–1807`, `L2172–2305`, `L2576` | `"Send Nudge / Reminder"` button is a dead `alert("Reminder feature coming soon.")` stub, Deployments/Rejoin/Promote modals list all company sites without scoping to `effectiveAllowedSiteIds`, `assignToSite`/`relieveFromSite` never update `managementTarget` state in the open modal, and Rejoin Modal renders two duplicate `"New Employee ID"` inputs. |
| **UDF-AUD-126** | **HIGH** | Security & Data Integrity / Role Overrides | `components/AdminRoleManagementPage.tsx` | `L413–455`, `L590–601`, `L681–735`, `L1110–1114`, `L1486`, `L1520`, `L1551–1553` | `saveUserOverrides` uses `setDoc(..., { merge: true })` on nested `permissionOverrides` (never deleting keys reset to `'INHERIT'` or `{}` in Firestore) and drops `allowedPrefillFieldIds`, role/override saves never trigger `refreshAdminClaims`, `section.name` renders blank headers, and active `"Hidden"` pill uses `bg-red-50 text-white`. |
| **UDF-AUD-127** | **HIGH** | Security & Broken Feature / Staff Accounts | `components/AdminStaffManagementPage.tsx` | `L257–262`, `L309–338`, `L439–526`, `L608–657`, `L690–700` | `handleAddStaff` writes `sitesManaged` after `createStaffUserServer` mints claims with `sitesManaged: []`, `saveStaffEdit` & `handleExecuteTransfer` update Firestore without updating Firebase Auth email or custom claims, and clicking `"Undo"` after staff deletion fails to restore wiped site/employee/submission supervisor links. |
| **UDF-AUD-128** | **HIGH** | Broken Feature & RBAC / Site Management | `components/AdminSiteManagementPage.tsx` | `L69`, `L209`, `L370–424`, `L441`, `L769–777`, `L850`, `L993`, `L1020`, `L1186`, `L1277` | `hasManagePerm` hardcodes `Boolean(isSuperAdmin)` (locking out `Permission.SITES_MANAGE`), Hierarchy List View renders Edit/Power buttons without `hasManagePerm`, editing site supervisors never syncs `staff_accounts.sitesManaged`, `s.name === "Job Details"` fails against `s.title`, and `emp.data[...]` crashes when `emp.data` is undefined. |
| **UDF-AUD-129** | **HIGH** | Security & Privacy Bypass / Biodata Print | `components/AdminReviewSubmissionsPage.tsx` | `L613–1036`, `L855`, `L2251`, `L3091–3109`, `L3114–3350` | Biodata Preview Modal and `handlePrintBiodata` unconditionally display all sensitive fields (Aadhaar, PAN, Bank Account, IFSC, Phone, Photo) bypassing `userRole.onboardingFieldVisibility` (`'HIDDEN'`), Details Modal renders blank `{sec.name}` headers, `canAssignId` ignores `isDisabled`/`permissionOverrides`, and printed biodata hardcodes blank `Reg. No.: HY _____`. |
| **UDF-AUD-130** | **HIGH** | Broken Feature / Admin Sidebar & Route RBAC | `components/AdminPortalPage.tsx` | `L268`, `L368–436`, `L531`, `L614`, `L637–710`, `L757`, `L833` | `navStructure` checks only legacy v1 permissions (`MANAGE_*`/`VIEW_*`) instead of v2 permissions (`*_VIEW`/`*_APPROVE`) hiding 7 modules from custom roles, `ADMIN_PORTAL_BGV_MANAGEMENT` route guard blocks `Permission.BGV_VENDOR`, `ADMIN_PORTAL_TIMELINE_SEARCH` blocks `EMPLOYEES_VIEW_TIMELINE`, and `navStructure` `useMemo` omits `authUser`. |
| **UDF-AUD-131** | **HIGH** | Broken Feature / Account Update Review | `components/AdminAccountUpdateManagementPage.tsx`, `src/services/requestService.ts` | `L40`, `L68–86`, `L148–161`; `L171–187` | File upload account updates store `{ name, storagePath }` objects in `currentValue`/`requestedValue`, causing `typeof === 'string'` check to fall through and render `"[object Object]"` instead of `<SecureDocumentLink>`, and `subscribeToAccountUpdates` fetches only `'Pending'` records with no historical fetch for `'Approved'`/`'Rejected'` tabs. |
| **UDF-AUD-132** | **HIGH** | Broken Feature / Resignation Review | `components/AdminResignationManagementPage.tsx`, `src/services/requestService.ts` | `L44`, `L74–94`, `L207–222`; `L244–260` | `subscribeToResignationRequests` fetches only `'Pending'` resignations with no on-demand fetch for `'Approved'`/`'Rejected'` filter tabs (permanently showing `0`), and resignation letter preview reads `(selectedRequest.document as any).url` instead of `.storagePath`, passing `undefined` to `<SecureDocumentLink>`. |
| **UDF-AUD-133** | **HIGH** | Broken Feature / Leave Management & Balances | `components/AdminLeaveManagementPage.tsx`, `src/contexts/DataContext.tsx` | `L100–139`, `L154–169`, `L220–228`; `L139`, `L221–283` | `DataContext.employees` is never populated (`[]`), making `DataContext.leaveBalances` permanently `[]`; `AdminLeaveManagementPage` wipes `historicalRequests` whenever switching to `'ALL'` (`"Total"`) or `'Pending'` (resetting Approved/Rejected tab counters to `0`), and `getEmployeeBalance` ignores custom employee quotas. |
| **UDF-AUD-134** | **HIGH** | Broken Feature / Legacy Systems Import | `components/AdminLegacySystemsPage.tsx`, `components/AdminPortalPage.tsx` | `L126–134`, `L164–255`, `L465`, `L475`; `L849` | `handleFileUpload` `useCallback` omits `imports` from its dependencies (closing over stale `imports = []` and defeating Smart Merge), `.filter(Boolean)` strips rows missing ID/Name before error reporting (`errors` is always `[]`), `.xlsx` files are rejected despite UI prompt, and `EMPLOYEES_IMPORT` staff fail Firestore rules on all mutations. |
| **UDF-AUD-135** | **CRITICAL** | Security & Multi-Tenant Leak / BGV Tracker | `components/AdminBgvManagementPage.tsx`, `src/services/bgvService.ts` | `L242–253`, `L722`, `L798–805`, `L1033`; `L215–227` | `allowedSiteIds.length > 0` check fails open when `allowedSiteIds` is `[]` (leaking all company BGV records to unassigned staff), `if (record.vendorName && ...)` fails open when `vendorName` is empty (leaking all undispatched `PENDING` candidates & Aadhaar docs to external BGV vendors), and table avatars bypass `isFieldHiddenForRole('photo')`. |
| **UDF-AUD-136** | **CRITICAL** | Security & Governance Placebo / Emergency Lock | `components/AdminWebsiteManager.tsx`, `firestore.rules`, `storage.rules`, `functions/src/cron.ts` | `L1184–1201`, `L1332–1442` | `"Emergency LOCK Database"` (`manualEmergencyLock`), `"Enable Read-Only Mode"` (`manualReadOnly`), and circuit-breaker caps (`blockReadsOnLimit`, `blockWritesOnLimit`, `blockUploadsOnLimit`, `dbReadCap`, `dbWriteCap`, `storageCap`) are never enforced anywhere in `firestore.rules`, `storage.rules`, Cloud Functions, or client services, and `autoDeleteAbandonedSubmissions` is missing from `functions/src/cron.ts`. |
| **UDF-AUD-137** | **HIGH** | Security & Audit Integrity / Audit Logs | `components/AdminAuditLogPage.tsx`, `firestore.rules` | `L14`, `L17`, `L21–105`, `L113`, `L150–183`; `L504–510` | `const { authUser } = useAuth()` destructures non-existent `authUser` (always `undefined`, bypassing the non-admin `actorId` filter), hidden `Ctrl+Shift+Alt+Delete` mode and `firestore.rules` allow editing and deleting immutable security audit logs, and `filterAction` state has no UI dropdown. |
| **UDF-AUD-138** | **HIGH** | Security & Multi-Tenant Leak / Referral Invites | `components/AdminInvitesPage.tsx` | `L167`, `L174`, `L181`, `L214`, `L240`, `L258–262`, `L326–330`, `L834`, `L1005`, `L1164` | `activeSites` and site dropdowns are unscoped (allowing site-restricted staff to generate referral links for any company site), global `referredEmployees` listener queries an arbitrary `limit(50)` without `where('recruitedBy', ...)` before filtering in memory, `s.name === "Job Details"` fails against `s.title`, and `f.type` checks legacy strings instead of `FieldType`. |
| **UDF-AUD-139** | **MEDIUM** | Broken Feature / Admin Dashboard Analytics | `components/AdminDashboardPage.tsx` | `L37–54`, `L137–160`, `L233–261` | `"Leave Insights"` chart reads `stats.leavesByType` (which does not exist on `DataContext.stats`; it lives on `dashboardAnalytics.leavesByType`), permanently rendering `"No leave data available."`; `stats.pendingResignations` and `stats.pendingProfiles` bypass `isUnassignedStaff`, and `hasPermission` ignores `userRole.isDisabled`. |
| **UDF-AUD-140** | **MEDIUM** | Broken Feature & RBAC / Bulk Import Modal | `components/BulkImportModal.tsx`, `components/AdminMasterEmployeeListPage.tsx` | `L58–62`, `L113–129`, `L166–173`; `L2464` | `AdminMasterEmployeeListPage` passes unfiltered `sites` to `BulkImportModal` (allowing site-restricted staff to bulk-import into unauthorized sites), `sheet_to_csv` + `parseCSV` corrupts multi-line Excel cells, duplicate check errors silently fall back to importing without conflict checks, and `handleClose` leaks stale `duplicateConflicts`. |
| **UDF-AUD-141** | `HIGH` | Broken Feature / Dead Callable & Route | `components/employee/ProfileClaimPage.tsx`, `firebase.json`, `src/routes/AppRoutes.tsx` | `L73`, `L267–269, L599–601` | `ProfileClaimPage.tsx` invokes non-existent Cloud Function `claimEmployeeProfile` (also mapped in `firebase.json` rewrites) instead of `verifyLegacyClaim`, and the component is never mounted in `AppRoutes.tsx`. |
| **UDF-AUD-142** | `MEDIUM` | Broken Feature / Camera & Crop Modal | `components/common/DocumentCaptureModal.tsx` | `L13, L69, L145–158, L216–247, L250–305, L617` | `DocumentCaptureModal` accepts `maxSizeMB` prop but never enforces it; clicking capture before video stream dimensions initialize produces a `0x0` `"data:,"` canvas that hangs on `"Processing image orientation..."`; `enumerateDevices()` runs before permission grant; and toggling `lockAspect` fails to recalculate the active crop box. |
| **UDF-AUD-143** | `MEDIUM` | Broken Feature / Timeline Schema Mismatch | `components/events/EmployeeTimelinePage.tsx` | `L55–65, L70–81` | `EmployeeTimelinePage` only checks legacy string keys (`'Applicant Name'`, `'designation'`, `'currentSite'`) and omits Form Builder UUID keys and `currentSiteId` (falling back to `'Employee Record'`), and `getBgColor()` omits `case 'RESIGNATION'`. |
| **UDF-AUD-144** | `HIGH` | Broken Feature / Auth & Password Reset UX | `components/EmployeeLoginPage.tsx` | `L44–50, L67, L152, L363–365` | Cross-subdomain `?sso=google` redirect triggers `signInWithPopup` inside `useEffect` without a user gesture (blocked by browsers with `auth/popup-blocked`), Step 2 `"Verify"` button in Forgot Password performs zero verification before advancing to Step 3, and `employeeId` is passed to `employeeLogin` without `.trim().toUpperCase()`. |
| **UDF-AUD-145** | `HIGH` | Broken Feature / Approval Escalation Halts | `src/utils/workflowHelper.ts` | `L15–43` | `isRoleAssignedToSite` returns `true` for any role with any `*_VIEW_SCOPE_ALL` permission even when 0 active staff hold that role or the scope permission belongs to a different module, and when `roleObj.isDisabled === true` it falls through to step 2 without returning `false`, halting workflow auto-escalation on empty or suspended roles. |
| **UDF-AUD-146** | `HIGH` | Broken Feature / Form Builder Reorder Corruption | `hooks/useFormBuilder.ts`, `components/SectionItem.tsx`, `components/AdminPortalPage.tsx` | `L40–49, L111–128`, `L49, L84–92`, `L575–583` | `AdminPortalPage` and `SectionItem` sort sections/fields by `.order` and pass the sorted index to `reorderSections`/`reorderFields`, which `.splice()` the unsorted state arrays—corrupting section/field order—and `SectionItem` caches stale `section.name` state while ignoring `section.title`. |
| **UDF-AUD-147** | `MEDIUM` | Broken Feature / Location Resolution Collisions | `src/utils/subUnitUtils.ts` | `L10–59, L92–104` | `buildSubUnitLookupMap` and `resolveLocation` never filter out `Inactive` sites/sub-units and index sub-unit names in a flat global `Map`, silently overwriting earlier sites whenever two sites share a sub-unit name like `"Main Gate"` or `"Tower 1"`. |
| **UDF-AUD-148** | `HIGH` | Broken Feature / Onboarding Auth & Persistence | `src/utils/googleAuthHelper.ts` | `L178, L194–200` | On native Capacitor platforms, `googleLinkForOnboarding` calls `googleSignInForOnboarding()` (`signInWithCredential` instead of `linkWithCredential`), destroying the anonymous UID and orphaning the candidate's draft; on web, it downgrades the global `auth` singleton to `browserSessionPersistence`. |
| **UDF-AUD-149** | `HIGH` | Broken Feature / PAN & Name Substring Collision | `utils/formDataHelper.ts` | `L15, L26, L110, L126–131` | `getApplicantPAN` checks `labelLower.includes('pan')`, which matches `"Previous Company & Experience"` (`com-pan-y` in Section 2 before Section 4) and extracts the applicant's previous employer as their PAN number; `getApplicantName` matches `"Father's Name"`/`"Bank Name"`; and partial strings are returned without format validation. |
| **UDF-AUD-150** | `HIGH` | Security & Broken Feature / Unmasked PII Export | `utils/exportUtils.ts` | `L23, L50–52, L76` | `isSensitiveField` checks `'aadhaar'` (two `'a'`s) and omits `'aadhar'` (`"Aadhar Card No"`), `'uan'`, `'epfo'`, and `'esic'`, exporting 100% of Aadhaar, UAN, and ESIC numbers unmasked even when `canViewSensitive === false`, while ignoring `emp.profileData`/`emp.formData` and exporting file fields as `"[object Object]"`. |
| **UDF-AUD-151** | `MEDIUM` | Security & Broken Feature / Legacy Upload & Migration | `src/components/employeeFormFields/EmployeeFileUploadField.tsx`, `src/utils/migrationHelper.ts` | `L33–55`, `L12` | Duplicate `src/components/employeeFormFields/EmployeeFileUploadField.tsx` uploads raw files directly to Storage without size/type validation, compression, or `fileSessionStore` encryption, and `migrationHelper.ts` writes to the non-existent `'staff'` collection instead of `'staff_accounts'`. |
| **UDF-AUD-152** | `MEDIUM` | Security / HTML Sanitizer Protocol-Relative URL Bypass | `src/utils/sanitizeHtml.ts` | `L19, L26–31` | `SAFE_URL_PATTERN = /^(https?:\/\/|\/|#|mailto:|tel:)/i` allows protocol-relative external URLs (`//attacker.com/evil`), and the non-DOM fallback regex fails to strip `<iframe src="javascript:...">`, `<svg onload=...>`, or entity-encoded `javascript:` URIs. |
| **UDF-AUD-153** | `MEDIUM` | Broken Feature / Legal Nav & Inflated About Fallbacks | `components/PrivacyPolicyPage.tsx`, `components/TermsOfServicePage.tsx`, `components/AboutPage.tsx` | `L33`, `L33`, `L130, L136` | Clicking `"Careers"` in the header of `PrivacyPolicyPage` and `TermsOfServicePage` executes `navigate('/')` instead of `navigate('/careers')`, and `AboutPage` falls back to hardcoded `'15,000+'` officers and `'800+'` sites instead of live `public_stats`. |
| **UDF-AUD-154** | `MEDIUM` | Compliance & UI Bug / Placebo Cookie Banner & Duplicate Keys | `components/common/CookieConsent.tsx`, `components/common/ProgressBar.tsx`, `components/common/TagInput.tsx` | `L21–29`, `L31`, `L16–27` | `CookieConsent` writes `'declined'` to `localStorage.getItem('cookieConsent')` which is never read anywhere in the app (violating the Privacy Policy disclosure), `ProgressBar` uses `key={sectionName}` causing duplicate key errors, and `TagInput` drops uncommitted text on blur. |
| **UDF-AUD-155** | `MEDIUM` | Broken Feature / Payday Countdown, Grievance `siteId` & Quiz Sync | `components/employee/EmployeeEngagementHub.tsx` | `L89–118, L125–137, L147` | Payday countdown shows `0` or `-0` days remaining on the 7th due to midnight timestamp subtraction; grievance submission omits Form Builder site UUID fallback (`siteId: ''`); and client `setDoc` overwrites server `user_engagement` quiz state and locally adds points even after server rejection. |
| **UDF-AUD-156** | `MEDIUM` | Broken Feature / Disciplinary Document Crash & Legacy Claim State Leak | `components/employee/EmployeeDisciplinaryPage.tsx`, `components/LegacyClaimModal.tsx` | `L76–83`, `L44–55, L78` | `EmployeeDisciplinaryPage` passes raw object `(action as any).document` as `path` to `<SecureDocumentLink>` (crashing on `path.startsWith`), and `LegacyClaimModal` fails to reset state on close/reopen or wrap `signInWithCustomToken` in `lockSession()`/`unlockSession()`. |
| **UDF-AUD-157** | `HIGH` | Broken Feature / Static SEO & Sitemap Build Failure | `scripts/generateStaticPages.js`, `firestore.rules` | `L64–76, L105–106, L514–536`, `L277` | `generateStaticPages.js` queries `blog_posts?pageSize=100` unauthenticated without a `where('isPrivate', '==', false)` structured query, which `firestore.rules` rejects with HTTP `403 PERMISSION_DENIED`—causing `fetchBlogPosts()` to silently return `[]`, pre-rendering 0 Firestore blog posts and wiping all blog URLs from `public/sitemap.xml`. |
| **UDF-AUD-158** | `HIGH` | Security & Hosting Config / CSP Blocks AdSense & Broken Vercel/Netlify Configs | `firebase.json`, `vercel.json`, `netlify.toml`, `components/common/AdSenseUnit.tsx` | `L43, L439, L771`, `L1–13`, `L1–11` | `firebase.json` CSP omits all Google AdSense domains (`pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`), blocking `<AdSenseUnit>` in production; `vercel.json` and `netlify.toml` publish `"dist"` instead of `"dist-public"` and omit all 43 `/api/*` Cloud Function rewrites and security headers. |
| **UDF-AUD-159** | `MEDIUM` | Broken Feature / `PublicHeader` Dead `'/dashboard'` Link for Employees | `components/common/PublicHeader.tsx` | `L24–30, L44–60, L122, L204` | When an employee is logged in on the public portal, `PublicHeader` top nav renders `path: '/dashboard'` (which redirects to `/`) instead of `'/employee/dashboard'`, hides `'Careers'` and `'Business Services'`, and mis-navigates `#hash` links as `'/#hash'`. |
| **UDF-AUD-160** | `HIGH` | Broken Feature / Audit Actor Override Mis-Mapping & Premature `limit(100)` | `src/services/auditService.ts` | `L43–64, L70–95` | `logSystemAction` maps `actorOverride.id` to `targetId` and drops `actorOverride.name`, while `subscribeToAuditLogs` applies `limit(100)` globally before filtering by `filter.actorId` in memory—returning 0 logs for any staff member whose actions precede the latest 100 global events. |
| **UDF-AUD-161** | `HIGH` | Security & Multi-Tenant Isolation / Monolithic `settings/sites` Overwrite & Cross-Site Tampering | `src/services/siteService.ts`, `src/services/adminService.ts`, `firestore.rules` | `L29–62`, `L149–152`, `L271` | Storing all company sites in a single array on `settings/sites` and granting full document write access in `firestore.rules` to any staff with `SITES_EDIT` allows a single-site manager to modify or delete every other branch site in the company and causes concurrent edits to overwrite each other. |
| **UDF-AUD-162** | `MEDIUM` | Broken Feature / `updatePublicStats` Rule Block & Inaccurate Headcount | `src/services/statsService.ts`, `firestore.rules` | `L29–49`, `L271` | `updatePublicStats()` writes to `settings/public_stats`, which `firestore.rules` blocks for all HR admins lacking `SETTINGS_MANAGE`, and counts `where("isActive", "==", true)` on `employees` without excluding `isRelieved == true` or `isDeleted == true`. |
| **UDF-AUD-163** | `HIGH` | Broken Feature / `syncBgvCandidates` Wrong `bgvSites[0]` Fallback & Missing Form Builder UUID Extraction | `src/services/bgvService.ts` | `L174–279, L396–406, L456–472, L508–517` | `syncBgvCandidates` never extracts employee Name, Phone, Aadhaar, DOB, Father Name, Address, or documents from Form Builder UUID keys in `emp.data`, assigns unmatched employees to `bgvSites[0]` (wrong site!), and its client approval/rejection fallbacks never update `employees/{id}.bgvStatus`. |
| **UDF-AUD-164** | `HIGH` | Broken Feature / `uploadProfilePhoto` Extension Mismatch, Staff Path Rejection & Null `toBlob` Crash | `src/services/storageService.ts` | `L503–562` | `compressImage` outputs `image/jpeg` (`${baseName}.jpg`), but `uploadProfilePhoto` uses the original file extension (`avatar.png`/`avatar.webp`), hardcodes `employees/${userId}/profile/` even for staff accounts, and crashes when `canvas.toBlob` returns `null`. |
| **UDF-AUD-165** | `HIGH` | Broken Feature / `requestService.ts` Silent File Nullification on Upload Error & Unlogged Workflow Revert | `src/services/requestService.ts` | `L19–36, L262–289` | `uploadFilesInObject` catches upload failures and silently saves the request with `result[key] = null` (dropping required leave/profile/disciplinary attachments without warning), fails to scan nested objects for `File` instances, and `revertWorkflowRequest` fallback omits `approvalHistory` and leave-balance refunds. |
| **UDF-AUD-166** | `HIGH` | Broken Feature / `getEmployeeProfile` Missing `linkedUid`/`uid` Queries & Relieved Google Email Collision | `src/services/authService.ts` | `L50–121` | `getEmployeeProfile` never queries `where("linkedUid", "==", uid)` on `employees` or `where("uid", "==", uid)` on `onboarding_submissions`, and queries `linkedGoogleEmail` without `where("isActive", "==", true)`—matching old relieved stints first, overwriting their `uid`, and locking out active rejoined employees. |
| **UDF-AUD-167** | `MEDIUM` | Broken Feature / Duplicate Attendance Documents on Concurrent Taps & Missing Complaint `siteId` Resolution | `src/services/engagementService.ts` | `L237–272, L307–346` | `markAttendanceForDate` uses non-atomic `getDocs` + `addDoc` with random IDs instead of deterministic `${userId}_${date}` doc IDs (creating duplicate attendance entries on double-tap), and `submitComplaint` fails to resolve `siteId` from Form Builder UUID `52ae217b-2602-4337-a1cd-a1f9bd36a4b0`. |
| **UDF-AUD-168** | `MEDIUM` | Broken Feature / `aadhaarParser.ts` Missing `Year of Birth` Support, Premature 6-Digit Address Truncation & PDF Worker Leak | `src/utils/aadhaarParser.ts` | `L34–44, L68–73, L132–149, L293–378` | `parseAadhaarText` fails to parse `Year of Birth: YYYY` e-Aadhaar cards, truncates addresses prematurely whenever a door/plot/survey number contains 6 digits (`(?=\d{6})`), and `extractTextFromPDF`/`removePdfPassword` never call `pdf.destroy()`. |
| **UDF-AUD-169** | `HIGH` | Security / Anonymous Auth Session Promotion Exposes All Internal `isPrivate: true` Blog Posts to Public Visitors | `src/firebase/config.ts`, `src/services/blogService.ts`, `firestore.rules` | `L140–155`, `L20–32`, `L277` | `ensureAuthenticated()` signs public visitors in anonymously (`signInAnonymously`), making `!!auth?.currentUser` (`isAuth`) `true` in `blogService.ts:23` and `request.auth != null` `true` in `firestore.rules:277`—allowing any anonymous public visitor to fetch and read 100% of private internal company blog posts (`isPrivate: true`). |
| **UDF-AUD-170** | `MEDIUM` | Broken Feature / `public/sw.js` Service Worker Killer Forces Hard Page Reloads & Collides With `VitePWA` | `public/sw.js`, `vite.config.ts` | `L1–14`, `L74–133` | `public/sw.js` unregisters itself and calls `clients.forEach(c => c.navigate(c.url))` on activation—forcibly reloading open tabs and wiping unsaved `/join` onboarding form state—and gets copied into `dist-admin/sw.js` alongside `VitePWA`'s `sw-v2.js`. |
| `UDF-AUD-171` | **HIGH** | Broken Feature / Rules Mismatch | `App.tsx`, `firestore.rules` | `L2360–2390`, `L119–129` | `handleCompleteProfile` calls client `updateDoc(empRef, employeePayload)` with `profileData`, `data`, `needsProfileCompletion`, and `profileStatus`, which is rejected with `PERMISSION_DENIED` by `firestore.rules:119–129`, breaking the employee `DocumentUploadWizard` completion flow end-to-end. |
| `UDF-AUD-172` | **HIGH** | Security / Storage Auth Bypass | `functions/index.js` | `L2464–2469`, `L3637–3652`, `L3686–3691` | `getUploadUrl` and `deleteStoragePath` grant `isAuthorized = true` to **any caller** whenever the target employee or submission has a non-null `activeCorrectionToken`, without verifying that the caller knows the token or holds a verified `sessionToken`. |
| `UDF-AUD-173` | **HIGH** | Security & Broken Feature | `functions/index.js`, `src/services/employeeService.ts` | `L4580–4623`, `L5217`, `L728–736` | `onSubmissionCreated` writes server-detected duplicates to `updates.duplicateMatches` instead of `updates.duplicateCheck` (and never scans `onboarding_submissions` for `DUPLICATE_SUBMISSION`), while `approveOnboardingServer` and `App.tsx` only check `subData.duplicateCheck.isDuplicate`. |
| `UDF-AUD-174` | **HIGH** | Broken Feature / Scoping Bug | `src/contexts/DataContext.tsx` | `L303–358` | `allowedSiteIds` returns `undefined` whenever a staff role has `EMPLOYEES_VIEW_SCOPE_ALL` or `SUBMISSIONS_VIEW_SCOPE_ALL` (and ignores `permissionOverrides` and `isDisabled`), causing `scopedLeaveRequests`, `scopedAccountUpdateRequests`, `scopedResignationRequests`, and `scopedDisciplinaryActions` to hit `if (!allowedSiteIds) return [];` and return 0 records. |
| `UDF-AUD-175` | **HIGH** | Multi-Tenant Isolation & Stale Closure | `src/contexts/NotificationContext.tsx` | `L32–34`, `L114–175` | Subscribes all site-scoped staff and external BGV vendors to global `'all_admins'`/`'admin'` notifications, mutates `{ read: true }` directly on shared broadcast documents (hiding alerts from all other admins), and closes over `user = null` in `sendNotification` due to an empty `useCallback(..., [])` dependency array. |
| `UDF-AUD-176` | **HIGH** | Broken Feature / Audit Schema Mismatch | `functions/index.js` | `L2862, 4508, 4646, 5067, 5449, 5596, 5772, 5875, 6959, 7234, 7404, 7564, 7770, 8326` | 14 Cloud Functions write `audit_logs` documents using `action`/`module`/`category`/`description`/`performedBy` instead of `actionType`/`targetModule`/`details`/`actorName`, breaking module/action filtering and badges in `AdminAuditLogPage.tsx`. |
| `UDF-AUD-177` | **HIGH** | Broken Feature / Duplicate Leaderboard | `functions/index.js` | `L6045–6051`, `L7924–7930`, `L8046–8051` | Dual-ID sync in `completeTrainingQuizServer`, `recordDailyStreakServer`, and `redeemRewardServer` writes two separate documents in `user_engagement` (`user_engagement/{targetDocId}` and `user_engagement/{uid}`), duplicating the same employee on the Gamification Leaderboard. |
| `UDF-AUD-178` | **MEDIUM** | Broken Feature / Timezone Bug | `functions/index.js` | `L5975` | `completeTrainingQuizServer` computes `today = new Date().toISOString().split('T')[0]` in UTC instead of `Asia/Kolkata` (IST), causing 00:00–05:30 AM IST quiz lockouts and same-day double completions. |
| `UDF-AUD-179` | **HIGH** | Security & Broken Feature | `src/context/AuthContext.tsx` | `L120–151` | Real-time `onSnapshot(staffRef)` listener fails to sign out suspended (`isDisabled: true`) staff users and omits `sitesManaged` from the JWT token-refresh trigger condition. |
| `UDF-AUD-180` | **HIGH** | Broken Feature / Claims Sync | `functions/index.js` | `L4118–4165` | `onSettingsSitesWritten` fails to resolve supervisors assigned by `username`/`employeeId`, overwrites custom claims without unioning `staff_accounts.sitesManaged`, and never stamps `claimsUpdatedAt` on `staff_accounts`. |
| `UDF-AUD-181` | **HIGH** | Broken Feature / Leave Balance Key Mismatch | `components/employee/EmployeeLeaveRequestPage.tsx`, `src/contexts/DataContext.tsx` | `L52, 114, 175`, `L242` | `EmployeeLeaveRequestPage.tsx` looks up `currentBalance.balances[typeConfig.typeId]` (`'Casual'`, `'Sick'`, `'Earned'`) while `DataContext.tsx:242` keys `balances` by `lt.label` (`'Casual Leave'`, `'Sick Leave'`, `'Earned Leave'`), displaying `0 / 0` balances and blocking all leave submissions. |
| `UDF-AUD-182` | **MEDIUM** | Broken Feature / Date Overflow | `components/employee/AttendanceCalendar.tsx` | `L59–74` | `handlePrevMonth` and `handleNextMonth` call `d.setMonth(d.getMonth() ± 1)` on a `Date` retaining the current day-of-month (e.g. 31st) without calling `d.setDate(1)`, overflowing and skipping February and all 30-day months when clicked on the 31st. |
| `UDF-AUD-183` | **MEDIUM** | Broken Feature / UI Rendering | `components/employee/EmployeeAccountUpdatePage.tsx` | `L214–220`, `L307` | `displayValue` falls through to `String(value)` (`"[object Object]"`) when rendering file upload fields (`{ storagePath, driveUrl }`) in the Current Value box and Request History table. |
| `UDF-AUD-184` | **MEDIUM** | Broken Feature / Navigation Bug | `components/EmployeeDashboardPage.tsx`, `App.tsx` | `L701, 708`, `L899–934` | Breadcrumb passes URL path `'/employee'` to `navigateTo(path as AppView)`, which expects an `AppView` enum (`'EMPLOYEE_DASHBOARD'`), corrupting `currentView` and bouncing the employee out to `'/'`. |
| `UDF-AUD-185` | **MEDIUM** | Broken Feature / Missing Icons & Route | `components/ServicesPage.tsx` | `L34–49`, `L82` | `renderIcon` omits `PawPrint`, `Car`, `Calendar`, and `Cpu` defined in `websiteService.ts:35–76`, hardcodes fake AdSense slot `"5555555555"`, and `/services` is never mounted in `AppRoutes.tsx`. |
| `UDF-AUD-186` | **MEDIUM** | Broken Feature / Dead Mobile Layout | `src/utils/capacitor-utils.ts`, `components/EmployeeDashboardPage.tsx` | `L6–24`, `L98, 402` | `isNativeApp()` and `isAndroid()` are hardcoded to return `false`, permanently disabling the native mobile bottom-tab layout (`if (native)`) on Capacitor Android APK builds. |
| `UDF-AUD-187` | **MEDIUM** | Broken Feature / Broken CLI Utility | `src/utils/createAdmin.js` | `L10, 42, 48` | Crashes on Node execution (`Cannot find module '../firebase/config.js'`), assigns `roleId: 'role-hr-manager'` instead of `'role-super-admin'`, and writes to the legacy `'staff'` collection. |
| `UDF-AUD-188` | **HIGH** | Security & Data Loss Risk | `scripts/clear-employee-test-data.mjs`, `scripts/check_user_exact.js`, `scripts/search_user_rest.mjs` | `L39–72`, `L15–16`, `L21` | `clear-employee-test-data.mjs` production detection is bypassed when `firebase use` outputs an alias (`default`) without the project ID string, and diagnostic scripts hardcode a real user's personal Gmail (`arjosarka56r@gmail.com`) and Firebase UID (`FgWijMwhsWfMDGpYn5Alpv6tbw02`). |
| `UDF-AUD-189` | **MEDIUM** | Schema & Config Mismatch | `src/constants/defaults.ts`, `App.tsx` | `L182–234`, `L1060–1066` | `defaults.ts` uses field labels `"Father's Name"`, `"Mother's Name"`, `"ESIC No"`, and `"Passport Size Photo"` that mismatch `googleFormMapping.ts` (`"Father Name"`, `"Mother Name"`, `"ESI No"`, `"Photo"`), and `App.tsx:1060` shadows `defaultEditableFields` with a conflicting local array. |
| `UDF-AUD-190` | **HIGH** | Broken Feature / Storage Path Mismatch | `App.tsx` | `L2123–2171`, `L2343` | `handleApproveProfileCompletion` looks for uploaded profile-completion files in `onboarding/${subData.linkedUid || subId}` instead of `onboarding/${empDoc.id}` (where `handleDocumentUpload` uploaded them) and fails to rewrite plain string storage paths. |
| `UDF-AUD-191` | **HIGH** | Security & Data Sync Bug | `functions/index.js` | `L4438–4496` | `submitCorrectionServer` sets `allowedFields = null` when `requestedFields` is empty (allowing arbitrary field overwrites), fails to update top-level `applicantName` when Full Name is keyed by UUID `7debf274-...`, and leaves `onboarding_submissions` out of sync when `targetType === 'employee'`. |
| `UDF-AUD-192` | **HIGH** | Security / Unauthenticated Profile Claim | `functions/index.js` | `L2896–2975` | `claimEmployeeProfile` does not require `request.auth` (allowing unauthenticated callers to claim legacy profiles with `claimedByUid: ''`) and increments the daily lockout counter `_auth_attempts/claim_${id}` before checking if `legacy_claim_config.enabled` is true or if the employee exists. |
| `UDF-AUD-193` | **HIGH** | Security / Unauthenticated Password Oracle | `functions/index.js` | `L1253–1312` | `verifyEmployeePassword` has no `request.auth` or caller ownership check and uses a separate rate-limit bucket (`verify_${employeeId}`), exposing an unauthenticated password oracle and tripling the brute-force allowance across `login_`, `verify_`, and `unlink_`. |
| `UDF-AUD-194` | **HIGH** | Security / Missing Ownership Check | `functions/index.js` | `L1315–1384` | `unlinkEmployeeGoogleAccount` checks `if (!request.auth)` (which passes for any anonymous session) and never verifies that `request.auth.uid` owns `employeeId`, allowing an attacker with a predictable default password to unlink any employee's Google account. |
| `UDF-AUD-195` | **HIGH** | Security / Account Hijacking via Link | `functions/index.js` | `L1108–1250` | `linkEmployeeGoogleAccount` never verifies that the caller session owns `employeeId`, allowing an attacker who knows an employee's predictable default password (`firstName + birthYear + @ + last4Phone`) to bind their own Google account and hijack the profile. |
| `UDF-AUD-196` | **MEDIUM** | Broken Feature / Timezone Bug | `functions/index.js` | `L2796–2823` | `processNoticePeriodExitsCron` runs at `00:30 AM IST` (`19:00 UTC` previous day) but computes `todayStr = new Date().toISOString().split('T')[0]` in UTC (yesterday's date in IST), delaying all automated notice-period exits by 24 hours. |
| `UDF-AUD-197` | **HIGH** | Broken Feature / Apps Script Auth Mismatch | `GOOGLE_APPS_SCRIPT_v7.2.js` | `L75–91`, `L111–128` | `verifyViaApi` only checks `users/{uid}` for `roleId === 'role-super-admin'` (ignoring `staff_accounts/{uid}` and granular role permissions), blocking all HR Managers and Admins from executing Drive folder operations during onboarding approval, relieving, and deletion. |
| `UDF-AUD-198` | **MEDIUM** | Broken Feature / Drive Folder Routing | `GOOGLE_APPS_SCRIPT_v7.2.js`, `src/services/employeeService.ts` | `L12–18, 141–145`, `L2644, 2756, 2926` | `relieveEmployee` calls `'block_employee'` (moving relieved employees' Drive folders to `'Blocked Employees'` while `FOLDERS.RELIEVED` is never used), and `rejoinEmployee`/`restoreEmployee` call `'restore_employee'` (moving active employees' folders into `'Pending Employees'` instead of `'Active Employees'`). |
| `UDF-AUD-199` | **MEDIUM** | Broken Feature / Google Form Checkbox Sync | `GOOGLE_APPS_SCRIPT_v7.2.js` | `L320–321` | `submitToForm` wraps `field.value` in `[field.value]` for `FormApp.ItemType.CHECKBOX`, passing a nested array `[[...]]` when `field.value` is already an array and causing checkbox field sync to fail. |
| `UDF-AUD-200` | **HIGH** | Broken Feature / Rules Block on Correction Links | `components/employee/DataCorrectionPage.tsx`, `src/services/employeeService.ts`, `firestore.rules` | `L164–172`, `L5012–5044, 5070–5074`, `L218` | `DataCorrectionPage.tsx:164` and `submitCorrectionResponse` (`employeeService.ts:5071`) call direct Firestore `getDoc(doc(db, 'correction_requests', token))`, which throws an uncaught `PERMISSION_DENIED` error under `firestore.rules:218` (`allow read: if isStaff()`), breaking correction links for all candidates and employees. |
| `UDF-AUD-201` | **HIGH** | Broken Feature / Forced Sign-Out on Correction Page | `components/employee/DataCorrectionPage.tsx` | `L96–114` | `handleInitialAuthCheck` forcibly signs out (`await auth.signOut()`) any non-admin user on first mount, destroying the active session of logged-in employees and Google applicants when they open `/correct-details?token=...`. |
| `UDF-AUD-202` | **MEDIUM** | Broken Feature / Missing Image Size Limit | `components/employee/DataCorrectionPage.tsx` | `L645–648` | `validateSingleField` checks `if (fileSizeMB > maxMB && !isImage)`, exempting all image files from `maxFileSizeMB` validation on the Data Correction page. |
| `UDF-AUD-203` | **HIGH** | Multi-Tenant Isolation & Caching Bug | `src/services/employeeService.ts` | `L4223–4263` | `getEmployeeLookupMap` caches results in a single module-global `_empLookupCache` not keyed by `allowedSiteIds` (and truncates `allowedSiteIds.slice(0, 10)`), serving cross-site cached lookup maps across scope changes. |
| `UDF-AUD-204` | **HIGH** | Broken Feature / Always-Zero Site Headcounts | `src/services/employeeService.ts` | `L4194–4220` | `getSiteHeadcounts` queries `where("data.<unitFieldId>", "==", site.name)` while `EmployeeFormPage.tsx:2436` stores `site.id` and `approveOnboardingServer` writes `currentSiteId`/`profileData` (not `data`), returning `0` headcount for every site on the Admin Analytics dashboard. |
| `UDF-AUD-205` | **HIGH** | Broken Feature / Unscoped Analytics Query | `src/services/employeeService.ts` | `L4314–4378` | `getDashboardAnalytics` runs an unscoped collection-wide query on `employees` when `allowedSiteIds` is provided (failing `firestore.rules:114` with `PERMISSION_DENIED` and returning `0` recent hires for site-scoped staff) and truncates `allowedSiteIds.slice(0, 10)` on leave counts. |
| `UDF-AUD-206` | **HIGH** | Broken Feature / Paginated Submissions `PERMISSION_DENIED` | `src/services/employeeService.ts` | `L1164–1217` | When `hasSiteFilter` is true, `getPaginatedSubmissions` runs an unscoped query across the entire `onboarding_submissions` collection to filter sites in memory, which is immediately rejected with `PERMISSION_DENIED` by `firestore.rules:152` for all site-scoped staff. |
| `UDF-AUD-207` | **HIGH** | Broken Feature / Paginated Employees Query Failure | `src/services/employeeService.ts` | `L1310–1315`, `L1400–1422` | `getPaginatedEmployees` uses `where("needsProfileCompletion", "in", [false, null])` (which fails to match documents where `needsProfileCompletion` is `null` or undefined in Firestore), and its `catch` fallback query drops all site constraints, failing `firestore.rules:114` with `PERMISSION_DENIED` for site-scoped staff. |
| `UDF-AUD-208` | **HIGH** | Multi-Tenant Isolation & Broken Search | `src/services/employeeService.ts` | `L4632–4754` | `searchAllEmployees` runs 8 unscoped collection-wide queries without `allowedSiteIds` (failing `firestore.rules` for site-scoped staff) and checks non-existent `data.isDeleted` instead of `data.deletedAt`, labeling soft-deleted Recycle Bin records as `"Active"`. |
| `UDF-AUD-209` | **HIGH** | Broken Feature / Referral `joined` Double-Increment | `src/services/employeeService.ts`, `functions/index.js` | `L1035–1043`, `L1950–1957`, `L5421` | `submitEmployeeForm` attempts a direct client `updateDoc(inviteRef, { joined: increment(1) })` (which fails `firestore.rules:232` for candidates or increments prematurely for staff) and then `updateSubmissionStatus` / `approveOnboardingServer` increments `joined` a second time upon approval. |
| `UDF-AUD-210` | **HIGH** | Broken Feature / Timeline Missing Corrections | `src/services/employeeService.ts` | `L4589–4591` | `getEmployeeTimeline` queries `correction_requests` with `where('submissionId', '==', rid)` instead of `where('targetId', '==', rid)`, always returning 0 correction request events. |
| `UDF-AUD-211` | **HIGH** | Broken Feature / Employee Timeline `PERMISSION_DENIED` | `src/services/employeeService.ts`, `firestore.rules` | `L4538, 4565, 4590`, `L173, 199, 218` | `getEmployeeTimeline` queries `leave_requests`, `disciplinary_actions`, and `correction_requests` across all `relatedIds` (`employeeId`, `portalId`, etc.) by `where('employeeId', '==', rid)`, which throws `PERMISSION_DENIED` for Google-authenticated employees whose `request.auth.uid` is their Google UID (and misses disciplinary records keyed by `targetUserId`). |
| `UDF-AUD-212` | **HIGH** | Security & Data Corruption / Empty Email Match | `src/services/employeeService.ts` | `L1893`, `L2220`, `L2269–2282` | `subscribeToEmployeeByUid` runs `where("linkedGoogleEmail", "==", auth.currentUser?.email || "")`; when `auth.currentUser?.email` is null/empty, it queries `linkedGoogleEmail == ""`, matching manual employees initialized with `linkedGoogleEmail: ''` (`L1893`) and attempting to overwrite their `uid` field. |
| `UDF-AUD-213` | **HIGH** | Broken Feature / Revert Workflow Orphans Files | `src/services/employeeService.ts` | `L2359–2386` | `revertSubmissionWorkflow` moves storage files from `employees/${empId}` instead of `employees/${submissionId}/joining`, fails to rewrite `employees/...` storage paths in `onboarding_submissions.formData` back to `onboarding/...`, and leaves the Drive folder inside `'Active Employees'`. |
| `UDF-AUD-214` | **MEDIUM** | Broken Feature / Restore Corrupts Relieved Status | `src/services/employeeService.ts` | `L2517–2573` | `restoreEmployee` unconditionally sets `isRelieved: false` and `isActive: true` even when restoring a relieved employee from the Recycle Bin, and calls `'restore_employee'` which moves active employees' Drive folders into `'Pending Employees'`. |
| `UDF-AUD-215` | **HIGH** | Broken Feature / Email Sync Misses UUID Field | `src/services/employeeService.ts` | `L4757–4774` | `adminUpdateEmployeeEmail` updates `email`, `profileData.personalDetails.email`, and `data.email` on `employees/{id}` without updating the Form Builder email UUID key in `profileData`/`data` or syncing to `onboarding_submissions`. |
| `UDF-AUD-216` | **HIGH** | Broken Feature / Password Hash Drop & Maintenance Crash | `App.tsx`, `components/EmployeeFormPage.tsx` | `L1200, 1233`, `L2155–2180` | `handleFormSubmit` returns `undefined` when `checkWritesBlock()` is true (crashing `EmployeeFormPage.tsx:2179` on `result.success`), `EmployeeFormPage.tsx:2161` silently swallows `hashCandidatePassword` errors and submits with `isDefaultPassword: true`, and `draftId` is left inside `processedFormData`. |
| `UDF-AUD-217` | **MEDIUM** | Broken Feature / Review Step Site ID & Checkbox Display | `components/EmployeeFormPage.tsx` | `L3096–3111` | On the Review & Submit step, `"Unit or Facility"` renders the raw site ID (`"site-1"`) instead of resolving `siteOptionLabels[val]`, and `FieldType.CHECKBOX` checks `val ? 'Yes' : 'No'` before `Array.isArray(val)`, rendering `"Yes"` instead of the selected checkbox options (even for an empty array `[]`). |
| `UDF-AUD-218` | **MEDIUM** | Broken Feature / Stale Error Scroll on Step Next | `components/EmployeeFormPage.tsx` | `L2045–2075` | `handleNextStep` reads `Object.keys(formErrors)[0]` immediately after `validateStepFields(currentStep)` schedules an asynchronous `setFormErrors` update, reading stale state and failing to scroll to the first validation error. |
| `UDF-AUD-219` | **MEDIUM** | Broken Feature / Legacy Login Client `uid` Write | `src/services/employeeService.ts` | `L4143–4192` | `verifyEmployeeLogin` attempts a client-side `updateDoc(doc.ref, { uid })` on `onboarding_submissions` (`L4160`), which is rejected by `firestore.rules:158` (`PERMISSION_DENIED`). |
| `UDF-AUD-220` | **MEDIUM** | Broken Feature / Inaccurate Submission Count | `src/services/employeeService.ts` | `L3628–3632` | `getEmployeeRecordCounts` returns `1` whenever `ctx.submissionId` is truthy without checking if `onboarding_submissions/{submissionId}` actually exists in Firestore, displaying a ghost submission count in the Permanent Delete confirmation modal. |
| `UDF-AUD-221` | **CRITICAL** | Security Vulnerability | `functions/index.js` | `functions/index.js:1488–1505` | `selfLinkGoogleAccount` trusts raw `googleUid` and `email` without verifying `googleIdToken` when omitted. |
| `UDF-AUD-222` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:616–626` | `employeeGoogleLogin` omits `isDisabled === true`, `status === 'relieved'`, and `status === 'terminated'` checks. |
| `UDF-AUD-223` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:962–978, 990–1007` | `verifyAndResetEmployeePassword` matches `mobile`/`aadhar`/`dob` against any field in `Object.values(profileData/storedData)`, allows relieved/disabled resets, and never revokes refresh tokens. |
| `UDF-AUD-224` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:1835–1864, 1962–1971` | `getSecureDocumentURL` treats `staffDoc.type === 'Admin'` as SuperAdmin, fails open when `!docSite`, and skips `email_verified` on `draft_submissions.ownerEmail`. |
| `UDF-AUD-225` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:2065, 2094–2125, 2172` | `getBatchSignedViewUrls` skips Firestore `isDisabled`/`isActive` checks when `token.isAdmin === true`, treats `type === 'Admin'` as SuperAdmin, and fails open on `!docSite`. |
| `UDF-AUD-226` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:2391–2416` | `deleteStoragePath` skips Firestore `isDisabled` check when `token.isAdmin === true` and allows branch staff to delete individual files of employees at other sites. |
| `UDF-AUD-227` | **HIGH** | Broken Feature / Data Loss | `functions/index.js` | `functions/index.js:2713–2715, 2747–2753` | `autoDeleteRecycleBin` deletes `recycle_bin` metadata without purging underlying `SITE`/`VACANCY`/`INVITE` targets and leaves orphaned Firebase Auth users. |
| `UDF-AUD-228` | **MEDIUM** | Security Vulnerability | `functions/index.js` | `functions/index.js:3285–3400` | `resolveUsernameToEmail` exposes unauthenticated username-to-email enumeration with per-instance in-memory rate limiting and omits `isDisabled` checks. |
| `UDF-AUD-229` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:4015–4100` | `onRoleWritten` and `handleStaffOrUserWritten` recompute custom claims without revoking refresh tokens on role downgrade or account disablement. |
| `UDF-AUD-230` | **HIGH** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:4746, 5171, 5506, 5658` | Four core Cloud Functions check `token.roleId === 'super-admin'` instead of `'role-super-admin'`. |
| `UDF-AUD-231` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:6611, 6655` | `syncEmployeeToGoogleDriveServer` and `syncSubmissionToSheetsServer` treat `prof.type === 'Admin'` as `isSuperAdmin = true`. |
| `UDF-AUD-232` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:6697–6703, 6767–6773` | `getDraftSubmissionSecure` trusts spoofable `cf-connecting-ip`/`x-forwarded-for` headers, lacks `request.auth` check, and overwrites `activeSessionUid`. |
| `UDF-AUD-233` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:6806–6822` | `permanentDeleteEmployeeServer` lacks `sitesManaged` site-scoping check for non-SuperAdmin staff. |
| `UDF-AUD-234` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:3537–3765` | `getUploadUrl` never enforces `fileSize <= 10MB` or `contentType` allowlist, and `context === 'admin'` lets any staff overwrite `public/*` or any employee's `/bgv/` or `/disciplinary/` files. |
| `UDF-AUD-235` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:7083–7200` | `restoreRecycleBinServer` allows non-SuperAdmin staff to restore cross-site items and reactivates relieved employees without checking `isRelieved`. |
| `UDF-AUD-236` | **MEDIUM** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:7300–7309` | `deleteSiteServer` checks `siteId` and `currentSiteId` on `employees` but never `assignedSiteIds` (`array-contains`). |
| `UDF-AUD-237` | **MEDIUM** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:7673` | `bulkImportEmployeesServer` generates `empId` using `Math.random()` without collision checking. |
| `UDF-AUD-238` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:8112, 8121–8139` | `sendNotificationServer` treats any `!!token.roleId` (including guards/BGV vendors) as `isAdmin = true`, allows broadcasting to `ROLE:role-super-admin`, and lets `clientProvidedId` overwrite notifications. |
| `UDF-AUD-239` | **HIGH** | Security Vulnerability | `functions/index.js` | `functions/index.js:360–428` | `setStaffUserStatus` and `resetStaffUserPassword` allow modifying other `role-super-admin` accounts or self-disabling, and `setStaffUserStatus` omits `revokeRefreshTokens` and `claimsUpdatedAt`. |
| `UDF-AUD-240` | **MEDIUM** | Security Vulnerability | `functions/index.js` | `functions/index.js:435–493` | `checkAndIncrementFailedAttempts` and `checkClaimDailyAttempts` use non-transactional `get()` + `set()`, allowing concurrent brute-force bypass. |
| `UDF-AUD-241` | **MEDIUM** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:5661–5664` | `rejoinEmployeeServer` checks `token.permissions` only without Firestore `staff_accounts`/`roles` fallback. |
| `UDF-AUD-242` | **LOW** | Performance / Reliability | `functions/index.js` | `functions/index.js:2649–2664` | `autoDeleteRecycleBin` hardcodes the `20,000` free-tier daily write limit and drops to `500` on Monitoring API failure. |
| `UDF-AUD-243` | **MEDIUM** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:3360–3373` | `resolveUsernameToEmail` legacy fallback scans only `limit(100)` of `staff_accounts`, `staff`, and `users`. |
| `UDF-AUD-244` | **MEDIUM** | Broken Feature / Functional Bug | `functions/index.js` | `functions/index.js:1853–1856, 2120–2123` | `getSecureDocumentURL` and `getBatchSignedViewUrls` ignore `assignedSiteIds` when checking staff site access. |
| `UDF-AUD-245` | **MEDIUM** | Security Vulnerability | `functions/index.js` | `functions/index.js:250–290` | `createStaffUser` checks email uniqueness across collections but never checks `username` / `usernameLower` uniqueness. |
| `UDF-AUD-246` | **CRITICAL** | Security Vulnerability | `firestore.rules` | `firestore.rules:495` | `correction_requests` sets `allow get: if true;`, exposing plaintext verification answers (`verificationDob`, `verificationPhone`) and `requestedFieldValues` to unauthenticated callers. |
| `UDF-AUD-247` | **CRITICAL** | Security Vulnerability | `firestore.rules` | `firestore.rules:134–139, 193, 226` | `hasActiveCorrectionToken` grants any unauthenticated caller `get()` access to full `employees/{id}` and `onboarding_submissions/{id}` documents. |
| `UDF-AUD-248` | **MEDIUM** | Security Vulnerability | `firestore.rules` | `firestore.rules:192, 225` | `allow get: if resource == null || ...` leaks whether specific `employees` or `onboarding_submissions` document IDs exist to unauthenticated callers. |
| `UDF-AUD-249` | **HIGH** | Security Vulnerability | `firestore.rules` | `firestore.rules:581–585` | `recycle_bin` allows `EMPLOYEES_TAB_RECYCLE_BIN` staff to read all items across all sites, and `!(itemType matches '(?i)(STAFF|ROLE)')` omits `USER` and `WORKFLOW`. |
| `UDF-AUD-250` | **HIGH** | Security Vulnerability | `firestore.rules` | `firestore.rules:418–425, 532, 554, 561, 567` | `leave_balances`, `user_engagement`, `attendance`, `complaints`, and `reward_redemptions` use `isAdmin()` without `canStaffViewSite`. |
| `UDF-AUD-251` | **MEDIUM** | Security Vulnerability | `firestore.rules` | `firestore.rules:522–527` | `referral_invites` `allow list` grants full invite enumeration to anyone holding `SITES_DELETE` or `MANAGE_SITES`. |
| `UDF-AUD-252` | **HIGH** | Security Vulnerability | `firestore.rules` | `firestore.rules:539–549` | `user_engagement` `update` rule compares `lastVisitDate > resource.data.lastVisitDate` lexicographically, allowing unlimited `+5` point farming. |
| `UDF-AUD-253` | **MEDIUM** | Security Vulnerability | `firestore.rules` | `firestore.rules:411–414` | `roles` collection allows `allow read: if isRegisteredUser();`, exposing all internal RBAC definitions to every employee. |
| `UDF-AUD-254` | **HIGH** | Security Vulnerability | `firestore.rules`<br>`components/AdminBgvManagementPage.tsx` | `firestore.rules:460–464`<br>`AdminBgvManagementPage.tsx:249–253` | `bgv_records` grants `hasPermission('BGV_VENDOR')` read access to all records, and `AdminBgvManagementPage` fails to hide undispatched `PENDING` records where `vendorName` is unset. |
| `UDF-AUD-255` | **MEDIUM** | Security Vulnerability | `storage.rules` | `storage.rules:27–31, 43–45` | `isValidUpload()` in `storage.rules` is unused dead code while `allow read, write: if false` blocks all direct client storage operations. |
| `UDF-AUD-256` | **HIGH** | Broken Feature / Functional Bug | `src/services/storageService.ts` | `storageService.ts:175–178, 227–260, 370–371, 392–421, 466–467, 480–482` | `storageService.ts` falls back to blocked direct `uploadBytes`/`getBlob`, leaks unrevoked `URL.createObjectURL` blobs, and retains 25-min signed URLs in `sessionStorage` after logout. |
| `UDF-AUD-257` | **MEDIUM** | Broken Feature / Functional Bug | `src/services/storageService.ts` | `storageService.ts:450–457` | `uploadSubmissionDocument` reads `localStorage.getItem('onboarding_savedDraftId')` directly, risking uploads into a stale draft folder. |
| `UDF-AUD-258` | **HIGH** | Broken Feature / Functional Bug | `src/utils/bulkImportUtils.ts`<br>`functions/index.js` | `bulkImportUtils.ts:791–805`<br>`functions/index.js:7626` | `bulkImportEmployees` drops `defaultStatus` and `importMode` (`'pending_profile'`) when calling `bulkImportEmployeesServer`. |
| `UDF-AUD-259` | **MEDIUM** | Broken Feature / Functional Bug | `src/utils/bulkImportUtils.ts` | `bulkImportUtils.ts:594–606` | `checkForDatabaseDuplicates` only queries `profileData.personalDetails.phoneNumber` and `data/profileData.${aadharFieldId}`, missing top-level `phoneNumber`, `aadhaarNumber`, and `panNumber`. |
| `UDF-AUD-260` | **MEDIUM** | Broken Feature / Functional Bug | `src/utils/bulkImportUtils.ts` | `bulkImportUtils.ts:882, 978–984` | Client-side bulk import writes `formData[unitFieldId] = siteName` (name instead of `site.id`) and populates only `{ personalDetails: { fullName, phoneNumber } }` into `profileData`. |
| `UDF-AUD-261` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminLegacySystemsPage.tsx` | `AdminLegacySystemsPage.tsx:218, 255` | `handleFileUpload` uses `useCallback(..., [logAction])` omitting `imports` from its dependency array, breaking Smart Merge. |
| `UDF-AUD-262` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminVacancyManager.tsx` | `AdminVacancyManager.tsx:61–67, 134–161` | `designationOptions` checks `optionsMap[activeSite.name]` only (missing `activeSite.id`) and `handleSaveVacancy` lacks `title`/`count >= 1` validation. |
| `UDF-AUD-263` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminCorrectionRequestsPage.tsx` | `AdminCorrectionRequestsPage.tsx:51, 89–122, 134` | `req.createdBy.toLowerCase()` crashes if `createdBy` is undefined, `hasManagePerm` is unused, and the list lacks site scoping. |
| `UDF-AUD-264` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminDraftsManagementPage.tsx` | `AdminDraftsManagementPage.tsx:94–109` | `getDraftName` checks `['firstName', 'lastName', 'name', 'applicantName', 'full_name']` instead of Form Builder UUID `7debf274-baee-4bac-a137-4b4b46719874`. |
| `UDF-AUD-265` | **MEDIUM** | Broken Feature / Functional Bug | `components/FieldEditorModal.tsx`<br>`components/employeeFormFields/EmployeeFileUploadField.tsx` | `FieldEditorModal.tsx:108`<br>`EmployeeFileUploadField.tsx:137–142` | `allowedFileTypes` configured in Form Builder is completely ignored by all upload validators. |
| `UDF-AUD-266` | **MEDIUM** | Broken Feature / Functional Bug | `components/employeeFormFields/EmployeeFileUploadField.tsx` | `EmployeeFileUploadField.tsx:104–116` | `useEffect` only resolves `getSecureURL(valPath)` for image extensions, setting `resolvedUrl = null` for PDFs. |
| `UDF-AUD-267` | **MEDIUM** | Broken Feature / Functional Bug | `components/employeeFormFields/EmployeeFileUploadField.tsx` | `EmployeeFileUploadField.tsx:240–244` | `handleOpenExistingCropper` checks `!(typeof value === 'string')`, disabling cropping once background upload saves the string storage path. |
| `UDF-AUD-268` | **HIGH** | Performance & Efficiency | `src/services/requestService.ts` | `requestService.ts:40–56` | `fetchLeaveRequestsByStatus` queries the entire `leave_requests` collection without `siteId` or `limit()`, filtering client-side. |
| `UDF-AUD-269` | **HIGH** | Broken Feature / Functional Bug | `src/services/requestService.ts` | `requestService.ts:181–202` | `processDueResignations` uses browser local timezone and calls direct `setDoc(..., { isProcessed: true }, { merge: true })`, failing `firestore.rules:356` for non-SuperAdmins. |
| `UDF-AUD-270` | **HIGH** | Broken Feature / Functional Bug | `src/services/requestService.ts` | `requestService.ts:280–288` | `revertWorkflowRequest` client fallback calls `setDoc` directly, blocked by `firestore.rules:296, 326, 356` and omitting `approvalHistory`. |
| `UDF-AUD-271` | **MEDIUM** | Data Integrity | `src/services/adminService.ts` | `adminService.ts:149–152` | `updateSites` overwrites the entire `settings/sites` document with `setDoc` without a transaction or optimistic concurrency. |
| `UDF-AUD-272` | **LOW** | Broken Feature / Functional Bug | `src/services/adminService.ts` | `adminService.ts:255–310` | `seedInitialData` checks `settings/roles` instead of the `roles` collection and ignores the `defaultStaff` parameter. |
| `UDF-AUD-273` | **HIGH** | Broken Feature / Functional Bug | `src/services/engagementService.ts` | `engagementService.ts:433–459` | `createRewardRedemption` local fallback deducts points in `user_engagement` BEFORE `addDoc('reward_redemptions')` fails with `PERMISSION_DENIED`. |
| `UDF-AUD-274` | **MEDIUM** | Security Vulnerability | `components/AdminDashboardPage.tsx` | `AdminDashboardPage.tsx:140, 142, 156, 158` | `stats.pendingResignations` and `stats.pendingProfiles` bypass the `isUnassignedStaff` check. |
| `UDF-AUD-275` | **MEDIUM** | Security Vulnerability | `components/AdminGrievancesPage.tsx` | `AdminGrievancesPage.tsx:178–198, 211–222` | `filteredRewards` lacks site scoping, and `filteredInquiries` lacks `canViewInquiries` check and grants B2B `contact_messages` access to `GRIEVANCES_VIEW`. |
| `UDF-AUD-276` | **HIGH** | Security & Performance | `components/AdminWebsiteManager.tsx` | `AdminWebsiteManager.tsx:43–54, 138–146, 178–242` | `loadAttendanceRecords` queries entire `attendance` collection without `limit()`, and mutators lack permission checks and `logSystemAction`. |
| `UDF-AUD-277` | **MEDIUM** | Broken Feature / Functional Bug | `components/BlogDashboardPage.tsx` | `BlogDashboardPage.tsx:110, 170` | `quizDate` uses UTC (`new Date().toISOString().split('T')[0]`) while `dayIndex` uses local date (`new Date().getDate()`). |
| `UDF-AUD-278` | **MEDIUM** | Data Integrity | `components/AdminSiteManagementPage.tsx` | `AdminSiteManagementPage.tsx:413` | `handleSaveEdit` overwrites `supervisorIds: editingSite.supervisorId ? [editingSite.supervisorId] : []`, silently wiping co-supervisors. |
| `UDF-AUD-279` | **MEDIUM** | Broken Feature / Functional Bug | `src/utils/fileSessionStore.ts` | `fileSessionStore.ts:36–40, 156–160` | Generates a new random AES-GCM key if `sessionStorage` is empty, silently failing decryption across tabs/restarts without cleaning IndexedDB. |
| `UDF-AUD-280` | **MEDIUM** | Broken Feature / Functional Bug | `src/utils/applyValidationRules.ts` | `applyValidationRules.ts:132–134, 170` | Only sets `allowedPattern` if `!field.allowedPattern` (skipping `'any'`) and overwrites `settings/form_sections` directly with `setDoc`. |
| `UDF-AUD-281` | **MEDIUM** | Data Integrity | `src/services/bgvService.ts` | `bgvService.ts:127–310` | `syncBgvCandidates` never updates `siteId` or `siteName` on existing `bgv_records` when an employee transfers sites or is relieved. |
| `UDF-AUD-282` | **HIGH** | Security Vulnerability | `firebase.json` | `firebase.json:43` | Content Security Policy (`script-src`) includes `'unsafe-inline'`, weakening XSS protection across all hosted portals. |
| `UDF-AUD-283` | **MEDIUM** | Security Vulnerability | `vercel.json`<br>`netlify.toml` | `vercel.json:1–13`<br>`netlify.toml:1–12` | Secondary hosting configs (`vercel.json` and `netlify.toml`) lack all security headers and rewrite `/api/*` to `/index.html`. |
| `UDF-AUD-284` | **HIGH** | Broken Feature / Functional Bug | `components/AdminAuditLogPage.tsx` | `AdminAuditLogPage.tsx:109–111` | `filteredLogs` calls `.toLowerCase()` on `entry.details` and `entry.actorName` without null guards, crashing on mismatched schemas. |
| `UDF-AUD-285` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminAuditLogPage.tsx`<br>`src/services/auditService.ts` | `AdminAuditLogPage.tsx:94–96`<br>`auditService.ts:71–95` | `subscribeToAuditLogs` fetches `limit(100)` globally first and filters `actorId` client-side. |
| `UDF-AUD-286` | **MEDIUM** | Security & Audit Integrity | `components/AdminAuditLogPage.tsx`<br>`src/services/auditService.ts` | `AdminAuditLogPage.tsx:59–83`<br>`auditService.ts:103–111` | Hidden `Ctrl+Shift+Alt+L` mode directly edits or deletes `audit_logs` via `_deleteAuditLog`/`_updateAuditLogDetails` without confirmation or immutable trail. |
| `UDF-AUD-287` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminDisciplinaryPage.tsx` | `AdminDisciplinaryPage.tsx:38, 76, 84, 129` | Uses UTC date for `incidentDate`, passes `siteId: undefined` when `empInfo` lacks `siteId`, and checks role name `'field officer'` instead of permission. |
| `UDF-AUD-288` | **MEDIUM** | Security Vulnerability | `components/AdminDisciplinaryPage.tsx` | `AdminDisciplinaryPage.tsx:110–112` | Site-scoping filter `if (action.siteId && !allowedSiteIds.includes(action.siteId))` fails open when `action.siteId` is missing. |
| `UDF-AUD-289` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminWorkflowConfigPage.tsx` | `AdminWorkflowConfigPage.tsx:155, 317–323` | `addClientIdDefinition` generates `id` with `Math.random().toString(36).substr(2, 9)` and only mutates React state without auto-persisting. |
| `UDF-AUD-290` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminInvitesPage.tsx` | `AdminInvitesPage.tsx:486, 591–595` | `handleGenerateInvite` writes `auth.currentUser?.uid || authUser.id` as `createdBy`, and `handleSaveReactivation` resets `joined: 0` on single-use invites. |
| `UDF-AUD-291` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminInvitesPage.tsx` | `AdminInvitesPage.tsx:450–464, 525, 575, 601, 610, 621` | Uses blocking native `alert()` dialogs for all validation/errors and lacks `customExpiryDate` past-date validation. |
| `UDF-AUD-292` | **MEDIUM** | Data Integrity | `components/AdminStaffManagementPage.tsx` | `AdminStaffManagementPage.tsx:227, 258, 319, 360, 460, 468` | Updates `staff_accounts` and `settings/sites` sequentially without a Firestore `writeBatch` or transaction. |
| `UDF-AUD-293` | **MEDIUM** | Data Integrity | `components/AdminStaffManagementPage.tsx` | `AdminStaffManagementPage.tsx:313–326` | `saveStaffEdit` spreads the entire `StaffUser` object (`...updates`) into `setDoc(..., { merge: true })`. |
| `UDF-AUD-294` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminRoleManagementPage.tsx` | `AdminRoleManagementPage.tsx:738–749` | `filteredUsers` calls `.toLowerCase()` on `user.name`, `user.username`, and `user.email` without null guards. |
| `UDF-AUD-295` | **MEDIUM** | Security & Performance | `components/AdminRecycleBinPage.tsx` | `AdminRecycleBinPage.tsx:103–110, 121–126` | Subscribes to the entire `recycle_bin` collection without `limit()` or site scoping. |
| `UDF-AUD-296` | **LOW** | Broken Feature / Functional Bug | `components/AdminRecycleBinPage.tsx` | `AdminRecycleBinPage.tsx:177–186` | `getDaysRemaining` displays `NaN` when `expiresAtStr` is invalid or missing. |
| `UDF-AUD-297` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminLeaveManagementPage.tsx` | `AdminLeaveManagementPage.tsx:113–139, 454, 491` | `getEmployeeBalance` fails to match `leaveBalances` by `portalId` and lacks in-flight loading state on Revert/Bypass buttons. |
| `UDF-AUD-298` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminResignationManagementPage.tsx` | `AdminResignationManagementPage.tsx:101, 301, 340` | Checks `userRole?.name.toLowerCase().includes('field officer')` by display name and lacks in-flight loading state on Revert/Bypass buttons. |
| `UDF-AUD-299` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminAccountUpdateManagementPage.tsx` | `AdminAccountUpdateManagementPage.tsx:88, 258, 297` | Checks `userRole?.name.toLowerCase().includes('field officer')` by display name and lacks in-flight loading state on Revert/Bypass buttons. |
| `UDF-AUD-300` | **MEDIUM** | Broken Feature / Functional Bug | `src/utils/workflowHelper.ts` | `workflowHelper.ts:207–219, 263–281` | `isRoleAssignedToSite` returns `true` for any role with `*_VIEW_SCOPE_ALL` even if zero active staff users hold that role. |
| `UDF-AUD-301` | **MEDIUM** | Broken Feature / Functional Bug | `src/context/AuthContext.tsx` | `AuthContext.tsx:39–49, 65–76` | `onAuthStateChanged` reads `localStorage.getItem('portalType')` instead of hostname, causing cross-portal profile misresolution. |
| `UDF-AUD-302` | **MEDIUM** | Broken Feature / Functional Bug | `src/context/AuthContext.tsx` | `AuthContext.tsx:120–139` | Real-time `staff_accounts` listener updates `roleId`, `sitesManaged`, `permissionOverrides`, and `isDisabled`, but ignores `name` and `email` edits. |
| `UDF-AUD-303` | **LOW** | Performance / Build | `vite.config.ts` | `vite.config.ts:593–602` | `dist-public` PWA precache only ignores `Admin*.js`/`admin*.js` while still precaching `vendor-excel` (`xlsx`) and `vendor-pdf` (`pdf-lib`/`pdfjs-dist`). |
| `UDF-AUD-304` | **MEDIUM** | Broken Feature / Functional Bug | `components/BlogPage.tsx`<br>`components/BlogsPage.tsx`<br>`components/CareersPage.tsx` | `BlogPage.tsx:108`<br>`BlogsPage.tsx:166`<br>`CareersPage.tsx:49` | `Apply Now` buttons navigate to `/join?siteId=...&role=...` where `role` fails to pre-select if `vacancy.title` doesn't exactly match a dropdown option. |
| `UDF-AUD-305` | **MEDIUM** | Performance & Efficiency | `components/BlogsPage.tsx` | `BlogsPage.tsx:147–149` | Blog search filter runs `.toLowerCase().includes()` across full HTML `post.content` on every keystroke without `useMemo` or debouncing. |
| `UDF-AUD-306` | **MEDIUM** | Security Vulnerability | `src/utils/promotionLetterGenerator.ts` | `promotionLetterGenerator.ts:38–40, 269–276` | `printPromotionLetter` opens `window.open('', '_blank')` without `'noopener'` and writes HTML via `document.write()` with external Google Fonts. |
| `UDF-AUD-307` | **LOW** | Performance & Efficiency | `src/services/vacancyService.ts` | `vacancyService.ts:13–28, 64–76` | `getVacancies()` and `getOpenVacancies()` execute unbounded `getDocs()` queries without `orderBy` or `limit()`. |
| `UDF-AUD-308` | **MEDIUM** | Data Integrity | `src/services/siteService.ts` | `siteService.ts:143–176` | `updateSiteDetails` and `saveAllSites` perform non-transactional read-modify-write on `settings/sites`. |
| `UDF-AUD-309` | **MEDIUM** | Performance & Efficiency | `src/services/auditService.ts` | `auditService.ts:71–76` | `subscribeToAuditLogs` has no `where('actorId', '==', ...)` server-side filter when `filter?.actorId` is passed. |
| `UDF-AUD-310` | **MEDIUM** | Security & Privacy | `components/AdminPortalPage.tsx` | `AdminPortalPage.tsx:291, 516, 537, 802, 810` | `AdminPortalPage` persists `activeTimelineEmployeeId` in `sessionStorage` without clearing it on logout. |
| `UDF-AUD-311` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminInvitesPage.tsx` | `AdminInvitesPage.tsx:87–95` | `AdminInvitesPage` restores `adminInvitesActiveTab` from `sessionStorage` without checking whether the current user has permission for that tab. |
| `UDF-AUD-312` | **MEDIUM** | Performance & Efficiency | `firestore.indexes.json` | `firestore.indexes.json:1–238` | Missing composite indexes for `employees (isActive, siteId, joiningDate)`, `leave_requests (employeeId, status)`, `bgv_records (siteId, status)`, and `audit_logs (actorId, timestamp DESC)`. |
| `UDF-AUD-313` | **MEDIUM** | Security Vulnerability | `components/AdminBgvManagementPage.tsx` | `AdminBgvManagementPage.tsx:249–253` | BGV vendor filtering uses case-insensitive substring `.includes()` on `vendorName` instead of exact `vendorId === authUser.id`. |
| `UDF-AUD-314` | **MEDIUM** | Security Vulnerability | `components/AdminBgvManagementPage.tsx` | `AdminBgvManagementPage.tsx:243–246` | BGV site scoping fails open when `allowedSiteIds` is `[]` (unassigned staff). |
| `UDF-AUD-315` | **MEDIUM** | Broken Feature / Functional Bug | `src/components/auth/SetupAccountPage.tsx` | `SetupAccountPage.tsx:29–41, 66–74` | `handleGoogleLink` and `handleSetPassword` silently no-op when `user?.employeeId` is missing and omit Auth token refresh. |
| `UDF-AUD-316` | **LOW** | Security Vulnerability | `components/ContactPage.tsx` | `ContactPage.tsx:47–60` | `handleSubmit` writes directly to `contact_messages` from unauthenticated clients without rate limiting, CAPTCHA, or field-length validation. |
| `UDF-AUD-317` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminMasterEmployeeListPage.tsx` | `AdminMasterEmployeeListPage.tsx:272–281, 294–301` | `userVisibleColumns` persists column preferences globally in `localStorage['masterListColumnPrefs']` across admin accounts and ignores empty sets. |
| `UDF-AUD-318` | **MEDIUM** | Broken Feature / Functional Bug | `components/AdminMasterEmployeeListPage.tsx` | `AdminMasterEmployeeListPage.tsx:314–320` | `handleSaveJoiningDate` converts `newJoiningDateValue` (`YYYY-MM-DD`) via `new Date(newJoiningDateValue).toISOString()` without validity or timezone guards. |
| `UDF-AUD-319` | **MEDIUM** | Security & Data Integrity | `components/AdminReviewSubmissionsPage.tsx` | `AdminReviewSubmissionsPage.tsx:1511–1528` | `handleConfirmApproval` enforces duplicate-submission and active-employee blocking only in client UI `alert()`. |
| `UDF-AUD-320` | **LOW** | Performance & Efficiency | `components/BusinessSolutionsPage.tsx`<br>`components/ContactPage.tsx` | `BusinessSolutionsPage.tsx:35–45`<br>`ContactPage.tsx:34–44` | Public marketing pages independently call `getWebsiteConfig()` on every route mount without shared caching. |
## 2. Detailed Breakdown per Finding

### UDF-AUD-01 (`CRITICAL` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `App.tsx:1084–1104`, `App.tsx:1275–1286`, `src/contexts/DataContext.tsx:96, 150, 625`

#### Root Cause & Exact Code Trace
In `src/contexts/DataContext.tsx:96, 150, 625` and `src/services/adminService.ts:196`, `leavePolicy` is typed as `LeavePolicy | null` and defaults to `null` before `/settings/leave_policy` is created in Firestore or when auth resets. While `DataContext.tsx:229` safely guards `if (leavePolicy && leavePolicy.leaveTypes)`, `App.tsx:1084–1104` runs an unguarded `leavePolicy.leaveTypes.forEach(...)` inside a `useEffect` whenever `employees.length > 0`, and `initializeLeaveBalance` (`App.tsx:1275–1286`) similarly calls `leavePolicy.leaveTypes.forEach(...)` without checking if `leavePolicy` is non-null:
```tsx
// App.tsx:1084–1104
useEffect(() => {
  if (employees.length === 0) return;

  setLeaveBalances(prevBalances => {
    const updatedBalances = [...prevBalances];
    let changed = false;

    employees.forEach(emp => {
      const existingIndex = updatedBalances.findIndex(b => b.employeeId === emp.employeeId);
      if (existingIndex === -1) {
        const initialBalances: Record<string, { total: number; used: number; pending: number }> = {};
        leavePolicy.leaveTypes.forEach(lt => { // <-- CRASHES when leavePolicy is null
```

#### Real-World Impact
If `/settings/leave_policy` is absent in Firestore or has not finished loading when `employees` arrives, `leavePolicy.leaveTypes` throws `Uncaught TypeError: Cannot read properties of null (reading 'leaveTypes')`, unmounting the entire React application with a blank screen.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -1082,7 +1082,7 @@
   // Ensure all active employees have a leave balance record and sync total quotas with policy
   useEffect(() => {
-    if (employees.length === 0) return;
+    if (employees.length === 0 || !leavePolicy || !Array.isArray(leavePolicy.leaveTypes)) return;
 
     setLeaveBalances(prevBalances => {
       const updatedBalances = [...prevBalances];
@@ -1273,6 +1273,7 @@
   // --- Leave Balance Initialization ---
   const initializeLeaveBalance = useCallback((employeeId: string) => {
+    if (!leavePolicy || !Array.isArray(leavePolicy.leaveTypes)) return;
     setLeaveBalances(prev => {
       if (prev.some(b => b.employeeId === employeeId)) return prev;
       const initialBalances: Record<string, { total: number; used: number; pending: number }> = {};
```

### UDF-AUD-02 (`CRITICAL` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `src/services/employeeService.ts:2124–2184`, `src/contexts/DataContext.tsx:534`, `App.tsx:1162`, `firestore.rules:229–237`

#### Root Cause & Exact Code Trace
`subscribeToSubmissionsByUid(uid, callback)` in `src/services/employeeService.ts:2124–2184` starts 4 concurrent `onSnapshot` listeners (`qByEmpId`, `qByUid`, `qByLinkedUid`, `docRef`) and gates `emit()` at line `2141`:
```ts
// src/services/employeeService.ts:2125–2156
const qByEmpId = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", uid));
...
const emit = () => {
    if (!hasEmpReturned || !hasUidReturned || !hasLinkedUidReturned || !hasDocReturned) return;
    ...
};

const unsubEmp = onSnapshot(qByEmpId, (snap) => {
    empDocs = snap.docs;
    hasEmpReturned = true;
    emit();
}, (error) => {
    log.error("Error subscribing to personal submission by employeeId:", error);
    // BUG: hasEmpReturned is NEVER set to true and emit() is NEVER called!
});
```
In `firestore.rules:229–237`, `match /onboarding_submissions/{id}` `allow list` only allows non-admin queries filtered by `linkedUid`, `uid`, `ownerUid`, `linkedGoogleEmail`, or `email`—it does **not** allow `where("employeeId", "==", uid)`. Consequently, `qByEmpId` immediately fails with `FirebaseError: Missing or insufficient permissions`, its error handler logs the error without setting `hasEmpReturned = true`, and `emit()` returns early forever.

#### Real-World Impact
Every non-admin employee/candidate subscription via `subscribeToSubmissionsByUid` (`DataContext.tsx:534` and `App.tsx:1162`) deadlocks permanently and never delivers any submission data to the UI.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -2152,25 +2152,33 @@
     }, (error) => {
         log.error("Error subscribing to personal submission by employeeId:", error);
+        hasEmpReturned = true;
+        emit();
     });
 
     const unsubUid = onSnapshot(qByUid, (snap) => {
         uidDocs = snap.docs;
         hasUidReturned = true;
         emit();
     }, (error) => {
         log.error("Error subscribing to personal submission by uid:", error);
+        hasUidReturned = true;
+        emit();
     });
 
     const unsubLinked = onSnapshot(qByLinkedUid, (snap) => {
         linkedUidDocs = snap.docs;
         hasLinkedUidReturned = true;
         emit();
     }, (error) => {
         log.error("Error subscribing to personal submission by linkedUid:", error);
+        hasLinkedUidReturned = true;
+        emit();
     });
 
     const unsubDoc = onSnapshot(docRef, (snap) => {
         directDoc = snap.exists() ? snap : null;
         hasDocReturned = true;
         emit();
     }, (error) => {
         log.error("Error subscribing to personal submission by direct doc ID:", error);
+        hasDocReturned = true;
+        emit();
     });
--- a/firestore.rules
+++ b/firestore.rules
@@ -230,6 +230,8 @@
       allow list: if isAdmin() || (isAuthenticated() && (
         resource.data.get('linkedUid', '') == request.auth.uid ||
         resource.data.get('uid', '') == request.auth.uid ||
+        resource.data.get('employeeId', '') == request.auth.uid ||
+        (request.auth.token.get('employeeId', '') != '' && resource.data.get('employeeId', '') == request.auth.token.employeeId) ||
         resource.data.get('ownerUid', '') == request.auth.uid ||
         (request.auth.token.get('email', '') != '' && (
           resource.data.get('linkedGoogleEmail', '') == request.auth.token.email ||
```

### UDF-AUD-03 (`CRITICAL` | `Security Vulnerability`)
**Target Files & Lines:** `functions/index.js:1108–1250`, `functions/index.js:1315–1384`, `functions/index.js:1480–1625`

#### Root Cause & Exact Code Trace
1. **Unverified Google Identity Spoofing:** In `linkEmployeeGoogleAccount` (`functions/index.js:1117–1131`) and `selfLinkGoogleAccount` (`functions/index.js:1485–1502`), `idToken` / `googleIdToken` verification is inside an optional `if` block:
   ```js
   // functions/index.js:1117–1131
   let verifiedUid = googleUid;
   let verifiedEmail = email;
   if (idToken) {
       const decoded = await admin.auth().verifyIdToken(idToken);
       verifiedUid = decoded.uid;
       verifiedEmail = decoded.email || email;
   }
   ```
   If an attacker omits `idToken` / `googleIdToken`, the server trusts arbitrary client-supplied `googleUid` and `email`. In addition, `linkEmployeeGoogleAccount` (`L1108`) does not require `request.auth`.
2. **UID Overwrite Breaking Custom Token Ownership:** `linkEmployeeGoogleAccount` (`L1225`) and `selfLinkGoogleAccount` (`L1597`) set `uid: verifiedUid` (the Google UID) on `employees` and `onboarding_submissions`, whereas `employeeLogin` (`L800`) and `employeeGoogleLogin` (`L641, 655`) mint custom tokens with `uid = portalId` (`matchedDoc.id`).
3. **Permanent Password Lockout on Unlink:** `selfLinkGoogleAccount` (`L1602`) overwrites `passwordHash: ''`. Later, when the employee tries to unlink or change their Google account (`unlinkEmployeeGoogleAccount` `L1347–1365`) or change their password (`changeEmployeePassword` `L1069`), `if (empData.passwordHash) isVerified = await verifyPassword(...)` always evaluates to `false`, permanently locking them out. Additionally, `unlinkEmployeeGoogleAccount` (`L1315–1377`) never checks that `request.auth.uid` owns `employeeId`.

#### Real-World Impact
An attacker who knows an employee's default password can link any victim's `googleUid`/`email` without authenticating with Google; and any employee who links Google during first-time account setup (`SetupAccountPage.tsx:30`) has their `passwordHash` wiped to `''` and is permanently blocked from ever unlinking Google or setting a password.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1106,28 +1106,30 @@
 // 4. Employee: Link Google Account (requires password verification first)
 exports.linkEmployeeGoogleAccount = secureOnCall(async (request) => {
+    if (!request.auth) {
+        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
+    }
     const { employeeId, currentPassword, googleUid, email, idToken } = request.data;
-    if (!employeeId || !currentPassword || (!idToken && (!googleUid || !email))) {
+    if (!employeeId || !currentPassword || !idToken) {
         throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
     }
 
-    let verifiedUid = googleUid;
-    let verifiedEmail = email;
-    if (idToken) {
-        try {
-            const decoded = await admin.auth().verifyIdToken(idToken);
-            verifiedUid = decoded.uid;
-            verifiedEmail = decoded.email || email;
-        } catch (tokenErr) {
-            throw new functions.https.HttpsError('unauthenticated', 'Invalid Google authentication token.');
-        }
+    let verifiedUid;
+    let verifiedEmail;
+    try {
+        const decoded = await admin.auth().verifyIdToken(idToken);
+        if (decoded.email_verified === false || !decoded.email) {
+            throw new Error('Unverified Google email');
+        }
+        verifiedUid = decoded.uid;
+        verifiedEmail = decoded.email;
+    } catch (tokenErr) {
+        throw new functions.https.HttpsError('unauthenticated', 'Invalid Google authentication token.');
     }
@@ -1222,7 +1224,6 @@
         const linkPayload = {
-            uid: verifiedUid,
             linkedUid: verifiedUid,
             linkedGoogleEmail: normalizedEmail,
             authProvider: 'both',
@@ -1344,6 +1345,12 @@
         const empData = empDoc ? empDoc.data() : null;
         const subData = subDoc ? subDoc.data() : null;
+        const callerUid = request.auth.uid;
+        const targetDocId = (empDoc && empDoc.id) || (subDoc && subDoc.id);
+        const isCallerOwner = callerUid === targetDocId ||
+            callerUid === (empData && empData.employeeId) ||
+            callerUid === (empData && empData.linkedUid) ||
+            callerUid === (subData && subData.linkedUid);
+        if (!isCallerOwner) {
+            throw new functions.https.HttpsError('permission-denied', 'You can only unlink your own account.');
+        }
 
         // Verify password before unlinking
@@ -1482,19 +1489,19 @@
 exports.selfLinkGoogleAccount = secureOnCall(async (request) => {
     if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
     const { employeeId, googleUid, email } = request.data;
-    if (!employeeId || !googleUid || !email) throw new functions.https.HttpsError('invalid-argument', 'Missing parameters');
+    if (!employeeId || !request.data.googleIdToken) {
+        throw new functions.https.HttpsError('invalid-argument', 'Employee ID and Google ID token are required');
+    }
 
-    // Verify Google identity token if provided
-    let verifiedGoogleUid = googleUid;
-    let verifiedGoogleEmail = email;
-    if (request.data.googleIdToken) {
-        try {
-            const decoded = await admin.auth().verifyIdToken(request.data.googleIdToken);
-            verifiedGoogleUid = decoded.uid;
-            verifiedGoogleEmail = decoded.email || email;
-        } catch (tokenErr) {
-            throw new functions.https.HttpsError('unauthenticated', 'Invalid Google ID token.');
-        }
+    let verifiedGoogleUid;
+    let verifiedGoogleEmail;
+    try {
+        const decoded = await admin.auth().verifyIdToken(request.data.googleIdToken);
+        if (decoded.email_verified === false || !decoded.email) {
+            throw new Error('Unverified Google email');
+        }
+        verifiedGoogleUid = decoded.uid;
+        verifiedGoogleEmail = decoded.email;
+    } catch (tokenErr) {
+        throw new functions.https.HttpsError('unauthenticated', 'Invalid Google ID token.');
     }
@@ -1594,12 +1601,10 @@
         const linkPayload = {
-            uid: verifiedGoogleUid,
             linkedUid: verifiedGoogleUid,
             linkedGoogleEmail: normalizedEmail,
             authProvider: 'google',
             isDefaultPassword: false,
-            passwordHash: '', // Clear default password hash since they chose Google
             googleLinkedAt: new Date().toISOString()
         };
```

### UDF-AUD-04 (`CRITICAL` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `functions/index.js:507–675`, `functions/index.js:5321–5357`, `firestore.rules:88–111`

#### Root Cause & Exact Code Trace
1. In `approveOnboardingServer` (`functions/index.js:5321–5357`), when an onboarding submission is approved and copied into `employees/{submissionId}`, the server writes `uid: subData.linkedUid || subData.uid || submissionId`, **but omits `linkedUid`, `linkedGoogleEmail`, and `authProvider`**. If that employee later signs in via password (`employeeLogin` `L812`: `if (empDoc && empDoc.data().uid !== portalId) updates.push(empDoc.ref.update({ uid: portalId }))`), `uid` on `employees/{submissionId}` is overwritten with `submissionId`, completely erasing the employee's Google UID from their `employees` record.
2. In `employeeGoogleLogin` (`functions/index.js:664`), the custom token is minted with:
   ```js
   const customToken = await admin.auth().createCustomToken(portalId, {
       portal: 'employee',
       portalType: 'employee',
       authProvider: 'google'
   });
   ```
   Unlike `employeeLogin` (`L804–809`), `employeeGoogleLogin` omits `employeeId` and `role: 'employee'` from the custom token claims.
3. In `firestore.rules:88–111`, `isOwnerOfPortalId(portalId)` checks:
   ```javascript
   function isOwnerOfPortalId(portalId) {
     return portalId != null && (
       portalId == request.auth.uid ||
       (request.auth.token.get('employeeId', '') != '' && portalId == request.auth.token.employeeId) ||
       (exists(/databases/$(database)/documents/employees/$(portalId)) && ...) ||
       (exists(/databases/$(database)/documents/onboarding_submissions/$(portalId)) && ...)
     );
   }
   ```
   Because `employees` and `onboarding_submissions` documents are keyed by `submissionId` (`UDF-...`), `exists(/employees/HY123456)` is `false`. When a Google-SSO employee (`request.auth.uid == "UDF-..."`, `request.auth.token.employeeId == ""`) accesses `leave_requests`, `account_updates`, `resignations`, `disciplinary_actions`, `notifications`, `user_engagement`, or `attendance` records keyed/tagged with `employeeId: "HY123456"`, `isOwnerOfPortalId("HY123456")` evaluates to `false`.

#### Real-World Impact
Employees who log in with Google SSO get `permission-denied` when reading or creating records tied to their `employeeId` (`HY123456`), and lose Google SSO lookup on `employees` after any password login.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -661,7 +661,10 @@
         // Mint Custom Token with the exact Portal ID as the UID
+        const resolvedEmployeeId = (employeeDoc && employeeDoc.data().employeeId) || (submissionDoc && submissionDoc.data().employeeId) || '';
         const customToken = await admin.auth().createCustomToken(portalId, {
             portal: 'employee',
             portalType: 'employee',
-            authProvider: 'google'
+            authProvider: 'google',
+            role: 'employee',
+            employeeId: resolvedEmployeeId
         });
@@ -5323,6 +5326,9 @@
         const employeeRecord = {
             employeeId: finalEmpId,
             portalId: submissionId,
             uid: subData.linkedUid || subData.uid || submissionId,
+            linkedUid: subData.linkedUid || null,
+            linkedGoogleEmail: subData.linkedGoogleEmail || null,
+            authProvider: subData.authProvider || 'manual',
             applicantName: applicantName,
```

### UDF-AUD-05 (`CRITICAL` | `Security Vulnerability`)
**Target Files & Lines:** `firestore.rules:134–139, 192–193, 225–226, 493–495`, `components/employee/DataCorrectionPage.tsx:164, 196–219`, `functions/index.js:2464–2469, 2547, 3641–3652, 3686–3691`

#### Root Cause & Exact Code Trace
1. `firestore.rules:495` has `allow get: if true;` on `match /correction_requests/{id}`, and `DataCorrectionPage.tsx:164` calls `getCorrectionRequest(token)` directly from Firestore before calling `getCorrectionChallengeClient(token)` (`L167`). This leaks the full `correction_requests/{token}` document (`requestedFieldValues`, `targetId`, `linkedGoogleEmail`) to any unauthenticated user before verification.
2. `firestore.rules:192–193` (`employees`) and `225–226` (`onboarding_submissions`) grant `allow get: if resource == null || hasActiveCorrectionToken(resource.data) || ...`, where `hasActiveCorrectionToken` (`L134–139`) only checks whether `docData.activeCorrectionToken` points to a pending correction request. In `DataCorrectionPage.tsx:196–219`, `loadCorrectionDetails` immediately calls `getDoc(doc(db, targetCollection, request.targetId))` on mount **before** the user completes `handleGuestVerify` (DOB + Phone verification) or logs in.
3. In `functions/index.js`, `deleteStoragePath` (`L2464–2469`), `getStorageFolderSizeServer` (`L2547`), and `getUploadUrl` (`L3641–3652, 3686–3691`) grant write/delete permissions whenever the target Firestore document has a pending `activeCorrectionToken`, without checking whether the caller holds a verified `sessionToken` from `verifyCorrectionIdentity`.

#### Real-World Impact
An unauthenticated attacker who opens a correction link (or queries `getDoc` on an employee/submission ID while a correction token is pending) receives the entire `employees` or `onboarding_submissions` document—including the exact Date of Birth and Phone Number needed to pass `verifyCorrectionIdentity`, Aadhaar, PAN, bank account number, and `passwordHash`—and can overwrite or delete that employee's Storage files without verifying their identity.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -190,7 +190,6 @@
     // ─── Employee Records ────────────────────────────────────────────────────
     match /employees/{userId} {
       allow get: if resource == null ||
-                    hasActiveCorrectionToken(resource.data) ||
                     isSelfEmployee(userId, resource.data) || 
                     (isAdmin() && (
                       canStaffViewSite(resource.data.get('currentSiteId', resource.data.get('siteId', ''))) ||
@@ -223,7 +222,6 @@
     // ─── Onboarding Submissions ──────────────────────────────────────────────
     match /onboarding_submissions/{id} {
       allow get: if resource == null ||
-                    hasActiveCorrectionToken(resource.data) ||
                     isSelfSubmission(resource.data) || 
                     (isAdmin() && canStaffViewSite(resource.data.get('siteId', '')));
@@ -491,5 +489,5 @@
     // ─── Data Correction Requests ───────────────────────────────────────────
     match /correction_requests/{id} {
-      // Correction token holders need GET to load the form (token acts as credentials)
-      allow get: if true;
+      allow get: if isAdmin() || hasPermission('SUBMISSIONS_APPROVE');
       allow list: if isAdmin() || hasPermission('SUBMISSIONS_APPROVE');
--- a/components/employee/DataCorrectionPage.tsx
+++ b/components/employee/DataCorrectionPage.tsx
@@ -161,14 +161,12 @@
       // Ensure at least anonymous auth is active for Firebase rules
       await ensureAuthenticated();
 
-      let request = await getCorrectionRequest(token);
+      let request: any = null;
+      try {
+        const challenge = await getCorrectionChallengeClient(token);
+        if (challenge && challenge.request) {
+          request = challenge.request;
+        }
+      } catch (_) {}
       if (!request) {
-        try {
-          const challenge = await getCorrectionChallengeClient(token);
-          if (challenge && challenge.request) {
-            request = challenge.request;
-          }
-        } catch (_) {}
+        request = await getCorrectionRequest(token).catch(() => null);
       }
```

### UDF-AUD-06 (`CRITICAL` | `Security Vulnerability`)
**Target Files & Lines:** `firestore.rules:199–203, 219–221, 229, 239–241, 283, 313, 343, 367–375, 453–482, 554`, `src/services/bgvService.ts:127`, `components/AdminWebsiteManager.tsx:140`, `components/AdminInvitesPage.tsx:328–329`

#### Root Cause & Exact Code Trace
In `firestore.rules`, `canStaffViewSite(...)` is enforced on `allow get` for `employees` (`L196`), `onboarding_submissions` (`L228`), `leave_requests` (`L277`), `account_updates` (`L307`), and `resignations` (`L337`), **but is completely omitted on `allow list`, `allow update`, `allow create`, and `allow delete`**:
```javascript
// firestore.rules:199–203
allow list: if isAdmin() || (isAuthenticated() && (
  resource.data.get('uid', '') == request.auth.uid || 
  resource.data.get('linkedUid', '') == request.auth.uid
));
allow update: if canAdminManageEmployees() ...
```
The same unscoped `isAdmin()` or global permission check appears in `onboarding_submissions` (`L229, 239, 241`), `leave_requests` (`L283`), `account_updates` (`L313`), `resignations` (`L343`), `disciplinary_actions` (`L367`), `bgv_records` (`L453–460`), and `attendance` (`L554`). Furthermore, in the frontend:
- `src/services/bgvService.ts:127` (`subscribeToBgvRecords`) subscribes to `collection(db, BGV_COLLECTION)` without filtering by `sitesManaged`.
- `components/AdminWebsiteManager.tsx:140` (`loadAttendanceRecords`) queries all `attendance` records across all sites.
- `components/AdminInvitesPage.tsx:328–329` queries `collection(db, 'employees'), limit(50)` and `collection(db, 'onboarding_submissions'), limit(50)` across all sites whenever a staff member has `INVITES_VIEW_ALL` or `INVITES_MANAGE`.

#### Real-World Impact
Any site-scoped branch supervisor (`isAdmin() == true`, `sitesManaged: ['site-A']`) can query, list, update, or delete employee records, onboarding submissions, BGV dossiers, leave requests, account updates, resignations, disciplinary actions, and attendance logs belonging to every other site/branch in the organization.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -199,11 +199,19 @@
-      allow list: if isAdmin() || (isAuthenticated() && (
+      allow list: if (isAdmin() && (
+        canStaffViewSite(resource.data.get('currentSiteId', resource.data.get('siteId', ''))) ||
+        resource.data.get('assignedSiteIds', []).hasAny(request.auth.token.get('sitesManaged', []))
+      )) || (isAuthenticated() && (
         resource.data.get('uid', '') == request.auth.uid || 
         resource.data.get('linkedUid', '') == request.auth.uid
       ));
-      allow update: if canAdminManageEmployees() 
+      allow update: if (canAdminManageEmployees() && (
+        canStaffViewSite(resource.data.get('currentSiteId', resource.data.get('siteId', ''))) ||
+        resource.data.get('assignedSiteIds', []).hasAny(request.auth.token.get('sitesManaged', []))
+      ))
         || (isSelfEmployee(userId, resource.data) && (
@@ -219,2 +227,5 @@
-      allow create: if canAdminCreateEmployees();
-      allow delete: if canAdminDeleteEmployees();
+      allow create: if canAdminCreateEmployees() && canStaffViewSite(request.resource.data.get('currentSiteId', request.resource.data.get('siteId', '')));
+      allow delete: if canAdminDeleteEmployees() && (
+        canStaffViewSite(resource.data.get('currentSiteId', resource.data.get('siteId', ''))) ||
+        resource.data.get('assignedSiteIds', []).hasAny(request.auth.token.get('sitesManaged', []))
+      );
     }
 
     // ─── Onboarding Submissions ──────────────────────────────────────────────
     match /onboarding_submissions/{id} {
       allow get: if resource == null ||
                     isSelfSubmission(resource.data) || 
                     (isAdmin() && canStaffViewSite(resource.data.get('siteId', '')));
-      allow list: if isAdmin() || (isAuthenticated() && (
+      allow list: if (isAdmin() && canStaffViewSite(resource.data.get('siteId', ''))) || (isAuthenticated() && (
         resource.data.get('linkedUid', '') == request.auth.uid ||
@@ -239,3 +250,3 @@
-      allow update: if canAdminManageEmployees() 
+      allow update: if (canAdminManageEmployees() && canStaffViewSite(resource.data.get('siteId', '')))
         || (isAuthenticated() && (resource.id == request.auth.uid || resource.data.uid == request.auth.uid || resource.data.linkedUid == request.auth.uid));
-      allow delete: if canAdminDeleteEmployees(); 
+      allow delete: if canAdminDeleteEmployees() && canStaffViewSite(resource.data.get('siteId', '')); 
     }
```

### UDF-AUD-07 (`HIGH` | `Security Vulnerability`)
**Target Files & Lines:** `functions/index.js:1842–1864, 2063–2125, 2243–2308, 2391–2473, 3576–3586, 3666, 3698–3744`

#### Root Cause & Exact Code Trace
1. **Site-Isolation Bypass on Employee IDs (`getSecureDocumentURL` `L1847–1858` & `getBatchSignedViewUrls` `L2116–2124`):**
   ```js
   // functions/index.js:1847–1858
   const [empCheck, subCheck] = await Promise.all([
       db.collection('employees').doc(targetDocId).get(),
       db.collection('onboarding_submissions').doc(targetDocId).get()
   ]);
   const docData = empCheck.exists ? empCheck.data() : (subCheck.exists ? subCheck.data() : {});
   const docSite = docData.currentSiteId || docData.siteId || '';
   if (docSite && managedSites.includes(docSite)) {
       isAuthorized = true;
   } else if (!docSite) {
       isAuthorized = true; // <-- FAILS OPEN when targetDocId is an employeeId (e.g. HY123456)!
   }
   ```
   Because active employee documents are stored in Firestore under `employees/{submissionId}` (`UDF-...`) while their Storage folder is `employees/{employeeId}/...` (`employees/HY123456/...`), `db.collection('employees').doc('HY123456').get()` returns `exists: false` (`docSite = ''`), hitting `else if (!docSite) { isAuthorized = true; }` and granting cross-site access to any employee's files.
2. **Path Substring Injection & Missing Site Check (`moveStorageFolder` `L2243–2308`):** Staff accounts have no site-isolation check (`L2256`). For non-admin callers (`L2301–2302`), `const ownsSource = ... || cleanSource.includes(uid); const ownsDest = ... || cleanDest.includes(uid);` allows any authenticated user to move files to/from any bucket path simply by placing their `uid` substring inside the filename.
3. **Privilege & Site Bypass (`deleteStoragePath` `L2392–2411`):** Line `2392` (`if (request.auth.token && (request.auth.token.isAdmin || request.auth.token.isSuperAdmin)) { isAuthorized = true; }`) short-circuits before the `else` block (`L2405`), allowing any branch staff member with `isAdmin: true` to delete entire employee directories (`isFolder: true`) across any site, bypassing the `!isSuperAdmin` check on line `2405`.
4. **Unrestricted Admin Context in `getUploadUrl` (`L3728`):** `context === 'admin'` has no `firstSegment` or `sitesManaged` check, allowing any branch staff to overwrite `/public/*` or other sites' files.

#### Real-World Impact
Branch staff can generate signed view URLs for, overwrite, or delete employee documents belonging to other branches, and any authenticated user can move arbitrary Storage objects by embedding their UID in the path string.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1847,12 +1847,10 @@
                 } else {
                     const [empCheck, subCheck] = await Promise.all([
-                        db.collection('employees').doc(targetDocId).get(),
-                        db.collection('onboarding_submissions').doc(targetDocId).get()
+                        resolveEmployeeDocAdmin(db, targetDocId),
+                        resolveSubmissionDocAdmin(db, targetDocId)
                     ]);
-                    const docData = empCheck.exists ? empCheck.data() : (subCheck.exists ? subCheck.data() : {});
+                    const docData = (empCheck && empCheck.exists) ? empCheck.data() : ((subCheck && subCheck.exists) ? subCheck.data() : {});
                     const docSite = docData.currentSiteId || docData.siteId || '';
                     if (docSite && managedSites.includes(docSite)) {
                         isAuthorized = true;
-                    } else if (!docSite) {
-                        isAuthorized = true;
                     }
                 }
@@ -2299,6 +2297,6 @@
         if (!isAdmin) {
-            const ownsSource = cleanSource.startsWith(`onboarding/${uid}/`) || cleanSource.startsWith(`employees/${uid}/`) || cleanSource.includes(uid);
-            const ownsDest = cleanDest.startsWith(`onboarding/${uid}/`) || cleanDest.startsWith(`employees/${uid}/`) || cleanDest.includes(uid);
+            const ownsSource = cleanSource.startsWith(`onboarding/${uid}/`) || cleanSource.startsWith(`employees/${uid}/`);
+            const ownsDest = cleanDest.startsWith(`onboarding/${uid}/`) || cleanDest.startsWith(`employees/${uid}/`);
             if (ownsSource && ownsDest) {
                 isAuthorized = true;
@@ -2390,9 +2388,6 @@
         // 1. Check if caller is an Admin / Staff member
-        if (request.auth.token && (request.auth.token.isAdmin || request.auth.token.isSuperAdmin)) {
-            isAuthorized = true;
-        } else {
+        {
             const [adminDoc, staffDoc] = await Promise.all([
                 db.collection('users').doc(uid).get(),
                 db.collection('staff_accounts').doc(uid).get()
             ]);
```

### UDF-AUD-08 (`HIGH` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `src/contexts/DataContext.tsx:504–524`, `src/services/employeeService.ts:2220, 2256, 2275`, `src/services/authService.ts:72–85, 133–135`, `firestore.rules:199–202, 213–218, 229–237`

#### Root Cause & Exact Code Trace
1. `src/contexts/DataContext.tsx:505` runs `query(collection(db, 'employees'), where('employeeId', '==', employeeId))` for logged-in employees, which fails `firestore.rules:199–202` (`match /employees/{userId}` `allow list` only allows `uid == request.auth.uid || linkedUid == request.auth.uid`).
2. `src/services/employeeService.ts:2220` (`subscribeToEmployeeByUid`) and `src/services/authService.ts:72` (`getEmployeeProfile`) run `query(collection(db, 'employees'), where("linkedGoogleEmail", "==", ...))`, which also fails `firestore.rules:199–202` because `linkedGoogleEmail` is not permitted in `employees` `allow list`.
3. `src/services/authService.ts:80` and `src/services/employeeService.ts:2256, 2275` call `updateDoc(ref, { uid })` from the client on active `employees` documents (`profileStatus: 'approved'`), which fails `firestore.rules:213–218` (only allowed when `profileStatus` is `'needs_completion'` or `'waiting_for_admin'`).
4. `src/services/authService.ts:133` runs `query(collection(db, 'onboarding_submissions'), where("employeeId", "==", empData.employeeId || empDocId), limit(1))`, which fails `firestore.rules:229–237`.

#### Real-World Impact
Employee login (`getEmployeeProfile`) and real-time profile listeners (`DataContext.tsx`, `subscribeToEmployeeByUid`) throw `FirebaseError: Missing or insufficient permissions` whenever resolving an employee by `employeeId` or `linkedGoogleEmail`.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -199,4 +199,7 @@
       allow list: if isAdmin() || (isAuthenticated() && (
         resource.data.get('uid', '') == request.auth.uid || 
-        resource.data.get('linkedUid', '') == request.auth.uid
+        resource.data.get('linkedUid', '') == request.auth.uid ||
+        resource.data.get('employeeId', '') == request.auth.uid ||
+        (request.auth.token.get('employeeId', '') != '' && resource.data.get('employeeId', '') == request.auth.token.employeeId) ||
+        (request.auth.token.get('email', '') != '' && resource.data.get('linkedGoogleEmail', '') == request.auth.token.email)
       ));
```

### UDF-AUD-09 (`HIGH` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `src/services/bgvService.ts:318–362`, `firestore.rules:469–482`

#### Root Cause & Exact Code Trace
In `src/services/bgvService.ts`:
- `markBgvUnderProcess` (`L325–333`) calls `updateDoc(docRef, { status: BgvStatus.UNDER_PROCESS, vendorName, vendorCaseId, sentToVendorDate, notes, updatedAt })`.
- `vendorSubmitBgvReport` (`L351–360`) calls `updateDoc(docRef, { status: BgvStatus.VENDOR_SUBMITTED, bgvDocumentUrl, bgvDocumentPath, bgvDocumentName, vendorSubmittedDate, notes, updatedAt })`.
However, `firestore.rules:469–482` forbids non-SuperAdmins from modifying `status` (`!request.resource.data.diff(resource.data).affectedKeys().hasAny(['status', 'approvedBy', 'approvedDate', 'rejectionReason'])`) and restricts vendors (`vendorId == request.auth.uid`) to `hasOnly(['vendorNotes', 'vendorReportURL', 'vendorStatus', 'vendorCompletedAt', 'vendorDocuments', 'lastUpdated', 'updatedAt'])`.

#### Real-World Impact
Non-SuperAdmin staff granted `BGV_MANAGE`, `BGV_DISPATCH_VENDOR`, or `BGV_UPLOAD_CERTIFICATE` and external BGV vendors cannot dispatch BGV cases or upload BGV completion certificates—both actions fail with `PERMISSION_DENIED`.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -469,14 +469,20 @@
       allow update: if isSuperAdmin() || (
         (hasPermission('BGV_MANAGE') || hasPermission('BGV_DISPATCH_VENDOR') || hasPermission('BGV_UPLOAD_CERTIFICATE') || hasPermission('BGV_APPROVE_REJECT')) &&
-        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['status', 'approvedBy', 'approvedDate', 'rejectionReason'])
+        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['approvedBy', 'approvedDate', 'rejectionReason']) &&
+        (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['status']) ||
+         request.resource.data.status in ['UNDER_PROCESS', 'VENDOR_SUBMITTED', 'Under Process', 'Vendor Submitted'])
       ) || (
-        isAuthenticated() && resource.data.get('vendorId', '') == request.auth.uid &&
-        // SEC-06: Vendors can only update vendor notes & reports; forbidden from approving checks
+        isAuthenticated() && (resource.data.get('vendorId', '') == request.auth.uid || hasPermission('BGV_VENDOR')) &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly([
           'vendorNotes', 'vendorReportURL', 'vendorStatus', 'vendorCompletedAt', 
-          'vendorDocuments', 'lastUpdated', 'updatedAt'
+          'vendorDocuments', 'bgvDocumentUrl', 'bgvDocumentPath', 'bgvDocumentName',
+          'vendorSubmittedDate', 'notes', 'status', 'lastUpdated', 'updatedAt'
         ]) &&
-        !request.resource.data.diff(resource.data).affectedKeys().hasAny([
-          'status', 'result', 'internalStatus', 'approvedBy', 'approvedAt'
+        (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['status']) ||
+         request.resource.data.status in ['VENDOR_SUBMITTED', 'Vendor Submitted']) &&
+        !request.resource.data.diff(resource.data).affectedKeys().hasAny([
+          'result', 'internalStatus', 'approvedBy', 'approvedAt', 'approvedDate', 'rejectionReason'
         ])
       );
```

### UDF-AUD-10 (`HIGH` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `functions/index.js:4746, 5171, 5228–5243, 5506, 5536–5552, 5658, 5661–5683, 5926–5929, 6841–6851, 7257–7296, 7482–7497, 7723–7733, 8235–8244`

#### Root Cause & Exact Code Trace
1. **Broken Firestore Fallback for Site Isolation:** In `approveOnboardingServer` (`L5229–5234`), `relieveEmployeeServer` (`L5538–5543`), `permanentDeleteEmployeeServer` (`L6843–6848`), `promoteEmployeeServer` (`L7483–7488`), `bulkImportEmployeesServer` (`L7724–7729`), and `completeBgvReviewServer` (`L8236–8241`), when custom claims are absent from `request.auth.token` and permissions are loaded via the Firestore `staff_accounts` fallback, the subsequent site-isolation check still reads `token.permissions` and `token.sitesManaged` (which are `undefined`/`[]` in the fallback path!):
   ```js
   // functions/index.js:5228–5235
   if (!isSuperAdmin) {
       const perms = Array.isArray(token.permissions) ? token.permissions : [];
       const hasGlobalScope = perms.includes('EMPLOYEES_VIEW_SCOPE_ALL') || ...;
       if (!hasGlobalScope) {
           const managedSites = Array.isArray(token.sitesManaged) ? token.sitesManaged : [];
           const targetSiteId = siteId || subData.siteId || '';
           if (targetSiteId && !managedSites.includes(targetSiteId)) {
               throw new functions.https.HttpsError('permission-denied', 'Site Isolation: ...');
   ```
2. **Role ID Typo:** `processRequestReviewServer` (`L4746`), `approveOnboardingServer` (`L5171`), `relieveEmployeeServer` (`L5506`), and `rejoinEmployeeServer` (`L5658`) check `token.roleId === 'super-admin'` instead of `'role-super-admin'`.
3. **Missing Firestore Fallback:** `rejoinEmployeeServer` (`L5661–5664`) and `logClientAuditEvent` (`L5926–5929`) have no Firestore fallback when `request.auth.token` lacks custom claims (and `logClientAuditEvent` does not check `token.isDisabled === true`).
4. **Missing Site Isolation in `deleteSiteServer` (`L7257–7296`):** Non-SuperAdmin staff with `SITES_DELETE` or `SITES_MANAGE` (without `MANAGE_ALL_SITES`) can delete any site regardless of `sitesManaged`.

#### Real-World Impact
Site-scoped staff whose token claims have not refreshed receive false `permission-denied` errors on all 6 server operations; `rejoinEmployeeServer` fails whenever claims are absent; and `deleteSiteServer` allows cross-site deletion.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -5171,7 +5171,9 @@
-    let isSuperAdmin = token.isSuperAdmin === true || token.roleId === 'super-admin';
+    let isSuperAdmin = token.isSuperAdmin === true || token.roleId === 'role-super-admin';
     let canApprove = isSuperAdmin ||
         (Array.isArray(token.permissions) && token.permissions.includes('SUBMISSIONS_APPROVE'));
+    let effectivePerms = Array.isArray(token.permissions) ? token.permissions : [];
+    let effectiveSites = Array.isArray(token.sitesManaged) ? token.sitesManaged : [];
 
     if (!canApprove) {
         const [adminSnap, staffSnap] = await Promise.all([
             db.collection('users').doc(callerUid).get(),
             db.collection('staff_accounts').doc(callerUid).get()
         ]);
@@ -5187,6 +5189,7 @@
         if (staffDoc && staffDoc.isDisabled !== true && staffDoc.isActive !== false) {
+            effectiveSites = Array.isArray(staffDoc.sitesManaged) ? staffDoc.sitesManaged : effectiveSites;
             if (staffDoc.roleId === 'role-super-admin') {
                 isSuperAdmin = true;
                 canApprove = true;
             } else if (staffDoc.roleId) {
@@ -5195,5 +5198,6 @@
                     const overrides = staffDoc.permissionOverrides || {};
+                    effectivePerms = rolePerms.filter(p => overrides[p] !== false).concat(Object.keys(overrides).filter(k => overrides[k] === true));
                     if (rolePerms.includes('SUBMISSIONS_APPROVE') && overrides['SUBMISSIONS_APPROVE'] !== false) {
                         canApprove = true;
                     }
@@ -5229,6 +5233,5 @@
         if (!isSuperAdmin) {
-            const perms = Array.isArray(token.permissions) ? token.permissions : [];
-            const hasGlobalScope = perms.includes('EMPLOYEES_VIEW_SCOPE_ALL') || perms.includes('SUBMISSIONS_VIEW_SCOPE_ALL') || perms.includes('MANAGE_ALL_SITES');
+            const hasGlobalScope = effectivePerms.includes('EMPLOYEES_VIEW_SCOPE_ALL') || effectivePerms.includes('SUBMISSIONS_VIEW_SCOPE_ALL') || effectivePerms.includes('MANAGE_ALL_SITES');
             if (!hasGlobalScope) {
-                const managedSites = Array.isArray(token.sitesManaged) ? token.sitesManaged : [];
+                const managedSites = effectiveSites;
                 const targetSiteId = siteId || subData.siteId || '';
```

### UDF-AUD-11 (`HIGH` | `Security Vulnerability`)
**Target Files & Lines:** `src/contexts/NotificationContext.tsx:31–61, 114–175`, `functions/index.js:8110–8138`, `App.tsx:2473–2475`

#### Root Cause & Exact Code Trace
1. In `src/contexts/NotificationContext.tsx:32`, `if (user.type === UserType.ADMIN || (user as any).role === 'Admin' || (user as any).roleId)` evaluates to `true` for public visitors because `AuthContext.tsx:88` sets `roleId: 'guest'` on `UserType.PUBLIC` users. Public visitors therefore subscribe to `targetUserId in ['all_admins', 'admin']`, which fails `firestore.rules:392` (`permission-denied`).
2. `NotificationContext.tsx:146` passes an empty dependency array `[]` to `useCallback` for `sendNotification`, capturing the initial `user = null` in a stale closure so `isSelfOrBroadcast` (`L114`) is always `false`.
3. `NotificationContext.tsx:157–171` (`markAllNotificationsAsRead`) only filters `n.targetUserId === userId || 'all_admins' || 'admin'`, ignoring `user.employeeId`, `user.portalId`, and `ROLE:${user.roleId}`; meanwhile `App.tsx:2473–2475` filters `employeeProps.notifications` without `ROLE:employee` or `ROLE:role-security-guard`.
4. In `functions/index.js:8110–8138` (`sendNotificationServer`), `isAdmin` is checked only from `request.auth.token` (no Firestore fallback), and lines `8120–8125` only block `ROLE:employee` and `ROLE:role-security-guard` for non-admins—allowing any anonymous/unprivileged user to spam `'all_admins'`, `'admin'`, or any staff `ROLE:*` channel.

#### Real-World Impact
Public pages log Firestore permission errors, employees never see `ROLE:employee` broadcast notifications and cannot mark `employeeId`/`portalId` notifications as read, and any anonymous caller can flood admin notification feeds via `sendNotificationServer`.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/src/contexts/NotificationContext.tsx
+++ b/src/contexts/NotificationContext.tsx
@@ -30,7 +30,7 @@
         const targetIds = new Set<string>([userId]);
         if ((user as any).employeeId) targetIds.add((user as any).employeeId);
         if ((user as any).portalId) targetIds.add((user as any).portalId);
-        if (user.type === UserType.ADMIN || (user as any).role === 'Admin' || (user as any).roleId) {
+        if (user.type === UserType.ADMIN || (user as any).role === 'Admin') {
             targetIds.add('all_admins');
             targetIds.add('admin');
             if ((user as any).roleId) {
@@ -143,19 +143,22 @@
         } catch (error) {
             log.error('Error sending notification:', error);
         }
-    }, []);
+    }, [user]);
 
     const markAllNotificationsAsRead = useCallback(async (userId: string) => {
         try {
+            const myTargets = new Set<string>([userId]);
+            if ((user as any)?.employeeId) myTargets.add((user as any).employeeId);
+            if ((user as any)?.portalId) myTargets.add((user as any).portalId);
+            if (user?.type === UserType.ADMIN) {
+                myTargets.add('all_admins');
+                myTargets.add('admin');
+            }
             const unread = notifications.filter(
-                n => !n.read && (n.targetUserId === userId || n.targetUserId === 'all_admins' || n.targetUserId === 'admin')
+                n => !n.read && myTargets.has(n.targetUserId)
             );
```

### UDF-AUD-12 (`HIGH` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `components/AdminInvitesPage.tsx:294–297, 326–336, 591–595`, `src/services/employeeService.ts:1035–1043`, `functions/index.js:3404–3448, 5442–5445`, `firestore.rules:504–528`

#### Root Cause & Exact Code Trace
1. `submitEmployeeForm` (`src/services/employeeService.ts:1038`) executes `updateDoc(inviteRef, { joined: increment(1) })` from the candidate's browser, which always fails `firestore.rules:504–520` (`PERMISSION_DENIED`) and duplicates the server-side increment in `approveOnboardingServer` (`functions/index.js:5444`).
2. `approveOnboardingServer` (`functions/index.js:5442–5445`) adds `batch.update(inviteRef, { joined: admin.firestore.FieldValue.increment(1) })` to the atomic approval batch without checking if `referral_invites/{subData.inviteId}` still exists. If the invite document was deleted by a SuperAdmin, `batch.commit()` throws `5 NOT_FOUND`, completely breaking onboarding approval for that candidate!
3. `recordReferralMetricServer` (`functions/index.js:3404–3448`) allows unauthenticated callers to increment `'joined'` and does not verify that the invite is `'Active'`.
4. `AdminInvitesPage.tsx:591–595` (`handleSaveReactivation`) updates `status: 'Active'` and `expiresAt` even when `inviteToReactivate.status` is already `'Active'` (extend expiry), which fails `firestore.rules:507, 516` (`resource.data.status != 'Active' && request.resource.data.status == 'Active'`).

#### Real-World Impact
Approving any candidate whose referral invite was deleted crashes `approveOnboardingServer` with `NOT_FOUND`; extending expiry on an active invite fails with `PERMISSION_DENIED`; and candidate submissions log permission errors.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3409,7 +3409,7 @@
 exports.recordReferralMetricServer = secureOnCall(async (request) => {
     const { refId, metric } = request.data || {};
-    if (!refId || typeof refId !== 'string' || !['clicks', 'started', 'joined'].includes(metric)) {
+    if (!refId || typeof refId !== 'string' || !['clicks', 'started'].includes(metric)) {
         throw new functions.https.HttpsError('invalid-argument', 'Valid referral ID and metric are required.');
     }
@@ -5441,5 +5441,8 @@
         if (subData.inviteId) {
             const inviteRef = db.collection('referral_invites').doc(subData.inviteId);
-            batch.update(inviteRef, { joined: admin.firestore.FieldValue.increment(1) });
+            const inviteSnap = await inviteRef.get();
+            if (inviteSnap.exists) {
+                batch.update(inviteRef, { joined: admin.firestore.FieldValue.increment(1) });
+            }
         }
--- a/firestore.rules
+++ b/firestore.rules
@@ -507,2 +507,2 @@
-        (hasPermission('INVITES_REACTIVATE') && resource.data.status != 'Active' && request.resource.data.status == 'Active') ||
+        (hasPermission('INVITES_REACTIVATE') && request.resource.data.status == 'Active') ||
         (hasPermission('INVITES_EDIT') && request.resource.data.status == resource.data.status) ||
```

### UDF-AUD-13 (`HIGH` | `Security Vulnerability`)
**Target Files & Lines:** `GOOGLE_APPS_SCRIPT_v7.2.js:73–94, 132, 147–159`

#### Root Cause & Exact Code Trace
1. `verifyViaApi(idToken)` (`GOOGLE_APPS_SCRIPT_v7.2.js:75`) only queries `/documents/users/` + `uid` and never checks `/documents/staff_accounts/` + `uid`, so any SuperAdmin whose record is in `staff_accounts` gets `isSuperAdmin = false` when calling Apps Script with a Firebase ID token.
2. `submit_to_form` (`L132`) is not in `adminActions` (`L111–123`), so any anonymous Firebase user (`signInAnonymously`) passes `verifyFirebaseToken` and can inject arbitrary form responses into the production Google Form and Sheet.
3. In `if (data.base64)` (`L147–158`), `checkFirestoreAccess(data.token, "employees", data.uniqueId)` only checks if Firestore REST GET returns `200 OK`. Because `firestore.rules:192, 225` has `allow get: if resource == null || ...` (and `Firestore REST API` returns 404 only when permitted by `resource == null`, or 200 when a doc exists), any caller who passes a readable `uniqueId` can forge `data.employeeName` (`L176`) to upload arbitrary files into Google Drive.

#### Real-World Impact
Token-authenticated SuperAdmins in `staff_accounts` are rejected by `adminActions`, while anonymous users can spam Google Forms/Sheets or upload files into Google Drive.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/GOOGLE_APPS_SCRIPT_v7.2.js
+++ b/GOOGLE_APPS_SCRIPT_v7.2.js
@@ -74,6 +74,14 @@
     try {
       var firestoreUrl = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/users/" + uid;
       var firestoreResponse = UrlFetchApp.fetch(firestoreUrl, {
         method: "get",
         headers: { "Authorization": "Bearer " + idToken },
         muteHttpExceptions: true
       });
+      if (firestoreResponse.getResponseCode() !== 200) {
+        var staffUrl = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/staff_accounts/" + uid;
+        firestoreResponse = UrlFetchApp.fetch(staffUrl, {
+          method: "get",
+          headers: { "Authorization": "Bearer " + idToken },
+          muteHttpExceptions: true
+        });
+      }
       if (firestoreResponse.getResponseCode() === 200) {
@@ -111,6 +119,7 @@
     var adminActions = [
+      'submit_to_form',
       'copy_folder_contents',
```

### UDF-AUD-14 (`MEDIUM` | `Security Vulnerability`)
**Target Files & Lines:** `components/AdminReviewSubmissionsPage.tsx:677–685, 859`, `src/utils/sanitizeHtml.ts:19, 26–31, 75–80`, `scripts/generateStaticPages.js:52–56, 463, 477, 568`

#### Root Cause & Exact Code Trace
1. In `components/AdminReviewSubmissionsPage.tsx:679–680, 859`, `photoUrl` is assigned raw `photoPath` if it starts with `http` or `data:`, and is interpolated directly into `printWindow.document.write('<img src="${photoUrl}" alt="Passport Photo" />')` without `esc(photoUrl)`.
2. In `src/utils/sanitizeHtml.ts:19, 75–80`, `SAFE_URL_PATTERN = /^(https?:\/\/|\/|#|mailto:|tel:)/i` matches protocol-relative external URLs starting with `//` (e.g., `//attacker.example/track.png`).
3. In `scripts/generateStaticPages.js:463, 477, 568`, `post.imageUrl` is interpolated into `<img src="${coverUrl}">` without quote escaping, and `post.slug` (`L568`) is not passed through `slugFromTitle` before writing to the filesystem.

#### Real-World Impact
A malicious `http` or `data:` string in the photo field triggers DOM XSS in the Admin Biodata print window; protocol-relative URLs bypass `sanitizeHtml.ts`; and unsanitized blog slugs/image URLs can inject HTML or traverse directories during static build generation.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/components/AdminReviewSubmissionsPage.tsx
+++ b/components/AdminReviewSubmissionsPage.tsx
@@ -858,3 +858,3 @@
             <div class="photo-box">
-              ${photoUrl ? `<img src="${photoUrl}" alt="Passport Photo" />` : 'PASTE PASSPORT PHOTO HERE'}
+              ${photoUrl ? `<img src="${esc(photoUrl)}" alt="Passport Photo" />` : 'PASTE PASSPORT PHOTO HERE'}
             </div>
--- a/src/utils/sanitizeHtml.ts
+++ b/src/utils/sanitizeHtml.ts
@@ -19,1 +19,1 @@
-const SAFE_URL_PATTERN = /^(https?:\/\/|\/|#|mailto:|tel:)/i;
+const SAFE_URL_PATTERN = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;
```

### UDF-AUD-15 (`MEDIUM` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `components/ProfileAvatar.tsx:85–97`, `components/AdminStaffProfilePage.tsx:98`, `src/services/storageService.ts:467, 481, 496, 503–521`, `functions/index.js:3698–3724`, `firestore.rules:178–188`

#### Root Cause & Exact Code Trace
1. `AdminStaffProfilePage.tsx:98` passes `userId={loggedInUser.id}` and `collection="staff_accounts"` to `ProfileAvatar`. `uploadProfilePhoto` (`storageService.ts:503–521`) calls `getUploadUrl` with `context: 'profile'` and `targetId = userId`.
2. In `functions/index.js:3698–3724`, `context === 'profile'` only checks `if (targetId === uid)` or looks up `db.collection('employees').doc(targetId)`—it never checks `staff_accounts` or `users`. For staff accounts whose `loggedInUser.id` is a username or legacy staff ID (`loggedInUser.id !== auth.currentUser.uid`), `getUploadUrl` fails with `permission-denied`.
3. `storageService.ts:467, 481, 496, 515` fall back to direct Firebase Storage SDK uploads (`uploadFile`), which always fail because `storage.rules` denies all client writes (`allow write: if false;`).

#### Real-World Impact
Non-SuperAdmin staff whose `staff_accounts` document ID differs from `auth.currentUser.uid` cannot upload a profile photo, and `uploadSubmissionAttachment` (`storageService.ts:485`) always fails because it calls `uploadFile` directly instead of `uploadViaSignedUrl`.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3700,6 +3700,13 @@
         if (targetId === uid) {
             isAuthorized = true;
         } else {
+            const staffCheck = await db.collection('staff_accounts').doc(targetId).get();
+            if (staffCheck.exists && staffCheck.data().email && request.auth.token.email &&
+                staffCheck.data().email.toLowerCase() === request.auth.token.email.toLowerCase()) {
+                isAuthorized = true;
+            }
+        }
+        if (!isAuthorized) {
             // Target might be an employeeId (e.g. HY123456) while caller's uid is portalId (e.g. UDF-202606-ABCD)
```

### UDF-AUD-16 (`MEDIUM` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `components/employee/AttendanceCalendar.tsx:113–146`, `components/employee/EmployeeEngagementHub.tsx:105–118`, `src/services/engagementService.ts:207–246`

#### Root Cause & Exact Code Trace
1. In `components/employee/AttendanceCalendar.tsx:113–146`, when an employee marks attendance as `'P'`, the client reads `pointsToAdd` from `settings/gamification_rules` and logs `console.log('[ATTENDANCE POINTS] Awarded +5 points...')`, but `setDoc(streakRef, { ...streakData, userId, userName }, { merge: true })` omits `points` and no Cloud Function is called by `markAttendanceForDate` (`engagementService.ts:207–246`).
2. In `components/employee/EmployeeEngagementHub.tsx:109–117`, immediately after calling `completeTrainingQuizServer` (which atomically updates `user_engagement/{userId}` on the server), the client calls `setDoc(docRef, updated, { merge: true })` spreading the pre-call `streak` state (`safeStreak`), overwriting server-updated fields like `completedQuizzes`.

#### Real-World Impact
Employees never receive points for marking daily attendance, and client-side `setDoc` in `EmployeeEngagementHub.tsx` overwrites server-side `user_engagement` fields after quiz completion.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/components/employee/EmployeeEngagementHub.tsx
+++ b/components/employee/EmployeeEngagementHub.tsx
@@ -109,9 +109,8 @@
             const docRef = doc(db, 'user_engagement', userId);
-            const { points: _omitPoints, referralCount: _omitRef, ...safeStreak } = (streak || { userId, userName, streakCount: 1, lastVisitDate: today }) as any;
             const updated = {
-                ...safeStreak,
                 lastQuizDate: today,
                 lastQuizOption: quizAnswer,
                 lastQuizCorrect: isCorrect
             };
             await setDoc(docRef, updated, { merge: true });
```

### UDF-AUD-17 (`MEDIUM` | `Security Vulnerability`)
**Target Files & Lines:** `functions/index.js:465–493, 2896–3061`, `components/employee/ProfileClaimPage.tsx:88–103`, `components/EmployeeFormPage.tsx:762–797`

#### Root Cause & Exact Code Trace
1. In `checkClaimDailyAttempts` (`functions/index.js:481–485`), `const newCount = (data.count || 0) + 1; if (newCount >= MAX_DAILY_ATTEMPTS) return true;` runs *before* checking the user's verification metrics, blocking the 3rd attempt immediately (only 2 attempts are actually evaluated).
2. In `claimEmployeeProfile` (`functions/index.js:2983–3011`), the loop over `metrics` throws `"Verification failed. The ${metric} you entered does not match our records."`, creating a field-by-field oracle that tells an attacker whether earlier metrics in the array (`aadhaar`, `dob`, `phone`) were valid.
3. `claimEmployeeProfile` (`L3034`) mints a custom token with `uid = submissionId || trimmedId` (e.g. `"HY123456"`), and `ProfileClaimPage.tsx:89` calls `signInWithCustomToken(auth, data.token)` before redirecting to `/join`. When `EmployeeFormPage.tsx:769` runs `else if (user && !user.isAnonymous)`, it treats the custom-token session as a Google-authenticated user and sets `linkedUid = "HY123456"`.

#### Real-World Impact
Legacy employees are locked out after 2 failed tries instead of 3, attackers can verify individual PII fields one by one via specific error messages, and claimed profiles have `linkedUid` polluted with their `employeeId` on `/join`.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -481,3 +481,3 @@
         const newCount = (data.count || 0) + 1;
-        if (newCount >= MAX_DAILY_ATTEMPTS) {
+        if (newCount > MAX_DAILY_ATTEMPTS) {
             await attemptsRef.set({ count: newCount, firstAttemptAt: data.firstAttemptAt || now, lockedUntil: (data.firstAttemptAt || now) + ONE_DAY_MS });
@@ -3005,6 +3005,6 @@
                 if (!sYMD || !pYMD || sYMD !== pYMD) {
-                    throw new functions.https.HttpsError('permission-denied', `Verification failed. The ${metric} you entered does not match our records.`);
+                    throw new functions.https.HttpsError('permission-denied', 'Verification failed. The details you entered do not match our records.');
                 }
             } else if (!providedValue || normalize(storedValue) !== normalize(providedValue)) {
-                throw new functions.https.HttpsError('permission-denied', `Verification failed. The ${metric} you entered does not match our records.`);
+                throw new functions.https.HttpsError('permission-denied', 'Verification failed. The details you entered do not match our records.');
             }
```

### UDF-AUD-18 (`MEDIUM` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `components/AdminStaffManagementPage.tsx:258, 319, 360, 460, 468`, `components/AdminRoleManagementPage.tsx:724`, `functions/index.js:206–234, 7761`

#### Root Cause & Exact Code Trace
`firestore.rules:17–54` evaluates staff permissions and site access (`isAdmin()`, `hasPermission()`, `canStaffViewSite()`) exclusively from JWT custom claims (`request.auth.token`). However, when a SuperAdmin modifies a staff member's `sitesManaged`, `roleId`, or `permissionOverrides` in `AdminStaffManagementPage.tsx:258, 319, 360, 460, 468` or `AdminRoleManagementPage.tsx:724`, the UI writes directly to `staff_accounts/{staffId}` in Firestore without invoking `refreshAdminClaims({ targetUid })` (`functions/index.js:7761`).

#### Real-World Impact
Staff members whose role, site assignments, or permission overrides are modified by a SuperAdmin retain stale custom claims in Firebase Auth until their next manual sign-in + `setAdminClaims` call.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/components/AdminRoleManagementPage.tsx
+++ b/components/AdminRoleManagementPage.tsx
@@ -724,4 +724,8 @@
         await setDoc(doc(db, 'staff_accounts', updatedUser.id), {
           permissionOverrides: updatedUser.permissionOverrides || {}
         }, { merge: true });
+        const { httpsCallable } = await import('firebase/functions');
+        const { functions } = await import('../src/firebase/config');
+        const refreshFn = httpsCallable(functions, 'refreshAdminClaims');
+        await refreshFn({ targetUid: updatedUser.id }).catch(() => {});
         onNotify(`Permission overrides updated for ${updatedUser.name} and saved to server.`, 'success');
```

### UDF-AUD-19 (`LOW` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `src/utils/createAdmin.js:10`, `scripts/check_user_exact.js:1`, `scripts/inspect_test_data.js:1`, `functions/index.js:21, 7503, 7507, 7673, 8021`, `src/utils/bulkImportUtils.ts:545`

#### Root Cause & Exact Code Trace
1. `src/utils/createAdmin.js:10` imports `../firebase/config.js` (non-existent; actual file is `src/firebase/config.ts`).
2. `scripts/check_user_exact.js:1` and `scripts/inspect_test_data.js:1` import `../functions/node_modules/firebase-admin/lib/index.js` instead of `firebase-admin`.
3. `functions/index.js:21` falls back to hardcoded `'UDF_PORTAL_SALT_2026_!!'` when `process.env.LEGACY_SHA256_SALT` is unset.
4. `functions/index.js:7503, 7507, 7673, 8021` and `src/utils/bulkImportUtils.ts:545` use `Math.random()` instead of `crypto.randomInt` / `crypto.getRandomValues` for employee IDs, promotion references, and reward voucher codes (`UDF-XXXX`).

#### Real-World Impact
Utility scripts fail with `ERR_MODULE_NOT_FOUND`, and `Math.random()` produces predictable voucher/reference tokens.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -8020,2 +8020,2 @@
-        const randToken = Math.random().toString(36).substring(2, 7).toUpperCase();
+        const randToken = crypto.randomBytes(3).toString('hex').toUpperCase();
         const voucherCode = `UDF-${randToken}`;
```

### UDF-AUD-20 (`CRITICAL` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `components/employee/DocumentUploadWizard.tsx:118–139, 200, 210, 229, 428`, `components/BulkImportModal.tsx:580`, `types.ts:40–46`

#### Root Cause & Exact Code Trace
1. **Infinite React Re-Render Loop (`Too many re-renders`):** In `components/employee/DocumentUploadWizard.tsx:118–139`, `validateDetailsStep()` calls `setValidationErrors(errors);` unconditionally on line `137`:
   ```tsx
   // components/employee/DocumentUploadWizard.tsx:118–139
   const validateDetailsStep = (): boolean => {
       const errors: Record<string, string> = {};
       let isValid = true;
       ...
       setValidationErrors(errors); // <-- Mutates React state!
       return isValid;
   };
   ```
   Lines `200` and `210` invoke `validateDetailsStep()` **synchronously inside JSX during render**:
   ```tsx
   // components/employee/DocumentUploadWizard.tsx:200, 210
   disabled={isFinishing || !validateDetailsStep()} // L200
   disabled={isFinishing || !validateDetailsStep() || !allDocumentsUploaded} // L210
   ```
   Calling `setValidationErrors(errors)` during render triggers an immediate state update on every render pass, causing React to throw `Uncaught Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.`
2. **Undefined Section Titles (`section.title` vs `section.name`):** `FormSection` (`types.ts:40–46`) defines `name: string` (not `title`). However, `DocumentUploadWizard.tsx:229, 428` and `BulkImportModal.tsx:580` render `{section.title}`, resulting in blank section headers.

#### Real-World Impact
Every employee imported or approved with `needsProfileCompletion: true` (who is routed to `DocumentUploadWizard` by `EmployeeDashboardPage.tsx:163, 229`) immediately crashes with a white screen (`Too many re-renders`) upon logging into the Employee Portal.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/components/employee/DocumentUploadWizard.tsx
+++ b/components/employee/DocumentUploadWizard.tsx
@@ -118,22 +118,24 @@
-    const validateDetailsStep = (): boolean => {
+    const computeDetailsValidation = () => {
         const errors: Record<string, string> = {};
         let isValid = true;
 
         missingTextSections.forEach(section => {
             section.fields.forEach(field => {
                 if (field.isMandatory) {
                     const val = formData[field.id];
                     if (val === undefined || val === null || String(val).trim() === '') {
                         errors[field.id] = `${field.label} is required`;
                         isValid = false;
                     }
                 }
             });
         });
 
-        setValidationErrors(errors);
-        return isValid;
+        return { isValid, errors };
     };
+
+    const isDetailsStepValid = React.useMemo(() => computeDetailsValidation().isValid, [missingTextSections, formData]);
 
     const handleNextStep = async () => {
-        if (!validateDetailsStep()) return;
+        const { isValid, errors } = computeDetailsValidation();
+        setValidationErrors(errors);
+        if (!isValid) return;
@@ -198,3 +200,3 @@
                             onClick={handleFinish}
-                            disabled={isFinishing || !validateDetailsStep()}
+                            disabled={isFinishing || !isDetailsStepValid}
                             className="w-full py-3 flex justify-center items-center text-lg bg-green-600 hover:bg-green-700 focus:ring-green-500"
@@ -208,3 +210,3 @@
                             onClick={handleFinish}
-                            disabled={isFinishing || !validateDetailsStep() || !allDocumentsUploaded}
+                            disabled={isFinishing || !isDetailsStepValid || !allDocumentsUploaded}
                             className={`w-full py-3 flex justify-center items-center text-lg ${allDocumentsUploaded ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
@@ -228,3 +230,3 @@
                                     <h4 className="font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">
-                                        {section.title}
+                                        {section.name}
                                     </h4>
@@ -427,3 +429,3 @@
                                 <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center">
-                                    {section.title}
+                                    {section.name}
                                 </h3>
--- a/components/BulkImportModal.tsx
+++ b/components/BulkImportModal.tsx
@@ -579,3 +579,3 @@
                                     <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider border-b pb-1">
-                                        {section.title}
+                                        {section.name}
                                     </h4>
```

### UDF-AUD-21 (`HIGH` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `src/components/guards/AuthGuard.tsx:27–38`, `src/context/AuthContext.tsx:86–92`, `src/routes/AppRoutes.tsx:187–197, 245–255`

#### Root Cause & Exact Code Trace
1. Whenever `ensureAuthenticated()` (`signInAnonymously`) runs or an unlinked Firebase Auth session exists, `AuthContext.tsx:86–92` sets:
   ```ts
   // src/context/AuthContext.tsx:86–92
   setUser({
       id: firebaseUser.uid,
       name: firebaseUser.displayName || 'Guest User',
       type: UserType.PUBLIC,
       roleId: 'guest'
   });
   ```
2. In `src/components/guards/AuthGuard.tsx:27–38`:
   ```tsx
   if (!user) {
       const currentPath = location.pathname + location.search;
       const loginUrl = currentPath && currentPath !== '/' && currentPath !== '/login'
           ? `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`
           : redirectTo;
       return <Navigate to={loginUrl} state={{ from: location }} replace />;
   }

   if (allowedUserTypes && !allowedUserTypes.includes(user.type as UserType)) {
       const redirectPath = user.type === UserType.ADMIN ? '/admin/dashboard' : '/employee/dashboard';
       return <Navigate to={redirectPath} replace />;
   }
   ```
   Because `user` is non-null (`user.type === UserType.PUBLIC`), `if (!user)` is skipped and `AuthGuard` redirects `UserType.PUBLIC` to `/employee/dashboard`.
3. On `employee.udfonline.in` (`appTarget === 'employee'`), `AppRoutes.tsx:245` redirects `/employee/dashboard` → `/dashboard`, and `AppRoutes.tsx:251` wraps `/dashboard` in `<AuthGuard allowedUserTypes={[UserType.EMPLOYEE]}>`, which redirects back to `/employee/dashboard` → `/dashboard` in an infinite loop!
4. On `admin.udfonline.in` (`appTarget === 'admin'`), `AppRoutes.tsx:193` wraps `/*` (including `/employee/dashboard`) in `<AuthGuard allowedUserTypes={[UserType.ADMIN]}>`, redirecting `UserType.PUBLIC` or `UserType.EMPLOYEE` to `/employee/dashboard` → `/employee/dashboard` in an infinite loop instead of `/login`.

#### Real-World Impact
Any visitor to `employee.udfonline.in/dashboard` or `admin.udfonline.in/dashboard` who has an active anonymous Firebase session (or wrong portal role) triggers a browser `Maximum update depth exceeded` / infinite History API redirect loop instead of being sent to `/login`.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/src/components/guards/AuthGuard.tsx
+++ b/src/components/guards/AuthGuard.tsx
@@ -26,13 +26,16 @@
-    if (!user) {
+    if (!user || user.type === UserType.PUBLIC) {
         const currentPath = location.pathname + location.search;
         const loginUrl = currentPath && currentPath !== '/' && currentPath !== '/login'
             ? `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`
             : redirectTo;
         return <Navigate to={loginUrl} state={{ from: location }} replace />;
     }
 
     if (allowedUserTypes && !allowedUserTypes.includes(user.type as UserType)) {
-        // Redirect to appropriate dashboard based on actual user type
-        const redirectPath = user.type === UserType.ADMIN ? '/admin/dashboard' : '/employee/dashboard';
-        return <Navigate to={redirectPath} replace />;
+        return <Navigate to={redirectTo} replace />;
     }
```

### UDF-AUD-22 (`HIGH` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `components/AdminInvitesPage.tsx:325–345, 384, 1218–1221`, `firestore.rules:137, 217`

#### Root Cause & Exact Code Trace
In `components/AdminInvitesPage.tsx:325–345`:
```ts
if (isSuperAdmin || hasPermission(Permission.INVITES_VIEW_ALL) || hasPermission(Permission.INVITES_MANAGE)) {
  qEmp = query(collection(db, 'employees'), limit(50));
  qSub = query(collection(db, 'onboarding_submissions'), limit(50));
} else {
  const creatorId = auth.currentUser?.uid || authUser.id;
  const targetRecruiterIds = Array.from(new Set([authUser.id, creatorId, (authUser as any)?.username])).filter(Boolean);
  qEmp = query(collection(db, 'employees'), where('recruitedBy', 'in', targetRecruiterIds.slice(0, 10)), limit(50));
  qSub = query(collection(db, 'onboarding_submissions'), where('recruitedBy', 'in', targetRecruiterIds.slice(0, 10)), limit(50));
}
```
1. **Silent Data Truncation at 50 Random Records:** In the `if` branch (`isSuperAdmin || INVITES_VIEW_ALL || INVITES_MANAGE`), `query(collection(db, 'employees'), limit(50))` fetches only the first 50 employee documents in Firestore by document ID without any `where` filter, and then filters in memory on line `384` (`if (hasInvite || data.recruitedBy)`). Once the database has more than 50 employees, referred employees outside the first 50 document IDs are silently dropped from both the **"Referred Candidates"** tab and the per-invite **`Pending` / `Joined`** counts (`L1218–1221`).
2. **Permission Mismatch for `INVITES_VIEW_ALL` / `INVITES_MANAGE`:** Non-SuperAdmin staff with `INVITES_VIEW_ALL` or `INVITES_MANAGE` who do not also hold `EMPLOYEES_VIEW_SCOPE_ALL` / `SUBMISSIONS_VIEW_SCOPE_ALL` cannot run unscoped queries across all sites once site isolation (`UDF-AUD-06`) is enforced in `firestore.rules`.

#### Real-World Impact
The "Referred Candidates" tab and the `Pending` / `Joined` pipeline counters on `AdminInvitesPage` show inaccurate/zero counts for any referred employee not in the first 50 Firestore document IDs.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/components/AdminInvitesPage.tsx
+++ b/components/AdminInvitesPage.tsx
@@ -325,6 +325,6 @@
         if (isSuperAdmin || hasPermission(Permission.INVITES_VIEW_ALL) || hasPermission(Permission.INVITES_MANAGE)) {
-          qEmp = query(collection(db, 'employees'), limit(50));
-          qSub = query(collection(db, 'onboarding_submissions'), limit(50));
+          qEmp = query(collection(db, 'employees'), where('recruitedBy', '!=', null), limit(200));
+          qSub = query(collection(db, 'onboarding_submissions'), where('recruitedBy', '!=', null), limit(200));
         } else {
```

### UDF-AUD-23 (`MEDIUM` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `components/AdminSiteManagementPage.tsx:93–106`, `src/services/employeeService.ts:242–268`

#### Root Cause & Exact Code Trace
When an admin clicks **"View Personnel"** on any site card in `components/AdminSiteManagementPage.tsx:98–105`, it calls:
```ts
// components/AdminSiteManagementPage.tsx:98–105
const result = await getPaginatedEmployees(
  'ACTIVE',
  50,
  undefined,
  unitField?.id,
  viewingSite.name
);
```
However, `getPaginatedEmployees` in `src/services/employeeService.ts:242–268` ignores `filterField` (`unitField?.id`) and hardcodes:
```ts
// src/services/employeeService.ts:266–268
if (filterValue && filterValue !== 'ALL') {
  constraints.push(where('currentSiteId', '==', filterValue));
}
```
Because `employees` documents store the site ID (`viewingSite.id`, e.g. `'site-wipro'`) in `currentSiteId` rather than `viewingSite.name` (`'WIPRO'`), `where('currentSiteId', '==', viewingSite.name)` never matches any employee record.

#### Real-World Impact
The "View Personnel" modal in Site Management always displays *"No active employees recorded at this site yet."* (`0` employees) for every site whose `id !== name`.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/components/AdminSiteManagementPage.tsx
+++ b/components/AdminSiteManagementPage.tsx
@@ -98,7 +98,7 @@
         const result = await getPaginatedEmployees(
           'ACTIVE',
           50,
           undefined,
           unitField?.id,
-          viewingSite.name
+          viewingSite.id
         );
```

### UDF-AUD-24 (`MEDIUM` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `utils/exportUtils.ts:50, 66–76`

#### Root Cause & Exact Code Trace
In `utils/exportUtils.ts:50, 66–76`:
```ts
// utils/exportUtils.ts:50, 66–76
const data = emp.data || {};
...
activeFields.forEach(field => {
  let val = data[field.id];
  if (val === undefined || val === null) {
    val = '';
  } else if (Array.isArray(val)) {
    val = val.join('; ');
  } else if (typeof val === 'boolean') {
    val = val ? 'Yes' : 'No';
  }
  row.push(String(val));
});
```
1. Approved `FirestoreEmployee` documents store form fields in `emp.profileData` or `emp.formData`, so `const data = emp.data || {};` misses all fields stored under `profileData` when `emp.data` is absent.
2. File-upload fields stored as objects (`{ storagePath: "employees/...", driveUrl: "..." }`) fall through to `String(val)` and output literal `"[object Object]"` into the Excel sheet.
3. Cell strings starting with `=`, `+`, `-`, or `@` are not prefixed with `'`, allowing CSV/Excel formula injection if an applicant enters a formula in a text field.

#### Real-World Impact
Exported employee Excel sheets contain blank columns for `profileData`-backed records, `"[object Object]"` in all document columns, and unsanitized formula strings.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/utils/exportUtils.ts
+++ b/utils/exportUtils.ts
@@ -49,3 +49,3 @@
   const rows = employees.map(emp => {
-    const data = emp.data || {};
+    const data = { ...((emp as any).formData || {}), ...((emp as any).profileData || {}), ...(emp.data || {}) };
     const siteName = resolveSiteName(data);
@@ -66,11 +66,16 @@
     // Dynamic Form Fields
     activeFields.forEach(field => {
       let val = data[field.id];
       if (val === undefined || val === null) {
         val = '';
       } else if (Array.isArray(val)) {
         val = val.join('; ');
       } else if (typeof val === 'boolean') {
         val = val ? 'Yes' : 'No';
+      } else if (typeof val === 'object') {
+        val = val.driveUrl || val.storagePath || val.url || '';
       }
-      row.push(String(val));
+      const strVal = String(val);
+      row.push(/^[=+\-@]/.test(strVal) ? `'${strVal}` : strVal);
     });
```

### UDF-AUD-25 (`CRITICAL` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `functions/index.js:7587–7755`, `src/utils/bulkImportUtils.ts:791–805`, `src/services/employeeService.ts:1314, 1333`

#### Root Cause & Exact Code Trace
In `src/utils/bulkImportUtils.ts:791–802`, `bulkImportEmployees` calls `bulkImportEmployeesServer` first (`L796`), passing only `options: { generateIds, overwriteMode, idPrefix }` (omitting `importMode`, `defaultStatus`, and `formSections`), and returns early on line `801` (`if (res.data && res.data.success) return res.data;`), completely bypassing all client-side field mapping (`L807–1025`).

Inside `bulkImportEmployeesServer` (`functions/index.js:7697–7755`):
```js
// functions/index.js:7697–7736
const employeeRecord = {
    employeeId: empId,
    portalId: submissionId,
    fullName: row.fullName,
    siteName: siteName,
    currentSiteId: siteId,
    ...
    profileData: row.formData || {},
};
...
batch.set(db.collection('employees').doc(empId), employeeRecord, { merge: true });
batch.set(db.collection('onboarding_submissions').doc(submissionId), submissionRecord, { merge: true });
```
1. **100% Invisible in Master Employee List (`needsProfileCompletion` Missing):** `bulkImportEmployeesServer` never sets `needsProfileCompletion` on `employeeRecord`. In `getPaginatedEmployees('ACTIVE')` (`src/services/employeeService.ts:1314`), the query filters `where("needsProfileCompletion", "in", [false, null])`. In Firestore, `in [false, null]` **excludes documents where the field does not exist**, so zero server-imported employees ever appear in either the `ACTIVE` or `PENDING` (`where("needsProfileCompletion", "==", true)`) tabs of the Master Employee List!
2. **Broken Site-Scoped Queries:** It never sets `assignedSiteIds: siteId ? [siteId] : []` or `activeAssignments`, so site-scoped staff queries (`where("assignedSiteIds", "array-contains-any", ...)`) also return `0` results.
3. **Dropped Form Data:** `BulkImportModal.tsx` passes flat CSV headers on each `row` (not `row.formData`), so `row.formData` on `L7718` is `undefined`, and `data` is never written.
4. **Broken Document ID Invariant:** Line `7735` writes to `db.collection('employees').doc(empId)` (e.g. `HY123456`) while line `7736` writes to `db.collection('onboarding_submissions').doc(submissionId)` (`UDF-...`), breaking the `employees/{submissionId}` 1:1 document-ID invariant assumed by `employeeLogin`, `approveOnboardingServer`, and `firestore.rules`.
5. **Wrong Default Password Format:** Line `7694` computes `${row.fullName.split(' ')[0]}@${rawPhone || rawDob.slice(0, 4)}` (preserving uppercase and using `@` + full phone digits) instead of the documented lowercase `firstnameYYYY@last4` format generated by `generateDefaultPassword` (`bulkImportUtils.ts:527–540`).

#### Real-World Impact
Every employee imported via the Bulk Import feature disappears from the Master Employee List, has empty form data, cannot log in with the documented default password format, and breaks portal ID lookups.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -7690,29 +7690,41 @@
             // Password Generation: FirstName + BirthYear + @ + Last4Phone
             const rawPhone = String(row.phone || '').replace(/\D/g, '');
             const rawDob = String(row.dob || '');
-            const defaultPassword = `${row.fullName.split(' ')[0]}@${rawPhone || rawDob.slice(0, 4)}`;
+            const cleanFirst = String(row.fullName || '').trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user';
+            const yearMatch = rawDob.match(/\b(19\d{2}|20\d{2})\b/);
+            const birthYear = yearMatch ? yearMatch[1] : '2000';
+            const last4 = rawPhone.length >= 4 ? rawPhone.slice(-4) : '0000';
+            const defaultPassword = `${cleanFirst}${birthYear}@${last4}`;
             const passwordHash = hashPassword(defaultPassword);
+            const needsCompletion = options.importMode !== 'COMPLETE';
 
             const employeeRecord = {
+                id: submissionId,
                 employeeId: empId,
                 portalId: submissionId,
+                uid: submissionId,
                 fullName: row.fullName,
                 siteName: siteName,
                 currentSiteId: siteId,
+                assignedSiteIds: siteId ? [siteId] : [],
+                needsProfileCompletion: needsCompletion,
                 phone: rawPhone,
                 dob: rawDob,
                 email: row.email || '',
                 designation: row.designation || 'Security Guard',
                 joiningDate: row.joiningDate || new Date().toISOString().split('T')[0],
                 status: 'Approved',
                 isActive: true,
                 isRelieved: false,
                 passwordHash: passwordHash,
                 createdAt: admin.firestore.FieldValue.serverTimestamp(),
                 updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                 createdBy: uid,
                 importBatchId: `BATCH-${Date.now()}`,
+                data: row.formData || {},
                 profileData: row.formData || {},
             };
@@ -7734,3 +7746,3 @@
-            batch.set(db.collection('employees').doc(empId), employeeRecord, { merge: true });
+            batch.set(db.collection('employees').doc(submissionId), employeeRecord, { merge: true });
             batch.set(db.collection('onboarding_submissions').doc(submissionId), submissionRecord, { merge: true });
```

### UDF-AUD-26 (`CRITICAL` | `Security Vulnerability`)
**Target Files & Lines:** `firestore.rules:238–240`, `src/services/employeeService.ts:972, 992`, `functions/index.js:5322`

#### Root Cause & Exact Code Trace
1. **Unvalidated Client `create`/`update` on `onboarding_submissions` (`firestore.rules:238–240`):**
   ```javascript
   // firestore.rules:238–240
   allow create: if isAuthenticated();
   allow update: if canAdminManageEmployees() 
     || (isAuthenticated() && (resource.id == request.auth.uid || resource.data.uid == request.auth.uid || resource.data.linkedUid == request.auth.uid));
   ```
   Unlike `leave_requests`, `account_updates`, and `resignations`, `onboarding_submissions` enforces **no field or status restrictions** when a candidate creates or updates their own submission. Any authenticated user (including an anonymous Firebase session) can set `status: 'Approved'`, `currentLevel: 99`, `employeeId: 'HY100001'`, `duplicateCheck: { isDuplicate: false }`, or overwrite their `formData` after approval.
2. **Guest Submissions Pollute `linkedUid` with Ephemeral Anonymous Auth UIDs (`src/services/employeeService.ts:972, 992`):**
   ```ts
   // src/services/employeeService.ts:972, 992
   const authProvider = linkedUid ? 'google' : 'manual';
   ...
   linkedUid: auth.currentUser?.uid || null,
   authProvider: authProvider,
   ```
   When a candidate submits the onboarding form in **Guest Mode** (`linkedUid` parameter is `undefined`), `ensureAuthenticated()` signs them in via `signInAnonymously()`. Because line `992` writes `linkedUid: auth.currentUser?.uid || null` instead of `linkedUid: linkedUid || null`, every Guest submission records the ephemeral anonymous UID in `linkedUid`. When approved in `approveOnboardingServer` (`functions/index.js:5322`), `uid: subData.linkedUid || subData.uid || submissionId` sets the permanent employee's `uid` to that dead anonymous UID instead of `submissionId`.

#### Real-World Impact
Any anonymous user can forge or self-approve an `onboarding_submissions` document directly via the Firestore SDK, and every legitimate Guest onboarding submission stores a disposable anonymous Auth UID as its `linkedUid` and approved `employees.uid`.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -238,3 +238,6 @@
-      allow create: if isAuthenticated();
+      allow create: if canAdminManageEmployees()
+        || (isAuthenticated() && request.resource.data.status == 'Pending');
       allow update: if canAdminManageEmployees() 
-        || (isAuthenticated() && (resource.id == request.auth.uid || resource.data.uid == request.auth.uid || resource.data.linkedUid == request.auth.uid));
+        || (isAuthenticated()
+            && (resource.id == request.auth.uid || resource.data.uid == request.auth.uid || resource.data.linkedUid == request.auth.uid)
+            && resource.data.status in ['Pending', 'Returned', 'Draft']
+            && request.resource.data.status == 'Pending'
+            && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['employeeId', 'approvedBy', 'approvedAt', 'currentLevel', 'approvalHistory']));
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -991,3 +991,3 @@
       uid: submissionId, // Initially set to submissionId (the future Portal ID)
-      linkedUid: auth.currentUser?.uid || null,
+      linkedUid: linkedUid || (auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.uid : null),
       authProvider: authProvider,
```

### UDF-AUD-27 (`HIGH` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `components/EmployeeDashboardPage.tsx:189`, `src/contexts/DataContext.tsx:242, 278`, `components/employee/EmployeeLeaveRequestPage.tsx:39, 47, 52, 114`

#### Root Cause & Exact Code Trace
1. **`employeeId` vs `portalId` Lookup Mismatch:**
   In `src/contexts/DataContext.tsx:278`, `leaveBalances` entries are constructed with `employeeId: emp.employeeId` (the badge ID, e.g. `"HY123456"`). However, `components/EmployeeDashboardPage.tsx:189` renders:
   ```tsx
   // components/EmployeeDashboardPage.tsx:189
   <EmployeeLeaveRequestPage employeeId={authUser?.id || ''} employeeName={authUser?.name || ''} />
   ```
   Because `employeeLogin` and `employeeGoogleLogin` mint custom tokens with `uid = portalId` (`"UDF-..."`), `authUser.id` is `"UDF-..."` while `emp.employeeId` is `"HY123456"`. In `components/employee/EmployeeLeaveRequestPage.tsx:47`:
   ```ts
   const currentBalance = leaveBalances.find(b => b.employeeId === employeeId) || null;
   ```
   `"HY123456" === "UDF-..."` evaluates to `false`, so `currentBalance` is always `null` and `getBalance(type)` (`L51`) returns `{ total: 0, used: 0, remaining: 0 }`.
2. **`lt.label` vs `lt.typeId` Key Mismatch:**
   Even when `currentBalance` is matched, `DataContext.tsx:242` populates `policyBalances` using `lt.label` (`policyBalances[lt.label] = { total: quota, used: 0 }`), whereas `EmployeeLeaveRequestPage.tsx:39, 52` initializes `leaveType` to `firstActive.typeId` and indexes `currentBalance.balances[type]` by `typeId`. For any custom leave type created in `AdminLeaveManagementPage` where `typeId !== label` (e.g. `typeId: "leave_1710000000"`, `label: "Maternity Leave"`), `currentBalance.balances[leaveType]` is `undefined` (`remaining: 0`), causing line `114` (`if (selectedTypeObj?.isPaid && days > balance.remaining)`) to block submission with *"Insufficient leave balance. You have 0 days remaining..."*.

#### Real-World Impact
Employees see `0` remaining leave balance across all leave cards and are blocked from submitting any paid leave request.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/components/EmployeeDashboardPage.tsx
+++ b/components/EmployeeDashboardPage.tsx
@@ -188,2 +188,2 @@
-      case 'leaves':
-        return <EmployeeLeaveRequestPage employeeId={authUser?.id || ''} employeeName={authUser?.name || ''} />;
+      case 'leaves':
+        return <EmployeeLeaveRequestPage employeeId={currentUserSubmission?.employeeId || authUser?.id || ''} employeeName={authUser?.name || ''} />;
--- a/src/contexts/DataContext.tsx
+++ b/src/contexts/DataContext.tsx
@@ -241,3 +241,4 @@
                     leavePolicy.leaveTypes.forEach(lt => {
                         const quota = Number(lt.annualQuota) || 0;
                         policyBalances[lt.label] = { total: quota, used: 0 };
+                        if (lt.typeId) policyBalances[lt.typeId] = { total: quota, used: 0 };
                     });
```

### UDF-AUD-28 (`HIGH` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `App.tsx:1413–1420`, `src/services/requestService.ts:181–202`, `firestore.rules:356–361`, `functions/index.js:5002–5010`

#### Root Cause & Exact Code Trace
1. **Infinite `relieveEmployee` Loop for Non-SuperAdmin Staff:**
   Whenever any Admin (`authUser.type === 'Admin'`) loads the portal, `App.tsx:1416` executes `processDueResignations(resignationRequests)` (`src/services/requestService.ts:181–202`):
   ```ts
   // src/services/requestService.ts:192–195
   for (const req of dueRequests) {
     await relieveEmployee(req.employeeId, req.relievingDate, 'Resignation');
     await setDoc(doc(db, RESIGNATION_COL, req.id), { isProcessed: true }, { merge: true });
   }
   ```
   While `relieveEmployee` calls `relieveEmployeeServer` (which succeeds for staff with `EMPLOYEES_ACTION_RELIEVE`), line `194` performs a direct client `setDoc` on `resignations/{id}` to set `isProcessed: true`. In `firestore.rules:356–361`, non-SuperAdmin staff are only permitted to update `resignations` when `resource.data.status == 'Pending'` and `!request.resource.data.diff(resource.data).affectedKeys().hasAny([..., 'isProcessed'])`. Because the resignation is already `'Approved'`, line `194` throws `PERMISSION_DENIED`, leaving `isProcessed` `false` so `relieveEmployee` re-executes on every snapshot update in an infinite loop.
2. **Incomplete Auto-Relieve in `processRequestReviewServer` (`functions/index.js:5002–5010`):**
   When a resignation with `relievingDate <= today` is final-approved in `processRequestReviewServer`, lines `5003–5009` only set `{ isActive: false, status: 'Relieved', isRelieved: true }` without clearing `assignedSiteIds: []`, marking `activeAssignments` as `'Relieved'`, or appending to `employmentHistory` (unlike `relieveEmployeeServer` at `L5555–5605`).

#### Real-World Impact
Any non-SuperAdmin admin opening the portal when a resignation comes due triggers repeated `relieveEmployeeServer` calls and console `PERMISSION_DENIED` errors on every snapshot, and server-side auto-relieved employees remain listed in site `assignedSiteIds` and `activeAssignments`.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -355,6 +355,8 @@
       allow update: if isSuperAdmin() 
+        || (hasPermission('EMPLOYEES_ACTION_RELIEVE')
+            && resource.data.status == 'Approved'
+            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isProcessed']))
         || (hasPermission('RESIGNATIONS_APPROVE') 
             && resource.data.status == 'Pending'
             && request.resource.data.status in ['Approved', 'Rejected']
             && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['employeeId', 'employeeName', 'siteName', 'reason', 'proposedLastDay', 'submittedAt', 'isProcessed']));
```

### UDF-AUD-29 (`HIGH` | `Security Vulnerability`)
**Target Files & Lines:** `functions/index.js:4793–4806, 4850–4921`

#### Root Cause & Exact Code Trace
In `processRequestReviewServer` (`functions/index.js:4795–4802, 4899–4921`):
```js
// functions/index.js:4798–4802
const modId = moduleMap[requestType];
if (!modId || !permissions.includes(`${modId}_APPROVE`)) {
    throw new HttpsError("permission-denied", `Lack permission to review ${requestType} requests.`);
}
...
// functions/index.js:4900
if (!isBypass && currentLevel < maxLevels) {
    updatePayload.currentLevel = currentLevel + 1;
```
1. **Unchecked `isBypass` Flag:** `processRequestReviewServer` accepts `isBypass` directly from `request.data` (`L4774`) and checks `if (!isBypass && currentLevel < maxLevels)` (`L4900`) without verifying `isSuperAdmin`. Any staff member with `LEAVES_APPROVE`, `RESIGNATIONS_APPROVE`, `ACCOUNT_UPDATES_APPROVE`, or `DISCIPLINARY_APPROVE` can pass `isBypass: true` to skip all higher approval levels.
2. **Missing Workflow Level `roleId` Check:** Even with `isBypass: false`, `processRequestReviewServer` never verifies that the caller's `roleId` matches `levels.find(l => l.level === currentLevel)?.roleId` from `settings/workflows`, allowing a Level 1 reviewer (e.g. Field Officer) to approve Level 2 (HR Manager) and Level 3 (Operations Manager) steps sequentially.

#### Real-World Impact
Any Level 1 approver can bypass multi-tier approval chains and unilaterally final-approve multi-level leave, resignation, bank-account, or disciplinary requests.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4881,6 +4881,14 @@
             let maxLevels = 1;
+            let requiredLevelRoleId = null;
             if (wfSnap.exists) {
                 const wfData = wfSnap.data();
                 const config = (wfData.configs || []).find(c => c.moduleId === wfModuleId);
                 if (config && config.isEnabled && Array.isArray(config.levels) && config.levels.length > 0) {
                     maxLevels = config.levels.length;
+                    const levelCfg = config.levels.find(l => Number(l.level) === Number(currentLevel));
+                    requiredLevelRoleId = levelCfg ? levelCfg.roleId : null;
                 }
             }
+            if (isBypass && !isSuperAdmin) {
+                throw new HttpsError("permission-denied", "Only SuperAdmin can bypass workflow levels.");
+            }
+            if (!isSuperAdmin && requiredLevelRoleId && callerRoleId !== requiredLevelRoleId) {
+                throw new HttpsError("permission-denied", `Level ${currentLevel} requires role ${requiredLevelRoleId}.`);
+            }
```

### UDF-AUD-30 (`HIGH` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `firestore.rules:57–68, 145, 150, 178–182, 411–414, 428–431, 496–498`

#### Root Cause & Exact Code Trace
Multiple granular RBAC permissions defined in `types.ts` and assignable via `AdminRoleManagementPage.tsx` are omitted from `firestore.rules`:
1. **`canAdminManageEmployees()` (`firestore.rules:57–68`):** Checks only `SUBMISSIONS_APPROVE`, `EMPLOYEES_DELETE`, `EMPLOYEES_ACTION_RELIEVE`, `EMPLOYEES_ACTION_REJOIN`, `EMPLOYEES_PROMOTE`, and `EMPLOYEES_MANAGE_SITES`. It omits `EMPLOYEES_EDIT_PROFILE`, `EMPLOYEES_CORRECT_ID`, `EMPLOYEES_ACTION_RESTORE`, `SUBMISSIONS_REJECT`, `SUBMISSIONS_ADD_COMMENTS`, `SUBMISSIONS_EDIT_COMMENTS`, `SUBMISSIONS_REVERT_DECISION`, `SUBMISSIONS_ASSIGN_EMPLOYEE_ID`, and `SUBMISSIONS_CREATE_CORRECTION_LINK`.
2. **`match /roles/{roleId}` (`L413`) and `match /settings/roles` (`L145`):** Require `isSuperAdmin()` instead of `isSuperAdmin() || hasPermission('MANAGE_ROLES')`.
3. **`match /staff_accounts/{userId}` (`L180–181`):** Requires `isSuperAdmin()` for `create`, `delete`, and cross-staff `update` instead of `isSuperAdmin() || hasPermission('MANAGE_STAFF')`.
4. **`match /correction_requests/{id}` (`L496–497`):** Checks only `isAdmin() || hasPermission('SUBMISSIONS_APPROVE')`, omitting `hasPermission('SUBMISSIONS_CREATE_CORRECTION_LINK')`, `hasPermission('SUBMISSIONS_VIEW_CORRECTION_LINKS')`, and `hasPermission('EMPLOYEES_REQUEST_CORRECTION')`.
5. **`match /settings/{docId}` (`L150`) and `match /leave_policy/{id}` (`L430`):** Check only `hasPermission('LEAVES_APPROVE')` instead of `hasPermission('LEAVES_APPROVE') || hasPermission('LEAVES_MANAGE_BALANCES')`.

#### Real-World Impact
Staff assigned custom roles with these specific permissions (without full `SUBMISSIONS_APPROVE` or `isSuperAdmin`) receive `PERMISSION_DENIED` from Firestore when using the corresponding UI buttons that are enabled for their role.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -57,12 +57,21 @@
     function canAdminManageEmployees() {
       return isAdmin() || 
              hasPermission('SUBMISSIONS_APPROVE') || 
+             hasPermission('SUBMISSIONS_REJECT') ||
+             hasPermission('SUBMISSIONS_ADD_COMMENTS') ||
+             hasPermission('SUBMISSIONS_EDIT_COMMENTS') ||
+             hasPermission('SUBMISSIONS_REVERT_DECISION') ||
+             hasPermission('SUBMISSIONS_ASSIGN_EMPLOYEE_ID') ||
+             hasPermission('SUBMISSIONS_CREATE_CORRECTION_LINK') ||
+             hasPermission('EMPLOYEES_EDIT_PROFILE') ||
+             hasPermission('EMPLOYEES_CORRECT_ID') ||
              hasPermission('EMPLOYEES_DELETE') || 
+             hasPermission('EMPLOYEES_ACTION_RESTORE') ||
              hasPermission('EMPLOYEES_ACTION_RELIEVE') || 
              hasPermission('EMPLOYEES_ACTION_REJOIN') || 
              hasPermission('EMPLOYEES_PROMOTE') || 
              hasPermission('EMPLOYEES_MANAGE_SITES');
     }
@@ -144,8 +153,8 @@
       allow write: if isSuperAdmin()
-        || (docId == 'form_config' && hasPermission('MANAGE_FORM_BUILDER'))
+        || (docId == 'roles' && hasPermission('MANAGE_ROLES'))
+        || (docId == 'form_config' && hasPermission('MANAGE_FORM_BUILDER'))
         || (docId == 'website_content' && hasPermission('MANAGE_CONTENT'))
         || (docId == 'workflows' && hasPermission('MANAGE_WORKFLOWS'))
         || (docId == 'engagement_config' && hasPermission('ENGAGEMENT_CONFIGURE'))
-        || (docId == 'leave_policy' && hasPermission('LEAVES_APPROVE'));
+        || (docId == 'leave_policy' && (hasPermission('LEAVES_APPROVE') || hasPermission('LEAVES_MANAGE_BALANCES')));
```

### UDF-AUD-31 (`MEDIUM` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `src/services/employeeService.ts:4194–4220`

#### Root Cause & Exact Code Trace
In `src/services/employeeService.ts:4194–4220`, `getSiteHeadcounts` computes each site's active headcount using:
```ts
// src/services/employeeService.ts:4205–4209
const q = query(
    collection(db, EMPLOYEES_COLLECTION),
    where("isActive", "==", true),
    where(`data.${unitField.id}`, "==", site.name)
);
```
However, when an employee is assigned or transferred via `assignToSite` (`employeeService.ts:2931`), relieved from a site via `relieveFromSite` (`L3066`), promoted to a new site via `promoteEmployeeServer` (`functions/index.js:7528`), approved into a site via `approveOnboardingServer` (`L5327`), or imported via `bulkImportEmployeesServer` (`L7701`), only `currentSiteId`, `siteName`, and `assignedSiteIds` are updated—`data[unitField.id]` is either absent (`profileData` / `formData`) or holds the employee's initial onboarding answer.

#### Real-World Impact
Site headcount badges on `AdminDashboardPage` and `AdminSiteManagementPage` undercount or miscount active employees whenever employees are transferred, promoted, or bulk-imported.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4204,7 +4204,7 @@
         const promises = activeSites.map(async (site) => {
             const q = query(
                 collection(db, EMPLOYEES_COLLECTION),
                 where("isActive", "==", true),
-                where(`data.${unitField.id}`, "==", site.name)
+                where("currentSiteId", "==", site.id)
             );
             const snapshot = await getCountFromServer(q);
```

### UDF-AUD-32 (`MEDIUM` | `Broken Feature / Functional Bug`)
**Target Files & Lines:** `App.tsx:1001, 1183–1197`, `components/EmployeeFormPage.tsx:2178–2180`, `src/services/employeeService.ts:815, 887–891`

#### Root Cause & Exact Code Trace
1. **Unhandled `undefined` Return When Read-Only Mode (`checkWritesBlock`) Blocks Form Submission:**
   In `App.tsx:1001`, `handleEmployeeFormSubmit` begins with:
   ```ts
   // App.tsx:1001
   if (checkWritesBlock()) return;
   ```
   When `systemLock.blockWrites` is active, `handleEmployeeFormSubmit` returns `undefined`. However, `components/EmployeeFormPage.tsx:2178–2180` immediately dereferences `result.success`:
   ```ts
   // components/EmployeeFormPage.tsx:2178–2180
   const result = await onFormSubmit(finalSubmissionData, userIdToPass, linkedEmail);
   if (result.success) { // <-- Throws TypeError: Cannot read properties of undefined (reading 'success')
   ```
   Because `EmployeeFormPage.tsx:2204` has no `catch` or `finally` block around `onFormSubmit`, the unhandled rejection leaves `showSubmissionProgress` stuck open on screen.
2. **Missing `submissionId` (`customFolder`) on Final `File` Uploads in `submitEmployeeForm`:**
   In `src/services/employeeService.ts:815, 887–891`, `submitEmployeeForm` generates `submissionId` at line `815`, but calls `uploadSubmissionDocument(key, value, onProgress)` at line `887` without passing `submissionId` as the 4th argument (`customFolder`). If `sessionStorage.getItem('onboarding_savedDraftId')` is empty, `uploadSubmissionDocument` uploads the file to `onboarding/${uid}/...` instead of `onboarding/${submissionId}/...`.

#### Real-World Impact
Enabling Emergency Read-Only Mode causes candidate form submissions to crash with an uncaught `TypeError` and a frozen progress modal, and any un-uploaded `File` object passed to `submitEmployeeForm` without a session draft ID is uploaded under the temporary Auth `uid` folder rather than `submissionId`.

#### Exact Copy-Paste `diff` Remediation Block
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -1000,3 +1000,3 @@
   const handleEmployeeFormSubmit = async (formData: Record<string, any>, linkedUid?: string, linkedEmail?: string): Promise<{ success: boolean; submissionId?: string; error?: string }> => {
-    if (checkWritesBlock()) return;
+    if (checkWritesBlock()) return { success: false, error: 'System is currently in Read-Only maintenance mode.' };
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -886,3 +886,3 @@
         const uploadPromise = (async () => {
-          const uploadedMeta = await uploadSubmissionDocument(key, value, onProgress);
+          const uploadedMeta = await uploadSubmissionDocument(key, value, onProgress, submissionId);
           processedData[key] = uploadedMeta;
```


---

### `UDF-AUD-33` — Missing `ignoreUndefinedProperties: true` in `initializeFirestore` Causes Fatal `FirebaseError: Unsupported field value: undefined` Across 5 Portal Workflows
- **Severity:** `CRITICAL`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/firebase/config.ts:44–46`
  - `components/AdminMasterEmployeeListPage.tsx:1794–1802`
  - `components/AdminDisciplinaryPage.tsx:76–86`
  - `components/employee/EmployeeAccountUpdatePage.tsx:50–55, 105–113`
  - `components/AdminWorkflowConfigPage.tsx:374, 380`
  - `src/services/requestService.ts:19–36`
  - `src/services/employeeService.ts:3021–3022`

#### Root Cause & Exact Code Trace
In `src/firebase/config.ts:44–46`, Firestore is initialized without `ignoreUndefinedProperties: true`:
```ts
export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
});
```
Because the Firebase JS SDK rejects `undefined` values inside `setDoc()`, `updateDoc()`, and `arrayUnion()` unless `ignoreUndefinedProperties: true` is enabled, 5 everyday portal actions throw an uncaught `FirebaseError: Function setDoc()/updateDoc() called with invalid data. Unsupported field value: undefined`:
1. **Assigning an Employee to a Site without a Sub-Unit (`AdminMasterEmployeeListPage.tsx:1794–1802`)**: builds `newAsgn` with `subUnitId: newAssignmentSubUnitId || undefined` and `subUnitName: selectedSubUnit ? selectedSubUnit.name : undefined`, then passes it to `assignToSite` (`employeeService.ts:2969`), which calls `updateDoc(empRef, { activeAssignments: [...existingAssignments, newAssignment] })`.
2. **Issuing a Disciplinary Action without an Optional File or Site (`AdminDisciplinaryPage.tsx:76–86` & `requestService.ts:19–36`)**: sets `siteId: (empInfo as any)?.siteId || undefined` and `document: supportingDoc || undefined`; `uploadFilesInObject` (`requestService.ts:32`) copies `undefined` properties directly into `safe` before calling `setDoc(doc(db, 'disciplinary_actions', action.id), safe)`.
3. **Submitting an Employee Account Update for a Blank Field or Without a Supporting Document (`EmployeeAccountUpdatePage.tsx:54, 109, 112`)**: sets `currentValue: currentFieldValue` (which is `undefined` for any field not yet populated in `employeeData.data`) and `supportingDocument: supportingDoc || undefined`.
4. **Client Fallback Promotion without Site (`employeeService.ts:3021–3022`)**: sets `siteId: newSiteId || empData.currentSiteId || undefined` and `siteName: newSiteName || empData.siteName || undefined` inside `arrayUnion(promotionRecord)`.
5. **Clearing Min/Max Length in Client ID Library (`AdminWorkflowConfigPage.tsx:374, 380`)**: sets `minLength: e.target.value ? parseInt(e.target.value) : undefined` and `maxLength: e.target.value ? parseInt(e.target.value) : undefined` before calling `setDoc(doc(db, 'settings', 'portal_config'), config)`.

#### Real-World Impact
Assigning an employee to a site that has no sub-units, issuing a disciplinary warning without an attachment, submitting an account update for an empty field, or clearing Client ID min/max length crashes immediately on the client with `Unsupported field value: undefined`.

#### Remediation (`diff`)
```diff
--- a/src/firebase/config.ts
+++ b/src/firebase/config.ts
@@ -43,4 +43,5 @@
 export const db = initializeFirestore(app, {
     experimentalAutoDetectLongPolling: true,
+    ignoreUndefinedProperties: true,
 });
```

---

### `UDF-AUD-34` — Employee "Request Account Updates" Page Always Shows *"No fields are currently configured as editable by the Admin"* for 100% of Employees
- **Severity:** `CRITICAL`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/employee/EmployeeAccountUpdatePage.tsx:31–44, 50–55, 214–220`
  - `functions/index.js:5320–5357, 7697–7720`
  - `components/EmployeeDashboardPage.tsx:200–209`

#### Root Cause & Exact Code Trace
In `components/employee/EmployeeAccountUpdatePage.tsx:31–44`, the dropdown of editable fields is computed exclusively from `employeeData?.originalFormSections`:
```ts
const editableFields = useMemo(() => {
    const fields: (FormField & { sectionTitle: string })[] = [];
    (employeeData?.originalFormSections || []).forEach(section => {
        if (section.isAdminOnly) return;
        section.fields.forEach(field => {
            if (!field.isSystem && field.isEditableByEmployee !== false) {
                fields.push({ ...field, sectionTitle: section.title });
            }
        });
    });
    return fields;
}, [employeeData]);
```
However, `employeeData` is the employee's document from the `employees` collection (`DataContext.tsx:520`). Neither `approveOnboardingServer` (`functions/index.js:5320–5357`) nor `bulkImportEmployeesServer` (`functions/index.js:7697–7720`) saves `originalFormSections` onto the `employees` document, and `EmployeeDashboardPage.tsx:200–209` never passes `formSections` from `DataContext` into `<EmployeeAccountUpdatePage>`. Consequently, `employeeData?.originalFormSections` is always `undefined`, `editableFields` is always `[]`, and line `235` permanently renders *"No fields are currently configured as editable by the Admin"*. Additionally, `displayValue` (`L214–220`) converts file objects (`{ storagePath, driveUrl }`) via `String(val)` into `"[object Object]"`.

#### Real-World Impact
No employee in the portal (whether onboarded through the wizard or bulk-imported via Excel) can ever submit an Account Update Request (bank account change, phone number update, address change, etc.).

#### Remediation (`diff`)
```diff
--- a/components/employee/EmployeeAccountUpdatePage.tsx
+++ b/components/employee/EmployeeAccountUpdatePage.tsx
@@ -8,6 +8,7 @@
 import Textarea from '../common/Textarea';
 import { Edit, Send, FileText, Info } from 'lucide-react';
+import { useData } from '../../src/contexts/DataContext';
 
 interface EmployeeAccountUpdatePageProps {
@@ -21,6 +22,7 @@
 const EmployeeAccountUpdatePage: React.FC<EmployeeAccountUpdatePageProps> = ({
   employeeId, employeeData, existingRequests, onSubmitRequest, allowedFieldIds = [], roles, workflowConfigs
 }) => {
+  const { sections: contextSections } = useData();
   const [selectedFieldId, setSelectedFieldId] = useState<string>('');
@@ -31,14 +33,17 @@
   const editableFields = useMemo(() => {
     const fields: FormField[] = [];
-    (employeeData?.originalFormSections || []).forEach(section => {
+    const sourceSections = (employeeData?.originalFormSections && employeeData.originalFormSections.length > 0)
+      ? employeeData.originalFormSections
+      : (contextSections || []);
+    sourceSections.forEach(section => {
       (section.fields || []).forEach(field => {
         // Filter based on allowedFieldIds passed from App config
         if (allowedFieldIds.includes(field.id)) {
           if (!fields.find(f => f.id === field.id)) {
             fields.push(field);
           }
         }
       });
     });
     return fields.sort((a, b) => a.label.localeCompare(b.label));
-  }, [employeeData?.originalFormSections, allowedFieldIds]);
+  }, [employeeData?.originalFormSections, contextSections, allowedFieldIds]);
```

---

### `UDF-AUD-35` — Broken Prop Wiring (`onUpdateId` vs `onUpdateSubmissionId` and Missing `onSyncDrive`) Makes "Correct Employee Number" and "Backup Now / Re-Sync" Silent No-Ops
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `App.tsx:2312`
  - `components/AdminPortalPage.tsx:121, 196, 499–526, 650`
  - `components/AdminMasterEmployeeListPage.tsx:1361–1367, 1488–1494`
  - `src/services/employeeService.ts:2326–2342`

#### Root Cause & Exact Code Trace
1. `App.tsx:2312` passes `onUpdateId: handleUpdateSubmissionId` inside `adminProps`.
2. `AdminPortalPage.tsx:121, 196` declares and destructures `onUpdateSubmissionId` (instead of `onUpdateId`), which evaluates to `undefined`. It then passes `onUpdateId={onUpdateSubmissionId}` (`undefined`) to `<AdminReviewSubmissionsPage>` (`L650`) and **completely omits both `onUpdateId` and `onSyncDrive`** when rendering `<AdminMasterEmployeeListPage>` (`L499–526`).
3. Inside `AdminMasterEmployeeListPage.tsx`, clicking **"Update"** under *"Correct Employee Number"* (`L1362`: `if (newIdValue.trim() && onUpdateId)`) or clicking **"Backup Now / Re-Sync"** under *"Drive Backup Status"* (`L1489`: `if (onSyncDrive)`) silently does nothing because both props are `undefined`.
4. Even when `updateSubmissionEmployeeId` (`employeeService.ts:2326–2342`) is called, it updates `employeeId` on `onboarding_submissions` and `employees` without renaming the Google Drive folder (`renameEmployeeFolder`) or updating `driveFolderName`.

#### Real-World Impact
Admins cannot correct an employee's badge ID or trigger a manual Google Drive backup/re-sync from either the Master Employee List or the Submission Review page.

#### Remediation (`diff`)
```diff
--- a/components/AdminPortalPage.tsx
+++ b/components/AdminPortalPage.tsx
@@ -118,7 +118,7 @@
   onDownloadFiles: (submission: Submission) => Promise<void>;
   onApproveProfileCompletion?: (submissionId: string) => Promise<void>;
   onSyncDrive?: (submissionId: string) => Promise<void>;
-  onUpdateSubmissionId?: (submissionId: string, newEmployeeId: string) => Promise<void>;
+  onUpdateId?: (submissionId: string, newEmployeeId: string) => Promise<void>;
   onDeleteInvite?: (inviteId: string) => Promise<void>;
@@ -193,7 +193,7 @@
   onDownloadFiles,
   onApproveProfileCompletion,
   onSyncDrive,
-  onUpdateSubmissionId,
+  onUpdateId,
   onDeleteInvite,
@@ -518,6 +518,8 @@
           onApproveProfileCompletion={onApproveProfileCompletion}
           onAssignSite={onAssignSite}
           onTransferSite={onTransferSite}
+          onUpdateId={onUpdateId}
+          onSyncDrive={onSyncDrive}
           sites={sites}
           subUnits={subUnits}
           designations={designations}
@@ -647,7 +649,7 @@
           onEditSubmission={onEditSubmission}
           onDownloadFiles={onDownloadFiles}
           onSyncDrive={onSyncDrive}
-          onUpdateId={onUpdateSubmissionId}
+          onUpdateId={onUpdateId}
           onRevertSubmission={onRevertSubmission}
```

---

### `UDF-AUD-36` — Re-Hiring a Relieved Employee with a New Employee ID (`rejoinEmployeeServer` Path A) Leaves Firebase Auth Disabled, Pollutes `linkedUid`/`linkedGoogleEmail` on the Old Relieved Record (Blocking Google Login), Omits `onboarding_submissions`, and Breaks Storage Access
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:5583–5592, 5692–5803`
  - `src/services/employeeService.ts:2766–2860`

#### Root Cause & Exact Code Trace
When an employee is relieved (`relieveEmployeeServer`, `functions/index.js:5587`), their Firebase Auth account (`linkedUid` or `empDocId`) is disabled (`admin.auth().updateUser(uidToDisable, { disabled: true })`).
When that employee is later re-hired with a **New Employee ID** (`rejoinEmployeeServer` Path A, `functions/index.js:5693–5803`):
1. Unlike Path B (`L5866`), Path A **never re-enables the Firebase Auth user** (`disabled: true` remains on their Auth UID) and sets `uid: ''` (`L5723`).
2. Because `newEmployeeData = { ...origData, uid: '', employeeId: cleanNewId, portalId: cleanNewId }` (`L5721–5725`), it copies `linkedUid` and `linkedGoogleEmail` from `origData` without clearing `linkedUid` / `linkedGoogleEmail` on the old relieved record (`origEmpSnap.ref`). When the re-hired employee attempts Google Login (`employeeGoogleLogin`, `L518–574`), the query `db.collection('employees').where('linkedUid', '==', uid).limit(1)` hits the old relieved record first and throws `permission-denied: Account is relieved/inactive.`.
3. Path A **never creates an `onboarding_submissions/{cleanNewId}` document**, leaving `currentUserSubmission` `null` in the Employee Portal.
4. Path A copies `origData.profileData` / `origData.data` referencing `employees/${oldSubmissionId}/joining/...`, which `getSecureDocumentURL` (`L2063–2125`) denies for the new identity (`token.uid = cleanNewId`).

#### Real-World Impact
Any relieved employee re-hired under a new Employee ID is locked out of Google Sign-In (`Account is relieved/inactive`), has no `onboarding_submissions` record in their Employee Portal, and cannot view any of their carried-over personal documents.

#### Remediation (`diff`)
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -5776,10 +5776,16 @@
         tx.update(origEmpSnap.ref, {
           rejoinedAsId: cleanNewId,
           rejoinedAt: now,
+          linkedUid: admin.firestore.FieldValue.delete(),
+          linkedGoogleEmail: admin.firestore.FieldValue.delete(),
           updatedAt: now
         });
       });
-
+      if (origData.linkedUid) {
+        await admin.auth().updateUser(origData.linkedUid, { disabled: false }).catch(() => {});
+      }
```

---

### `UDF-AUD-37` — Reverting an Approved Submission (`revertSubmissionWorkflow`) and Approving Profile Completion (`handleApproveProfileCompletion`) Corrupt Storage Paths and Leave All Employee Documents Broken (404)
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/services/employeeService.ts:2344–2409`
  - `App.tsx:2103–2188`

#### Root Cause & Exact Code Trace
- **Bug A (`revertSubmissionWorkflow`, `src/services/employeeService.ts:2359–2408`)**:
  When `approveOnboardingServer` (`functions/index.js:5263–5318`) approves a submission, it moves uploaded files from `onboarding/${submissionId}/{fieldId}/{file}` to `employees/${submissionId}/joining/${fieldId}/{file}` (keyed by **`submissionId`**, NOT `empId`, and nested under `/joining`) and rewrites `onboarding_submissions.formData` paths to `employees/${submissionId}/joining/...`.
  When an Admin clicks **"Revert to Pending"** (`revertSubmissionWorkflow`, `employeeService.ts:2368–2374`):
  1. It calls `moveStorageFiles('employees/' + empId, 'onboarding/' + submissionId)` where `empId = data.employeeId || submissionId` (e.g., `employees/HY10045` instead of `employees/${submissionId}/joining`), finding **0 files**.
  2. It deletes `employees/{submissionId}` (`L2362`) and **never rewrites `formData` / `data` `storagePath` values** on `onboarding_submissions/{submissionId}` back from `employees/${submissionId}/joining/...` to `onboarding/${submissionId}/...`.
- **Bug B (`handleApproveProfileCompletion`, `App.tsx:2123–2171`)**:
  1. When `subData.linkedUid` exists, line `2129` sets `sourceUid = subData.linkedUid`, even though `handleDocumentUpload` (`App.tsx:2343`) uploaded the employee's profile-completion documents under `onboarding/${auth.currentUser.uid}` (which is `portalId = subId`, NOT `linkedUid`).
  2. It moves files to `employees/${employeeId}` instead of `employees/${subId}/joining`, and its `rewriteStoragePaths` helper (`L2142–2161`) only checks `if (val && typeof val === 'object' && val.storagePath)`—completely ignoring plain string `storagePath` values returned by `uploadSubmissionDocument`.

#### Real-World Impact
Reverting an approved onboarding submission to pending or approving a bulk-imported employee's profile completion leaves all uploaded photos, Aadhaar/PAN cards, and signatures pointing to non-existent or unauthorized Storage paths (404 / `permission-denied`).

#### Remediation (`diff`)
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -2367,10 +2367,20 @@
         // 3. Move files back in Storage (Best effort)
-        const empId = data.employeeId || submissionId;
         try {
-            await moveStorageFiles(`employees/${empId}`, `onboarding/${submissionId}`);
+            await moveStorageFiles(`employees/${submissionId}/joining`, `onboarding/${submissionId}`);
         } catch (storageErr) {
             console.warn("Storage move failed during revert (non-fatal):", storageErr);
         }
+        const rewriteRevertPaths = (obj: any): any => {
+            if (!obj || typeof obj !== 'object') return obj;
+            if (Array.isArray(obj)) return obj.map(rewriteRevertPaths);
+            const res: any = {};
+            for (const [k, v] of Object.entries(obj)) {
+                if (typeof v === 'string' && v.startsWith(`employees/${submissionId}/joining/`)) {
+                    res[k] = v.replace(`employees/${submissionId}/joining/`, `onboarding/${submissionId}/`);
+                } else {
+                    res[k] = rewriteRevertPaths(v);
+                }
+            }
+            return res;
+        };
```

---

### `UDF-AUD-38` — Soft-Deleted Employees & Submissions Never Appear in Central Recycle Bin (`AdminRecycleBinPage`), Bulk Soft-Delete Silently Skips Employees Without Submissions, and `EMPLOYEES_TAB_RECYCLE_BIN` Staff Are Blocked From `AdminRecycleBinPage`
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/services/employeeService.ts:2411–2515, 3957–4035`
  - `App.tsx:1834–1849`
  - `components/AdminPortalPage.tsx:433, 865`
  - `src/services/recycleBinService.ts:33–63`

#### Root Cause & Exact Code Trace
1. **Disconnected Recycle Bin Systems**: `AdminRecycleBinPage.tsx:105` subscribes exclusively to the `recycle_bin` collection (`subscribeToRecycleBin`). However, `softDeleteEmployee` (`employeeService.ts:2453`), `softDeleteSubmission` (`L2411`), and `bulkSoftDeleteSubmissions` (`L3957`) only set `deletedAt` and `isActive: false` on `employees` / `onboarding_submissions` without writing a document to `recycle_bin` via `moveToRecycleBin(...)`. Consequently, the **"Employees (0)"** counter on `AdminRecycleBinPage.tsx:139` is permanently `0`, and soft-deleted employees never appear in the Central Recycle Bin & Undo Vault.
2. **Bulk Soft-Delete Partial Drop (`App.tsx:1834–1849`)**: In `handleBulkSoftDeleteSubmissions`:
   ```ts
   if (resolvedSubIds.length > 0) {
     await bulkSoftDeleteSubmissions(resolvedSubIds, currentAdminIdentifier);
   } else {
     for (const id of empIds) {
       await softDeleteEmployee(id, currentAdminIdentifier);
     }
   }
   ```
   If an admin selects 5 employees in the Master Employee List where 3 have `onboarding_submissions` and 2 are bulk-imported (without `onboarding_submissions`), `resolvedSubIds.length > 0` is true, so the `else` branch never runs and the 2 bulk-imported employees are silently not deleted!
3. **RBAC Lockout on `AdminRecycleBinPage` (`AdminPortalPage.tsx:433, 865`)**: While `firestore.rules:581` and `restoreRecycleBinServer` (`functions/index.js:7055`) grant access to `hasPermission('EMPLOYEES_TAB_RECYCLE_BIN')`, `AdminPortalPage.tsx:433, 865` hardcodes `visible: isSuperAdmin` and `if (!isSuperAdmin) return accessDenied;`.

#### Real-World Impact
Soft-deleted employees are invisible in the Central Recycle Bin, bulk soft-deleting a mixed selection of onboarded and Excel-imported employees silently leaves the Excel-imported employees active, and non-SuperAdmin staff granted `EMPLOYEES_TAB_RECYCLE_BIN` are locked out of `AdminRecycleBinPage`.

#### Remediation (`diff`)
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -1838,11 +1838,12 @@
       if (resolvedSubIds.length > 0) {
         await bulkSoftDeleteSubmissions(resolvedSubIds, currentAdminIdentifier);
-      } else {
-        // Fallback: soft-delete directly on employees collection by doc ID
-        for (const id of empIds) {
-          await softDeleteEmployee(id, currentAdminIdentifier);
-        }
       }
+      const resolvedSet = new Set(resolvedSubIds);
+      for (const id of empIds) {
+        if (!resolvedSet.has(id)) {
+          await softDeleteEmployee(id, currentAdminIdentifier);
+        }
+      }
--- a/components/AdminPortalPage.tsx
+++ b/components/AdminPortalPage.tsx
@@ -430,7 +430,7 @@
         {
           id: 'recycle-bin',
           label: 'Recycle Bin',
           icon: Trash2,
-          visible: isSuperAdmin
+          visible: isSuperAdmin || checkPermission(Permission.EMPLOYEES_TAB_RECYCLE_BIN)
         }
@@ -862,7 +862,7 @@
       case 'recycle-bin':
-        if (!isSuperAdmin) return accessDenied;
+        if (!isSuperAdmin && !checkPermission(Permission.EMPLOYEES_TAB_RECYCLE_BIN)) return accessDenied;
         return <AdminRecycleBinPage />;
```

---

### `UDF-AUD-39` — Cloud Function Permission & State Mismatches in `relieveEmployeeServer`, `promoteEmployeeServer`, and `permanentDeleteEmployeeServer`
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:5510, 5520, 5560–5568, 6806, 6816, 7453, 7466, 7527–7547`

#### Root Cause & Exact Code Trace
1. **`relieveEmployeeServer` (`functions/index.js:5510, 5520, 5560–5568`)**:
   - Checks `permissions.includes('RESIGNATIONS_APPROVE') || permissions.includes('DELETE_EMPLOYEE')`, completely omitting **`EMPLOYEES_ACTION_RELIEVE`** (which `AdminMasterEmployeeListPage.tsx:1672` uses to show the *"Relieve Employee"* button). When an HR admin with `EMPLOYEES_ACTION_RELIEVE` clicks Relieve, `relieveEmployeeServer` throws `permission-denied`, and `employeeService.ts:2610` immediately rethrows `functions/permission-denied` without executing the client fallback.
   - Furthermore, `relieveEmployeeServer` (`L5560–5568`) never clears `assignedSiteIds: []` or marks `activeAssignments` as `'Relieved'`, so relieved employees remain counted as active site deployments.
2. **`promoteEmployeeServer` (`functions/index.js:7453, 7466, 7527–7547`)**:
   - Checks `EMPLOYEES_MANAGE_DEPLOYMENTS` or `SUBMISSIONS_APPROVE`, completely omitting **`EMPLOYEES_ACTION_PROMOTE`** and **`EMPLOYEES_EDIT_PROFILE`** (which `AdminMasterEmployeeListPage.tsx:194` uses to enable the *"Promote Employee"* button).
   - When promoting an employee with a site transfer (`newSiteId`, `L7527–7547`), it updates `currentSiteId` and `activeAssignments` but **never updates `assignedSiteIds`**, causing the promoted employee to vanish from site-scoped Master Employee List queries (`where('assignedSiteIds', 'array-contains-any', ...)`).
3. **`permanentDeleteEmployeeServer` (`functions/index.js:6806, 6816`)**:
   - Checks `DELETE_EMPLOYEE` or `SUBMISSIONS_APPROVE`, omitting **`DELETE_SUBMISSION`** when permanently deleting submissions.

#### Real-World Impact
Staff granted granular role permissions (`EMPLOYEES_ACTION_RELIEVE`, `EMPLOYEES_ACTION_PROMOTE`, `DELETE_SUBMISSION`) receive `permission-denied` errors when clicking the corresponding buttons, and employees promoted into a new site disappear from that branch's employee roster.

#### Remediation (`diff`)
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -5507,7 +5507,7 @@
     const isSuperAdmin = callerToken.isSuperAdmin === true || callerToken.role === 'SuperAdmin';
     const permissions = Array.isArray(callerToken.permissions) ? callerToken.permissions : [];
-    let hasAuth = isSuperAdmin || permissions.includes('RESIGNATIONS_APPROVE') || permissions.includes('DELETE_EMPLOYEE');
+    let hasAuth = isSuperAdmin || permissions.includes('EMPLOYEES_ACTION_RELIEVE') || permissions.includes('RESIGNATIONS_APPROVE') || permissions.includes('DELETE_EMPLOYEE');
@@ -7450,7 +7450,7 @@
     const isSuperAdmin = callerToken.isSuperAdmin === true || callerToken.role === 'SuperAdmin';
     const permissions = Array.isArray(callerToken.permissions) ? callerToken.permissions : [];
-    let hasAuth = isSuperAdmin || permissions.includes('EMPLOYEES_MANAGE_DEPLOYMENTS') || permissions.includes('SUBMISSIONS_APPROVE');
+    let hasAuth = isSuperAdmin || permissions.includes('EMPLOYEES_ACTION_PROMOTE') || permissions.includes('EMPLOYEES_EDIT_PROFILE') || permissions.includes('EMPLOYEES_MANAGE_DEPLOYMENTS') || permissions.includes('SUBMISSIONS_APPROVE');
@@ -7542,6 +7542,7 @@
         empUpdate.currentSiteId = newSiteId;
         empUpdate.siteId = newSiteId;
         empUpdate.activeAssignments = updatedAssignments;
+        empUpdate.assignedSiteIds = Array.from(new Set([...(empData.assignedSiteIds || []), newSiteId]));
```

---

### `UDF-AUD-40` — Daily Safety Quiz Fails on Default Question (`questionId: 'default'` / `undefined`), Shows False "+10 Points Added" Banner When Server Rejects, Resets on Refresh in `BlogDashboardPage`, and Uses UTC Instead of IST
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/BlogDashboardPage.tsx:66, 77–89, 158–184, 403`
  - `components/employee/EmployeeEngagementHub.tsx:105–118, 235–242`
  - `functions/index.js:5975, 5995–6008`

#### Root Cause & Exact Code Trace
1. When no active documents exist in `safety_quizzes`, `BlogDashboardPage.tsx:66` falls back to `DEFAULT_QUIZ` with `id: 'default'` (`answer: 1`), and `EmployeeEngagementHub.tsx:235` falls back to an inline object with `id: undefined` (`correctOptionIndex: 1`). When the employee submits their answer, `completeTrainingQuizServer` (`functions/index.js:5996–6008`) looks up `safety_quizzes/default` (not found) or `settings/gamification_rules.dailyQuiz` (never written by any admin UI) and throws `failed-precondition: Quiz question or correct answer not found.`.
2. In `BlogDashboardPage.tsx:160, 403`, `setQuizSubmitted(true)` is set before calling `recordQuizAttempt`; when the server throws, the `catch` block only logs a warning while line `403` still displays `✓ Correct! (+10 Points Added)` even though 0 points were awarded.
3. `BlogDashboardPage.tsx:77–89` never checks `streak.lastQuizDate === today` on mount, so refreshing `/dashboard` resets `quizSubmitted` to `false`.
4. `completeTrainingQuizServer` (`functions/index.js:5975`) computes `today = new Date().toISOString().split('T')[0]` (**UTC**), whereas `EmployeeEngagementHub.tsx:76` and `recordDailyStreakServer` (`L7826`) use **`Asia/Kolkata` (IST)**, causing a 5.5-hour mismatch between 12:00 AM and 5:30 AM IST.

#### Real-World Impact
The default Daily Safety Quiz fails on the server, misleads employees on `/dashboard` with a fake `+10 Points Added` confirmation, and suffers daily reset desynchronization between 12:00 AM and 5:30 AM IST.

#### Remediation (`diff`)
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -5972,7 +5972,7 @@
-    const today = new Date().toISOString().split('T')[0];
+    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
     const docRef = db.collection('user_engagement').doc(String(userId));
@@ -6004,6 +6004,8 @@
           correctIndex = Number(qData.dailyQuiz.correctOptionIndex ?? qData.dailyQuiz.answer);
         }
       }
+      if ((correctIndex === null || Number.isNaN(correctIndex)) && (!questionId || questionId === 'default')) {
+        correctIndex = 1; // Built-in default safety quiz answer index
+      }
```

---

### `UDF-AUD-41` — Rejecting an Employee Reward Redemption Never Refunds Deducted Points (`pointsSpent`)
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminGrievancesPage.tsx:339–363`
  - `src/services/engagementService.ts:475–498`
  - `firestore.rules:539–549`

#### Root Cause & Exact Code Trace
When an employee redeems a reward in `EmployeeEngagementHub.tsx:167`, `redeemRewardServer` (`functions/index.js:8037–8051`) immediately deducts `verifiedCost` from `user_engagement/{userId}.points` (and `user_engagement/{uid}.points`).
However, when an Admin rejects that redemption in `AdminGrievancesPage.tsx:340–355` (`targetRewardStatus === 'rejected'`), `updateRewardRedemptionStatus` (`src/services/engagementService.ts:475–498`) only updates `reward_redemptions/{redemptionId}` to `status: 'rejected'` and **never refunds `pointsSpent` back to `user_engagement`**. Moreover, `firestore.rules:543–548` caps client-side `user_engagement.points` increments at `+5` for non-SuperAdmins, so a refund of 100+ points cannot even be performed client-side by a regular Admin.

#### Real-World Impact
Every time an admin rejects a reward redemption request, the employee permanently loses all points spent on that reward.

#### Remediation (`diff`)
```diff
--- a/src/services/engagementService.ts
+++ b/src/services/engagementService.ts
@@ -475,11 +475,20 @@
 export async function updateRewardRedemptionStatus(
   redemptionId: string,
   status: 'approved' | 'rejected' | 'delivered',
   adminNotes?: string,
   processedBy?: string
 ): Promise<void> {
   const docRef = doc(db, REWARD_REDEMPTIONS_COL, redemptionId);
+  const snap = await getDoc(docRef);
+  const prevData = snap.exists() ? snap.data() : null;
   await updateDoc(docRef, {
     status,
     adminNotes: adminNotes || '',
     processedBy: processedBy || 'Admin',
     processedAt: new Date().toISOString()
   });
+  if (status === 'rejected' && prevData && prevData.status !== 'rejected' && Number(prevData.pointsSpent) > 0) {
+    const engRef = doc(db, USER_ENGAGEMENT_COL, prevData.employeeId);
+    await updateDoc(engRef, { points: increment(Number(prevData.pointsSpent)) }).catch(() => {});
+  }
 }
```

---

### `UDF-AUD-42` — Client ID "Custom Regex Pattern" Option Cannot Be Selected in `AdminWorkflowConfigPage`, and Revoking a Correction Link (`revokeCorrectionRequest`) Leaves `activeCorrectionToken` Set
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminWorkflowConfigPage.tsx:327–358`
  - `components/AdminCorrectionRequestsPage.tsx:89–104`
  - `src/services/employeeService.ts:5381–5385`

#### Root Cause & Exact Code Trace
1. **Unselectable "Custom Regex Pattern" (`AdminWorkflowConfigPage.tsx:327–358`)**:
   The Validation Format `<Select>` derives its `value` from `def.pattern`:
   ```tsx
   value={
     def.pattern === '^[0-9]+$' ? 'numeric' :
     def.pattern === '^[a-zA-Z0-9]+$' ? 'alphanumeric' :
     def.pattern === '^[A-Z0-9]+$' ? 'uppercase_alphanumeric' :
     !def.pattern ? 'none' : 'custom'
   }
   ```
   When `def.pattern` is `''` (`'none'`) and the admin selects `"custom"` (*"Custom Regex Pattern"*), the `onChange` handler (`L334–341`) has no `else if (val === 'custom')` branch, so `def.pattern` remains `''`, the `<Select>` immediately snaps back to `'none'`, and the custom regex input (`L351`) never renders.
2. **Stale `activeCorrectionToken` on Revoke (`employeeService.ts:5381–5385`)**:
   `revokeCorrectionRequest(requestId)` updates `correction_requests/{requestId}` to `{ status: 'expired' }` without clearing `activeCorrectionToken: null` on the target `employees` or `onboarding_submissions` document.

#### Real-World Impact
Admins cannot configure custom regex validation rules for Client IDs in Workflow Config, and revoking a correction request leaves a stale `activeCorrectionToken` on the employee record.

#### Remediation (`diff`)
```diff
--- a/components/AdminWorkflowConfigPage.tsx
+++ b/components/AdminWorkflowConfigPage.tsx
@@ -338,6 +338,7 @@
                       if (val === 'numeric') newConfig.clientIdDefinitions[index].pattern = '^[0-9]+$';
                       else if (val === 'alphanumeric') newConfig.clientIdDefinitions[index].pattern = '^[a-zA-Z0-9]+$';
                       else if (val === 'uppercase_alphanumeric') newConfig.clientIdDefinitions[index].pattern = '^[A-Z0-9]+$';
+                      else if (val === 'custom') newConfig.clientIdDefinitions[index].pattern = '^.*$';
                       setConfig(newConfig);
                     }}
```

---

### `UDF-AUD-43` — Master Employee List Drops Tab/Filter Loads While `isLoading` is True, Uses Raw `searchTerm` Instead of `debouncedSearchTerm` (with Case-Sensitive Firestore Prefix Query), Has Non-Functional "Send Nudge" Button, and Renders Duplicate "New Employee ID" Inputs in Rejoin Modal
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminMasterEmployeeListPage.tsx:426–478, 500–510, 1644–1656, 2170–2308`
  - `src/services/employeeService.ts:1340–1349`

#### Root Cause & Exact Code Trace
1. **Dropped Tab/Site Filter Loads (`AdminMasterEmployeeListPage.tsx:427`)**: `loadPage` begins with `if (isLoading) return;`. If an admin clicks the `RELIEVED` or `RECYCLE_BIN` tab or changes the Site filter while the previous query is still loading, `loadPage('initial')` returns early and leaves stale rows from the previous tab/filter displayed under the new tab header.
2. **Un-debounced & Case-Sensitive Server Search (`AdminMasterEmployeeListPage.tsx:474, 502` & `employeeService.ts:1340–1349`)**: Although `debouncedSearchTerm` is computed (`L392–398`) and triggers `useEffect` (`L502`), line `474` passes raw `searchTerm` to `getPaginatedEmployees`, which executes a single case-sensitive Firestore range query `where(searchPath, '>=', term)`—missing names/IDs unless typed with exact matching capitalization.
3. **Placeholder "Send Nudge / Reminder" Button (`AdminMasterEmployeeListPage.tsx:1650`)**: The button gated by `Permission.EMPLOYEES_SEND_PROFILE_NUDGE` only runs `onClick={() => alert("Reminder feature coming soon.")}`.
4. **Duplicate "New Employee ID" Inputs in Rejoin Modal (`AdminMasterEmployeeListPage.tsx:2170–2177, 2293–2307`)**: When `rehireMode === 'NEW_ID'`, the modal renders two separate text inputs bound to `rehireId`.

#### Real-World Impact
Switching tabs or site filters quickly in the Master Employee List displays the wrong tab's employees, lowercase searches miss uppercase employee names, clicking "Send Nudge" shows a placeholder alert, and the Rejoin Modal displays duplicate ID fields.

#### Remediation (`diff`)
```diff
--- a/components/AdminMasterEmployeeListPage.tsx
+++ b/components/AdminMasterEmployeeListPage.tsx
@@ -471,7 +471,7 @@
         viewMode === 'RECYCLE_BIN' ? 'DELETED' : viewMode,
         selectedSite,
-        searchTerm,
+        debouncedSearchTerm,
         sortBy
       );
```

---

### `UDF-AUD-44` — Leave Balance Storage & Refund Desynchronization Turns Uninitialized Leave Types Negative and Inflates "Used" Leave Counts
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `App.tsx:1916–1926`
  - `src/services/employeeService.ts:2295–2324`
  - `components/AdminLeaveManagementPage.tsx:113–139`
  - `functions/index.js:4924–4944`

#### Root Cause & Exact Code Trace
1. When a leave request is approved in `processRequestReviewServer` (`functions/index.js:4939–4941`), it runs:
   ```js
   await empDoc.ref.update({
     [`leaveBalance.${balanceKey}`]: admin.firestore.FieldValue.increment(-daysTaken),
     updatedAt: now
   });
   ```
2. For any custom leave type (configured in `settings/leave_types`) or any bulk-imported employee (`bulkImportEmployeesServer`, `L7697–7720`, which never initializes `leaveBalance`), `employees.leaveBalance[balanceKey]` is `undefined`. Firestore's `FieldValue.increment(-daysTaken)` initializes a missing field to `0 + (-daysTaken) = -daysTaken` (e.g. `-2`).
3. When an admin opens that leave request in `AdminLeaveManagementPage.tsx:126–131`, it calculates:
   ```ts
   const hasExplicitRemaining = selectedEmpRecord.leaveBalance?.[shortKey] !== undefined;
   const remaining = hasExplicitRemaining ? Number(selectedEmpRecord.leaveBalance[shortKey]) : total;
   const used = Math.max(0, total - remaining);
   ```
   Because `selectedEmpRecord.leaveBalance[shortKey]` is `-2`, `remaining` is `-2` (clamped to `0` on line `131`), and `used` is calculated as `total - (-2) = total + 2` (showing e.g. `14 used / 12 total, 0 remaining` after taking just 2 days of leave!).

#### Real-World Impact
Bulk-imported employees or employees taking custom leave types immediately drop to `0 remaining` and display `used = total + daysTaken` after their very first approved leave request.

#### Remediation (`diff`)
```diff
--- a/components/AdminLeaveManagementPage.tsx
+++ b/components/AdminLeaveManagementPage.tsx
@@ -124,8 +124,9 @@
     const total = leaveTypeConfig?.annualQuota ?? (shortKey === 'casual' ? 12 : shortKey === 'sick' ? 7 : shortKey === 'privilege' ? 15 : 0);
     
     const hasExplicitRemaining = selectedEmpRecord.leaveBalance?.[shortKey] !== undefined;
-    const remaining = hasExplicitRemaining ? Number(selectedEmpRecord.leaveBalance[shortKey]) : total;
+    const rawVal = hasExplicitRemaining ? Number(selectedEmpRecord.leaveBalance[shortKey]) : total;
+    const remaining = rawVal < 0 ? Math.max(0, total + rawVal) : rawVal;
     const used = Math.max(0, total - remaining);
```


---

### `UDF-AUD-45` — `selfLinkGoogleAccount` Rejects 100% of Fresh Google Accounts With `already-exists` During Account Setup, and `SetupAccountPage` Silently No-Ops When `user.employeeId` Is Missing
- **Severity:** `CRITICAL`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:1560–1575`
  - `src/components/auth/SetupAccountPage.tsx:25–41, 66–74`
  - `src/utils/googleAuthHelper.ts:57, 72`

#### Root Cause & Exact Code Trace
1. **Inverted `getUserByEmail` Check in `selfLinkGoogleAccount` (`functions/index.js:1560–1575`)**:
   - When an employee on `/setup-account` clicks **"Sign in with Google (Recommended)"**, `SetupAccountPage.tsx:26` calls `getGoogleCredentialSafely()` (`googleAuthHelper.ts:44–82`), which executes `await signInWithPopup(secAuth, provider)` (`L72`). That popup sign-in **immediately creates the user record in Firebase Authentication** for `email` with UID `result.uid`.
   - Next, `SetupAccountPage.tsx:30–36` invokes `selfLinkGoogleAccount`. Inside `selfLinkGoogleAccount` (`functions/index.js:1561–1570`):
     ```js
     const authUserRecord = await admin.auth().getUserByEmail(normalizedGoogleEmail);
     if (authUserRecord) {
         const [empSnapByUid, subSnapByUid] = await Promise.all([
             db.collection('employees').where('uid', '==', authUserRecord.uid).limit(1).get(),
             db.collection('onboarding_submissions').where('linkedUid', '==', authUserRecord.uid).limit(1).get()
         ]);
         if (empSnapByUid.empty && subSnapByUid.empty) {
             throw new functions.https.HttpsError('already-exists', 'This Google account is already registered in our system. Please contact your administrator.');
         }
     }
     ```
   - Because `signInWithPopup` just created `authUserRecord` in Firebase Auth and the employee has not yet linked this Google UID to `employees` or `onboarding_submissions`, `empSnapByUid.empty && subSnapByUid.empty` is **always `true`** for every fresh Google account! Thus `selfLinkGoogleAccount` **always throws `already-exists`**, completely blocking first-time Google account setup.
2. **Silent No-Op When `user.employeeId` Is Missing (`SetupAccountPage.tsx:29, 66`)**:
   - Both `handleGoogleLink` (`L29`) and `handleSetPassword` (`L66`) wrap their logic in `if (user && user.employeeId)` with no `else` branch. If `user` was hydrated with `user.id` or `user.portalId` while `user.employeeId` is undefined, clicking either button finishes with `loading = false` and no error message or navigation.

#### Real-World Impact
Every employee on `/setup-account` who clicks "Sign in with Google (Recommended)" using a personal Google account not previously linked in Firestore is blocked with *"This Google account is already registered in our system. Please contact your administrator."*

#### Remediation (`diff`)
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1560,15 +1560,18 @@
-        // 🛡️ SECURITY: Check if this email belongs to an Admin/Staff user via Firebase Auth API
-        try {
-            const authUserRecord = await admin.auth().getUserByEmail(normalizedGoogleEmail);
-            if (authUserRecord) {
-                const [empSnapByUid, subSnapByUid] = await Promise.all([
-                    db.collection('employees').where('uid', '==', authUserRecord.uid).limit(1).get(),
-                    db.collection('onboarding_submissions').where('linkedUid', '==', authUserRecord.uid).limit(1).get()
-                ]);
-                if (empSnapByUid.empty && subSnapByUid.empty) {
-                    throw new functions.https.HttpsError('already-exists', 'This Google account is already registered in our system. Please contact your administrator.');
-                }
-            }
-        } catch (err) {
-            if (err instanceof functions.https.HttpsError) throw err;
-        }
+        // 🛡️ SECURITY: Check if this Google account belongs to an Admin or Staff user in Firestore
+        const staffChecks = await Promise.all([
+            db.collection('users').doc(googleUid).get(),
+            db.collection('staff_accounts').doc(googleUid).get(),
+            db.collection('users').where('email', '==', normalizedGoogleEmail).limit(1).get(),
+            db.collection('staff_accounts').where('email', '==', normalizedGoogleEmail).limit(1).get()
+        ]);
+        if (staffChecks.some(s => (s.docs ? !s.empty : s.exists))) {
+            throw new functions.https.HttpsError('already-exists', 'This Google account is already registered as a staff/admin account.');
+        }
```

---

### `UDF-AUD-46` — System Audit Logs Page (`AdminAuditLogPage`) Crashes with `TypeError: Cannot read properties of undefined (reading 'toLowerCase')`, Destructures Undefined `authUser` from `useAuth()`, and Has Broken Privileged Edit/Delete
- **Severity:** `CRITICAL`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminAuditLogPage.tsx:14, 38, 59–83, 94–96, 107–116, 213–221`
  - `src/services/auditService.ts:78–86, 102–110`
  - `functions/index.js:4508–4520, 6959–6968, 7234–7243, 7403–7413, 7563–7573, 7770–7777, 8325–8334`

#### Root Cause & Exact Code Trace
1. **Un-guarded `.toLowerCase()` Crash (`AdminAuditLogPage.tsx:107–116`)**:
   ```ts
   const filteredLogs = useMemo(() => {
       return auditLogs.filter(entry => {
           const matchesSearch =
               entry.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
               entry.actorName.toLowerCase().includes(searchTerm.toLowerCase());
           const matchesModule = filterModule === 'ALL' || entry.targetModule === filterModule;
           const matchesAction = filterAction === 'ALL' || entry.actionType === filterAction;
           return matchesSearch && matchesModule && matchesAction;
       });
   }, [auditLogs, searchTerm, filterModule, filterAction]);
   ```
   However, 7 Cloud Functions write different field names into `audit_logs`:
   - `submitDataCorrectionServer` (`functions/index.js:4508–4520`) writes `description` (not `details`) and `performedBy` (not `actorName`). As soon as a single data correction is submitted, `entry.details` is `undefined`, crashing `AdminAuditLogPage` immediately on mount!
   - `permanentDeleteEmployeeServer` (`L6959`), `restoreRecycleBinServer` (`L7234`), `deleteSiteServer` (`L7403`), `promoteEmployeeServer` (`L7563`), `bulkImportEmployeesServer` (`L7770`), and `completeBgvReviewServer` (`L8325`) write `actorEmail`, `action`, and `category` instead of `actorName`, `actionType`, and `targetModule`—crashing `AdminAuditLogPage` when typing in the search bar (`entry.actorName.toLowerCase()`) and displaying blank Actor, Action, and Module cells (`L213–221`).
2. **Undefined `authUser` from `useAuth()` (`AdminAuditLogPage.tsx:14, 94–96`)**:
   Line `14` runs `const { authUser } = useAuth();`, whereas `AuthContext.tsx:180` provides `{ user }`. Thus `authUser` is always `undefined`, `filter` (`L94`) is never applied for non-SuperAdmins without `VIEW_AUDIT_LOGS`, and `firestore.rules:406` rejects the unfiltered query with `permission-denied`.
3. **Broken Privileged Edit/Delete (`AdminAuditLogPage.tsx:59–83`, `auditService.ts:102–110`)**:
   `_deleteAuditLog` and `_updateAuditLogDetails` attempt direct client-side `deleteDoc`/`updateDoc` on `audit_logs`, which `firestore.rules:407` (`allow create, update, delete: if false;`) blocks.

#### Real-World Impact
Opening or searching the System Audit Logs page crashes the UI with `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` whenever server-audited actions exist in `audit_logs`.

#### Remediation (`diff`)
```diff
--- a/src/services/auditService.ts
+++ b/src/services/auditService.ts
@@ -78,9 +78,13 @@
         let logs = snapshot.docs.map(doc => {
             const data = doc.data();
             const ts = data.timestamp as Timestamp;
             return {
                 id: doc.id,
                 ...data,
+                details: data.details || data.description || '',
+                actorName: data.actorName || data.actorEmail || data.performedBy || 'System',
+                actionType: data.actionType || data.action || 'SYSTEM',
+                targetModule: data.targetModule || data.module || data.category || 'SYSTEM',
                 timestamp: ts && typeof ts.toDate === 'function' ? ts.toDate().toISOString() : (typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString())
             };
         }) as AuditLogEntry[];
--- a/components/AdminAuditLogPage.tsx
+++ b/components/AdminAuditLogPage.tsx
@@ -14,3 +14,3 @@
 const AdminAuditLogPage: React.FC<AdminAuditLogPageProps> = ({ userRole, isSuperAdmin }) => {
-    const { authUser } = useAuth();
+    const { user: authUser } = useAuth();
@@ -94,2 +94,2 @@
-        if (!hasFullAccess && authUser?.uid) {
-            filter = { actorId: authUser.uid };
+        if (!hasFullAccess && authUser?.id) {
+            filter = { actorId: authUser.id };
```

---

### `UDF-AUD-47` — Daily Safety Quiz Rate-Limit Bypass (`userId == uid` vs `userId == targetDocId`) Allows Unlimited Point Farming in `completeTrainingQuizServer`
- **Severity:** `HIGH`
- **Category:** `Security Vulnerability`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:5978–5987, 6022–6060`

#### Root Cause & Exact Code Trace
In `completeTrainingQuizServer` (`functions/index.js:5978–5987`), the daily rate-limit check queries `gamification_logs` by `userId == uid`:
```js
const existingLogSnap = await db.collection('gamification_logs')
    .where('userId', '==', uid)
    .where('type', '==', 'QUIZ')
    .where('date', '==', today)
    .limit(1)
    .get();
```
However, on lines `6022–6033`, `targetDocId` is resolved to `request.data.targetUserId` (the employee's `employeeId` or `portalId`, e.g., `"HY10045"`), and lines `6053–6055` write the log document with `userId: targetDocId` (`"HY10045"`) and `userUid: uid`!
Whenever `targetDocId !== uid` (which applies to every employee logged in via Google Sign-In or whose `userId` prop in `BlogDashboardPage` / `EmployeeEngagementHub` is their `employeeId` rather than `auth.currentUser.uid`), `.where('userId', '==', uid)` never matches the saved log entry (`userId: targetDocId`).

#### Real-World Impact
Any employee whose `targetUserId` (`employeeId`) differs from their Firebase Auth `uid` can submit the Daily Safety Quiz unlimited times per day to farm infinite gamification points and redeem rewards at will.

#### Remediation (`diff`)
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -5977,11 +5977,15 @@
     // 1. Rate-limit / Duplicate check: Has this user already completed today's quiz?
-    const existingLogSnap = await db.collection('gamification_logs')
-        .where('userId', '==', uid)
-        .where('type', '==', 'QUIZ')
-        .where('date', '==', today)
-        .limit(1)
-        .get();
-
-    if (!existingLogSnap.empty) {
+    const requestedTarget = (request.data && typeof request.data.targetUserId === 'string') ? request.data.targetUserId.trim() : uid;
+    const [byUidSnap, byTargetSnap] = await Promise.all([
+        db.collection('gamification_logs').where('userUid', '==', uid).where('type', '==', 'QUIZ').where('date', '==', today).limit(1).get(),
+        db.collection('gamification_logs').where('userId', '==', requestedTarget).where('type', '==', 'QUIZ').where('date', '==', today).limit(1).get()
+    ]);
+
+    if (!byUidSnap.empty || !byTargetSnap.empty) {
         throw new functions.https.HttpsError('already-exists', 'You have already completed the daily quiz today.');
     }
```

---

### `UDF-AUD-48` — Anonymous Visitors Receive All Private Internal Protocol Blog Posts (`isPrivate: true`), While Public Visitors Cannot See Public Posts Missing `isPrivate: false`
- **Severity:** `HIGH`
- **Category:** `Security Vulnerability`
- **Target File(s) & Exact Lines:**
  - `src/services/blogService.ts:23–32`
  - `firestore.rules:574–577`

#### Root Cause & Exact Code Trace
1. **Private Blog Leak to Anonymous Sessions**:
   In `firestore.rules:574–576`:
   ```
   match /blog_posts/{id} {
     allow read: if resource.data.get('isPrivate', false) != true || isAuthenticated();
   ```
   And in `src/services/blogService.ts:23–32`:
   ```ts
   const isAuth = !!auth?.currentUser;
   if (isAuth) {
       // Authenticated users (staff/employees) can see all posts (including internal protocols)
       q = query(blogCol, orderBy('timestamp', 'desc'));
   ```
   Because `ensureAuthenticated()` signs public visitors in via `signInAnonymously(auth)` on `/join`, `/claim-profile`, and `/correct-data`, `auth.currentUser` is non-null (`isAnonymous === true`) and `isAuthenticated()` in `firestore.rules` is `true`! Thus, any anonymous visitor who navigates to `/blogs` fetches and views all internal-only (`isPrivate: true`) company protocol posts.
2. **Public Posts Omitted When `isPrivate` Field Is Undefined**:
   When `auth.currentUser` is `null`, `blogService.ts:31` runs `where('isPrivate', '==', false)`, which fails to return any public blog post where `isPrivate` was not explicitly set to boolean `false`.

#### Real-World Impact
Unverified anonymous visitors can read all private internal security protocols in `blog_posts`, while unauthenticated visitors miss public posts that lack an explicit `isPrivate: false` property.

#### Remediation (`diff`)
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -574,3 +574,3 @@
     match /blog_posts/{id} {
-      allow read: if resource.data.get('isPrivate', false) != true || isAuthenticated();
+      allow read: if resource.data.get('isPrivate', false) != true || isRegisteredUser();
       allow write: if isSuperAdmin() || hasPermission('MANAGE_SYSTEM');
--- a/src/services/blogService.ts
+++ b/src/services/blogService.ts
@@ -23,3 +23,3 @@
         const blogCol = collection(db, 'blog_posts');
-        const isAuth = !!auth?.currentUser;
+        const isAuth = !!auth?.currentUser && !auth.currentUser.isAnonymous;
```

---

### `UDF-AUD-49` — `SecuritySettingsModal` Unlinks Existing Google Account Before Popup Selection, `employeeLogin` Overwrites `uid` (`googleUid`), `changeEmployeePassword` Rejects Google-Logged-In Employees, and `firestore.rules` Blocks `onboarding_submissions` `get` by `portalId`
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/employee/SecuritySettingsModal.tsx:74–88`
  - `functions/index.js:507–669, 800–812, 1061–1065`
  - `firestore.rules:224–228`

#### Root Cause & Exact Code Trace
1. **Premature Google Unlink Before Popup Confirmation (`SecuritySettingsModal.tsx:74–88`)**:
   - When `activeTab === 'change_google'`, `handleLinkGoogle` calls `await unlinkGoogleAccount(employeeId, currentPassword)` (`L77`) **before** opening the Google sign-in popup (`await getGoogleCredentialSafely()` at `L82`). If the employee closes the popup or the new Google account fails verification at `L87`, their original Google account has already been unlinked in Firestore.
2. **`employeeLogin` Overwrites `uid` With `portalId` (`functions/index.js:800–812`)**:
   - `linkEmployeeGoogleAccount` (`L1215`) and `selfLinkGoogleAccount` (`L1597`) store `googleUid` in `uid` (without setting `linkedUid` or `googleUid`). If the employee subsequently logs in once with Employee ID + password, `employeeLogin` (`L812`) executes `await matchedDoc.ref.update({ uid: customTokenUid })` (`portalId`), wiping out `googleUid` from `uid`.
3. **`changeEmployeePassword` Rejects Google-Logged-In Employees (`functions/index.js:650–664, 1061–1065`)**:
   - `employeeGoogleLogin` (`L664`) mints a custom token with `uid = portalId` (`UDF-...`), while leaving `empData.uid = googleUid` and `empData.linkedUid = googleUid` (`L651–655`). When that employee calls `changeEmployeePassword` (`L1062–1065`), `callerUid` (`portalId`) matches neither `empData.uid` (`googleUid`) nor `empData.linkedUid` (`googleUid`), throwing `permission-denied: You do not have permission to change this password`.
4. **`firestore.rules:224–228` Blocks `onboarding_submissions` `get` When `request.auth.uid == id`**:
   - Unlike `allow update` (`L240`, which checks `resource.id == request.auth.uid`), `allow get` (`L225–227`) only calls `isSelfSubmission(resource.data)`—which never checks `id == request.auth.uid`, denying direct `getDoc(doc(db, 'onboarding_submissions', portalId))` for Google-logged-in employees whose custom token UID is `portalId`.

#### Real-World Impact
Cancelling the "Change Google Account" popup leaves the employee with no linked Google account; logging in with a password wipes `uid: googleUid`; Google-authenticated employees cannot change their password; and direct `getDoc` reads on `onboarding_submissions/{portalId}` fail with `PERMISSION_DENIED`.

#### Remediation (`diff`)
```diff
--- a/components/employee/SecuritySettingsModal.tsx
+++ b/components/employee/SecuritySettingsModal.tsx
@@ -74,10 +74,10 @@
-            // 2. If changing Google account, unlink the current one now that password is verified
-            if (activeTab === 'change_google') {
-                const { unlinkGoogleAccount } = await import('../../src/services/employeeService');
-                await unlinkGoogleAccount(employeeId, currentPassword);
-            }
-
-            // 3. Open Google popup safely (without replacing core auth session)
+            // 2. Open Google popup FIRST before unlinking existing Google account
             const { getGoogleCredentialSafely } = await import('../../src/utils/googleAuthHelper');
             const googleResult = await getGoogleCredentialSafely();
             if (!googleResult.uid || !googleResult.email) throw new Error('Google selection failed.');
+
+            if (activeTab === 'change_google') {
+                const { unlinkGoogleAccount } = await import('../../src/services/employeeService');
+                await unlinkGoogleAccount(employeeId, currentPassword);
+            }
--- a/functions/index.js
+++ b/functions/index.js
@@ -1062,2 +1062,2 @@
         const callerUid = request.auth.uid;
-        if (empData.uid !== callerUid && empData.linkedUid !== callerUid) {
+        if (docRef.id !== callerUid && empData.portalId !== callerUid && empData.uid !== callerUid && empData.linkedUid !== callerUid) {
             throw new functions.https.HttpsError('permission-denied', 'You do not have permission to change this password.');
```

---

### `UDF-AUD-50` — Vacancy & Site Management RBAC Lockouts (`VACANCIES_POST`, `SITES_MANAGE`), Broken `navigateTo('ADMIN_PORTAL_SITE_MANAGEMENT')` String, and Dead Role Field-Visibility in `EmployeeFormPage`
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminVacancyManager.tsx:16, 21–32, 134–161, 212, 231`
  - `components/AdminSiteManagementPage.tsx:69`
  - `components/EmployeeFormPage.tsx:217, 1488–1514`
  - `firestore.rules:445–449`

#### Root Cause & Exact Code Trace
1. **`VACANCIES_POST` Blocked by `firestore.rules:448`**: `AdminVacancyManager.tsx:31, 136` allows staff with `Permission.VACANCIES_POST` to open the modal and call `createVacancy` / `updateVacancy`, but `firestore.rules:448` (`match /vacancies/{id}`) only permits `allow write: if isSuperAdmin() || hasPermission('VACANCIES_MANAGE');`—omitting `hasPermission('VACANCIES_POST')` and failing with `Missing or insufficient permissions`.
2. **Broken `navigateTo` & Undefined `authUser` in `AdminVacancyManager.tsx:16, 212, 231`**: Line `16` destructures `authUser` from `useData()` (which does not exist on `DataContext`), so `authUser` is `undefined` and per-user `permissionOverrides` (`L23`) are ignored. Lines `212` and `231` call `navigateTo('ADMIN_PORTAL_SITE_MANAGEMENT' as any)` instead of `AppView.ADMIN_PORTAL_SITE_MANAGEMENT` (`'admin_portal_site_management'`), breaking the *"Manage Sites"* button.
3. **`SITES_MANAGE` Ignored in `AdminSiteManagementPage.tsx:69`**: Hardcodes `const hasManagePerm = Boolean(isSuperAdmin);`, locking out staff granted `Permission.SITES_MANAGE` in Role Manager even though `firestore.rules:146` allows `hasPermission('SITES_MANAGE')`.
4. **Undefined `authUser` & `isSuperAdmin` in `EmployeeFormPage.tsx:217`**: Destructures `const { authUser, isSuperAdmin } = useAuth();` (where `useAuth()` only provides `user`), making `authUser` and `isSuperAdmin` permanently `undefined` and rendering role-based `fieldVisibility` (`L1489–1514`) dead code.

#### Real-World Impact
Staff granted `VACANCIES_POST` cannot post or edit vacancies, staff granted `SITES_MANAGE` are locked in Read-Only mode in Site Management, clicking "Manage Sites" in Vacancy Manager navigates to an invalid view key, and role-based field visibility on the onboarding form never runs.

#### Remediation (`diff`)
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -446,4 +446,5 @@
     match /vacancies/{id} {
       allow read: if true; // Public — displayed on blog/careers page
-      allow write: if isSuperAdmin() || hasPermission('VACANCIES_MANAGE');
+      allow create, update: if isSuperAdmin() || hasPermission('VACANCIES_MANAGE') || hasPermission('VACANCIES_POST');
+      allow delete: if isSuperAdmin() || hasPermission('VACANCIES_MANAGE');
     }
--- a/components/AdminSiteManagementPage.tsx
+++ b/components/AdminSiteManagementPage.tsx
@@ -69,1 +69,1 @@
-  const hasManagePerm = Boolean(isSuperAdmin);
+  const hasManagePerm = Boolean(isSuperAdmin || userRole?.permissions?.includes(Permission.SITES_MANAGE) || userRole?.permissions?.includes(Permission.MANAGE_SITES));
--- a/components/EmployeeFormPage.tsx
+++ b/components/EmployeeFormPage.tsx
@@ -217,1 +217,2 @@
-  const { authUser, isSuperAdmin } = useAuth();
+  const { user: authUser } = useAuth();
+  const isSuperAdmin = Boolean(authUser?.isSuperAdmin || authUser?.roleId === 'role-super-admin');
```

---

### `UDF-AUD-51` — Legacy Profile Claim Bank Account Last-4 Mismatch, Premature `claimed: true` Lockout Before Form Submission, Stale `imports` Closure in CSV Smart-Merge, and Missing `fatherName` in Edit Modal
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/LegacyClaimModal.tsx:32`
  - `components/AdminLegacySystemsPage.tsx:95, 218, 255, 590–598, 656–721`
  - `functions/index.js:2988, 3008, 3017–3022`

#### Root Cause & Exact Code Trace
1. **Bank Account Last-4 vs Full-Number Mismatch**: `LegacyClaimModal.tsx:32` labels the input `Bank Account (Last 4 digits)` (and `AdminLegacySystemsPage.tsx:95` recommends last 4 digits), whereas the CSV template (`AdminLegacySystemsPage.tsx:304`) stores the full account number (`50100123456789`) and `claimEmployeeProfile` (`functions/index.js:3008`) requires `normalize(storedValue) === normalize(providedValue)`. Entering the last 4 digits fails verification and locks the employee ID out for 24 hours after 3 attempts (`L2911`).
2. **Premature `claimed: true` Lockout (`functions/index.js:3017–3022`)**: `claimEmployeeProfile` sets `claimed: true` on `legacy_employee_imports/{id}` immediately upon verification before the employee submits `/join`. If the user closes their browser or loses session before submitting `/join`, re-trying `/claim-profile` (`L2963`: `.where('claimed', '==', false)`) fails with `No unclaimed profile found`, and `AdminLegacySystemsPage.tsx:585` (`{!imp.claimed && ...}`) hides the Edit/Delete buttons for that record.
3. **Stale `imports` Closure in `handleFileUpload` (`AdminLegacySystemsPage.tsx:218, 255`)**: `handleFileUpload` checks `imports.find(...)` to merge updated CSV rows (`L218`), but its `useCallback` dependency array is `[logAction]` (`L255`)—omitting `imports`! Thus `imports` inside the callback is always `[]` from initial mount, so re-uploading a CSV always creates duplicate `legacy_employee_imports` documents instead of merging.
4. **Missing `fatherName` & `location` in Edit Modal (`AdminLegacySystemsPage.tsx:590–598, 656–721`)**: Although `fatherName` is one of the 6 verification metrics (`L96`), the Edit Legacy Record modal omits `fatherName` and `location`.

#### Real-World Impact
Employees claiming legacy profiles with Bank Account verification get locked out when entering the last 4 digits, interrupted claim sessions permanently lock the legacy record, CSV re-uploads duplicate records instead of merging, and admins cannot edit a legacy employee's Father's Name.

#### Remediation (`diff`)
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3005,6 +3005,10 @@
                 if (!sYMD || !pYMD || sYMD !== pYMD) {
                     throw new functions.https.HttpsError('permission-denied', `Verification failed. The ${metric} you entered does not match our records.`);
                 }
+            } else if (metric === 'bankAccount') {
+                const normStored = normalize(storedValue);
+                const normProv = normalize(providedValue);
+                if (!normProv || (normStored !== normProv && (normProv.length !== 4 || !normStored.endsWith(normProv)))) {
+                    throw new functions.https.HttpsError('permission-denied', `Verification failed. The ${metric} you entered does not match our records.`);
+                }
             } else if (!providedValue || normalize(storedValue) !== normalize(providedValue)) {
--- a/components/AdminLegacySystemsPage.tsx
+++ b/components/AdminLegacySystemsPage.tsx
@@ -254,2 +254,2 @@
-    }, [logAction]);
+    }, [logAction, imports]);
```

---

### `UDF-AUD-52` — Self-Service Forgot Password Prompt Says "Last 4 digits or full" for Aadhaar While `verifyAndResetEmployeePassword` Requires Full 12 Digits, Ignores `formData` on `onboarding_submissions`, and Fakes Step 2 Verification
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/EmployeeLoginPage.tsx:355, 363–384`
  - `functions/index.js:887–905, 930, 968–977`

#### Root Cause & Exact Code Trace
1. **Aadhaar Last-4 vs Full-12 Mismatch (`EmployeeLoginPage.tsx:355` vs `functions/index.js:930, 968–972`)**:
   - `EmployeeLoginPage.tsx:355` renders `<input placeholder="Last 4 digits or full" ... />` for Aadhaar Number in the Forgot Password modal.
   - However, `verifyAndResetEmployeePassword` (`functions/index.js:968–972`) checks `candidateAadhars.some(c => c && normDigits(c) === inputAadhar) || (inputAadhar.length >= 12 && ...)`. Entering the last 4 digits always fails verification and increments `checkAndIncrementFailedAttempts(db, 'reset_' + employeeId)` (`L882`), locking the employee out for 1 hour after 5 attempts.
2. **`empData.formData` Ignored When Matching `onboarding_submissions` (`functions/index.js:892, 903–904`)**:
   - When `empDoc` is resolved from `onboarding_submissions` (`L892`), lines `903–904` only read `const profileData = empData.profileData || {}; const storedData = empData.data || {};`, ignoring `empData.formData` where submission field UUIDs (`NAME_FIELD`, `MOBILE_FIELD`, `DOB_FIELD`, `AADHAR_FIELD`) are stored.
3. **Fake Step 2 "Verify" Button (`EmployeeLoginPage.tsx:363–384`)**:
   - Clicking **"Verify"** in Step 2 (`L363–365`) only checks that the 4 inputs are non-empty strings in the browser and immediately displays `"Verification complete. Enter your new password."` (`L372`) without calling the backend.

#### Real-World Impact
Employees who enter the last 4 digits of their Aadhaar as instructed by the Forgot Password form are rejected and locked out for 1 hour, and self-onboarded employees whose details reside in `onboarding_submissions.formData` cannot reset their passwords.

#### Remediation (`diff`)
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -903,2 +903,2 @@
         const profileData = empData.profileData || {};
-        const storedData = empData.data || {};
+        const storedData = { ...(empData.formData || {}), ...(empData.data || {}) };
@@ -968,5 +968,6 @@
-        const matchAadhar = candidateAadhars.some(c => c && normDigits(c) === inputAadhar) ||
+        const matchAadhar = candidateAadhars.some(c => c && (normDigits(c) === inputAadhar || (inputAadhar.length === 4 && normDigits(c).length === 12 && normDigits(c).endsWith(inputAadhar)))) ||
             (inputAadhar.length >= 12 && (
                 Object.values(profileData).some(val => typeof val === 'string' && normDigits(val) === inputAadhar) ||
                 Object.values(storedData).some(val => typeof val === 'string' && normDigits(val) === inputAadhar)
             ));
```

---

### `UDF-AUD-53` — Systemic v1 vs v2 Permission Enum Mismatch Hides 7 Sidebar Modules for Custom Roles, Locks Disciplinary & Correction Actions to Read-Only, and Permanently Masks Sensitive PII
- **Severity:** `CRITICAL`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminPortalPage.tsx:268, 379–390, 413, 436, 531, 827, 833, 852`
  - `components/AdminDisciplinaryPage.tsx:42, 134, 210`
  - `components/AdminMasterEmployeeListPage.tsx:628`
  - `components/AdminCorrectionRequestsPage.tsx:51, 356, 368`
  - `components/AdminLeaveManagementPage.tsx:85`
  - `components/AdminResignationManagementPage.tsx:43`
  - `components/AdminRoleManagementPage.tsx:43–250`

#### Root Cause & Exact Code Trace
`AdminRoleManagementPage.tsx:43–250` defines the 107 granular **v2** `Permission.*` enum keys that can be assigned to custom roles in the Role Manager (`SUBMISSIONS_VIEW`, `LEAVES_VIEW`, `ACCOUNT_UPDATES_VIEW`, `RESIGNATIONS_VIEW`, `DISCIPLINE_VIEW`, `DISCIPLINE_MANAGE`, `EMPLOYEES_VIEW`, `EMPLOYEES_VIEW_SENSITIVE_INFO`, `SITES_VIEW`, `SITES_MANAGE`, `SUBMISSIONS_VIEW_CORRECTION_LINKS`, etc.). None of the legacy **v1** `Permission.VIEW_*` or `Permission.MANAGE_*` keys exist in `AdminRoleManagementPage.tsx`. However, multiple core UI modules still check only the legacy v1 enum values:
1. **7 Sidebar Modules Hidden for All Custom Roles (`AdminPortalPage.tsx:379–390, 413`)**:
   - `L379` (*Review Submissions*): `canSeeModule(Permission.MANAGE_SUBMISSIONS, Permission.VIEW_SUBMISSIONS)` — omits `Permission.SUBMISSIONS_VIEW`.
   - `L380` (*Leave Requests*): `canSeeModule(Permission.MANAGE_LEAVES, Permission.VIEW_LEAVES)` — omits `Permission.LEAVES_VIEW`.
   - `L381` (*Account Updates*): `canSeeModule(Permission.MANAGE_ACCOUNT_UPDATES, Permission.VIEW_ACCOUNT_UPDATES)` — omits `Permission.ACCOUNT_UPDATES_VIEW`.
   - `L382` (*Resignations*): `canSeeModule(Permission.MANAGE_RESIGNATIONS, Permission.VIEW_RESIGNATIONS)` — omits `Permission.RESIGNATIONS_VIEW`.
   - `L383` (*Disciplinary Actions*): `canSeeModule(Permission.MANAGE_DISCIPLINE, Permission.VIEW_DISCIPLINE)` — omits `Permission.DISCIPLINE_VIEW` and `Permission.DISCIPLINE_MANAGE`.
   - `L390` (*Master Employee List*): `canSeeModule(Permission.VIEW_MASTER_EMPLOYEE_LIST)` — omits `Permission.EMPLOYEES_VIEW`.
   - `L413` (*Sites & Sub-Units*): `canSeeModule(Permission.MANAGE_SITES, Permission.VIEW_SITES)` — omits `Permission.SITES_VIEW` and `Permission.SITES_MANAGE`.
2. **Disciplinary Actions Permanently Read-Only (`AdminDisciplinaryPage.tsx:42, 134, 210`)**:
   - Line `42` sets `const canManage = isSuperAdmin || hasPermission(Permission.MANAGE_DISCIPLINE);` instead of checking `Permission.DISCIPLINE_MANAGE` (`AdminRoleManagementPage.tsx:129`), hiding the **"+ Issue Warning / Action"** button (`L134`) and **Delete** action (`L210`) for every non-SuperAdmin role.
3. **Sensitive PII Never Unmasked (`AdminMasterEmployeeListPage.tsx:628` & `AdminPortalPage.tsx:268`)**:
   - Both files check `hasPermission(Permission.VIEW_SENSITIVE_INFO)` instead of `Permission.EMPLOYEES_VIEW_SENSITIVE_INFO` (`AdminRoleManagementPage.tsx:177`). As a result, Aadhaar, PAN, Bank Account Number, and Mobile Number remain permanently masked (`••••••••`) in the Master Employee List and Excel Exports for all non-SuperAdmin staff—even when granted *"View Sensitive Info (Aadhaar/Bank)"* in Role Manager.
4. **Correction Links Revoke/Delete Locked (`AdminCorrectionRequestsPage.tsx:51, 356, 368`)**:
   - Line `51` sets `const canManage = isSuperAdmin || hasPermission(Permission.MANAGE_SUBMISSIONS);`, hiding Revoke and Delete controls for staff granted `SUBMISSIONS_CREATE_CORRECTION_LINK`, `EMPLOYEES_REQUEST_CORRECTION`, or `SUBMISSIONS_APPROVE`.
5. **BGV Vendor & System Admin Grievances Blocked in `renderAdminContent` (`AdminPortalPage.tsx:833, 852`)**:
   - `L391` shows the *BGV Management* sidebar link to `Permission.BGV_VENDOR`, but `L833` omits `hasPermission(Permission.BGV_VENDOR)` and renders `Access Denied`. Similarly, `L386` shows *Help & Support* to `Permission.MANAGE_SYSTEM`, but `L852` omits `hasPermission(Permission.MANAGE_SYSTEM)`.
6. **Employee Timeline Back Button Redirects Non-SuperAdmins to "Access Denied" (`AdminPortalPage.tsx:531, 827`)**:
   - Clicking *"Back"* from `EmployeeTimelinePage` (`L827`) navigates to `ADMIN_PORTAL_TIMELINE_SEARCH`, which at `L531` unconditionally blocks all non-SuperAdmins (`if (!isSuperAdmin) return Access Denied`).

#### Real-World Impact
Any custom role created or edited in `AdminRoleManagementPage` is missing 7 primary sidebar tabs, cannot issue or delete disciplinary warnings, never sees unmasked Aadhaar/Bank PII in the Master Employee List or Excel exports, cannot revoke data correction links, and hits "Access Denied" when opening BGV as a Vendor or clicking Back from an Employee Timeline.

#### Remediation (`diff`)
```diff
--- a/components/AdminPortalPage.tsx
+++ b/components/AdminPortalPage.tsx
@@ -268,1 +268,1 @@
-    const canSeeSensitive = isSuperAdmin || hasPermission(Permission.VIEW_SENSITIVE_INFO);
+    const canSeeSensitive = isSuperAdmin || hasPermission(Permission.VIEW_SENSITIVE_INFO) || hasPermission(Permission.EMPLOYEES_VIEW_SENSITIVE_INFO);
@@ -379,5 +379,5 @@
-        { view: View.ADMIN_PORTAL_SUBMISSIONS, label: 'Review Submissions', icon: FileCheck, badge: pendingCounts.submissions, visible: canSeeModule(Permission.MANAGE_SUBMISSIONS, Permission.VIEW_SUBMISSIONS) },
-        { view: View.ADMIN_PORTAL_LEAVE_MANAGEMENT, label: 'Leave Requests', icon: Calendar, badge: pendingCounts.leaves, visible: canSeeModule(Permission.MANAGE_LEAVES, Permission.VIEW_LEAVES) },
-        { view: View.ADMIN_PORTAL_ACCOUNT_UPDATES, label: 'Account Updates', icon: UserCog, badge: pendingCounts.updates, visible: canSeeModule(Permission.MANAGE_ACCOUNT_UPDATES, Permission.VIEW_ACCOUNT_UPDATES) },
-        { view: View.ADMIN_PORTAL_RESIGNATIONS, label: 'Resignations', icon: UserX, badge: pendingCounts.resignations, visible: canSeeModule(Permission.MANAGE_RESIGNATIONS, Permission.VIEW_RESIGNATIONS) },
-        { view: View.ADMIN_PORTAL_DISCIPLINARY, label: 'Disciplinary Actions', icon: AlertTriangle, visible: canSeeModule(Permission.MANAGE_DISCIPLINE, Permission.VIEW_DISCIPLINE) },
+        { view: View.ADMIN_PORTAL_SUBMISSIONS, label: 'Review Submissions', icon: FileCheck, badge: pendingCounts.submissions, visible: canSeeModule(Permission.MANAGE_SUBMISSIONS, Permission.VIEW_SUBMISSIONS, Permission.SUBMISSIONS_VIEW) },
+        { view: View.ADMIN_PORTAL_LEAVE_MANAGEMENT, label: 'Leave Requests', icon: Calendar, badge: pendingCounts.leaves, visible: canSeeModule(Permission.MANAGE_LEAVES, Permission.VIEW_LEAVES, Permission.LEAVES_VIEW) },
+        { view: View.ADMIN_PORTAL_ACCOUNT_UPDATES, label: 'Account Updates', icon: UserCog, badge: pendingCounts.updates, visible: canSeeModule(Permission.MANAGE_ACCOUNT_UPDATES, Permission.VIEW_ACCOUNT_UPDATES, Permission.ACCOUNT_UPDATES_VIEW) },
+        { view: View.ADMIN_PORTAL_RESIGNATIONS, label: 'Resignations', icon: UserX, badge: pendingCounts.resignations, visible: canSeeModule(Permission.MANAGE_RESIGNATIONS, Permission.VIEW_RESIGNATIONS, Permission.RESIGNATIONS_VIEW) },
+        { view: View.ADMIN_PORTAL_DISCIPLINARY, label: 'Disciplinary Actions', icon: AlertTriangle, visible: canSeeModule(Permission.MANAGE_DISCIPLINE, Permission.VIEW_DISCIPLINE, Permission.DISCIPLINE_VIEW, Permission.DISCIPLINE_MANAGE) },
@@ -390,1 +390,1 @@
-        { view: View.ADMIN_PORTAL_MASTER_LIST, label: 'Master Employee List', icon: Users, visible: canSeeModule(Permission.VIEW_MASTER_EMPLOYEE_LIST) },
+        { view: View.ADMIN_PORTAL_MASTER_LIST, label: 'Master Employee List', icon: Users, visible: canSeeModule(Permission.VIEW_MASTER_EMPLOYEE_LIST, Permission.EMPLOYEES_VIEW) },
@@ -413,1 +413,1 @@
-        { view: View.ADMIN_PORTAL_SITES, label: 'Sites & Sub-Units', icon: MapPin, visible: canSeeModule(Permission.MANAGE_SITES, Permission.VIEW_SITES) },
+        { view: View.ADMIN_PORTAL_SITES, label: 'Sites & Sub-Units', icon: MapPin, visible: canSeeModule(Permission.MANAGE_SITES, Permission.VIEW_SITES, Permission.SITES_VIEW, Permission.SITES_MANAGE) },
--- a/components/AdminDisciplinaryPage.tsx
+++ b/components/AdminDisciplinaryPage.tsx
@@ -42,1 +42,1 @@
-  const canManage = isSuperAdmin || hasPermission(Permission.MANAGE_DISCIPLINE);
+  const canManage = isSuperAdmin || hasPermission(Permission.MANAGE_DISCIPLINE) || hasPermission(Permission.DISCIPLINE_MANAGE);
--- a/components/AdminMasterEmployeeListPage.tsx
+++ b/components/AdminMasterEmployeeListPage.tsx
@@ -628,1 +628,1 @@
-  const canSeeSensitive = isSuperAdmin || hasPermission(Permission.VIEW_SENSITIVE_INFO);
+  const canSeeSensitive = isSuperAdmin || hasPermission(Permission.VIEW_SENSITIVE_INFO) || hasPermission(Permission.EMPLOYEES_VIEW_SENSITIVE_INFO);
```

---

### `UDF-AUD-54` — BGV Pipeline Broken for Non-SuperAdmins: `firestore.rules` Blocks `markBgvUnderProcess` and `vendorSubmitBgvReport`, `completeBgvReviewServer` Rejects `BGV_UPLOAD_CERTIFICATE` and `BGV_VIEW_SCOPE_ALL`, and `FIRESTORE_RULES_PERMS` Strips `BGV_VIEW_SCOPE_ALL`
- **Severity:** `CRITICAL`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/services/bgvService.ts:282, 318–362, 412–473`
  - `components/AdminBgvManagementPage.tsx:100, 103`
  - `functions/index.js:3870–3884, 8199–8201, 8214, 8235–8244`
  - `firestore.rules:465–482`

#### Root Cause & Exact Code Trace
1. **`markBgvUnderProcess` & `vendorSubmitBgvReport` Blocked by `firestore.rules:471, 473–481`**:
   - `markBgvUnderProcess` (`bgvService.ts:326`) and `vendorSubmitBgvReport` (`bgvService.ts:352`) are client-side `updateDoc` calls that mutate `status` (`BgvStatus.UNDER_PROCESS` and `BgvStatus.VENDOR_SUBMITTED`).
   - However, `firestore.rules:471` forbids any non-SuperAdmin staff from changing `status` (`!request.resource.data.diff(resource.data).affectedKeys().hasAny(['status', 'approvedBy', 'rejectedBy', 'completedDate'])`), and the vendor rule (`L473–481`) requires `resource.data.vendorId == request.auth.uid` (which `markBgvUnderProcess` never sets) and restricts `affectedKeys().hasOnly(['vendorReportUrl', 'vendorSubmittedAt', 'vendorRemarks', 'updatedAt'])`—whereas `vendorSubmitBgvReport` (`bgvService.ts:352–360`) writes `status`, `bgvDocumentUrl`, `bgvDocumentPath`, `bgvDocumentName`, `vendorSubmittedDate`, and `notes`!
2. **`BGV_UPLOAD_CERTIFICATE` Rejected by `completeBgvReviewServer` (`functions/index.js:8199–8201, 8214`)**:
   - In `AdminBgvManagementPage.tsx:100`, `canUpload = isSuperAdmin || hasPermission(Permission.BGV_MANAGE) || hasPermission(Permission.BGV_UPLOAD_CERTIFICATE)` enables **"Mode A: Upload BGV Certificate"**, which calls `staffDirectCompleteBgv` (`bgvService.ts:412`) -> `completeBgvReviewServer`.
   - However, `completeBgvReviewServer` (`functions/index.js:8199–8201, 8214`) only allows `BGV_APPROVE_REJECT` or `BGV_MANAGE`, rejecting `BGV_UPLOAD_CERTIFICATE` with `permission-denied` (and the client fallback at `bgvService.ts:457` is blocked by `firestore.rules:471`).
3. **`BGV_VIEW_SCOPE_ALL` Stripped from JWT Claims & Ignored in `completeBgvReviewServer` (`functions/index.js:3871, 8235–8244`)**:
   - `FIRESTORE_RULES_PERMS` (`functions/index.js:3871`) omits `BGV_VIEW_SCOPE_ALL`, and `completeBgvReviewServer` (`L8236–8239`) only checks `EMPLOYEES_VIEW_SCOPE_ALL` and `SUBMISSIONS_VIEW_SCOPE_ALL`, throwing `permission-denied: You do not have management authority for site "..."` for global BGV officers.

#### Real-World Impact
Non-SuperAdmin BGV officers and BGV vendors cannot mark BGV records as "Under Process", cannot upload vendor reports, cannot complete Mode A direct certificate uploads with `BGV_UPLOAD_CERTIFICATE`, and cannot approve BGV records across branches even when granted `BGV_VIEW_SCOPE_ALL`.

#### Remediation (`diff`)
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3871,1 +3871,1 @@
-    'EMPLOYEES_VIEW', 'EMPLOYEES_VIEW_SCOPE_ALL', 'EMPLOYEES_EDIT', 'EMPLOYEES_DELETE',
+    'EMPLOYEES_VIEW', 'EMPLOYEES_VIEW_SCOPE_ALL', 'BGV_VIEW_SCOPE_ALL', 'EMPLOYEES_EDIT', 'EMPLOYEES_DELETE',
@@ -8199,3 +8199,4 @@
     let hasPerm = isSuperAdmin ||
         permissions.includes('BGV_APPROVE_REJECT') ||
-        permissions.includes('BGV_MANAGE');
+        permissions.includes('BGV_MANAGE') ||
+        permissions.includes('BGV_UPLOAD_CERTIFICATE');
@@ -8214,1 +8215,1 @@
-                hasPerm = rolePerms.includes('BGV_APPROVE_REJECT') || rolePerms.includes('BGV_MANAGE');
+                hasPerm = rolePerms.includes('BGV_APPROVE_REJECT') || rolePerms.includes('BGV_MANAGE') || rolePerms.includes('BGV_UPLOAD_CERTIFICATE');
@@ -8237,3 +8238,4 @@
             const hasGlobalScope = permissions.includes('EMPLOYEES_VIEW_SCOPE_ALL') ||
                 permissions.includes('SUBMISSIONS_VIEW_SCOPE_ALL') ||
+                permissions.includes('BGV_VIEW_SCOPE_ALL') ||
                 permissions.includes('MANAGE_ROLES');
```

---

### `UDF-AUD-55` — `processRequestReviewServer` Ignores `permissionOverrides`, Fails to Escalate Unassigned Site Workflow Levels, Leaves Auth Enabled on Immediate Resignation Approval, and `saveUserOverrides` Drops `allowedPrefillFieldIds`
- **Severity:** `HIGH`
- **Category:** `Security Vulnerability`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:3870–3884, 4761–4806, 4846–4921, 4993–5041`
  - `src/utils/workflowHelper.ts:51–90`
  - `components/AdminRoleManagementPage.tsx:590–600, 719–735`

#### Root Cause & Exact Code Trace
1. **Per-Staff `permissionOverrides` Ignored in `processRequestReviewServer` (`functions/index.js:4775–4802`)**:
   - When verifying permissions for `leave_requests`, `resignations`, and `account_updates`, `processRequestReviewServer` loads `rData.permissions` from `roles/{callerRoleId}` (`L4780`) without applying `staffDoc.permissionOverrides` (`Record<string, boolean>`).
   - If a SuperAdmin revokes `LEAVES_APPROVE: false` on an individual staff member via User Overrides, `processRequestReviewServer` still allows them to approve leave requests. Conversely, if a staff member is granted `LEAVES_REJECT: true` or `LEAVES_REVERT_DECISION: true` via `permissionOverrides`, `FIRESTORE_RULES_PERMS` (`L3870`) strips those keys from JWT claims and `processRequestReviewServer` ignores `staffDoc.permissionOverrides`, throwing `permission-denied`.
2. **Unassigned Workflow Level Desynchronization (`functions/index.js:4852, 4900–4916` vs `src/utils/workflowHelper.ts:51–90`)**:
   - When a site has no staff assigned to Level 1 (e.g. Field Officer), `getEffectiveApprovalLevel` (`workflowHelper.ts:69–82`) escalates the request to Level 2 (HR Manager) in the UI and displays **"Final Approval"**.
   - However, when the Level 2 HR Manager clicks Approve, `processRequestReviewServer` (`L4852, 4900`) inspects raw `reqData.currentLevel` (`1 < 2`) without checking whether Level 1 is assigned to the site—advancing `currentLevel` from `1` to `2` and keeping `status: 'Pending'` instead of finalizing approval!
3. **Immediate Resignation Approval Leaves Firebase Auth Enabled (`functions/index.js:4993–5041`)**:
   - When a resignation with `relievingDate <= today` (`isPastOrToday`) is approved, `processRequestReviewServer` marks the employee `'Relieved'` and sets `isProcessed: true` (`L5010`) **without calling `admin.auth().updateUser(linkedUid, { disabled: true })`**. Because `isProcessed` is already `true`, `processNoticePeriodExitsCron` never processes them either, leaving the relieved employee's Firebase Auth session active indefinitely.
4. **Reverting Approved Resignations or Account Updates Leaves Employee Mutated (`functions/index.js:4872–4898`)**:
   - `action === 'REVERT'` only refunds `leaveBalance` for `leave_requests` (`L4881`). Reverting an approved `resignations` request leaves `resignationStatus: 'Notice Period'` / `isRelieved: true` on `employees` (so `processNoticePeriodExitsCron` still auto-relieves them!), and reverting an approved `account_updates` request never restores `currentValue`.
5. **`saveUserOverrides` Drops `allowedPrefillFieldIds` (`AdminRoleManagementPage.tsx:590–600, 719–735`)**:
   - `toggleAllowedPrefillField` (`L590`) updates `editingUserOverrides.allowedPrefillFieldIds`, but `saveUserOverrides` (`L724–726`) calls `updateStaffAccount(editingUserOverrides.id, { permissionOverrides: editingUserOverrides.permissionOverrides })`—discarding `allowedPrefillFieldIds`.

#### Real-World Impact
Revoked per-user approval permissions can still approve requests on the server, escalated multi-level requests require clicking "Final Approval" twice, immediately relieved employees retain active Firebase Auth accounts, reverted resignations still auto-terminate employees at midnight, and per-user prefill field overrides in Role Manager are silently lost on save.

#### Remediation (`diff`)
```diff
--- a/components/AdminRoleManagementPage.tsx
+++ b/components/AdminRoleManagementPage.tsx
@@ -724,3 +724,4 @@
       await updateStaffAccount(editingUserOverrides.id, {
-        permissionOverrides: editingUserOverrides.permissionOverrides || {}
+        permissionOverrides: editingUserOverrides.permissionOverrides || {},
+        allowedPrefillFieldIds: editingUserOverrides.allowedPrefillFieldIds || []
       });
```

---

### `UDF-AUD-56` — Midnight Cron Bugs: `processNoticePeriodExitsCron` Uses UTC Date at 00:30 IST (Delaying All Exits by 24 Hours), and `autoDeleteRecycleBin` Passes Submission UUID Instead of Badge ID (`employeeId`)
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:2682–2754, 2796–2875`

#### Root Cause & Exact Code Trace
1. **24-Hour Off-By-One in `processNoticePeriodExitsCron` (`functions/index.js:2796–2822`)**:
   - `processNoticePeriodExitsCron` runs at `schedule: "30 0 * * *"` (`00:30 AM Asia/Kolkata`), which is `19:00 UTC` of the **previous calendar day**.
   - Line `2803` computes `const todayStr = new Date().toISOString().split('T')[0];` (**UTC**), which at `00:30 IST` always evaluates to **yesterday's date** in India! Consequently, `if (relDateStr <= todayStr)` (`L2822`) is `false` on the employee's actual relieving date, delaying every notice-period termination by 24 hours. It also fails to set `isProcessed: true` on the `resignations` document or clear `assignedSiteIds: []` / `activeAssignments: []`.
2. **Broken Cascade Delete in `autoDeleteRecycleBin` (`functions/index.js:2683–2711, 2747–2754`)**:
   - `performHardDelete` sets `const uniqueId = docSnap.id;` (`L2684`, the document UUID) and calls `deleteAssociated(uniqueId)` (`L2708`), which queries `.where('employeeId', '==', id)` across `leave_requests`, `account_updates`, `resignations`, and `disciplinary_actions`. Because those collections store the badge ID (`data.employeeId`, e.g. `HY10045`), `0` associated records are deleted. Furthermore, `performHardDelete` only deletes `onboarding/${uniqueId}/` in Storage (leaving `employees/${data.employeeId}/` intact), never deletes the employee's Firebase Auth account, and `/recycle_bin` expiration (`L2747–2753`) only deletes the `/recycle_bin` wrapper document without deleting the underlying `STAFF` account.

#### Real-World Impact
Notice-period employees remain active with login access for an extra 24 hours past their relieving date, and 60-day Recycle Bin auto-purges leave orphaned leave/resignation/disciplinary records, `employees/{badgeId}` Storage files, Firebase Auth accounts, and soft-deleted `staff_accounts` behind.

#### Remediation (`diff`)
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -2803,1 +2803,1 @@
-        const todayStr = new Date().toISOString().split('T')[0];
+        const todayStr = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
@@ -2684,2 +2684,3 @@
         const uniqueId = docSnap.id;
+        const badgeId = data.employeeId || uniqueId;
         const archiveRef = db.collection('deleted_archives').doc(uniqueId);
@@ -2708,1 +2709,1 @@
-        await deleteAssociated(uniqueId);
+        await deleteAssociated(badgeId);
```

---

### `UDF-AUD-57` — `rejoinEmployeeServer` Rejects `EMPLOYEES_ACTION_REJOIN` and Checks Wrong SuperAdmin Role ID (`'super-admin'`), and `firestore.rules` Blocks `MANAGE_SYSTEM` Admins From Saving Safety Quizzes
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:5658–5664`
  - `firestore.rules:150, 589–592`
  - `components/AdminWebsiteManager.tsx:193–214`

#### Root Cause & Exact Code Trace
1. **`rejoinEmployeeServer` Permission Lockout (`functions/index.js:5658–5664`)**:
   - Line `5658` checks `token.roleId === 'super-admin'` (instead of `'role-super-admin'`) with zero Firestore `staff_accounts`/`users` fallback, and lines `5660–5664` check only `permissions.includes('SUBMISSIONS_APPROVE') || permissions.includes('MANAGE_SUBMISSIONS')`—completely omitting **`EMPLOYEES_ACTION_REJOIN`** (which `AdminMasterEmployeeListPage.tsx:1676` uses to render the Rejoin button, and which `FIRESTORE_RULES_PERMS` at `L3870` strips from `token.permissions`).
2. **`safety_quizzes` Write Blocked for `MANAGE_SYSTEM` (`firestore.rules:589–592`)**:
   - `AdminWebsiteManager.tsx` is gated by `Permission.MANAGE_SYSTEM`, and its "Safety Quiz Manager" tab (`L193–214`) calls `createQuizQuestion`, `updateQuizQuestion`, and `deleteQuizQuestion` on `safety_quizzes`. However, `firestore.rules:591` only permits `isSuperAdmin() || hasPermission('GAMIFICATION_MANAGE')` (where `GAMIFICATION_MANAGE` is not even assignable in `AdminRoleManagementPage.tsx`), blocking all `MANAGE_SYSTEM` admins with `PERMISSION_DENIED`.

#### Real-World Impact
HR staff granted `EMPLOYEES_ACTION_REJOIN` receive `permission-denied` whenever they attempt to rejoin a relieved employee, and System Admins with `MANAGE_SYSTEM` fail with `PERMISSION_DENIED` when creating, editing, or deleting Safety Quiz questions in Website Manager.

#### Remediation (`diff`)
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -591,1 +591,1 @@
-      allow create, update, delete: if isSuperAdmin() || hasPermission('GAMIFICATION_MANAGE');
+      allow create, update, delete: if isSuperAdmin() || hasPermission('GAMIFICATION_MANAGE') || hasPermission('MANAGE_SYSTEM');
```

---

### `UDF-AUD-58` — Employee Inquiry (`AdminTimelineSearchPage`) Renders Blank Buttons (`text` & `icon` Props Ignored by `Button.tsx`) and Fires Duplicate `onViewTimeline` Calls
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminTimelineSearchPage.tsx:44–60, 87–121`
  - `components/common/Button.tsx:4–42`
  - `components/common/Input.tsx:5–44`
  - `components/BulkImportModal.tsx:388`

#### Root Cause & Exact Code Trace
- `components/common/Button.tsx:10–41` only renders `{children}` and does not accept `text`, `icon`, or `loading` props (`...props` is spread directly onto the DOM `<button>`).
- However, `AdminTimelineSearchPage.tsx:54–59` (`<Button type="submit" variant="primary" disabled={loading} text={loading ? 'Searching...' : 'Search'} />`) and `L114–120` (`<Button variant="secondary" size="sm" onClick={...} text="View Timeline" icon={<Clock size={16} />} />`) pass `text` and `icon` without `children`, rendering **empty, label-less buttons** and attaching `icon="[object Object]"` to the DOM `<button>` (as does `<Input icon={<Search />} />` at `L44–51`, and `<Button loading={isCheckingDuplicates}>` in `BulkImportModal.tsx:388`).
- Additionally, `AdminTimelineSearchPage.tsx:89` (`<li onClick={() => onViewTimeline(...)}>`) and `L116` (`<Button onClick={() => onViewTimeline(...)}>`) both fire `onViewTimeline` on a single click without `e.stopPropagation()`.

#### Real-World Impact
The "Employee Inquiry" (`AdminTimelineSearchPage`) page renders blank Search and View Timeline buttons with no text or icons and triggers React DOM warnings and duplicate navigation callbacks when clicked.

#### Remediation (`diff`)
```diff
--- a/components/common/Button.tsx
+++ b/components/common/Button.tsx
@@ -4,12 +4,16 @@
 interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
   variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
   size?: 'sm' | 'md' | 'lg';
-  children: React.ReactNode;
+  children?: React.ReactNode;
+  text?: string;
+  icon?: React.ReactNode;
+  loading?: boolean;
 }
 
 export const Button: React.FC<ButtonProps> = ({ 
   variant = 'primary', 
   size = 'md', 
   children, 
+  text,
+  icon,
+  loading,
   className = '', 
   ...props 
 }) => {
@@ -38,3 +42,4 @@
   return (
     <button className={classes} {...props}>
+      {icon && <span className="mr-1.5 inline-flex items-center">{icon}</span>}
-      {children}
+      {children ?? text}
     </button>
   );
 };
```

---

### `UDF-AUD-59` — Site-Scoped Supervisors See Unfiltered Company-Wide Grievance Counts in KPI Cards & Badges, and `BlogDashboardPage` Submits Grievances Without `siteId`
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminGrievancesPage.tsx:191–198, 393–397`
  - `components/BlogDashboardPage.tsx:31, 194`

#### Root Cause & Exact Code Trace
1. **Unfiltered KPI & Badge Counts (`AdminGrievancesPage.tsx:191–198, 393–397`)**:
   - While `filteredComplaints` (`L157–175`) filters grievances by `staffSiteIds` (`user?.sitesManaged`), `grievanceStats` (`L191–198`) calculates `total`, `pending`, `inReview`, and `resolved` from the raw company-wide `complaints` array instead of `filteredComplaints`.
2. **Missing `siteId` on Grievances Submitted from `BlogDashboardPage` (`BlogDashboardPage.tsx:31, 194`)**:
   - `BlogDashboardPage.tsx:31` sets `userId = user?.portalId || user?.id` and calls `submitComplaint(userId, userName, complaintText)` (`L194`) without passing `siteId` or `siteName`. If `resolveEmployeeDoc(userId)` (`engagementService.ts:323`) fails to match `portalId`, `siteId` is stored as `''`, and `AdminGrievancesPage.tsx:163–166` hides all complaints with `siteId === ''` from site-scoped supervisors.

#### Real-World Impact
Site-scoped supervisors see global company-wide grievance numbers in the top KPI cards and tab badges even when their table has `0` site grievances, and grievances submitted from the Blog Hub without a resolved `siteId` are invisible to branch supervisors.

#### Remediation (`diff`)
```diff
--- a/components/AdminGrievancesPage.tsx
+++ b/components/AdminGrievancesPage.tsx
@@ -191,8 +191,8 @@
   const grievanceStats = useMemo(() => {
-    const total = complaints.length;
-    const pending = complaints.filter(c => c.status === 'pending').length;
-    const inReview = complaints.filter(c => c.status === 'in-review').length;
-    const resolved = complaints.filter(c => c.status === 'resolved' || c.status === 'dismissed').length;
+    const total = filteredComplaints.length;
+    const pending = filteredComplaints.filter(c => c.status === 'pending').length;
+    const inReview = filteredComplaints.filter(c => c.status === 'in-review').length;
+    const resolved = filteredComplaints.filter(c => c.status === 'resolved' || c.status === 'dismissed').length;
     return { total, pending, inReview, resolved };
-  }, [complaints]);
+  }, [filteredComplaints]);
```

---

### `UDF-AUD-60` — Forced Default-Password Modal Re-Triggers in a Loop on `EmployeeDashboardPage` After Google Linking or Stale Props, and `securityAction` State Type Omits `'change_google'`
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/EmployeeDashboardPage.tsx:86, 91–96, 356, 413, 577, 613`
  - `components/employee/SecuritySettingsModal.tsx:56–59, 229`

#### Root Cause & Exact Code Trace
- In `EmployeeDashboardPage.tsx:91–96`:
  ```tsx
  useEffect(() => {
    if (employeeData && (employeeData as any).isDefaultPassword === true && !showSecurityModal) {
      setIsForcedSecurity(true);
      setShowSecurityModal(true);
    }
  }, [employeeData]);
  ```
  1. When the modal is open in Forced Mode (`isForced: true`), `SecuritySettingsModal.tsx:229` still displays the **"Link Google"** button. If an employee clicks "Link Google", `linkGoogleAccount` (`functions/index.js`) links their Google account but **never sets `isDefaultPassword: false`** on `employees`, so 2.5 seconds later `onClose()` runs and the forced password modal immediately pops back up on the next `employeeData` update.
  2. Even when the employee changes their password (`changePassword` sets `isDefaultPassword: false` in Firestore), if `employeeData` in `App.tsx` was hydrated from `onLoginSuccess` local state (`EmployeeLoginPage.tsx:81`) rather than the live Firestore snapshot, `employeeData.isDefaultPassword` remains `true` in memory and re-triggers the forced modal.
  3. Additionally, `securityAction` (`EmployeeDashboardPage.tsx:86`) is typed as `'all' | 'password' | 'link_google' | 'unlink_google'`, omitting `'change_google'` (which `L413` and `L577` pass via `as any`).

#### Real-World Impact
Employees forced to change their default password get stuck in a recurring forced-security modal if they link Google first or if `employeeData` re-renders before parent state clears `isDefaultPassword`.

#### Remediation (`diff`)
```diff
--- a/components/EmployeeDashboardPage.tsx
+++ b/components/EmployeeDashboardPage.tsx
@@ -86,2 +86,3 @@
-  const [securityAction, setSecurityAction] = useState<'all' | 'password' | 'link_google' | 'unlink_google'>('all');
+  const [securityAction, setSecurityAction] = useState<'all' | 'password' | 'link_google' | 'unlink_google' | 'change_google'>('all');
   const [isForcedSecurity, setIsForcedSecurity] = useState(false);
+  const [hasCompletedForcedSecurity, setHasCompletedForcedSecurity] = useState(false);
@@ -91,6 +92,6 @@
   useEffect(() => {
-    if (employeeData && (employeeData as any).isDefaultPassword === true && !showSecurityModal) {
+    if (employeeData && (employeeData as any).isDefaultPassword === true && !showSecurityModal && !hasCompletedForcedSecurity) {
       setIsForcedSecurity(true);
       setShowSecurityModal(true);
     }
-  }, [employeeData]);
+  }, [employeeData, showSecurityModal, hasCompletedForcedSecurity]);
```


---

### `UDF-AUD-61` — Defeated Lazy-Loading & Redundant Unbounded Real-Time Listeners on Dashboard Mount and Every Tab Switch
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `App.tsx:1131–1177`
  - `components/AdminPortalPage.tsx:223–251`
  - `src/contexts/DataContext.tsx:171–209, 534–539`
  - `src/services/requestService.ts:59–67, 107–115, 144–152`
  - `src/services/employeeService.ts:1150–1163`

#### Root Cause & Exact Code Trace
1. **`onboarding_submissions` Unbounded Listener Tears Down & Re-Subscribes on Every Tab Switch (`App.tsx:1140–1177`)**:
   - Lines `1142–1147` set `shouldSubscribe = currentView === AppView.ADMIN_PORTAL_SUBMISSION_REVIEW || ... || currentView === AppView.ADMIN_DASHBOARD || hasSubmissionsSubscribedRef.current`.
   - Because every Admin logs directly into `AppView.ADMIN_DASHBOARD`, `subscribeToSubmissions` (`employeeService.ts:1150`: `onSnapshot(collection(db, 'onboarding_submissions'))` with no `where` or `limit`) fires immediately on login.
   - Worse still, `currentView` is in the `useEffect` dependency array (`L1177`). Every single time the admin clicks a different sidebar tab, React runs the effect cleanup (`unsubSubmissions()` at `L1175`) and—because `hasSubmissionsSubscribedRef.current` is `true`—immediately attaches a brand-new `onSnapshot` listener over the entire `onboarding_submissions` collection!
2. **All 3 Request Collections Subscribed Immediately on `ADMIN_DASHBOARD` (`AdminPortalPage.tsx:225–229`)**:
   - When `currentAdminView === AppView.ADMIN_DASHBOARD`, `AdminPortalPage.tsx:225–229` immediately calls `ensureModuleSubscribed('LEAVES')`, `ensureModuleSubscribed('ACCOUNT_UPDATES')`, and `ensureModuleSubscribed('RESIGNATIONS')`.
   - Each of those functions (`requestService.ts:60, 108, 145`) opens an unbounded `onSnapshot(collection(db, ...))` across the entire historical collection, even though `AdminDashboardPage.tsx` only displays summary counts already fetched via `getCountFromServer` in `refreshGlobalStats()`!
3. **Duplicate `subscribeToSubmissionsByUid` Listeners for Employees (`DataContext.tsx:534–539` & `App.tsx:1162–1169`)**:
   - When an Employee logs in, both `DataContext.tsx:534` and `App.tsx:1162` call `subscribeToSubmissionsByUid(user.id)` concurrently and write to `setSubmittedForms` with different schemas (`DataContext` writes raw docs; `App.tsx` maps `data: d.formData`).

#### Real-World Impact
Every admin login immediately downloads 4 entire Firestore collections (`onboarding_submissions`, `leave_requests`, `account_updates`, `resignations`), and every sidebar tab switch re-downloads the entire `onboarding_submissions` collection—causing severe initial load latency, high Firestore read billing, and memory churn.

#### Remediation (`diff`)
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -1142,8 +1142,7 @@
       const shouldSubscribe = 
         currentView === AppView.ADMIN_PORTAL_SUBMISSION_REVIEW || 
         currentView === AppView.ADMIN_PORTAL_DRAFTS || 
-        currentView === AppView.ADMIN_PORTAL_SITE_MANAGEMENT || 
-        currentView === AppView.ADMIN_DASHBOARD ||
-        hasSubmissionsSubscribedRef.current;
+        currentView === AppView.ADMIN_PORTAL_SITE_MANAGEMENT;
 
-      if (shouldSubscribe) {
+      if (shouldSubscribe && !hasSubmissionsSubscribedRef.current) {
         hasSubmissionsSubscribedRef.current = true;
--- a/components/AdminPortalPage.tsx
+++ b/components/AdminPortalPage.tsx
@@ -225,5 +225,2 @@
       case AppView.ADMIN_DASHBOARD:
-        ensureModuleSubscribed('LEAVES');
-        ensureModuleSubscribed('ACCOUNT_UPDATES');
-        ensureModuleSubscribed('RESIGNATIONS');
         break;
```

---

### `UDF-AUD-62` — `getPaginatedSubmissions` Downloads Entire Collection on Every Page/Filter Load, Drops Submissions With Top-Level `siteId`, Ignores Badge/Submission ID Search, and Drops Status Tab Switches While `isLoading` Is `true`
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/services/employeeService.ts:1146–1285`
  - `components/AdminReviewSubmissionsPage.tsx:1085–1161, 1212–1216`

#### Root Cause & Exact Code Trace
1. **Unbounded Full-Collection Fetch on Every Filter/Page Load (`employeeService.ts:1164–1251`)**:
   - Whenever `hasSiteFilter || hasSearchFilter` is truthy (which is **always true for every site-scoped Field Officer/Admin** and any search query), `getPaginatedSubmissions` executes an unpaginated `getDocs(query(collection(db, 'onboarding_submissions'), where('status', '==', status), orderBy('timestamp', 'desc')))` (`L1166–1171`) plus `getDoc(doc(db, 'settings', 'sites'))` (`L1190`) on every search keystroke (after 400ms) and every "Load More" click.
2. **Site Filter Drops Submissions With Top-Level `siteId`/`siteName` (`employeeService.ts:1200`)**:
   - Line `1200` checks only `const val = sub.data?.[siteFieldId]; if (!val) return false;`, ignoring `sub.siteId` and `sub.siteName`.
3. **Search Filter Ignores `sub.id` (`UDF-...`), `sub.employeeId` (`HY...`), `sub.phoneNumber`, and Form UUID Name Fields (`employeeService.ts:1220–1230`)**:
   - Only checks `sub[searchField] || sub.data?.[searchField]`, `sub.recruitedByName`, and `sub.inviteId`. Searching by Portal ID (`UDF-...`), Employee ID (`HY...`), or Phone Number returns `0` results.
4. **Dropped Status Tab Switches (`AdminReviewSubmissionsPage.tsx:1086, 1126–1161`) & Missing Section Names (`L1215`)**:
   - `loadMoreData` returns early when `if (isLoading) return;` (`L1086`), dropping status tab changes (`Pending Review` / `Approved` / `Rejected`) triggered while the `submittedForms` effect (`L1147`) is loading. Additionally, `openApprovalModal` (`L1215`) reads `sec.title || 'General'` instead of `sec.name`, grouping all fields under `'General'`.

#### Real-World Impact
Site-scoped staff trigger full-collection reads on every view/pagination action and miss submissions with top-level `siteId`; admins cannot search submissions by Portal ID, Employee ID, or Phone Number; and switching status tabs during an active load fails to update the table.

#### Remediation (`diff`)
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -1199,3 +1199,3 @@
             allSubmissions = allSubmissions.filter(sub => {
-                const val = sub.data?.[siteFieldId];
+                const val = sub.siteId || sub.siteName || sub.data?.[siteFieldId] || sub.data?.siteId || sub.data?.siteName;
                 if (!val) return false;
@@ -1222,7 +1222,11 @@
             allSubmissions = allSubmissions.filter(sub => {
                 const targetValue = sub[searchField] || sub.data?.[searchField] || '';
                 const recruiter = sub.recruitedByName || '';
                 const inviteCode = sub.inviteId || '';
+                const subId = sub.id || '';
+                const empId = sub.employeeId || '';
+                const phone = sub.phoneNumber || '';
                 return String(targetValue).toLowerCase().includes(term) ||
                     recruiter.toLowerCase().includes(term) ||
-                    inviteCode.toLowerCase().includes(term);
+                    inviteCode.toLowerCase().includes(term) ||
+                    subId.toLowerCase().includes(term) ||
+                    empId.toLowerCase().includes(term) ||
+                    phone.toLowerCase().includes(term);
             });
```

---

### `UDF-AUD-63` — "Deep Purge (Google Re-Auth)" Calls `signInWithPopup(auth, provider)`, Overwriting `auth.currentUser` Before Comparing `activeEmail`
- **Severity:** `HIGH`
- **Category:** `Security Vulnerability`
- **Target File(s) & Exact Lines:**
  - `App.tsx:1748–1779`

#### Root Cause & Exact Code Trace
In `handleConfirmDeletion` (`App.tsx:1762–1768`):
```tsx
const result = await signInWithPopup(auth, provider);
const signedInEmail = (result.user.email || '').toLowerCase().trim();
const activeEmail = (auth.currentUser.email || authUser?.email || '').toLowerCase().trim();

if (signedInEmail && activeEmail && signedInEmail !== activeEmail) {
  throw new Error(`Account mismatch: Re-authentication used "${signedInEmail}", but current admin session is logged in as "${activeEmail}".`);
}
```
1. Calling `signInWithPopup(auth, provider)` on the primary `auth` instance **immediately signs in the selected Google account and replaces `auth.currentUser` with `result.user`**.
2. On line `1764`, `auth.currentUser.email` is therefore **already `result.user.email` (`signedInEmail`)**! Thus `activeEmail === signedInEmail` is always true, and the account-mismatch check (`signedInEmail !== activeEmail`) **never triggers**.
3. Furthermore, if the SuperAdmin logged in via Email/Password (or a different Google account), `signInWithPopup(auth, provider)` replaces their active Firebase Auth session with the popup Google account, causing `permanentDeleteEmployee` (`L1786`) and subsequent admin operations to fail with `permission-denied`.

#### Real-World Impact
The Google Re-Authentication guard for Deep Purge fails to verify that the Google account matches the logged-in admin and corrupts the active Firebase Auth session if a different Google account is selected.

#### Remediation (`diff`)
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -1758,10 +1758,11 @@
+        const activeEmail = (authUser?.email || auth.currentUser.email || '').toLowerCase().trim();
+        const { getGoogleCredentialSafely } = await import('./src/utils/googleAuthHelper');
+        const result = await getGoogleCredentialSafely();
+        const signedInEmail = (result.email || '').toLowerCase().trim();
-        const provider = new GoogleAuthProvider();
-        provider.setCustomParameters({ prompt: 'select_account' });
-
-        const result = await signInWithPopup(auth, provider);
-        const signedInEmail = (result.user.email || '').toLowerCase().trim();
-        const activeEmail = (auth.currentUser.email || authUser?.email || '').toLowerCase().trim();
 
         if (signedInEmail && activeEmail && signedInEmail !== activeEmail) {
           throw new Error(`Account mismatch: Re-authentication used "${signedInEmail}", but current admin session is logged in as "${activeEmail}".`);
         }
```

---

### `UDF-AUD-64` — `DataContext.setLeaveBalances` Is a Silent No-Op, `DataContext.leaveBalances` Is Always `[]` for Admins, and `AdminLeaveManagementPage` Shows `0` Leave Balance When `selectedRequest.employeeId` Is a `portalId`
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `App.tsx:550–562, 1084–1126, 1274–1291`
  - `src/contexts/DataContext.tsx:221–287, 497`
  - `components/AdminLeaveManagementPage.tsx:50–63, 113–139`

#### Root Cause & Exact Code Trace
1. **`setLeaveBalances` Is a Hardcoded No-Op (`DataContext.tsx:285–287`)**:
   - `DataContext.tsx:285` defines `const setLeaveBalances = useCallback((val: any) => { /* No-op */ }, []);`. All leave balance calculations in `App.tsx:550–562, 1084–1126, 1274–1291` call `setLeaveBalances(...)`, which silently discards the computed array.
2. **`DataContext.leaveBalances` Is Always `[]` for Admins (`DataContext.tsx:221–283, 497`)**:
   - `DataContext` derives `leaveBalances` by mapping over `employees` (`L222`), which is only populated when `user.type === 'Employee'` (`L497`). For Admins, `employees` is always `[]`, so `leaveBalances` is always `[]`.
3. **`AdminLeaveManagementPage.tsx:115` Fails When `selectedRequest.employeeId` Is a `portalId`**:
   - `handleSubmitLeaveRequest` (`App.tsx:1298, 1303`) sets `request.employeeId = authUser.portalId || authUser.id` (`UDF-...`).
   - When an Admin opens the request modal in `AdminLeaveManagementPage.tsx`, `resolveEmployeeDoc(selectedRequest.employeeId)` (`L55`) loads `selectedEmpRecord`. However, line `115` checks `if (selectedEmpRecord && (selectedEmpRecord.employeeId === employeeId || selectedEmpRecord.id === employeeId))`—omitting `selectedEmpRecord.portalId === employeeId` and `selectedEmpRecord.submissionId === employeeId`! When the employee doc is keyed by badge ID (`HY...`) while `selectedRequest.employeeId` is `UDF-...`, line `115` is `false` and falls through to `leaveBalances.find(...)` (`[]`), displaying `0` total and `0` remaining leave balance.

#### Real-World Impact
Admins reviewing leave requests submitted by employees whose `request.employeeId` is their `portalId` (`UDF-...`) see `0` quota and `0` remaining days in the Leave Review Modal, and table rows outside the modal always see `leaveBalances = []`.

#### Remediation (`diff`)
```diff
--- a/components/AdminLeaveManagementPage.tsx
+++ b/components/AdminLeaveManagementPage.tsx
@@ -115,1 +115,1 @@
-        if (selectedEmpRecord && (selectedEmpRecord.employeeId === employeeId || selectedEmpRecord.id === employeeId)) {
+        if (selectedEmpRecord && (selectedEmpRecord.employeeId === employeeId || selectedEmpRecord.id === employeeId || selectedEmpRecord.portalId === employeeId || selectedEmpRecord.submissionId === employeeId)) {
```

---

### `UDF-AUD-65` — Form Builder `Job Details` Hardcoded `order = 1 / 2` In-Place Mutation Causes Duplicate Field Order Collisions, and `reorderSections` Splices Unsorted `sectionsRef.current`
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `App.tsx:620–632, 729–761`
  - `src/services/adminService.ts:44–56`
  - `components/AdminPortalPage.tsx:575–595`

#### Root Cause & Exact Code Trace
1. **In-Place `order` Collision in `Job Details` (`adminService.ts:46–54` & `App.tsx:746–754`)**:
   - Both `subscribeToFormSections` (`adminService.ts:49–52`) and `syncedSections` (`App.tsx:749–753`) overwrite `unitField.order = 1; postField.order = 2;` without re-indexing the other fields in `Job Details` (`order: 0, 1, 2, 3...`). This creates duplicate `order: 1` and `order: 2` values across fields in `Job Details`, and prevents admins from reordering fields inside `Job Details`.
2. **`reorderSections` Splices Unsorted Array (`App.tsx:620–632` vs `AdminPortalPage.tsx:575`)**:
   - `AdminPortalPage.tsx:575` renders `[...sections].sort((a, b) => a.order - b.order)` and passes the sorted `index` to `reorderSections(index, index - 1)`. However, `reorderSections` (`App.tsx:623`) runs `const res = Array.from(sectionsRef.current); const [rem] = res.splice(src, 1);` without sorting `sectionsRef.current` by `order` first (unlike `reorderFields` at `L708`).

#### Real-World Impact
Reordering fields inside the `Job Details` section in Form Builder fails or produces duplicate sort orders, and moving sections up/down splices the wrong section if `sectionsRef.current` is not already sorted by `order`.

#### Remediation (`diff`)
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -622,2 +622,2 @@
       sendNotification(authUser?.id || 'admin', `Moving section...`, 'info');
-      const res = Array.from(sectionsRef.current);
+      const res = [...sectionsRef.current].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
```

---

### `UDF-AUD-66` — Prop Mismatch (`onUpdateId` vs `onUpdateSubmissionId`) Breaks ID Correction in `AdminReviewSubmissionsPage`, Missing `onRefreshStats` Breaks Recycle Bin Refresh, and `confirmDelete` in `AdminStaffManagementPage` Ignores `mode === 'just-user'`
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `App.tsx:2227–2331`
  - `components/AdminPortalPage.tsx:121, 168, 196, 499–526, 650, 870`
  - `components/AdminStaffManagementPage.tsx:579–709`

#### Root Cause & Exact Code Trace
1. **`onUpdateId` vs `onUpdateSubmissionId` Breaks `AdminReviewSubmissionsPage` (`App.tsx:2312` vs `AdminPortalPage.tsx:121, 196, 650`)**:
   - `App.tsx:2312` passes `onUpdateId: handleUpdateSubmissionId` in `adminProps`, whereas `AdminPortalPage.tsx:196` destructures `onUpdateSubmissionId` (`undefined`) and passes `onUpdateId={onUpdateSubmissionId}` (`undefined`) to `<AdminReviewSubmissionsPage>` (`L650`).
2. **Missing `onRefreshStats` in `adminProps` (`App.tsx:2227–2331` vs `AdminPortalPage.tsx:168, 870`)**:
   - `AdminPortalPage.tsx:870` passes `onRefreshData={props.onRefreshStats}` to `<AdminRecycleBinPage>`, but `App.tsx` never includes `onRefreshStats: refreshGlobalStats` in `adminProps`.
3. **`confirmDelete` Ignores `mode` Parameter (`AdminStaffManagementPage.tsx:579, 608–657, 693–698`)**:
   - `confirmDelete = async (mode: 'just-user' | 'clean-links')` (`L579`) never inspects `mode`: even when the SuperAdmin clicks *"Delete User Only (Keep Site Links)"* (`mode === 'just-user'`), lines `608–657` unconditionally wipe the staff member's `supervisorId` and `supervisorIds` from `settings/sites`, `employees`, and `onboarding_submissions`, and clicking **Undo** on the 10-second toast (`L693–698`) fails to restore `settings/sites`.

#### Real-World Impact
Correcting an Employee ID from Review Submissions silently does nothing, restoring items from the Recycle Bin does not refresh dashboard counters, and deleting a staff account with `'just-user'` still wipes all their site supervisor assignments (and Undo fails to restore them).

#### Remediation (`diff`)
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -2311,3 +2311,5 @@
     onSyncDrive: handleSyncDrive,
     onUpdateId: handleUpdateSubmissionId,
+    onUpdateSubmissionId: handleUpdateSubmissionId,
+    onRefreshStats: refreshGlobalStats,
     onRevertWorkflowRequest: handleRevertWorkflowRequest,
--- a/components/AdminStaffManagementPage.tsx
+++ b/components/AdminStaffManagementPage.tsx
@@ -608,1 +608,1 @@
-      if (deleteLinks.sites.length > 0) {
+      if (mode === 'clean-links' && deleteLinks.sites.length > 0) {
```

---

### `UDF-AUD-67` — `adminProps.userRole` and Module `hasPermission` Helpers Ignore `baseRole.isDisabled === true`, Allowing Disabled Roles to Perform Approvals and Actions in UI
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `App.tsx:2234–2259`
  - `components/AdminLeaveManagementPage.tsx:86`
  - `components/AdminResignationManagementPage.tsx:44`
  - `components/AdminAccountUpdateManagementPage.tsx:40`
  - `components/AdminReviewSubmissionsPage.tsx:2251`

#### Root Cause & Exact Code Trace
- In `App.tsx:2234–2259`, `adminProps.userRole` merges `authUser.permissionOverrides` into `baseRole.permissions` **without checking `if (baseRole.isDisabled) return { ...baseRole, permissions: [] };`**.
- Meanwhile, `AdminLeaveManagementPage.tsx:86`, `AdminResignationManagementPage.tsx:44`, `AdminAccountUpdateManagementPage.tsx:40`, and `AdminReviewSubmissionsPage.tsx:2251` check `userRole?.permissions.includes(p)` directly without checking `userRole?.isDisabled === true` (unlike `AdminPortalPage.tsx:255` and `DataContext.tsx:328`).

#### Real-World Impact
If a role is disabled in Role Manager (`isDisabled: true`), staff assigned to that role still see active Approve/Reject/Delete/Assign ID buttons inside Leave Management, Resignation Management, Account Updates, and Submission Review.

#### Remediation (`diff`)
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -2235,3 +2235,4 @@
       const baseRole = roles.find(r => r.id === authUser?.roleId);
       if (!baseRole) return undefined;
+      if (baseRole.isDisabled) return { ...baseRole, permissions: [] };
```

---

### `UDF-AUD-68` — Unassigned Staff See Global Company-Wide `pendingResignations` and `pendingProfiles` Counts on Dashboard Cards, and `refreshGlobalStats` Omits `EMPLOYEES_VIEW_SCOPE_ALL`
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminDashboardPage.tsx:44–54, 137–160`
  - `src/contexts/DataContext.tsx:411, 438`

#### Root Cause & Exact Code Trace
1. **Unzeroed Dashboard Cards for Unassigned Staff (`AdminDashboardPage.tsx:50–54, 137–160`)**:
   - Lines `50–53` zero out `pendingSubmissionsCount`, `pendingLeavesCount`, `pendingUpdatesCount`, and `activeEmployeesCount` when `isUnassignedStaff` is `true`, **but lines `137–142` (`stats.pendingResignations`) and lines `153–158` (`stats.pendingProfiles`) read raw `stats.*` directly**.
2. **`refreshGlobalStats` Omits `EMPLOYEES_VIEW_SCOPE_ALL` (`DataContext.tsx:411`)**:
   - `DataContext.tsx:411` sets `const hasViewScopeAll = isSuper || hasPermission(Permission.SUBMISSIONS_VIEW_SCOPE_ALL);`—omitting `hasPermission(Permission.EMPLOYEES_VIEW_SCOPE_ALL)` (which `DataContext.tsx:304` and `AdminDashboardPage.tsx:46` both include!). Consequently, for a role with `EMPLOYEES_VIEW_SCOPE_ALL` (and no assigned sites), `hasViewScopeAll` is `false`, `effectiveSiteIds` is `[]`, and `getGlobalStats` (`employeeService.ts:400`) returns `0` for all 6 dashboard KPIs!

#### Real-World Impact
HR officers granted `EMPLOYEES_VIEW_SCOPE_ALL` see `0` Active Employees and `0` Incomplete Profiles on the Admin Dashboard, while unassigned site staff see unzeroed `pendingResignations` and `pendingProfiles` badges.

#### Remediation (`diff`)
```diff
--- a/src/contexts/DataContext.tsx
+++ b/src/contexts/DataContext.tsx
@@ -411,1 +411,1 @@
-            const hasViewScopeAll = isSuper || hasPermission(Permission.SUBMISSIONS_VIEW_SCOPE_ALL);
+            const hasViewScopeAll = isSuper || hasPermission(Permission.SUBMISSIONS_VIEW_SCOPE_ALL) || hasPermission(Permission.EMPLOYEES_VIEW_SCOPE_ALL);
--- a/components/AdminDashboardPage.tsx
+++ b/components/AdminDashboardPage.tsx
@@ -53,1 +53,3 @@
     const activeEmployeesCount = isUnassignedStaff ? 0 : stats.activeEmployees;
+    const pendingResignationsCount = isUnassignedStaff ? 0 : stats.pendingResignations;
+    const pendingProfilesCount = isUnassignedStaff ? 0 : stats.pendingProfiles;
```

---

### `UDF-AUD-69` — `SecureDocumentLink` Fails to Open Base64 `data:` Documents in Modern Browsers (`window.open('data:...', '_blank')` Blocked), and `RequestCorrectionModal` Ignores `initialSelectedFields` Prop Updates
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/components/common/SecureDocumentLink.tsx:36–60, 78–92`
  - `components/common/RequestCorrectionModal.tsx:35–52, 120–128`

#### Root Cause & Exact Code Trace
1. **`window.open('data:...', '_blank')` Blocked by Browser Security (`SecureDocumentLink.tsx:43–45, 78–92`)**:
   - When `path` is a base64 `data:` URI (`isBase64`, labeled `View Document (Local)` at `L89`), `getSecureURL(path)` returns the raw `data:` URI and `handleClick` calls `window.open(resolvedUrl, '_blank', 'noopener,noreferrer')`. Modern browsers block top-frame navigation to `data:` URIs (`Not allowed to navigate top frame to data URL`), opening a blank `about:blank` tab.
2. **`RequestCorrectionModal` Stale `initialSelectedFields` State & Direct State Mutation (`RequestCorrectionModal.tsx:35–52, 120–128`)**:
   - `selectedFields` and `fieldReasons` only read `initialSelectedFields` in their `useState` initializer on mount (`L35, 43`) with no `useEffect` syncing when `isOpen` or `initialSelectedFields` updates; and `handleSelectSectionFields` (`L124`: `if (!selectAll) delete fieldReasons[id];`) mutates React state `fieldReasons` directly inside `setSelectedFields`.

#### Real-World Impact
Clicking "View Document (Local)" on base64-encoded documents opens a blank tab in Chrome/Edge/Firefox, and opening `RequestCorrectionModal` for a submission with pre-flagged conflict fields fails to pre-select those fields if the modal was mounted previously.

#### Remediation (`diff`)
```diff
--- a/src/components/common/SecureDocumentLink.tsx
+++ b/src/components/common/SecureDocumentLink.tsx
@@ -42,4 +42,9 @@
-      const resolvedUrl = await getSecureURL(path);
+      let resolvedUrl = await getSecureURL(path);
+      if (resolvedUrl && resolvedUrl.startsWith('data:')) {
+        const res = await fetch(resolvedUrl);
+        const blob = await res.blob();
+        resolvedUrl = URL.createObjectURL(blob);
+      }
       if (resolvedUrl && isSafeUrl(resolvedUrl)) {
         window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
```

---

### `UDF-AUD-70` — Sequential Unbatched N+1 Delete Loops in `purgeAbandonedDrafts`, `handleCleanStaleDrafts`, `purgeEmployeesCollection`, and `emptyRecycleBin` Cause Multi-Minute UI Freezes
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/services/employeeService.ts:342–359, 4265–4284`
  - `components/AdminDraftsManagementPage.tsx:58–76`
  - `src/services/recycleBinService.ts:385–393`

#### Root Cause & Exact Code Trace
- `purgeAbandonedDrafts` (`employeeService.ts:349–357`), `handleCleanStaleDrafts` (`AdminDraftsManagementPage.tsx:64–67`), `purgeEmployeesCollection` (`employeeService.ts:4268–4281`), and `emptyRecycleBin` (`recycleBinService.ts:388–391`) iterate over every document with a sequential `for (const d of ...)` `await` loop, executing 2–10 serial network round-trips (Cloud Function Storage delete + Firestore delete + Drive delete) per record instead of processing bounded parallel chunks (`Promise.all` with chunk size 10) and `writeBatch(db)`.

#### Real-World Impact
Purging 50–200 stale drafts or recycle bin items takes hundreds of sequential network round-trips, freezing the UI for minutes and leaving partially deleted state if the browser tab closes or times out.

#### Remediation (`diff`)
```diff
--- a/components/AdminDraftsManagementPage.tsx
+++ b/components/AdminDraftsManagementPage.tsx
@@ -63,5 +63,8 @@
             let count = 0;
-            for (const d of staleSubmittedDrafts) {
-                await deleteDraftSubmission(d.id);
-                count++;
+            for (let i = 0; i < staleSubmittedDrafts.length; i += 10) {
+                const chunk = staleSubmittedDrafts.slice(i, i + 10);
+                await Promise.all(chunk.map(d => deleteDraftSubmission(d.id)));
+                count += chunk.length;
             }
```


---

### `UDF-AUD-71` — Non-SuperAdmin With `SITES_MANAGE` Adding or Editing a Site Overwrites `/settings/sites` With Only Their Filtered `allowedSiteIds` Subset (Wiping Out All Other Organization Sites), and Editing Any Site Destroys Co-Supervisors (`supervisorIds`)
- **Severity:** `CRITICAL`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminPortalPage.tsx:773`
  - `components/AdminSiteManagementPage.tsx:281–291, 390–392, 411–423`
  - `src/services/siteService.ts:58–62`

#### Root Cause & Exact Code Trace
1. **Filtered `sites` Prop Saved Back as Full `/settings/sites` Array (`AdminPortalPage.tsx:773` & `AdminSiteManagementPage.tsx:281–291, 390–392, 415–417`)**:
   - `AdminPortalPage.tsx:773` renders `<AdminSiteManagementPage sites={isSuperAdmin ? sites : sites.filter(s => allowedSiteIds?.includes(s.id))} ... />`.
   - When a non-SuperAdmin with `SITES_MANAGE` adds a site (`handleAddSite` at `L390–392`), edits a site (`handleSaveEdit` at `L415–417`), or deletes a designation (`handleDeleteDesignation` at `L281–291`), `AdminSiteManagementPage` computes `updatedSites` from its filtered `sites` prop and calls `saveAllSites(updatedSites)` (`siteService.ts:58–62`), which executes `await setDoc(doc(db, 'settings', 'sites'), { sites: stripUndefined(sites) }, { merge: true })`.
   - Because `{ merge: true }` replaces the top-level `sites` array field in `/settings/sites`, **every site in the organization outside the staff member's `allowedSiteIds` is permanently erased from `/settings/sites`!**
2. **Editing Any Site Wipes Co-Supervisors (`AdminSiteManagementPage.tsx:411–414`)**:
   - `handleSaveEdit` constructs `siteToSave` with `supervisorIds: editingSite.supervisorId ? [editingSite.supervisorId] : []`, discarding all additional co-supervisors in `editingSite.supervisorIds`.

#### Real-World Impact
Any site-scoped admin granted `SITES_MANAGE` who edits their site or adds a site overwrites `/settings/sites` with only their own sites—wiping out all other client sites across the entire company—and editing any site removes its co-supervisors.

#### Remediation (`diff`)
```diff
--- a/components/AdminSiteManagementPage.tsx
+++ b/components/AdminSiteManagementPage.tsx
@@ -409,9 +409,15 @@
-  const handleSaveEdit = () => {
+  const handleSaveEdit = async () => {
     if (editingSite && hasManagePerm) {
+      const existingIds = Array.isArray(editingSite.supervisorIds) ? editingSite.supervisorIds.filter(Boolean) : [];
+      const mergedSupervisorIds = editingSite.supervisorId
+        ? Array.from(new Set([editingSite.supervisorId, ...existingIds]))
+        : existingIds;
       const siteToSave: Site = {
         ...editingSite,
-        supervisorIds: editingSite.supervisorId ? [editingSite.supervisorId] : []
+        supervisorIds: mergedSupervisorIds
       };
-      const updatedSites = sites.map(s => s.id === editingSite.id ? siteToSave : s);
+      const { getSites } = await import('../src/services/siteService');
+      const allCurrentSites = await getSites();
+      const baseSites = allCurrentSites.length > 0 ? allCurrentSites : sites;
+      const updatedSites = baseSites.map(s => s.id === editingSite.id ? siteToSave : s);
       setSites(updatedSites);
       saveAllSites(updatedSites).catch(err => console.error("Failed to save sites:", err));
```

---

### `UDF-AUD-72` — Pre-Compression 5MB Check Blocks Large Scanned PDFs Before `compressPdf` Can Run, Images Undergo Triple Lossy JPEG Re-Encoding, "Crop / Adjust" Button Is Unreachable Dead Code, and Replacing/Removing Files Leaks Orphaned Storage Objects
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/employeeFormFields/EmployeeFileUploadField.tsx:144–170, 235, 391, 445–487`
  - `components/common/DocumentCaptureModal.tsx:291–304`
  - `src/services/storageService.ts:436`
  - `src/utils/pdfCompression.ts:42`

#### Root Cause & Exact Code Trace
1. **PDFs Rejected Before `compressPdf` Runs (`EmployeeFileUploadField.tsx:145–158`)**:
   - Line `146` checks `if (file.size > maxMB * 1024 * 1024 && !isImage) { alert(...); return; }` **before** calling `autoCompressFile` or `uploadSubmissionDocument`. Thus any scanned PDF over 5MB is rejected immediately before `compressPdf` (`pdfCompression.ts:42`) is ever invoked.
2. **Triple Lossy JPEG Re-Encoding on Every Image Upload (`DocumentCaptureModal.tsx:302`, `EmployeeFileUploadField.tsx:157`, `storageService.ts:436`)**:
   - `DocumentCaptureModal.tsx:302` encodes the cropped image as JPEG (`0.92`), `startBackgroundUpload` (`EmployeeFileUploadField.tsx:157`) calls `await autoCompressFile(file)` (re-encoding on canvas as JPEG `0.90`), and `uploadSubmissionDocument` (`storageService.ts:436`) calls `await autoCompressFile(file)` a third time (`0.90`) because `{ skipCompression: true }` is not passed.
3. **Unreachable "Crop / Adjust" Button (`EmployeeFileUploadField.tsx:170, 261, 445–457`)**:
   - As soon as `startBackgroundUpload` completes, `onChange(field.id, path)` sets `value` to the Cloud Storage string path (`isStringVal === true`), so `{isImage && !isStringVal && <Button>Crop / Adjust</Button>}` (`L445`) never renders after upload.
4. **Orphaned Storage Files on Replace/Remove in `DataCorrectionPage` & `DocumentUploadWizard` (`EmployeeFileUploadField.tsx:461–487`)**:
   - `EmployeeFileUploadField` uploads files immediately to Storage on selection (`startBackgroundUpload`), but clicking "Replace" (`L461`) or "Remove" (`L474`) only calls `onChange(field.id, null)` without deleting the previous `valPath` from Storage (unlike `EmployeeFormPage.tsx:1975`, `DataCorrectionPage` and `DocumentUploadWizard` do not delete replaced paths in `onChange`).

#### Real-World Impact
Applicants with `>5MB` scanned PDFs are blocked instead of having their PDFs auto-compressed, uploaded document photos lose sharpness and take 3x longer on mobile CPUs due to triple canvas re-encoding, users cannot re-crop an image after initial confirm, and replacing/removing files in Correction or Profile Completion wizards leaks orphaned files in Cloud Storage.

#### Remediation (`diff`)
```diff
--- a/components/employeeFormFields/EmployeeFileUploadField.tsx
+++ b/components/employeeFormFields/EmployeeFileUploadField.tsx
@@ -144,15 +144,8 @@
     const maxMB = field.maxFileSizeMB || 5;
-    if (file.size > maxMB * 1024 * 1024 && !isImage) {
-      alert(`File size must be less than ${maxMB}MB.`);
-      return;
-    }
 
     setIsUploading(true);
     setUploadProgress(0);
     try {
-      // 3. Auto-compress image files client-side before upload
-      let fileToUpload = file;
-      if (isImage) {
-        fileToUpload = await autoCompressFile(file);
-      }
+      // 3. Auto-compress both images and large PDFs client-side before size check
+      const fileToUpload = await autoCompressFile(file);
@@ -165,5 +158,7 @@
       const path = await uploadSubmissionDocument(
         field.id,
         fileToUpload,
-        (percent) => setUploadProgress(percent)
+        (percent) => setUploadProgress(percent),
+        undefined,
+        { skipCompression: true }
       );
```

---

### `UDF-AUD-73` — Candidate Onboarding Form Persists Unencrypted PII (Aadhaar, PAN, Bank Account) in `localStorage` on Shared PCs, Submits Guest Applications With Empty `passwordHash` When `hashCandidatePassword` Fails, and Reads Stale `formErrors` on Step Validation
- **Severity:** `HIGH`
- **Category:** `Security Vulnerability`
- **Target File(s) & Exact Lines:**
  - `components/EmployeeFormPage.tsx:413–425, 2045–2075, 2156–2177`
  - `src/services/employeeService.ts:810, 976`

#### Root Cause & Exact Code Trace
1. **Plaintext Candidate PII Persisted in `localStorage` (`EmployeeFormPage.tsx:413–425`)**:
   - On every keystroke (`useEffect([formData])`), line `422` writes `localStorage.setItem(SS_FORM_DATA, serialized)`, storing the applicant's full plaintext `formData` (Aadhaar Number, PAN, Bank Account, IFSC, Phone, DOB, Address, and Cloud Storage paths) in persistent `localStorage`—contradicting the kiosk/shared-PC privacy hardening in `src/utils/fileSessionStore.ts:17–21`.
2. **Swallowed `hashCandidatePassword` Failure Creates Un-Loginnable Account (`EmployeeFormPage.tsx:2156–2164`)**:
   - In `handleFinalSubmit`:
     ```tsx
     if (!linkedUid && password) {
       try {
         const { hashCandidatePassword } = await import('../src/services/employeeService');
         hashedPasswordToPass = await hashCandidatePassword(password);
       } catch (err) {
         console.error("Failed to hash password on client", err);
       }
     }
     ```
     If `hashCandidatePassword` fails, `catch` swallows the error and submits the Guest application with `hashedPasswordToPass = undefined` (`passwordHash: ''` at `employeeService.ts:976`), leaving the candidate with neither Google Auth nor a password hash!
3. **Stale `formErrors` Read in `handleNextStep` (`EmployeeFormPage.tsx:2045–2075`)**:
   - `validateStepFields` calls `setFormErrors(prev => ({ ...prev, ...errors }))` asynchronously, and `handleNextStep` (`L2070`) immediately reads `Object.keys(formErrors)[0]` from the pre-update render closure.

#### Real-World Impact
Sensitive candidate PII remains in `localStorage` after closing the browser tab on shared computers, transient network errors during `hashCandidatePassword` permanently lock out Guest applicants after approval, and clicking "Next" with validation errors fails to scroll to the first invalid field.

#### Remediation (`diff`)
```diff
--- a/components/EmployeeFormPage.tsx
+++ b/components/EmployeeFormPage.tsx
@@ -421,2 +421,1 @@
       sessionStorage.setItem(SS_FORM_DATA, serialized);
-      localStorage.setItem(SS_FORM_DATA, serialized);
@@ -2161,3 +2160,5 @@
       } catch (err) {
         console.error("Failed to hash password on client", err);
+        setIsSubmitting(false);
+        setShowSubmissionProgress(false);
+        setSubmissionError("Could not secure your password due to a network error. Please try submitting again.");
+        return;
       }
```

---

### `UDF-AUD-74` — `DataCorrectionPage` Force-Signs Out Already-Logged-In Active Employees on Mount, Pre-Fills Old Unchanged Values That Pass Validation Without Edits, and Treats `{ storagePath: '' }` Objects as Non-Empty Files
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/employee/DataCorrectionPage.tsx:95–119, 244–250, 396–404, 701–738`

#### Root Cause & Exact Code Trace
1. **Forced `auth.signOut()` Destroys Active Employee Sessions (`DataCorrectionPage.tsx:95–119`)**:
   - `handleInitialAuthCheck` checks `const isManager = authUser && (authUser.id === 'super-admin' || authUser.roleId === 'role-super-admin' || authUser.type === 'Admin');` and if `!isManager && auth.currentUser && !hasSignedOutAlready`, calls `await auth.signOut()` (`L110`).
   - When an active employee (`request.targetType === 'employee'`) who is already logged into `employee.udfonline.in` opens a correction link in a new tab, `handleInitialAuthCheck` signs out their Firebase Auth session while `authUser` in `AuthContext` can remain populated, causing subsequent Firestore/Storage calls to fail with `permission-denied`.
2. **Pre-Filled Unchanged Values Pass Submission (`DataCorrectionPage.tsx:244–250, 701–738`)**:
   - Lines `244–249` initialize `formData` with the existing values (`fields[fieldId]`), and `handleSubmit` (`L706–716`) never checks whether any requested field was actually modified from its original value before marking the correction token `'completed'`.
3. **Empty `{ storagePath: '' }` Object Passes `FILE_UPLOAD` Validation (`DataCorrectionPage.tsx:396–398`)**:
   - Line `397` sets `isEmpty = !value || (typeof value === 'string' && value.trim() === '');`, which evaluates to `false` when `value` is an object `{ storagePath: '', driveUrl: '' }`.

#### Real-World Impact
Active employees opening a correction link get forcibly signed out of their employee session, and candidates can submit a correction link without changing any of the fields HR requested them to fix.

#### Remediation (`diff`)
```diff
--- a/components/employee/DataCorrectionPage.tsx
+++ b/components/employee/DataCorrectionPage.tsx
@@ -396,2 +396,3 @@
     } else if (field.type === FieldType.FILE_UPLOAD) {
-      isEmpty = !value || (typeof value === 'string' && value.trim() === '');
+      const pathVal = typeof value === 'object' && value !== null ? (value.storagePath || value.url || '') : value;
+      isEmpty = !pathVal || (typeof pathVal === 'string' && pathVal.trim() === '');
```

---

### `UDF-AUD-75` — Bulk Import Duplicate Scanner Queries Non-Existent `profileData.personalDetails.phoneNumber` Path, Server Call Drops `importMode` (`pending_profile`) & `existingConflicts`, and Client Fallback Calls `hashCandidatePasswordServer` Sequentially Per Row
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/utils/bulkImportUtils.ts:592–597, 791–805, 819–876`

#### Root Cause & Exact Code Trace
1. **Non-Existent Nested Phone Path in `checkDuplicatesInDatabase` (`bulkImportUtils.ts:594–595`)**:
   - Queries `where("profileData.personalDetails.phoneNumber", "in", chunkPhones)` on `employees` and `where("formData.personalDetails.phoneNumber", "in", chunkPhones)` on `onboarding_submissions`. Neither collection has a nested `personalDetails.phoneNumber` object—phone numbers are stored at top-level `phoneNumber` and `data.${phoneFieldId}` / `profileData.${phoneFieldId}` / `formData.${phoneFieldId}`. Consequently, 100% of phone number duplicates are missed during Bulk Import pre-checks.
2. **`bulkImportEmployees` Drops `importMode`, `defaultStatus`, and `existingConflicts` (`bulkImportUtils.ts:796–799`)**:
   - Passes only `options: { generateIds, overwriteMode, idPrefix }` to `bulkImportEmployeesServer`, discarding `importMode` (`'direct' | 'pending_profile'`), `defaultStatus`, and `existingConflicts`.
3. **Sequential Per-Row Cloud Function Hashing in Client Fallback (`bulkImportUtils.ts:819–876`)**:
   - If the server function fails, line `873` executes `await hashCandidatePassword(...)` sequentially inside the `for` loop for every row in the CSV.

#### Real-World Impact
Bulk Import duplicate checking never catches existing employees with the same phone number, selecting "Pending Profile Completion" mode in Bulk Import is ignored by the server function, and fallback imports make N sequential HTTPS calls.

#### Remediation (`diff`)
```diff
--- a/src/utils/bulkImportUtils.ts
+++ b/src/utils/bulkImportUtils.ts
@@ -594,2 +594,2 @@
-            empQueries.push(getDocs(query(collection(db, EMPLOYEES_COLLECTION), where("profileData.personalDetails.phoneNumber", "in", chunkPhones))));
-            subQueries.push(getDocs(query(collection(db, SUBMISSIONS_COLLECTION), where("formData.personalDetails.phoneNumber", "in", chunkPhones))));
+            empQueries.push(getDocs(query(collection(db, EMPLOYEES_COLLECTION), where("phoneNumber", "in", chunkPhones))));
+            subQueries.push(getDocs(query(collection(db, SUBMISSIONS_COLLECTION), where("phoneNumber", "in", chunkPhones))));
@@ -797,2 +797,2 @@
             rows,
-            options: { generateIds, overwriteMode, idPrefix }
+            options: { generateIds, overwriteMode, idPrefix, importMode, defaultStatus }
         });
```

---

### `UDF-AUD-76` — Aadhaar PDF Parser Fails on Year-Only DOBs (`Year of Birth: YYYY`), Hyphenated/Apostrophe Relation Names, and Masked Aadhaar Letters With 16-Digit VIDs
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/utils/aadhaarParser.ts:62–73, 92, 132`

#### Root Cause & Exact Code Trace
1. **Limited DOB Regex (`aadhaarParser.ts:69`)**:
   - `const dobRegex = /DOB\s*:\s*(\d{2}\/\d{2}\/\d{4})|Date of Birth\s*:\s*(\d{2}\/\d{2}\/\d{4})/i;` fails when UIDAI Aadhaar PDFs contain `DOB: YYYY-MM-DD` or `Year of Birth : YYYY`.
2. **Truncated Father/Spouse Names (`aadhaarParser.ts:92`)**:
   - `const relationRegex = /(?:S\s*\/\s*O|D\s*\/\s*O|W\s*\/\s*O|C\s*\/\s*O)[\s:]+([a-zA-Z \.]+?)(?:,|Address|$|
|DOB|[0-9])/i;` excludes `-` and `'`, failing to match or truncating hyphenated/apostrophe names.
3. **VID False-Positive on Masked Aadhaar PDFs (`aadhaarParser.ts:62–66`)**:
   - `const aadhaarRegex = /\d{4}\s\d{4}\s\d{4}/g;` matches the first 3 four-digit groups in the PDF text. On masked e-Aadhaar PDFs (`XXXX XXXX 1234`) that include a 16-digit Virtual ID (`VID : 9123 4567 8901 2345`), `aadhaarMatches[0]` extracts the first 12 digits of the VID (`912345678901`) as the candidate's Aadhaar Number!

#### Real-World Impact
Uploading a masked e-Aadhaar PDF auto-fills the first 12 digits of the 16-digit VID into the Aadhaar Number field, and `Year of Birth` or hyphenated relation names fail to extract.

#### Remediation (`diff`)
```diff
--- a/src/utils/aadhaarParser.ts
+++ b/src/utils/aadhaarParser.ts
@@ -62,5 +62,6 @@
-    const aadhaarRegex = /\d{4}\s\d{4}\s\d{4}/g;
-    const aadhaarMatches = text.match(aadhaarRegex);
+    const textWithoutVid = text.replace(/VID\s*[:\-]?\s*\d{4}\s+\d{4}\s+\d{4}\s+\d{4}/gi, '');
+    const aadhaarRegex = /[2-9]\d{3}\s\d{4}\s\d{4}/g;
+    const aadhaarMatches = textWithoutVid.match(aadhaarRegex);
     if (aadhaarMatches) {
         details.aadhaarNo = aadhaarMatches[0].replace(/\s/g, '');
     }
```

---

### `UDF-AUD-77` — `AdminWebsiteManager` Downloads Entire `attendance` Collection Without Pagination or Date Filter, and `updateDoc(doc(db, 'settings', 'portal_config'))` Fails When Document Does Not Exist
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminWebsiteManager.tsx:28–55, 138–155`

#### Root Cause & Exact Code Trace
1. **Unbounded Full-Collection Scan on `attendance` (`AdminWebsiteManager.tsx:140`)**:
   - `fetchAttendance` executes `const snap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc')));` with no `limit()` and no date range filter, downloading every historical attendance record across all employees and sites.
2. **`updateDoc` on Potentially Non-Existent `settings/portal_config` (`AdminWebsiteManager.tsx:45`)**:
   - `handleRefreshMetrics` calls `await updateDoc(doc(db, 'settings', 'portal_config'), { cachedMetrics: ... })` instead of `setDoc(..., { merge: true })`.

#### Real-World Impact
Opening the Attendance view in Website Manager reads thousands of historical attendance documents in a single query, and refreshing system metrics fails with `NOT_FOUND` if `settings/portal_config` has not been created yet.

#### Remediation (`diff`)
```diff
--- a/components/AdminWebsiteManager.tsx
+++ b/components/AdminWebsiteManager.tsx
@@ -7,1 +7,1 @@
-import { collection, getDocs, getDoc, doc, query, orderBy, where, updateDoc, setDoc, deleteDoc, addDoc, onSnapshot } from 'firebase/firestore';
+import { collection, getDocs, getDoc, doc, query, orderBy, where, limit, updateDoc, setDoc, deleteDoc, addDoc, onSnapshot } from 'firebase/firestore';
@@ -45,1 +45,1 @@
-            await updateDoc(doc(db, 'settings', 'portal_config'), {
+            await setDoc(doc(db, 'settings', 'portal_config'), {
@@ -49,1 +49,1 @@
-            });
+            }, { merge: true });
@@ -140,1 +140,1 @@
-            const snap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc')));
+            const snap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(200)));
```

---

### `UDF-AUD-78` — `subscribeToBgvRecords` Opens an Unbounded Real-Time Listener on All `bgv_records`, and `AdminBgvManagementPage` Ignores `userRole.isDisabled`
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/AdminBgvManagementPage.tsx:86–104, 215–265`
  - `src/services/bgvService.ts:125–145`

#### Root Cause & Exact Code Trace
1. **Unbounded Real-Time Listener on `bgv_records` (`bgvService.ts:125–145`)**:
   - `subscribeToBgvRecords` runs `onSnapshot(query(collection(db, BGV_COLLECTION), orderBy('initiatedDate', 'desc')))` with no `limit()` and no `where('siteId', 'in', ...)`, streaming every BGV record in company history to every staff/vendor client.
2. **Missing `userRole?.isDisabled` Check (`AdminBgvManagementPage.tsx:86–93`)**:
   - `hasPermission` checks `userRole?.permissions?.includes(p)` without checking `if (userRole?.isDisabled === true) return false;`.

#### Real-World Impact
Every BGV page load downloads all historical BGV records in real time regardless of branch scope, and staff assigned to a disabled role retain BGV UI actions.

#### Remediation (`diff`)
```diff
--- a/components/AdminBgvManagementPage.tsx
+++ b/components/AdminBgvManagementPage.tsx
@@ -86,3 +86,4 @@
   const hasPermission = (p: Permission) => {
     if (isSuperAdmin) return true;
+    if (userRole?.isDisabled === true) return false;
     const overrides = (authUser as any)?.permissionOverrides;
```

---

### `UDF-AUD-79` — `seedInitialData` Executes 7 Sequential `getDoc` Calls on Every SuperAdmin Mount and Checks Legacy `settings/roles` Instead of `roles` Collection (Risking Custom Role Deletion)
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/services/adminService.ts:105–134, 255–310`
  - `App.tsx:1058–1072`

#### Root Cause & Exact Code Trace
1. **Destructive Legacy `settings/roles` Check (`adminService.ts:266–270` & `105–133`)**:
   - `seedInitialData` checks `const rolesSnap = await getDoc(doc(db, 'settings', 'roles')); if (!rolesSnap.exists()) { await updateRoles(defaultRoles); }`.
   - Active roles are stored in the top-level `roles` collection (`subscribeToRoles` at `L97`). If the legacy `settings/roles` backup doc is absent or deleted, `updateRoles(defaultRoles)` (`L110–128`) fetches all docs in `collection(db, 'roles')` and **deletes every custom role ID not in `defaultRoles`** (`L121–126`)!
2. **7 Serial `await getDoc` Round-Trips on Every SuperAdmin Login (`adminService.ts:266–306`)**:
   - Checks `roles`, `sites`, `workflows`, `portal_config`, `leave_policy`, `form_sections`, and `editable_fields` sequentially one after another instead of `Promise.all`.

#### Real-World Impact
If `settings/roles` is missing while custom roles exist in `roles/{id}`, logging in as SuperAdmin wipes out all custom roles in the `roles` collection, and 7 sequential Firestore reads slow down every SuperAdmin mount.

#### Remediation (`diff`)
```diff
--- a/src/services/adminService.ts
+++ b/src/services/adminService.ts
@@ -266,4 +266,5 @@
-        const rolesSnap = await getDoc(doc(db, SETTINGS_COLLECTION, ROLES_DOC_ID));
-        if (!rolesSnap.exists()) {
+        const rolesColSnap = await getDocs(collection(db, ROLES_COLLECTION));
+        if (rolesColSnap.empty) {
             await updateRoles(defaultRoles);
             log.log("Seeded Roles");
         }
```

---

### `UDF-AUD-80` — `compressPdf` Never Calls `page.cleanup()` or `pdfJsDoc.destroy()` and Holds Full-Resolution Canvas Buffers in Memory Across Multi-Page PDFs
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `src/utils/pdfCompression.ts:72–125`

#### Root Cause & Exact Code Trace
- In `compressPdf` (`pdfCompression.ts:72–125`), `pdfjsLib.getDocument(...)` spawns a PDF.js worker task (`loadingTask`) and loops through `1..pdfJsDoc.numPages`, creating a `2400px` `<canvas>` per page (`L94–96`).
- Inside the loop, neither `page.cleanup()` nor `canvas.width = 0; canvas.height = 0;` is called after embedding the JPEG, and `await pdfJsDoc.destroy()` is never called after the loop—leaving decoded PDF page trees and high-resolution canvas backing stores allocated in browser memory.

#### Real-World Impact
Compressing multi-page scanned PDFs on mobile devices spikes browser memory and can crash the tab (`Out of Memory`) during onboarding or BGV certificate uploads.

#### Remediation (`diff`)
```diff
--- a/src/utils/pdfCompression.ts
+++ b/src/utils/pdfCompression.ts
@@ -123,3 +123,7 @@
                 height: unscaledViewport.height
             });
+            canvas.width = 0;
+            canvas.height = 0;
+            page.cleanup();
         }
+        await pdfJsDoc.destroy();
```


---

### `UDF-AUD-81` — Public "Apply Now" Job Vacancy Links Never Prefill the Onboarding Form and Are Wiped on Google Sign-In
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Functional Bug`
- **Target File(s) & Exact Lines:**
  - `components/CareersPage.tsx:48–50`
  - `components/BlogPage.tsx:107–109`
  - `components/BlogsPage.tsx:165–167`
  - `components/EmployeeFormPage.tsx:175–183, 345–359, 1059–1076, 2331, 2448, 2467`
- **Root Cause & Exact Code Trace:**
  1. When a candidate clicks **Apply Now** on an open vacancy card on `/careers` (`CareersPage.tsx:49`), `/` (`BlogPage.tsx:108`), or `/blogs` (`BlogsPage.tsx:166`), the app navigates to `/join?siteId=${vacancy.siteId}&role=${encodeURIComponent(vacancy.title)}`.
  2. In `EmployeeFormPage.tsx:345–359`, the URL query prefill effect writes:
     ```tsx
     if (siteParam) next['siteId'] = siteParam;
     if (roleParam) next['designation'] = roleParam;
     ```
     However, every form input rendered by `renderField` (`EmployeeFormPage.tsx:2467`) binds to `value: formData[field.id]` using the UUID field IDs `SITE_FIELD_ID = '52ae217b-2602-4337-a1cd-a1f9bd36a4b0'` ("Unit or Facility") and `DESIGNATION_FIELD_ID = 'db307195-cf54-4a6e-9056-f3974b050c4d'` ("Post of Apply"). Furthermore, `getFieldOptions` (`L2331`) and `renderField` (`L2448`) inspect `formData[SITE_FIELD_ID]` (never `formData['siteId']`) to enable the Designation dropdown.
  3. Worse still, when a new candidate selects **Sign in with Google to Apply** (`EmployeeFormPage.tsx:1048–1076`), `isFormEmpty(formData, referralInvite)` returns `true` (because `'siteId'`, `'designation'`, `SITE_FIELD_ID`, and `DESIGNATION_FIELD_ID` are classified as system keys at `L175–183`), and `setFormData(cleanPrefills)` (`L1076`) rebuilds `cleanPrefills` exclusively from `referralInvite` — wiping out the URL query parameters completely.
- **Real-World Impact:**
  100% of job applicants clicking "Apply Now" from the public Careers or Blog pages land on an un-prefilled onboarding form where "Unit or Facility" is unselected and "Post of Apply" is locked/disabled.
- **Remediation (`diff`):**
```diff
--- a/components/EmployeeFormPage.tsx
+++ b/components/EmployeeFormPage.tsx
@@ -347,12 +347,20 @@
       const params = new URLSearchParams(window.location.search);
       const siteParam = params.get('siteId') || params.get('site');
       const roleParam = params.get('role') || params.get('designation');
       if (siteParam || roleParam) {
+        const matchedSite = siteParam
+          ? sites.find(s => s.id === siteParam || s.name?.trim().toLowerCase() === siteParam.trim().toLowerCase())
+          : undefined;
+        const resolvedSiteId = matchedSite ? matchedSite.id : siteParam;
         setFormData(prev => {
           const next = { ...prev };
-          if (siteParam) next['siteId'] = siteParam;
-          if (roleParam) next['designation'] = roleParam;
+          if (resolvedSiteId) {
+            next['siteId'] = resolvedSiteId;
+            next[SITE_FIELD_ID] = resolvedSiteId;
+          }
+          if (roleParam) {
+            next['designation'] = roleParam;
+            next[DESIGNATION_FIELD_ID] = roleParam;
+          }
           return next;
         });
       }
     } catch (e) {}
-  }, []);
+  }, [sites]);
@@ -1058,6 +1066,14 @@
                 // Preserve only clean referral pre-fills (if visiting with referral)
                 const cleanPrefills: Record<string, any> = {};
+                const urlParams = new URLSearchParams(window.location.search);
+                const urlSite = urlParams.get('siteId') || urlParams.get('site');
+                const urlRole = urlParams.get('role') || urlParams.get('designation');
+                if (urlSite) {
+                  const matchedSite = sites.find(s => s.id === urlSite || s.name?.trim().toLowerCase() === urlSite.trim().toLowerCase());
+                  cleanPrefills[SITE_FIELD_ID] = matchedSite ? matchedSite.id : urlSite;
+                  cleanPrefills['siteId'] = cleanPrefills[SITE_FIELD_ID];
+                }
+                if (urlRole) {
+                  cleanPrefills[DESIGNATION_FIELD_ID] = urlRole;
+                  cleanPrefills['designation'] = urlRole;
+                }
                 if (referralInvite) {
```

---

### `UDF-AUD-82` — Employee Security Tab (`adminControlEmployeeAuth`) Rejects All Delegated Staff (`EMPLOYEES_MANAGE_SECURITY`), Leaves Unlinked Google Custom Claims Active, and Generates Trivial Default Passwords
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Security Vulnerability`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:1645–1768`
  - `components/AdminRoleManagementPage.tsx:199`
- **Root Cause & Exact Code Trace:**
  1. `AdminRoleManagementPage.tsx:199` grants `Permission.EMPLOYEES_MANAGE_SECURITY` (*"Manage Security Tab: Allows managing guard authentication methods, resetting manual passwords, or unlinking Google"*), and `AdminMasterEmployeeListPage.tsx` renders the Security tab for staff holding this permission. However, `adminControlEmployeeAuth` (`functions/index.js:1645–1651`) enforces `if (!isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Only Super Administrators can perform employee credential resets or auth provider changes.')`, blocking every delegated HR administrator with `EMPLOYEES_MANAGE_SECURITY`.
  2. When `action === 'unlink_google'` (`L1680–1688`) executes, it removes `uid` and `linkedGoogleEmail` from the Firestore record, but never clears the custom claims (`admin.auth().setCustomUserClaims(prevUid, {})`) or revokes refresh tokens (`admin.auth().revokeRefreshTokens(prevUid)`) on the unlinked Google user's Firebase Auth account. Because `firestore.rules:91` trusts `request.auth.token.employeeId == portalId`, the unlinked Google account retains full read/write access to the employee's records.
  3. When `action === 'reset_to_default'` (`L1733–1756`) generates a default password for an approved employee, `L1733` inspects `sourceData.data || sourceData.formData || {}` (ignoring `sourceData.profileData` where approved employee fields live), and `L1754` reads `sourceData.phoneNumber || sourceData.aadhaarNumber || ''` (ignoring `profileData['eb3617dc-9f1d-475d-a2db-005b6bc2500c']` and `aadharNumber`), causing `year` to default to `'123'` and `cleanSuffix` to `''` (producing weak passwords like `ramesh123`).
- **Real-World Impact:**
  Delegated HR staff with `EMPLOYEES_MANAGE_SECURITY` cannot use any action in the Employee Security tab, unlinked Google accounts retain unauthorized access to employee records, and default password resets produce easily guessable `firstName123` credentials.
- **Remediation (`diff`):**
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1644,8 +1644,19 @@
     // SECURITY: Only SuperAdmin or staff with EMPLOYEES_MANAGE_SECURITY can reset employee passwords
     const isSuperAdmin = (userSnap.exists && userSnap.data().roleId === 'role-super-admin') ||
                          (staffAccSnap.exists && staffAccSnap.data().roleId === 'role-super-admin') ||
                          (staffSnap.exists && staffSnap.data().roleId === 'role-super-admin');
+    let hasSecurityPerm = isSuperAdmin || (Array.isArray(request.auth.token?.permissions) && request.auth.token.permissions.includes('EMPLOYEES_MANAGE_SECURITY'));
+    if (!hasSecurityPerm && staffDoc) {
+        if (staffDoc.permissionOverrides?.EMPLOYEES_MANAGE_SECURITY === true) hasSecurityPerm = true;
+        else if (staffDoc.permissionOverrides?.EMPLOYEES_MANAGE_SECURITY !== false && staffDoc.roleId) {
+            const rSnap = await db.collection('roles').doc(staffDoc.roleId).get();
+            if (rSnap.exists && rSnap.data().isDisabled !== true && Array.isArray(rSnap.data().permissions)) {
+                hasSecurityPerm = rSnap.data().permissions.includes('EMPLOYEES_MANAGE_SECURITY');
+            }
+        }
+    }
 
-    if (!isSuperAdmin) {
+    if (!hasSecurityPerm) {
         throw new functions.https.HttpsError('permission-denied', 'Only authorized administrators can perform employee credential resets or auth provider changes.');
     }
@@ -1680,10 +1691,17 @@
         else if (action === 'unlink_google') {
+            const prevUids = new Set();
+            if (!empSnap.empty) { const d = empSnap.docs[0].data(); if (d.uid) prevUids.add(d.uid); if (d.linkedUid && d.linkedUid !== 'none') prevUids.add(d.linkedUid); }
+            if (!subSnap.empty) { const d = subSnap.docs[0].data(); if (d.uid) prevUids.add(d.uid); if (d.linkedUid && d.linkedUid !== 'none') prevUids.add(d.linkedUid); }
             const updates = {
                 uid: admin.firestore.FieldValue.delete(),
                 linkedUid: 'none',
                 authProvider: 'manual',
                 linkedGoogleEmail: admin.firestore.FieldValue.delete()
             };
             await Promise.all(docRefs.map(ref => ref.update(updates)));
+            for (const oldUid of prevUids) {
+                await admin.auth().setCustomUserClaims(oldUid, {}).catch(() => {});
+                await admin.auth().revokeRefreshTokens(oldUid).catch(() => {});
+            }
             return { success: true };
         }
@@ -1730,7 +1748,7 @@
                 // Get DOB year: search in data object for any date-of-birth field
                 let year = '123';
-                const dataObj = sourceData.data || sourceData.formData || {};
+                const dataObj = { ...(sourceData.data || {}), ...(sourceData.formData || {}), ...(sourceData.profileData || {}) };
                 for (const [key, val] of Object.entries(dataObj)) {
@@ -1751,5 +1769,7 @@
-                const phoneOrAadhaar = sourceData.phoneNumber || sourceData.aadhaarNumber || '';
+                const phoneOrAadhaar = sourceData.phoneNumber || sourceData.contactNumber || sourceData.aadhaarNumber || sourceData.aadharNumber ||
+                    dataObj['eb3617dc-9f1d-475d-a2db-005b6bc2500c'] || dataObj['18855ee9-0d66-41d6-988b-128b776a8c5b'] || '';
                 const cleanSuffix = String(phoneOrAadhaar || '').replace(/\D/g, '').slice(-4);
```

---

### `UDF-AUD-83` — `restoreRecycleBinServer` Ignores `EMPLOYEES_ACTION_RESTORE`, Permits Cross-Module Restoration (`SITE`, `DESIGNATION`, `VACANCY`, `INVITE`), and Leaves Restored Employees Disabled in Firebase Auth
- **Severity:** `HIGH`
- **Category:** `Security Vulnerability & Broken Feature`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:7053–7228`
  - `components/AdminRoleManagementPage.tsx:191`
- **Root Cause & Exact Code Trace:**
  1. `restoreRecycleBinServer` (`functions/index.js:7054–7072`) checks only `EMPLOYEES_TAB_RECYCLE_BIN` and `DELETE_EMPLOYEE`, omitting `Permission.EMPLOYEES_ACTION_RESTORE` (`AdminRoleManagementPage.tsx:191`: *"Restore Employee: Allows restoring soft-deleted employee files from Trash"*) and ignoring `saData.permissionOverrides` and `roleSnap.data().isDisabled`.
  2. Line 7084 only restricts `['STAFF', 'ROLE']` to SuperAdmin. Consequently, any staff member with `EMPLOYEES_TAB_RECYCLE_BIN` can restore `SITE` records (`L7091`, modifying `/settings/sites` without `SITES_MANAGE`), `DESIGNATION` records (`L7213`, modifying `/settings/portal_config` without `MANAGE_SYSTEM`), `VACANCY` records (`L7202`, without `VACANCIES_MANAGE`), `INVITE` records (`L7190`, without `INVITES_REACTIVATE`), and `EMPLOYEE`/`SUBMISSION` records belonging to any site (no `canStaffViewSite` check).
  3. In `case 'EMPLOYEE'` (`L7143–7166`), `restoreRecycleBinServer` never re-enables the employee's Firebase Auth user (`admin.auth().updateUser(empUid, { disabled: false })` is completely missing, unlike `case 'STAFF'` at `L7139`), and only checks `db.collection('onboarding_submissions').doc(originalId)` (`L7155`) instead of `data.submissionId || data.portalId || originalId`.
- **Real-World Impact:**
  Staff granted `EMPLOYEES_ACTION_RESTORE` are blocked from restoring employees, staff with `EMPLOYEES_TAB_RECYCLE_BIN` can modify global sites and portal settings without authorization, and restored employees remain disabled in Firebase Auth and unable to log in.
- **Remediation (`diff`):**
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -7053,7 +7053,8 @@
     // Authorization: SuperAdmin or EMPLOYEES_TAB_RECYCLE_BIN / DELETE_EMPLOYEE / EMPLOYEES_ACTION_RESTORE
     let hasRestorePerm = isSuperAdmin || 
         permissions.includes('EMPLOYEES_TAB_RECYCLE_BIN') || 
-        permissions.includes('DELETE_EMPLOYEE');
+        permissions.includes('DELETE_EMPLOYEE') ||
+        permissions.includes('EMPLOYEES_ACTION_RESTORE');
 
     if (!hasRestorePerm) {
@@ -7065,7 +7066,8 @@
         if (!allowed && saData.roleId) {
             const roleSnap = await db.collection('roles').doc(saData.roleId).get();
-            const rolePerms = (roleSnap.exists && Array.isArray(roleSnap.data().permissions)) ? roleSnap.data().permissions : [];
-            allowed = rolePerms.includes('EMPLOYEES_TAB_RECYCLE_BIN') || rolePerms.includes('DELETE_EMPLOYEE');
+            const rolePerms = (roleSnap.exists && roleSnap.data().isDisabled !== true && Array.isArray(roleSnap.data().permissions)) ? roleSnap.data().permissions : [];
+            allowed = rolePerms.includes('EMPLOYEES_TAB_RECYCLE_BIN') || rolePerms.includes('DELETE_EMPLOYEE') || rolePerms.includes('EMPLOYEES_ACTION_RESTORE');
         }
         if (!allowed) {
@@ -7148,14 +7150,21 @@
                 isActive: true,
+                status: (data && data.status === 'Relieved') ? 'Active' : (data?.status || 'Active'),
                 isDeleted: false,
                 deletedAt: null,
                 restoredAt: nowIso
             }, { merge: true });
 
             // Also re-activate onboarding_submissions if present
-            const subRef = db.collection('onboarding_submissions').doc(originalId);
+            const subDocId = data?.submissionId || data?.portalId || originalId;
+            const subRef = db.collection('onboarding_submissions').doc(subDocId);
             const subSnap = await subRef.get();
             if (subSnap.exists) {
                 await subRef.update({
                     isActive: true,
                     isDeleted: false,
                     deletedAt: null,
                     restoredAt: nowIso
                 }).catch(() => {});
             }
+            const empAuthUid = data?.uid || data?.linkedUid || originalId;
+            if (empAuthUid && empAuthUid !== 'none') {
+                await admin.auth().updateUser(empAuthUid, { disabled: false }).catch(() => {});
+            }
             break;
         }
```

---

### `UDF-AUD-84` — `deleteSiteServer` Allows Any `SITES_MANAGE` User to Delete Any Site and Permanently Deadlocks When Historical Expired/Consumed Referral Invites Exist
- **Severity:** `HIGH`
- **Category:** `Security Vulnerability & Broken Feature`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:7276–7380`
  - `components/AdminInvitesPage.tsx:1215–1216, 1322`
- **Root Cause & Exact Code Trace:**
  1. `deleteSiteServer` (`functions/index.js:7276–7296`) authorizes callers holding `SITES_MANAGE` or `MANAGE_SITES` (not just `isSuperAdmin` or `SITES_DELETE`) and performs zero check against `token.sitesManaged` or `saData.sitesManaged`, allowing any site supervisor with `SITES_MANAGE` to delete any other site in the company.
  2. Dependency Check #2 (`L7320–7330`) queries `db.collection('referral_invites').where('siteId', '==', siteId).where('status', '==', 'Active').get()` and throws `failed-precondition` (`"Cannot delete ... because it is linked to X active referral invite link(s). Revoke these invites first."`) if `!inviteSnap.empty`. However, referral links that expired by calendar date (`expiresAt < Date.now()`) or single-use consumption (`!isReusable && joined >= 1`) never change their Firestore `status` field from `'Active'`. At the same time, `AdminInvitesPage.tsx:1215–1216, 1322` computes `displayStatus = 'Expired'` for those links and **hides the "Revoke Link" button** (`displayStatus === 'Active'`). As a result, admins cannot revoke the expired/consumed links in the UI and can **never delete the site**.
- **Real-World Impact:**
  Any site that has ever had a single-use or time-expired referral invite is permanently undeletable via `deleteSiteServer`, while site-scoped staff with `SITES_MANAGE` can delete other branches' sites.
- **Remediation (`diff`):**
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -7319,11 +7319,19 @@
     // 2. Dependency Check: Active (non-expired, non-consumed) referral invites
     const inviteSnap = await db.collection('referral_invites')
         .where('siteId', '==', siteId)
         .where('status', '==', 'Active')
         .get();
 
-    if (!inviteSnap.empty) {
+    const trulyActiveInvites = inviteSnap.docs.filter(d => {
+        const inv = d.data();
+        const isCalendarExpired = inv.expiresAt ? new Date(inv.expiresAt).getTime() < Date.now() : false;
+        const isSingleUseConsumed = inv.isReusable === false && (inv.joined || 0) >= 1;
+        return !isCalendarExpired && !isSingleUseConsumed;
+    });
+
+    if (trulyActiveInvites.length > 0) {
         throw new functions.https.HttpsError(
             'failed-precondition',
-            `Cannot delete "${siteName || siteId}" because it is linked to ${inviteSnap.size} active referral invite link(s). Revoke these invites first.`
+            `Cannot delete "${siteName || siteId}" because it is linked to ${trulyActiveInvites.length} active referral invite link(s). Revoke these invites first.`
         );
     }
```

---

### `UDF-AUD-85` — Google Drive & Sheets Sync Engine (`syncRecordToDriveAndSheetsCore` & `appendSubmissionToSheetsServer`) Deadlocks on Errors, Writes Employee Drive URLs to `data` Instead of `profileData`, and Enables Google Sheets Formula Injection
- **Severity:** `HIGH`
- **Category:** `Broken Feature & Security Vulnerability`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:4660–4667, 6222–6587`
- **Root Cause & Exact Code Trace:**
  1. **Permanent `in_progress` Deadlock (`L6238–6247`, `L4663`)**: `syncRecordToDriveAndSheetsCore` writes `driveBackupStatus: 'in_progress'` at `L6244` without a `try/catch/finally` block to reset the status on failure. Furthermore, `onSubmissionCreated` (`L4537, 4663`) invokes `syncRecordToDriveAndSheetsCore` inside a default 60-second / 256MiB trigger (whereas `syncEmployeeToGoogleDriveServer` at `L6590` requires 300s / 1GiB because `uploadFileViaAppsScriptServer` buffers and base64-encodes every file in memory). Any timeout or error leaves `driveBackupStatus === 'in_progress'` permanently, causing all future manual or automated sync calls to exit immediately at `L6238`.
  2. **False-Positive `googleFormSyncStatus: 'synced'` Lockout (`L6368–6372`, `L6394`)**: `syncRecordToDriveAndSheetsCore` unconditionally updates `googleFormSyncStatus: 'synced'` even when `appendSubmissionToSheetsServer` returns `'form_sync_not_configured'`, `'form_sync_failed'`, or `'form_sync_error'`. Subsequent retries via `syncSubmissionToSheetsServer` (`L6679`) hit `if (recordData.googleFormSyncStatus === 'synced' || recordData.googleFormSyncStatus === 'in_progress') return 'already_synced'` (`L6394`) and refuse to sync.
  3. **Employee Drive Links Written to Wrong Field (`L6251` vs `L6356–6360`)**: For `employees` documents (`isEmployee === true`), `L6251` reads `recordData.formData || recordData.profileData || recordData.data`, but `L6357` writes `updatedFormData` (containing the new `.driveUrl` links) only to `updatePayload.data`. Because the portal UI reads `emp.profileData || emp.formData || emp.data`, `profileData` shadows `data` and none of the synced Google Drive file links appear in the UI.
  4. **Google Sheets Formula Injection (`L6535–6542`)**: `sheets.spreadsheets.values.append` uses `valueInputOption: 'USER_ENTERED'` instead of `'RAW'`, allowing candidate-supplied values starting with `=`, `+`, `-`, or `@` to execute formulas inside the HR master spreadsheet.
- **Real-World Impact:**
  Failed or timed-out Drive/Sheets syncs permanently wedge the record against future retries, synced Drive links do not appear on approved employee profiles, and malicious applicants can inject executable spreadsheet formulas into HR's Google Sheet.
- **Remediation (`diff`):**
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -6356,5 +6356,7 @@
     if (isEmployee) {
         updatePayload.data = updatedFormData;
+        if (recordData.profileData) updatePayload.profileData = updatedFormData;
+        if (recordData.formData) updatePayload.formData = updatedFormData;
     } else {
         updatePayload.formData = updatedFormData;
     }
@@ -6367,7 +6369,8 @@
         sheetsSyncStatus = await appendSubmissionToSheetsServer(recordData, updatedFormData, folderUrl);
+        const isSheetSuccess = sheetsSyncStatus === 'sheets_appended' || sheetsSyncStatus === 'form_synced' || sheetsSyncStatus === 'already_synced';
         await targetDocRef.update({
-            googleFormSyncStatus: 'synced',
+            googleFormSyncStatus: isSheetSuccess ? 'synced' : 'failed',
             googleFormSyncedAt: new Date().toISOString(),
             googleSheetsSyncStatus: sheetsSyncStatus
         });
@@ -6535,7 +6538,7 @@
             await sheets.spreadsheets.values.append({
                 spreadsheetId,
                 range: 'Sheet1!A:Z',
-                valueInputOption: 'USER_ENTERED',
+                valueInputOption: 'RAW',
                 requestBody: {
                     values: [row]
                 }
```

---

### `UDF-AUD-86` — Client Fallback in `createRewardRedemption` Burns Employee Points Before Failing `reward_redemptions` Creation (`allow create: if false`)
- **Severity:** `HIGH`
- **Category:** `Broken Feature / Data Loss`
- **Target File(s) & Exact Lines:**
  - `src/services/engagementService.ts:411–460`
  - `functions/index.js:7813–7822, 7857–7881, 7983–7992`
  - `firestore.rules:539–549, 566–570`
- **Root Cause & Exact Code Trace:**
  1. In `createRewardRedemption` (`src/services/engagementService.ts:418–431`), if `redeemRewardServer` fails with any error other than `'functions/failed-precondition'` (for example, `'functions/not-found'` when a reward title in the UI does not match `settings/gamification_rules`, or a transient network error), execution falls through to the client fallback (`L433–459`).
  2. At `L444`, the client executes `await setDoc(streakRef, { points: newPoints }, { merge: true })`. Because `firestore.rules:543` allows point reductions (`request.resource.data.get('points', 0) <= resource.data.get('points', 0)`), Firestore **commits the point deduction**.
  3. Immediately afterward, at `L446`, the client executes `await addDoc(collection(db, 'reward_redemptions'), ...)`. However, `firestore.rules:569` enforces `allow create: if false;` on `reward_redemptions`! The `addDoc` call **always fails** with `PERMISSION_DENIED`, and the `catch` block (`L456–459`) returns `false` without restoring `currentPoints`, permanently burning the employee's points with zero redemption record.
  4. Additionally, in `recordDailyStreakServer` (`functions/index.js:7817`) and `redeemRewardServer` (`L7987`), `db.collection('employees').doc(requestedId).get()` fails to match employees whose `employees` document is keyed by `submissionId` (`UDF-...`) instead of badge ID (`HY...`), and `recordDailyStreakServer` returns early on Day 1 (`!streakSnap.exists`, `L7881`) without performing the Dual-ID sync to `user_engagement/{uid}` (`L7924`).
- **Real-World Impact:**
  Any employee whose `redeemRewardServer` call hits a non-precondition error permanently loses their gamification points without receiving a reward redemption entry, and employees whose `employees` doc is keyed by `submissionId` encounter split point balances between `user_engagement/{uid}` and `user_engagement/{employeeId}`.
- **Remediation (`diff`):**
```diff
--- a/src/services/engagementService.ts
+++ b/src/services/engagementService.ts
@@ -425,35 +425,7 @@
     } catch (serverErr: any) {
-        log.warn('Server redeemRewardServer failed, falling back to local transaction if permitted:', serverErr?.message || serverErr);
-        if (serverErr?.code === 'functions/failed-precondition') {
-            // Insufficient points was strictly rejected by server
-            return false;
-        }
+        log.error('Server redeemRewardServer failed:', serverErr?.message || serverErr);
+        return false;
     }
-
-    try {
-        const streakRef = doc(db, 'user_engagement', userId);
-        const streakSnap = await getDoc(streakRef);
-        const currentPoints = streakSnap.exists() ? (streakSnap.data().points || 0) : 0;
-        
-        if (currentPoints < pointsSpent) {
-            log.warn(`Insufficient points for ${userId}: has ${currentPoints}, needs ${pointsSpent}`);
-            return false;
-        }
-
-        const newPoints = currentPoints - pointsSpent;
-        await setDoc(streakRef, { points: newPoints }, { merge: true });
-
-        await addDoc(collection(db, 'reward_redemptions'), {
-            userId,
-            userName,
-            rewardTitle,
-            pointsSpent,
-            status: 'pending',
-            timestamp: serverTimestamp()
-        });
-        log.log(`Reward redemption created for ${userName}: ${rewardTitle} (${pointsSpent} pts)`);
-        return true;
-    } catch (error) {
-        log.error('Error recording reward redemption:', error);
-        return false;
-    }
+    return false;
 };
```

---

### `UDF-AUD-87` — Data Correction Server Pipeline (`verifyCorrectionIdentity` & `submitCorrectionServer`) Never Enforces `expiresAt`, Never Checks `activeSessionToken`, and Fails to Reset Submission Status or Sync Employee Submissions
- **Severity:** `HIGH`
- **Category:** `Security Vulnerability & Broken Feature`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:4238–4526`
- **Root Cause & Exact Code Trace:**
  1. **Missing Expiry Enforcement (`L4255–4261`, `L4373–4375`)**: Although `getCorrectionChallenge` (`L4195–4201`) checks `data.expiresAt`, neither `verifyCorrectionIdentity` nor `submitCorrectionServer` checks `data.expiresAt`. Because expired correction documents retain `status: 'pending'` in Firestore, an expired link can still be verified and submitted via direct callable invocation.
  2. **Unchecked `activeSessionToken` (`L4330` vs `L4398–4414`)**: `verifyCorrectionIdentity` writes `activeSessionToken: sessionToken` to `correction_requests/{token}` (`L4330`), but `submitCorrectionServer` (`L4398–4414`) never checks `sessionToken === reqData.activeSessionToken` and compares HMAC digests with standard `===` (`L4410`) instead of `crypto.timingSafeEqual`.
  3. **Incomplete Post-Correction State Sync (`L4431–4458`)**: When `reqData.targetType === 'submission'`, `submitCorrectionServer` updates `formData.*` on `onboarding_submissions` (`L4453`) but never resets `status` from `'Correction Requested'` / `'Rejected'` back to `'Pending'` (so the submission remains stuck out of the active review queue) and never re-computes `duplicateMatches`. When `reqData.targetType === 'employee'`, it updates `profileData.*` and `data.*` on `employees` (`L4448–4449`), but never updates `formData.*` on `employees` or the linked `onboarding_submissions` document.
- **Real-World Impact:**
  Expired correction tokens remain usable against the backend, corrected onboarding submissions do not return to `'Pending'` status in the admin review queue, and corrected employee fields diverge between `profileData` and `formData`/`onboarding_submissions`.
- **Remediation (`diff`):**
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4259,6 +4259,12 @@
     if (data.status === 'locked' || (data.failedAttempts || 0) >= 5) {
         throw new functions.https.HttpsError('permission-denied', 'This correction link is locked due to too many failed attempts.');
     }
+    if (data.expiresAt) {
+        const exp = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
+        if (exp < new Date()) {
+            throw new functions.https.HttpsError('failed-precondition', 'This correction link has expired.');
+        }
+    }
@@ -4373,6 +4379,12 @@
     if (reqData.status !== 'pending') {
         throw new functions.https.HttpsError('failed-precondition', 'Correction request is no longer pending.');
     }
+    if (reqData.expiresAt) {
+        const exp = reqData.expiresAt.toDate ? reqData.expiresAt.toDate() : new Date(reqData.expiresAt);
+        if (exp < new Date()) {
+            throw new functions.https.HttpsError('failed-precondition', 'Correction request has expired.');
+        }
+    }
@@ -4409,5 +4421,5 @@
             const expectedHash = crypto.createHmac('sha256', hmacSecret).update(expectedPayload).digest('hex');
-            if (tokenHash === expectedHash) {
+            if (tokenHash === expectedHash && (!reqData.activeSessionToken || sessionToken === reqData.activeSessionToken)) {
                 isAuthorized = true;
             }
@@ -4448,9 +4460,13 @@
         for (const [key, value] of Object.entries(processedData)) {
             updates[`profileData.${key}`] = value;
             updates[`data.${key}`] = value;
+            if (targetData.formData) updates[`formData.${key}`] = value;
         }
     } else {
+        if (targetData.status === 'Correction Requested' || targetData.status === 'Rejected') {
+            updates.status = 'Pending';
+        }
         for (const [key, value] of Object.entries(processedData)) {
             updates[`formData.${key}`] = value;
             if (targetData.data) {
                 updates[`data.${key}`] = value;
             }
         }
     }
```

---

### `UDF-AUD-88` — `AdminInvitesPage.tsx` Ignores `userRole.isDisabled` & `permissionOverrides`, and `firestore.rules` Blocks `INVITES_REACTIVATE` on All Calendar-Expired and Single-Use-Consumed Links
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Rules Mismatch`
- **Target File(s) & Exact Lines:**
  - `components/AdminInvitesPage.tsx:167, 572–605, 1215–1216, 1304`
  - `firestore.rules:507, 516`
- **Root Cause & Exact Code Trace:**
  1. `AdminInvitesPage.tsx:167` defines `const hasPermission = (p: Permission) => isSuperAdmin || userRole?.permissions.includes(p) || false;`, ignoring both `userRole?.isDisabled === true` and `authUser?.permissionOverrides`.
  2. In `AdminInvitesPage.tsx:1215–1216`, a referral link is shown as `displayStatus = 'Expired'` when `invite.expiresAt < Date.now()` or `(!invite.isReusable && (invite.joined || 0) >= 1)`, even though its stored `resource.data.status` in Firestore is still `'Active'`.
  3. When a staff member holding `Permission.INVITES_REACTIVATE` (without `INVITES_MANAGE` or `INVITES_EDIT`) clicks **Reactivate / Extend Expiry** (`handleSaveReactivation`, `L591–595`), `firestore.rules:507, 516` requires `resource.data.status != 'Active' && request.resource.data.status == 'Active'`. Because `resource.data.status` in Firestore is `'Active'`, the rule evaluates to `false` and rejects 100% of reactivations on calendar-expired and single-use-consumed links with `FirebaseError: Missing or insufficient permissions`.
- **Real-World Impact:**
  Staff granted `INVITES_REACTIVATE` cannot reactivate or extend any expired or consumed referral link unless it was manually revoked first, and per-user permission overrides / suspended roles are ignored across the Recruitment & Referral Invites module.
- **Remediation (`diff`):**
```diff
--- a/components/AdminInvitesPage.tsx
+++ b/components/AdminInvitesPage.tsx
@@ -166,3 +166,9 @@
   // Check Permissions
-  const hasPermission = (p: Permission) => isSuperAdmin || userRole?.permissions.includes(p) || false;
+  const hasPermission = (p: Permission) => {
+    if (isSuperAdmin) return true;
+    if (userRole?.isDisabled === true) return false;
+    const overrides = (authUser as any)?.permissionOverrides;
+    if (overrides && overrides[p] !== undefined) return Boolean(overrides[p]);
+    return Boolean(userRole?.permissions?.includes(p));
+  };
--- a/firestore.rules
+++ b/firestore.rules
@@ -507,2 +507,2 @@
-        (hasPermission('INVITES_REACTIVATE') && resource.data.status != 'Active' && request.resource.data.status == 'Active') ||
+        (hasPermission('INVITES_REACTIVATE') && request.resource.data.status == 'Active') ||
@@ -515,3 +515,3 @@
           // Creator wants to reactivate
-          (resource.data.status != 'Active' && request.resource.data.status == 'Active' && hasPermission('INVITES_REACTIVATE')) ||
+          (request.resource.data.status == 'Active' && hasPermission('INVITES_REACTIVATE')) ||
```

---

### `UDF-AUD-89` — `AdminGrievancesPage.tsx` and `firestore.rules` Allow Any Admin to Read/Mutate All Grievances, Rewards, and Inquiries Across All Sites and Open 3 Unbounded Listeners
- **Severity:** `MEDIUM`
- **Category:** `Security Vulnerability & Performance / Cost`
- **Target File(s) & Exact Lines:**
  - `components/AdminGrievancesPage.tsx:76, 116–140, 178–188, 242–265, 1167`
  - `src/services/engagementService.ts:350, 463, 516`
  - `firestore.rules:168, 560–571`
- **Root Cause & Exact Code Trace:**
  1. `firestore.rules:168` (`contact_messages`), `L561–563` (`complaints`), and `L567–570` (`reward_redemptions`) grant `allow read, update, delete: if isAdmin();` without checking module permissions (`GRIEVANCES_VIEW`, `GRIEVANCES_RESOLVE`, `GRIEVANCES_DELETE`, `REWARDS_VIEW`, `REWARDS_MANAGE`, `MANAGE_SYSTEM`) or branch site isolation (`canStaffViewSite(resource.data.get('siteId', ''))`).
  2. `AdminGrievancesPage.tsx:116–140` unconditionally starts all 3 real-time `onSnapshot` listeners (`subscribeToComplaints`, `subscribeToRewardRedemptions`, `subscribeToContactInquiries`) on mount without checking `canViewGrievances`, `canViewRewards`, or `canViewInquiries`, and none of the three queries in `engagementService.ts:350, 463, 516` apply a `limit()`, streaming the entire historical collections on every mount.
  3. `filteredRewards` (`AdminGrievancesPage.tsx:178–188`) has no `allowedSiteIds` filter, and `handleSaveInquiry` (`L242–265, 1167`) allows any user with `GRIEVANCES_VIEW` (read-only access) to modify `contact_messages` status and internal sales notes.
- **Real-World Impact:**
  Any site supervisor or recruiter can read, alter, or delete confidential employee grievances, reward redemptions, and B2B client leads across all sites, while every visit to the Grievances page streams 3 unbounded collections.
- **Remediation (`diff`):**
```diff
--- a/components/AdminGrievancesPage.tsx
+++ b/components/AdminGrievancesPage.tsx
@@ -76,2 +76,3 @@
     const canViewInquiries = isSuperAdmin || hasPermission(Permission.MANAGE_SYSTEM) || hasPermission(Permission.GRIEVANCES_VIEW);
+    const canManageInquiries = isSuperAdmin || hasPermission(Permission.MANAGE_SYSTEM) || hasPermission(Permission.GRIEVANCES_RESOLVE);
@@ -116,18 +117,18 @@
     useEffect(() => {
-        setLoadingComplaints(true);
-        const unsubscribeComplaints = subscribeToComplaints((items) => {
+        const unsubscribeComplaints = canViewGrievances ? subscribeToComplaints((items) => {
             setComplaints(items);
             setLoadingComplaints(false);
-        });
+        }) : (() => { setLoadingComplaints(false); return () => {}; })();
 
-        setLoadingRewards(true);
-        const unsubscribeRewards = subscribeToRewardRedemptions((items) => {
+        const unsubscribeRewards = canViewRewards ? subscribeToRewardRedemptions((items) => {
             setRedemptions(items);
             setLoadingRewards(false);
-        });
+        }) : (() => { setLoadingRewards(false); return () => {}; })();
 
-        setLoadingInquiries(true);
-        const unsubscribeInquiries = subscribeToContactInquiries((items) => {
+        const unsubscribeInquiries = canViewInquiries ? subscribeToContactInquiries((items) => {
             setInquiries(items);
             setLoadingInquiries(false);
-        });
+        }) : (() => { setLoadingInquiries(false); return () => {}; })();
```

---

### `UDF-AUD-90` — `computeAndApplyUserClaims`, `onRoleWritten`, and `onSettingsSitesWritten` Strip Active Permissions via `FIRESTORE_RULES_PERMS` & `.pop()` Truncation and Fail Supervisor Claim Sync
- **Severity:** `MEDIUM`
- **Category:** `Broken Feature / Custom Claims Sync Bug`
- **Target File(s) & Exact Lines:**
  - `functions/index.js:3870–3902, 4015–4054, 4118–4165`
- **Root Cause & Exact Code Trace:**
  1. `computeAndApplyUserClaims` (`functions/index.js:3870–3889`) filters `request.auth.token.permissions` against `FIRESTORE_RULES_PERMS`, which omits `VACANCIES_POST`, `GRIEVANCES_VIEW`, `GRIEVANCES_VIEW_SCOPE_ALL`, `GRIEVANCES_RESOLVE`, `GRIEVANCES_DELETE`, `REWARDS_VIEW`, `REWARDS_MANAGE`, `EMPLOYEES_ACTION_RELIEVE`, `EMPLOYEES_ACTION_REJOIN`, `EMPLOYEES_ACTION_RESTORE`, `EMPLOYEES_EDIT_PROFILE`, `EMPLOYEES_MANAGE_SECURITY`, `SUBMISSIONS_VIEW`, `SUBMISSIONS_PREVIEW_DOCS`, and `SUBMISSIONS_REJECT`. Every Cloud Function that checks `request.auth.token.permissions` for those permissions fails its fast-path token check and either rejects the caller (if it lacks a Firestore fallback, like `rejoinEmployeeServer`) or incurs extra Firestore reads on every invocation.
  2. At `L3900–3902`, `while (JSON.stringify(claims).length > 900 && claims.permissions.length > 0) { claims.permissions.pop(); }` silently drops permissions from the end of the array whenever a staff member has a large permission set or 15–20 `sitesManaged` IDs — stripping `GAMIFICATION_MANAGE`, `DISCIPLINE_*`, `VACANCIES_MANAGE`, `INVITES_*`, and `BGV_*` first.
  3. `onRoleWritten` (`L4021–4024`) queries only `staff_accounts` and `staff`, skipping `users`.
  4. `onSettingsSitesWritten` (`L4150–4158`) looks up changed supervisor IDs only via `admin.auth().getUser(supId)` and `db.collection('staff_accounts').doc(supId).get()`, failing when `supId` is a `username`, `employeeId`, or a document in `users`/`staff`, and invokes `computeAndApplyUserClaims(authUser.uid)` without passing `resolvedDocId` (`supId`), causing `computeAndApplyUserClaims` to miss `staff_accounts/{supId}` when the document ID differs from `authUser.uid`.
- **Real-World Impact:**
  Staff with comprehensive roles silently lose tail permissions in `firestore.rules` due to the 900-byte `.pop()` loop, Cloud Functions miss 15+ permissions from `request.auth.token.permissions`, and assigning a site supervisor whose `staff_accounts` doc ID differs from their Firebase Auth UID fails to update their `sitesManaged` custom claim.
- **Remediation (`diff`):**
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3882,3 +3882,6 @@
         'INVITES_VIEW_ALL', 'VACANCIES_MANAGE', 'DISCIPLINE_MANAGE', 'DISCIPLINE_CREATE',
-        'DISCIPLINE_ISSUE', 'DISCIPLINE_DELETE', 'GAMIFICATION_MANAGE'
+        'DISCIPLINE_ISSUE', 'DISCIPLINE_DELETE', 'GAMIFICATION_MANAGE', 'VACANCIES_POST',
+        'EMPLOYEES_ACTION_RELIEVE', 'EMPLOYEES_ACTION_REJOIN', 'EMPLOYEES_ACTION_RESTORE',
+        'EMPLOYEES_EDIT_PROFILE', 'EMPLOYEES_MANAGE_SECURITY', 'GRIEVANCES_VIEW',
+        'GRIEVANCES_VIEW_SCOPE_ALL', 'GRIEVANCES_RESOLVE', 'GRIEVANCES_DELETE', 'REWARDS_VIEW', 'REWARDS_MANAGE'
     ]);
@@ -4150,9 +4153,10 @@
             let authUser = await admin.auth().getUser(supId).catch(() => null);
+            const snap = await db.collection('staff_accounts').doc(supId).get();
             if (!authUser) {
-                const snap = await db.collection('staff_accounts').doc(supId).get();
                 if (snap.exists && snap.data().email) {
                     authUser = await admin.auth().getUserByEmail(snap.data().email).catch(() => null);
                 }
             }
             if (authUser) {
-                await computeAndApplyUserClaims(authUser.uid);
+                await computeAndApplyUserClaims(authUser.uid, snap.exists ? snap.id : null, snap.exists ? snap.data() : null);
                 console.log(`[TRIGGER: onSettingsSitesWritten] Recomputed claims for supervisor ${authUser.uid}`);
             }
```

### [UDF-AUD-91] [HIGH] Filing Any Disciplinary Action Without an Attachment (`AdminDisciplinaryPage.tsx:76–86`) or Submitting a Leave/Account-Update Request With `undefined` Fields (`requestService.ts:19–35, 90–98, 127–135, 222–230`) Crashes `setDoc`, While `AdminDisciplinaryPage` Leaks Unscoped Records and Hides `DISCIPLINE_DELETE`
- **Category**: Broken Feature / Crash & RBAC Mismatch
- **Target File(s) & Exact Line Numbers**:
  - `components/AdminDisciplinaryPage.tsx` (Lines `76–86, 110–112, 168, 202`)
  - `src/services/requestService.ts` (Lines `19–35, 90–98, 127–135, 222–230`)
- **Root Cause & Exact Code Trace**:
  1. **Firestore `setDoc` Crash on `undefined` Properties**: In `components/AdminDisciplinaryPage.tsx:74–86`, `handleIssueAction` constructs `newAction`:
     ```ts
     const newAction: DisciplinaryAction = {
         id: `DA_${Date.now()}`,
         employeeId: selectedEmployeeId,
         siteId: (empInfo as any)?.siteId || undefined,
         ...
         document: supportingDoc || undefined
     };
     await createDisciplinaryAction(newAction);
     ```
     Whenever the admin issues a warning without attaching a supporting file (`supportingDoc === null`) or the employee's `siteId` is empty, `document` and/or `siteId` evaluate to `undefined`. Inside `createDisciplinaryAction` (`src/services/requestService.ts:222–230`), `uploadFilesInObject(action, ...)` (`L19–35`) iterates `for (const key in obj)` and copies every property (including those whose value is `undefined`) into `result[key]`, then calls `setDoc(doc(db, 'disciplinary_actions', action.id), safe)` (`L228`). Because the client Firestore SDK is initialized without `ignoreUndefinedProperties: true` (`src/firebase.ts:44`), `setDoc()` immediately throws `FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined`. The exact same bug affects `createLeaveRequest` (`requestService.ts:90–98`, when `supportingDocument` or `siteId` is `undefined`) and `createAccountUpdate` (`L127–135`, when `supportingDocument`, `bankDetails`, or `siteId` is `undefined`).
  2. **Cross-Site Leak on Missing `siteId`**: In `AdminDisciplinaryPage.tsx:110–112`, the site filter checks:
     ```ts
     if (allowedSiteIds !== undefined) {
         if (action.siteId && !allowedSiteIds.includes(action.siteId)) return false;
     }
     ```
     If `action.siteId` is missing or `""`, the condition `if (action.siteId && ...)` evaluates to `false` and returns `true`, exposing the disciplinary record to every site-scoped admin across all branches.
  3. **`Permission.DISCIPLINE_DELETE` Ignored in UI**: While `AdminRoleManagementPage.tsx:130` and `firestore.rules:375` grant deletion rights via `Permission.DISCIPLINE_DELETE`, `AdminDisciplinaryPage.tsx:168, 202` hardcodes `{isSuperAdmin && <th ...>Action</th>}` and `{isSuperAdmin && (<td ...><button onClick={() => handleDelete(action.id)}>...)}`, hiding the Delete button from all delegated staff with `DISCIPLINE_DELETE`.
- **Real-World Impact**:
  - Issuing any disciplinary warning without a file attachment fails with a Firestore exception (`Failed to issue disciplinary action`).
  - Delegated HR managers granted `DISCIPLINE_DELETE` cannot delete erroneous disciplinary entries, and records without a `siteId` leak across all branch managers.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/src/services/requestService.ts
+++ b/src/services/requestService.ts
@@ -21,6 +21,9 @@
     const result: any = Array.isArray(obj) ? [] : {};
     for (const key in obj) {
         const value = obj[key];
+        if (value === undefined) {
+            continue;
+        }
         if (value && typeof value === 'object' && 'data' in value && 'name' in value && 'type' in value) {
             if (typeof value.data === 'string' && value.data.startsWith('data:')) {
                 const path = `${folderPath}/${Date.now()}_${value.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
--- a/components/AdminDisciplinaryPage.tsx
+++ b/components/AdminDisciplinaryPage.tsx
@@ -34,7 +34,11 @@
     const isSuperAdmin = authUser?.roleId === 'role-super-admin' || userRole?.id === 'role-super-admin';
     const hasPermission = (p: Permission) => {
         if (isSuperAdmin) return true;
+        if (userRole?.isDisabled === true) return false;
+        if (authUser?.permissionOverrides?.revoked?.includes(p)) return false;
+        if (authUser?.permissionOverrides?.granted?.includes(p)) return true;
         return userRole?.permissions?.includes(p) || false;
     };
     const canIssueDiscipline = hasPermission(Permission.DISCIPLINE_ISSUE) || hasPermission(Permission.MANAGE_REQUESTS);
+    const canDeleteDiscipline = hasPermission(Permission.DISCIPLINE_DELETE) || hasPermission(Permission.MANAGE_REQUESTS);
@@ -108,7 +112,7 @@
     const filteredActions = useMemo(() => {
         return disciplinaryActions.filter(action => {
             if (allowedSiteIds !== undefined) {
-                if (action.siteId && !allowedSiteIds.includes(action.siteId)) return false;
+                if (!action.siteId || !allowedSiteIds.includes(action.siteId)) return false;
             }
             const empName = getEmployeeName(action.employeeId).toLowerCase();
             const empId = action.employeeId.toLowerCase();
@@ -165,7 +169,7 @@
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason & Details</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issued By</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
-                            {isSuperAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>}
+                            {canDeleteDiscipline && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>}
                         </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
@@ -199,7 +203,7 @@
                                     ) : (
                                         <span className="text-gray-400 text-xs">None</span>
                                     )}
                                 </td>
-                                {isSuperAdmin && (
+                                {canDeleteDiscipline && (
                                     <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                         <button
                                             onClick={() => handleDelete(action.id)}
```

### [UDF-AUD-92] [HIGH] `getEmployeeTimeline` (`src/services/employeeService.ts:4404–4629`) Queries Non-Existent `submissionId` on `correction_requests`, Omits `account_updates` and `resignations` Collections Entirely, Never Loads Previous Stint Documents (`previousEmployeeId`), and `searchAllEmployees` (`L4632–4715`) Leaks Records Across All Sites
- **Category**: Broken Feature / Functional Bug & Cross-Site Leak
- **Target File(s) & Exact Line Numbers**:
  - `src/services/employeeService.ts` (Lines `4404–4629, 4632–4715`)
  - `components/events/EmployeeTimelinePage.tsx` (Lines `48–49`)
  - `components/AdminTimelineSearchPage.tsx` (Lines `19–34`)
- **Root Cause & Exact Code Trace**:
  1. **Broken `correction_requests` Query & Field Names**: In `getEmployeeTimeline` (`src/services/employeeService.ts:4589–4613`), Step 9 queries `correction_requests` using `where('submissionId', '==', rid)` and reads `data.targetFieldLabels`:
     ```ts
     const qCorr = query(collection(db, 'correction_requests'), where('submissionId', '==', rid));
     ...
     description: `Admin requested data correction for fields: ${(data.targetFieldLabels || []).join(', ')}`,
     ```
     However, `correction_requests` documents store the target ID in `targetId` (not `submissionId`) and the field list in `requestedFields` (not `targetFieldLabels`, see `AdminCorrectionRequestsPage.tsx:133, 294` and `employeeService.ts:5338–5346`). As a result, `qCorr` always returns 0 documents and 100% of data correction requests are missing from employee timelines.
  2. **Missing `account_updates` and `resignations` Queries**: Although `EmployeeTimelinePage.tsx:48–49` defines icons and badge styles for `UPDATE` (`account_updates`) and `RESIGNATION` (`resignations`) timeline events, `getEmployeeTimeline` only queries `leave_requests` (`L4538`) and `disciplinary_actions` (`L4565`) and never queries `account_updates` or `resignations`.
  3. **Missing Prior Employment Stint (`previousEmployeeId`)**: When an employee is rejoined under a new badge ID (`Path B`), `empData.previousEmployeeId` is pushed to `relatedIds` (`L4418`), which queries `leave_requests` and `disciplinary_actions` for that ID, but `getEmployeeTimeline` never calls `getEmployeeById(empData.previousEmployeeId)` to extract the prior stint's `joiningDate`, `approvedAt`, `promotionHistory`, `relievingDate`, or `rejoinHistory`.
  4. **Unscoped `searchAllEmployees` Leak**: `searchAllEmployees` (`employeeService.ts:4632–4715`), called by `AdminTimelineSearchPage.tsx:26`, accepts only `(searchTerm: string)` and performs unscoped queries across `employees` and `onboarding_submissions` without filtering by `allowedSiteIds`.
- **Real-World Impact**:
  - The Employee Timeline view omits all data correction requests, bank/account update requests, resignation filings, and prior-stint lifecycle milestones, while allowing site-scoped admins to search and view timelines of employees from other branches.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4586,21 +4586,58 @@
             // 9. Fetch Correction Requests
             for (const rid of Array.from(relatedIds)) {
                 try {
-                    const qCorr = query(collection(db, 'correction_requests'), where('submissionId', '==', rid));
+                    const qCorr = query(collection(db, 'correction_requests'), where('targetId', '==', rid));
                     const corrSnaps = await getDocs(qCorr);
                     corrSnaps.forEach(docSnap => {
                         const data = docSnap.data();
+                        const labels = (data.requestedFields || data.targetFieldLabels || []).map((f: any) => typeof f === 'string' ? f : f.fieldLabel || f.fieldId);
                         events.push({
                             id: `corr-${docSnap.id}`,
                             date: safeToISO(data.createdAt) || new Date().toISOString(),
                             type: 'CORRECTION',
                             title: `Data Correction Requested (${data.status || 'Pending'})`,
-                            description: `Admin requested data correction for fields: ${(data.targetFieldLabels || []).join(', ')}`,
+                            description: `Admin requested data correction for fields: ${labels.join(', ')}`,
                             actor: data.requestedByName || data.requestedBy || 'Admin'
                         });
                     });
                 } catch (err) {
                     console.warn("Could not fetch correction requests for", rid, err);
+                }
+                try {
+                    const qUpd = query(collection(db, 'account_updates'), where('employeeId', '==', rid));
+                    const updSnaps = await getDocs(qUpd);
+                    updSnaps.forEach(docSnap => {
+                        const data = docSnap.data();
+                        events.push({
+                            id: `upd-${docSnap.id}`,
+                            date: safeToISO(data.requestedAt) || new Date().toISOString(),
+                            type: 'UPDATE',
+                            title: `${data.updateType || 'Account'} Update Request (${data.status})`,
+                            description: `Reason: ${data.reason || 'N/A'}`,
+                            actor: data.reviewedBy || 'Employee'
+                        });
+                    });
+                } catch (err) {
+                    console.warn("Could not fetch account updates for", rid, err);
+                }
+                try {
+                    const qRes = query(collection(db, 'resignations'), where('employeeId', '==', rid));
+                    const resSnaps = await getDocs(qRes);
+                    resSnaps.forEach(docSnap => {
+                        const data = docSnap.data();
+                        events.push({
+                            id: `res-${docSnap.id}`,
+                            date: safeToISO(data.submittedAt) || new Date().toISOString(),
+                            type: 'RESIGNATION',
+                            title: `Resignation Request (${data.status})`,
+                            description: `Proposed Last Working Day: ${data.proposedLastWorkingDay || 'N/A'}. Reason: ${data.reason || 'N/A'}`,
+                            actor: data.reviewedBy || 'Employee'
+                        });
+                    });
+                } catch (err) {
+                    console.warn("Could not fetch resignations for", rid, err);
                 }
             }
         }
```

### [UDF-AUD-93] [HIGH] `AdminDraftsManagementPage.tsx` (`L94–115, 240–248`) Displays `"Incomplete Applicant"` for 100% of Real Onboarding Drafts, Breaks Name Search, and Exposes Destructive Draft Deletion to Read-Only Viewers (`SUBMISSIONS_VIEW_DRAFTS`)
- **Category**: Broken Feature / Functional Bug & RBAC Violation
- **Target File(s) & Exact Line Numbers**:
  - `components/AdminDraftsManagementPage.tsx` (Lines `94–115, 240–248`)
  - `components/EmployeeFormPage.tsx` (Line `45`)
  - `components/AdminRoleManagementPage.tsx` (Line `53`)
- **Root Cause & Exact Code Trace**:
  1. **Missing UUID Field Lookup in `getDraftName`**: In `components/AdminDraftsManagementPage.tsx:94–109`, `getDraftName` attempts to resolve the applicant's name from `draft.data`:
     ```ts
     const getDraftName = (draft: OnboardingSubmission) => {
         if (!draft.data) return 'Unknown User';
         const nameFields = ['firstName', 'lastName', 'name', 'applicantName', 'full_name'];
         let foundName = '';
         for (const field of nameFields) {
             if (draft.data[field] && typeof draft.data[field] === 'string') {
                 foundName += draft.data[field] + ' ';
             }
         }
         return foundName.trim() || 'Incomplete Applicant';
     };
     ```
     However, the portal's onboarding form stores the candidate's First/Full Name under the UUID key `'7debf274-baee-4bac-a137-4b4b46719874'` (`EmployeeFormPage.tsx:45`, `employeeService.ts:3616`). Because `getDraftName` never checks `'7debf274-baee-4bac-a137-4b4b46719874'` (or `draft.profileData`), 100% of real candidate drafts display `"Incomplete Applicant"` in the table and modal, and searching by candidate name (`L112–114`) fails for every draft.
  2. **Unrestricted Delete Button for Read-Only Viewers**: In `AdminRoleManagementPage.tsx:53`, `Permission.SUBMISSIONS_VIEW_DRAFTS` is explicitly categorized under `readOnlyOptions` (`label: 'View Drafts'`). Yet `AdminDraftsManagementPage.tsx:240–248` renders the **Delete** button unconditionally for anyone who can view the page, without checking `isSuperAdmin` or `Permission.DELETE_SUBMISSION`.
- **Real-World Impact**:
  - HR staff viewing Onboarding Drafts see every row labeled `"Incomplete Applicant"` and cannot search drafts by applicant name.
  - Staff granted read-only `SUBMISSIONS_VIEW_DRAFTS` access can permanently delete active candidate drafts.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/AdminDraftsManagementPage.tsx
+++ b/components/AdminDraftsManagementPage.tsx
@@ -91,9 +91,10 @@
         }
     };
 
     const getDraftName = (draft: OnboardingSubmission) => {
-        if (!draft.data) return 'Unknown User';
-        const nameFields = ['firstName', 'lastName', 'name', 'applicantName', 'full_name'];
+        const src = draft.data || (draft as any).profileData;
+        if (!src) return 'Unknown User';
+        if (typeof src['7debf274-baee-4bac-a137-4b4b46719874'] === 'string' && src['7debf274-baee-4bac-a137-4b4b46719874'].trim()) {
+            return src['7debf274-baee-4bac-a137-4b4b46719874'].trim();
+        }
+        const nameFields = ['fullName', 'firstName', 'lastName', 'name', 'applicantName', 'full_name'];
         let foundName = '';
         for (const field of nameFields) {
-            if (draft.data[field] && typeof draft.data[field] === 'string') {
-                foundName += draft.data[field] + ' ';
+            if (src[field] && typeof src[field] === 'string') {
+                foundName += src[field] + ' ';
             }
         }
         return foundName.trim() || 'Incomplete Applicant';
     };
```

### [UDF-AUD-94] [HIGH] `AdminCorrectionRequestsPage.tsx` (`L51, 94, 112, 356, 368`) Locks Out All Delegated Staff via Deprecated `Permission.MANAGE_SUBMISSIONS`, `revokeCorrectionRequest` (`employeeService.ts:5381–5385`) Never Clears `activeCorrectionToken`, and `deleteCorrectionRequest` (`L5387–5411`) Fails When `targetId` Is a Badge `employeeId`
- **Category**: Broken Feature / RBAC Lockout & State Desynchronization
- **Target File(s) & Exact Line Numbers**:
  - `components/AdminCorrectionRequestsPage.tsx` (Lines `51, 94, 112, 356, 368`)
  - `src/services/employeeService.ts` (Lines `5381–5411`)
- **Root Cause & Exact Code Trace**:
  1. **Deprecated Permission Check Locks Out All Delegated Staff**: In `components/AdminCorrectionRequestsPage.tsx:51`:
     ```ts
     const hasManagePerm = isSuperAdmin || userRole?.permissions.includes(Permission.MANAGE_SUBMISSIONS);
     ```
     Both `handleRevoke` (`L94`), `handleDelete` (`L112`), and the table action buttons (`L356, 368`) require `hasManagePerm`. However, `AdminRoleManagementPage.tsx:54, 63` assigns the v2 granular permissions `Permission.SUBMISSIONS_VIEW_CORRECTION_LINKS`, `Permission.SUBMISSIONS_CREATE_CORRECTION_LINK`, and `Permission.EMPLOYEES_REQUEST_CORRECTION`—never `Permission.MANAGE_SUBMISSIONS`. Additionally, `hasManagePerm` ignores `userRole?.isDisabled` and `authUser?.permissionOverrides`. Consequently, 100% of non-SuperAdmin staff cannot revoke or delete correction links they created.
  2. **`revokeCorrectionRequest` Orphans `activeCorrectionToken`**: In `src/services/employeeService.ts:5381–5385`:
     ```ts
     export const revokeCorrectionRequest = async (requestId: string): Promise<void> => {
       const docRef = doc(db, 'correction_requests', requestId);
       await updateDoc(docRef, { status: 'expired' });
     };
     ```
     Unlike `deleteCorrectionRequest` (`L5387–5411`), `revokeCorrectionRequest` never sets `activeCorrectionToken: null` on the target `employees` or `onboarding_submissions` document. After revoking a correction request, the employee or submission remains permanently badged as `"Correction Requested"` in the admin UI.
  3. **`deleteCorrectionRequest` Uses Raw `doc(db, 'employees', targetId)` Instead of `resolveEmployeeDoc`**: In `employeeService.ts:5398`, when `targetType === 'employee'`, `deleteCorrectionRequest` calls `updateDoc(doc(db, 'employees', targetId), { activeCorrectionToken: null })`. For employees whose Firestore document ID is their `submissionId` (`UDF-...`) while `targetId` is their badge `employeeId` (`HY...`), `doc(db, 'employees', targetId)` does not exist, throwing `not-found` (caught and swallowed at `L5405`) and leaving `activeCorrectionToken` stuck on the employee record.
- **Real-World Impact**:
  - Delegated HR officers who create correction links cannot revoke or delete them.
  - Revoking any correction link leaves the employee/submission permanently badged as having an active pending correction request.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/AdminCorrectionRequestsPage.tsx
+++ b/components/AdminCorrectionRequestsPage.tsx
@@ -48,7 +48,15 @@
     const userRole = roles.find(r => r.id === authUser?.roleId);
     const isSuperAdmin = authUser?.roleId === 'role-super-admin' || userRole?.id === 'role-super-admin';
-    const hasManagePerm = isSuperAdmin || userRole?.permissions.includes(Permission.MANAGE_SUBMISSIONS);
+    const checkPerm = (p: Permission) => {
+        if (isSuperAdmin) return true;
+        if (userRole?.isDisabled === true) return false;
+        if (authUser?.permissionOverrides?.revoked?.includes(p)) return false;
+        if (authUser?.permissionOverrides?.granted?.includes(p)) return true;
+        return userRole?.permissions.includes(p) || false;
+    };
+    const hasManagePerm = checkPerm(Permission.MANAGE_SUBMISSIONS) ||
+        checkPerm(Permission.SUBMISSIONS_CREATE_CORRECTION_LINK) ||
+        checkPerm(Permission.EMPLOYEES_REQUEST_CORRECTION);
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -5381,8 +5381,24 @@
 export const revokeCorrectionRequest = async (requestId: string): Promise<void> => {
   const docRef = doc(db, 'correction_requests', requestId);
+  const snap = await getDoc(docRef);
   await updateDoc(docRef, { status: 'expired' });
+  if (snap.exists()) {
+    const { targetId, targetType } = snap.data();
+    if (targetId) {
+      try {
+        if (targetType === 'employee') {
+          const empRef = await resolveEmployeeDoc(targetId);
+          if (empRef) await updateDoc(empRef, { activeCorrectionToken: null });
+        } else {
+          await updateDoc(doc(db, 'onboarding_submissions', targetId), { activeCorrectionToken: null });
+        }
+      } catch (e) {
+        console.warn('Could not clear activeCorrectionToken on revoke:', e);
+      }
+    }
+  }
 };
 
 export const deleteCorrectionRequest = async (requestId: string): Promise<void> => {
@@ -5395,7 +5411,8 @@
     if (targetId) {
       try {
         if (targetType === 'employee') {
-          const empRef = doc(db, 'employees', targetId);
-          await updateDoc(empRef, { activeCorrectionToken: null });
+          const empRef = await resolveEmployeeDoc(targetId);
+          if (empRef) await updateDoc(empRef, { activeCorrectionToken: null });
         } else {
           const subRef = doc(db, 'onboarding_submissions', targetId);
           await updateDoc(subRef, { activeCorrectionToken: null });
```

### [UDF-AUD-95] [HIGH] `recycleBinService.ts` (`L122–393`) Client Fallback Restores Records Without Server Checks, Re-Opens Historical Closed Vacancies on Site Restore (`functions/index.js:7108–7113`), Orphans Soft-Deleted Vacancies on Site Purge, and Can Delete Active Recreated Records
- **Category**: Security Vulnerability & Data Corruption
- **Target File(s) & Exact Line Numbers**:
  - `src/services/recycleBinService.ts` (Lines `122–393`)
  - `functions/index.js` (Lines `7108–7113`)
- **Root Cause & Exact Code Trace**:
  1. **Silent Client Fallback on `restoreRecycleBinServer` Errors**: In `restoreFromRecycleBin` (`src/services/recycleBinService.ts:130–142`), if `restoreRecycleBinServer` throws an error (including `permission-denied`), the `catch (serverError)` block logs a warning and falls through to 200+ lines of direct client-side Firestore mutations (`L143–350`), bypassing server-side validation and producing partial multi-collection state when a mid-flight rule blocks one of the writes.
  2. **Restoring a Site Unconditionally Re-Opens Historical Closed Vacancies**: Both `restoreRecycleBinServer` (`functions/index.js:7108–7113`) and `restoreFromRecycleBin` (`recycleBinService.ts:180–185`) restore linked vacancies with:
     ```js
     batch.update(vacRef, {
         status: 'Open',
         isDeleted: false,
         restoredAt: admin.firestore.FieldValue.serverTimestamp()
     });
     ```
     Because `deleteSiteServer` (`functions/index.js:7186–7193`) snapshots all vacancies for that site into `metadata.linkedVacancies` without recording their prior `status`, restoring a deleted site overwrites `status: 'Open'` on every historical vacancy at that branch—including vacancies that were closed months or years earlier!
  3. **Orphaned Soft-Deleted Vacancies & Destructive Purge of Recreated Records**: In `permanentDeleteFromRecycleBin` (`recycleBinService.ts:356–380`), purging a `SITE` or `VACANCY` deletes only the `recycle_bin/{binId}` document without deleting the soft-deleted `vacancies/{vid}` documents (`isDeleted: true`), leaving them permanently orphaned in Firestore. Conversely, when purging `STAFF`, `EMPLOYEE`, or `SUBMISSION`, `permanentDeleteFromRecycleBin` unconditionally calls `deleteStaffUser(originalId)`, `permanentDeleteEmployee(originalId)`, or `deleteSubmission(originalId)` even if the record had already been restored or recreated under the same ID.
- **Real-World Impact**:
  - Restoring a site from the Recycle Bin re-publishes all historical closed job vacancies for that site on the public careers page.
  - Purging a stale Recycle Bin entry for an employee or staff member who was already restored permanently deletes the live employee or staff account!
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -7106,7 +7106,7 @@
         if (Array.isArray(linkedVacancies)) {
             for (const vid of linkedVacancies) {
                 const vacRef = db.collection('vacancies').doc(vid);
                 batch.update(vacRef, {
-                    status: 'Open',
+                    status: item.metadata?.vacancyStatuses?.[vid] || 'Open',
                     isDeleted: false,
                     restoredAt: admin.firestore.FieldValue.serverTimestamp()
                 });
             }
         }
@@ -7186,10 +7186,12 @@
         const vacSnap = await db.collection('vacancies').where('siteId', '==', siteId).get();
         const linkedVacancies = [];
+        const vacancyStatuses = {};
         const batch = db.batch();
         vacSnap.forEach(vDoc => {
             linkedVacancies.push(vDoc.id);
+            vacancyStatuses[vDoc.id] = vDoc.data().status || 'Closed';
             batch.update(vDoc.ref, { status: 'Closed', isDeleted: true });
         });
```

### [UDF-AUD-96] [HIGH] `getEmployeeLookupMap` (`src/services/employeeService.ts:4223–4260`) Uses a Single Unscoped Global Cache Across Site Scopes, Truncates `allowedSiteIds` at 10 Sites, Ignores `siteId`/`assignedSiteIds`, and Downloads the Entire `employees` Collection for Global Admins
- **Category**: Security / Cross-Tenant Cache Leak & Firestore Quota Exhaustion
- **Target File(s) & Exact Line Numbers**:
  - `src/services/employeeService.ts` (Lines `4223–4260`)
- **Root Cause & Exact Code Trace**:
  1. **Unscoped Global `_empLookupCache`**: In `src/services/employeeService.ts:4223–4230`:
     ```ts
     let _empLookupCache: { data: Record<string, { name: string, siteId: string, photoUrl?: string }>, timestamp: number } | null = null;
     export const getEmployeeLookupMap = async (allowedSiteIds?: string[]) => {
       if (_empLookupCache && (Date.now() - _empLookupCache.timestamp < 60000)) {
         return _empLookupCache.data;
       }
     ```
     `_empLookupCache` does not store the `allowedSiteIds` key for which it was populated. If a component calls `getEmployeeLookupMap()` without arguments (or before site-scope hydration) and another component calls `getEmployeeLookupMap(allowedSiteIds)` within 60 seconds, the cached map from the first call is returned verbatim.
  2. **Silent `.slice(0, 10)` Truncation & Field Mismatch**: Lines `4240–4244` run:
     ```ts
     if (allowedSiteIds !== undefined) {
       const slice = allowedSiteIds.slice(0, 10);
       q = query(collection(db, 'employees'), where("currentSiteId", "in", slice));
     }
     ```
     Any regional manager assigned to more than 10 sites silently loses employee name/site resolution for sites `11+` in Leave, Resignation, Account Update, and Disciplinary tables (rendering raw IDs and `"Unassigned"`), and any employee whose site is stored under `siteId` or `assignedSiteIds` is missed by `where("currentSiteId", "in", slice)`.
  3. **Full Collection Download Every 60 Seconds**: When `allowedSiteIds` is `undefined` (SuperAdmin or global HR), `getDocs(query(collection(db, 'employees')))` (`L4239, 4246`) downloads every document in the `employees` collection every 60 seconds.
- **Real-World Impact**:
  - Regional managers managing >10 branches see broken employee names (`HY...`) and `"Unassigned"` sites across request management pages, while global admins incur full-collection Firestore reads every minute.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4220,13 +4220,14 @@
-let _empLookupCache: { data: Record<string, { name: string, siteId: string, photoUrl?: string }>, timestamp: number } | null = null;
+let _empLookupCache: { scopeKey: string, data: Record<string, { name: string, siteId: string, photoUrl?: string }>, timestamp: number } | null = null;
 
 export const getEmployeeLookupMap = async (allowedSiteIds?: string[]): Promise<Record<string, { name: string, siteId: string, photoUrl?: string }>> => {
+  const scopeKey = allowedSiteIds === undefined ? '__ALL__' : [...allowedSiteIds].sort().join(',');
-  if (_empLookupCache && (Date.now() - _empLookupCache.timestamp < 60000)) {
+  if (_empLookupCache && _empLookupCache.scopeKey === scopeKey && (Date.now() - _empLookupCache.timestamp < 60000)) {
     return _empLookupCache.data;
   }
 
   const map: Record<string, { name: string, siteId: string, photoUrl?: string }> = {};
   try {
-    let q = query(collection(db, 'employees'));
     if (allowedSiteIds !== undefined) {
       if (allowedSiteIds.length === 0) return map;
-      const slice = allowedSiteIds.slice(0, 10);
-      q = query(collection(db, 'employees'), where("currentSiteId", "in", slice));
+      for (let i = 0; i < allowedSiteIds.length; i += 30) {
+        const chunk = allowedSiteIds.slice(i, i + 30);
+        const snap = await getDocs(query(collection(db, 'employees'), where("currentSiteId", "in", chunk)));
+        snap.forEach(docSnap => {
+          const data = docSnap.data();
+          const empId = data.employeeId || docSnap.id;
+          const name = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || empId;
+          const siteId = data.currentSiteId || data.siteId || (Array.isArray(data.assignedSiteIds) ? data.assignedSiteIds[0] : '') || '';
+          const photoUrl = data.photoUrl || data.profilePhoto || undefined;
+          const entry = { name, siteId, photoUrl };
+          map[empId] = entry;
+          map[docSnap.id] = entry;
+        });
+      }
+      _empLookupCache = { scopeKey, data: map, timestamp: Date.now() };
+      return map;
     }
+    const q = query(collection(db, 'employees'));
     const snap = await getDocs(q);
```

### [UDF-AUD-97] [MEDIUM] `AdminVacancyManager.tsx` (`L21–28, 174–183`) Ignores `userRole.isDisabled` & `permissionOverrides`, Logs `deletedByUid: 'user'` (`authUser.uid` vs `authUser.id`), and `getVacancies` (`vacancyService.ts:13–28`) Returns Soft-Deleted Vacancies (`isDeleted: true`)
- **Category**: Broken Feature / RBAC & Audit Attribution Bug
- **Target File(s) & Exact Line Numbers**:
  - `components/AdminVacancyManager.tsx` (Lines `21–28, 174–183`)
  - `src/services/vacancyService.ts` (Lines `13–28`)
- **Root Cause & Exact Code Trace**:
  1. **Soft-Deleted Vacancies Displayed in UI**: When a site is deleted via `deleteSiteServer` (`functions/index.js:7191`), its vacancies are marked `{ status: 'Closed', isDeleted: true }`. However, `getVacancies` (`src/services/vacancyService.ts:13–28`) returns all documents in `vacancies` without filtering out `v.isDeleted === true`.
  2. **Wrong `authUser` Properties in Recycle Bin Audit Metadata**: In `handleDeleteVacancy` (`components/AdminVacancyManager.tsx:180–181`):
     ```ts
     deletedByUid: authUser?.uid || 'user',
     deletedByName: authUser?.displayName || authUser?.email || 'Admin',
     ```
     Because the portal's `User` interface (`types.ts:276–295`) defines `id` and `name` (not `uid` or `displayName`), `deletedByUid` always records `'user'` instead of the admin's UID.
  3. **Ignored `isDisabled` & `permissionOverrides`**: `hasPermission` (`AdminVacancyManager.tsx:22–25`) checks `userRole?.permissions?.includes(p)` without checking `userRole?.isDisabled === true` or `authUser?.permissionOverrides`.
- **Real-World Impact**:
  - Soft-deleted vacancies remain visible in `AdminVacancyManager`, and every deleted vacancy in the Recycle Bin shows `deletedByUid: 'user'` instead of the acting administrator.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/src/services/vacancyService.ts
+++ b/src/services/vacancyService.ts
@@ -22,6 +22,6 @@
     const snapshot = await getDocs(q);
     const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vacancy));
     // Sort in memory to avoid needing a composite index in Firestore
-    return results.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
+    return results.filter((v: any) => !v.isDeleted).sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
   } catch (error) {
--- a/components/AdminVacancyManager.tsx
+++ b/components/AdminVacancyManager.tsx
@@ -22,7 +22,10 @@
     const isSuperAdmin = authUser?.roleId === 'role-super-admin' || userRole?.id === 'role-super-admin';
     const hasPermission = (p: Permission) => {
         if (isSuperAdmin) return true;
+        if (userRole?.isDisabled === true) return false;
+        if (authUser?.permissionOverrides?.revoked?.includes(p)) return false;
+        if (authUser?.permissionOverrides?.granted?.includes(p)) return true;
         return userRole?.permissions?.includes(p) || false;
     };
@@ -177,8 +180,8 @@
                 originalId: id,
                 module: 'VACANCY',
                 title: vacancyToDelete.title || 'Vacancy',
-                deletedByUid: authUser?.uid || 'user',
-                deletedByName: authUser?.displayName || authUser?.email || 'Admin',
+                deletedByUid: authUser?.id || 'user',
+                deletedByName: authUser?.name || authUser?.email || 'Admin',
                 data: vacancyToDelete
             });
```

### [UDF-AUD-98] [MEDIUM] `SetupAccountPage.tsx` (`L14, 29–41, 66–74, 94`) Destructures Non-Existent `useAuth().user` / `setUser` Instead of `authUser` / `setAuthUser` and Has No Route Mounted in `AppRoutes.tsx`
- **Category**: Broken Feature / Dead Route & Context Property Mismatch
- **Target File(s) & Exact Line Numbers**:
  - `src/components/auth/SetupAccountPage.tsx` (Lines `14, 29–41, 66–74, 94`)
  - `src/context/AuthContext.tsx` (Lines `10–18`)
  - `src/routes/AppRoutes.tsx` & `App.tsx` (Line `96`)
- **Root Cause & Exact Code Trace**:
  1. In `src/components/auth/SetupAccountPage.tsx:14`:
     ```ts
     const { user, setUser } = useAuth();
     ```
     However, `AuthContextType` (`src/context/AuthContext.tsx:10–18`) exports `{ authUser, setAuthUser, isLoading }`. Because `user` and `setUser` do not exist on `AuthContext`, `user` is permanently `undefined` at runtime.
  2. Consequently, inside `handlePasswordSubmit` (`L29`: `if (user && user.employeeId)`) and `handleLinkGoogle` (`L66`: `if (user && user.employeeId)`), the condition is always `false`, so submitting a new password or linking Google during account setup never updates Firestore or local auth state!
  3. Furthermore, although `App.tsx:96` maps `'/setup-account'` to `AppView.SETUP_ACCOUNT`, `src/routes/AppRoutes.tsx` has no `<Route path="/setup-account" ... />`, causing `/setup-account` to hit the wildcard `*` redirect.
- **Real-World Impact**:
  - Navigating to `/setup-account` redirects away immediately, and if rendered, `SetupAccountPage` silently drops password updates and Google account links because `user` is `undefined`.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/src/components/auth/SetupAccountPage.tsx
+++ b/src/components/auth/SetupAccountPage.tsx
@@ -11,7 +11,7 @@
 export const SetupAccountPage: React.FC = () => {
     const navigate = useNavigate();
-    const { user, setUser } = useAuth();
+    const { authUser: user, setAuthUser: setUser } = useAuth();
     const [step, setStep] = useState<'password' | 'google'>('password');
```

### [UDF-AUD-99] [MEDIUM] `useFormBuilder.ts` (`L9–18`) Uses Stale `sections.length` Closure in `addSection`, and `FieldEditorModal.tsx` (`L106–110, 120–121, 204`) Fails to Clear Removed Validation Rules on Field Edit
- **Category**: Broken Feature / Form Builder State Bugs
- **Target File(s) & Exact Line Numbers**:
  - `hooks/useFormBuilder.ts` (Lines `9–18`)
  - `components/FieldEditorModal.tsx` (Lines `106–110, 120–121, 204`)
- **Root Cause & Exact Code Trace**:
  1. **Stale `sections.length` in `addSection`**: In `hooks/useFormBuilder.ts:9–18`:
     ```ts
     const addSection = useCallback(() => {
         const newSection: FormSection = {
             id: uuidv4(),
             title: 'New Section',
             description: 'Section description',
             order: sections.length,
             fields: [],
         };
         setSections(prev => [...prev, newSection]);
     }, [sections.length]);
     ```
     If `sections` contains deleted gaps or rapid additions, `order: prev.length` inside the updater (or `Math.max(0, ...prev.map(s => s.order)) + 1`) should be used so two sections never receive the same `order` value.
  2. **Impossible to Remove Optional Validation Constraints in `FieldEditorModal`**: In `components/FieldEditorModal.tsx:96–121`, `handleSubmit` builds `fieldData` and only attaches optional properties if they are truthy (`if (minLength !== undefined) fieldData.minLength = minLength;` etc.), then calls:
     ```ts
     if (existingField) {
         onSave({ ...existingField, ...fieldData });
     }
     ```
     If an admin edits an existing field to **remove** `minLength`, `maxLength`, `allowedFileTypes`, `maxFileSizeMB`, or `minAge` (clearing the input so the state becomes `undefined` or `""`), `fieldData` simply omits that key, and `{ ...existingField, ...fieldData }` retains the old property from `existingField`! Thus, once a validation constraint is added to a form field, it can never be removed through the Form Builder UI.
- **Real-World Impact**:
  - Admins cannot remove `minLength`, `maxLength`, `minAge`, `maxFileSizeMB`, or `allowedFileTypes` constraints from any onboarding form field once set.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/FieldEditorModal.tsx
+++ b/components/FieldEditorModal.tsx
@@ -103,11 +103,11 @@
             options: showOptions ? options.map(opt => opt.trim()).filter(Boolean) : [],
             regexPattern: showTextValidation && regexPattern ? regexPattern : undefined,
             regexErrorMessage: showTextValidation && regexPattern && regexErrorMessage ? regexErrorMessage : undefined,
+            minLength: showTextValidation && minLength !== undefined ? minLength : undefined,
+            maxLength: showTextValidation && maxLength !== undefined ? maxLength : undefined,
+            allowedFileTypes: showFileSettings && allowedFileTypes.length > 0 ? allowedFileTypes : undefined,
+            maxFileSizeMB: showFileSettings && maxFileSizeMB !== undefined ? maxFileSizeMB : undefined,
+            minAge: showDateSettings && minAge !== undefined ? minAge : undefined,
         };
-        if (showTextValidation && minLength !== undefined) fieldData.minLength = minLength;
-        if (showTextValidation && maxLength !== undefined) fieldData.maxLength = maxLength;
-        if (showFileSettings && allowedFileTypes.length > 0) fieldData.allowedFileTypes = allowedFileTypes;
-        if (showFileSettings && maxFileSizeMB !== undefined) fieldData.maxFileSizeMB = maxFileSizeMB;
-        if (showDateSettings && minAge !== undefined) fieldData.minAge = minAge;
```

### [UDF-AUD-100] [MEDIUM] `AdminLeaveManagementPage.tsx` (`L86, 205–214, 330`) Locks Out Delegated Staff With `MANAGE_LEAVE_TYPES` from the Leave Policy Tab, and Request Management Pages Ignore `userRole.isDisabled` & `permissionOverrides`
- **Category**: Broken Feature / RBAC Lockout
- **Target File(s) & Exact Line Numbers**:
  - `components/AdminLeaveManagementPage.tsx` (Lines `86, 205–214, 330`)
  - `components/AdminAccountUpdateManagementPage.tsx` (Line `40`)
  - `components/AdminResignationManagementPage.tsx` (Line `44`)
  - `firestore.rules` (Line `150`)
- **Root Cause & Exact Code Trace**:
  1. **`MANAGE_LEAVE_TYPES` Locked Out of Leave Policy UI**: In `firestore.rules:150`, the `settings/leave_policy` rule explicitly grants write access to delegated HR staff:
     ```javascript
     allow write: if isSuperAdmin() || hasPermission('MANAGE_SETTINGS') || hasPermission('MANAGE_LEAVE_TYPES') || hasPermission('LEAVES_APPROVE');
     ```
     And `AdminRoleManagementPage.tsx:107` exposes `Permission.MANAGE_LEAVE_TYPES` (`'Manage Leave Policy / Types'`). However, `components/AdminLeaveManagementPage.tsx:205` gates the **Leave Policy** tab button behind `{isSuperAdmin && (...)}`:
     ```tsx
     {isSuperAdmin && (
         <button onClick={() => setActiveTab('policy')} ...>
             Leave Policy
         </button>
     )}
     ```
     As a result, any HR manager granted `Permission.MANAGE_LEAVE_TYPES` cannot see or open the Leave Policy tab in the UI.
  2. **`userRole.isDisabled` and `permissionOverrides` Ignored Across Request Management Pages**:
     - `AdminLeaveManagementPage.tsx:86`: `const hasPermission = (p: Permission) => isSuperAdmin || userRole?.permissions.includes(p) || false;`
     - `AdminAccountUpdateManagementPage.tsx:40`: `const hasPermission = (p: Permission) => isSuperAdmin || userRole?.permissions.includes(p) || false;`
     - `AdminResignationManagementPage.tsx:44`: `const hasPermission = (p: Permission) => isSuperAdmin || userRole?.permissions.includes(p) || false;`
     All three pages ignore `userRole?.isDisabled === true` and per-user `authUser?.permissionOverrides` (`granted` / `revoked`).
- **Real-World Impact**:
  - Delegated HR admins assigned `MANAGE_LEAVE_TYPES` are completely blocked from accessing the Leave Policy configuration tab, while staff with disabled roles or revoked overrides retain UI action buttons across Leave, Account Update, and Resignation pages.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/AdminLeaveManagementPage.tsx
+++ b/components/AdminLeaveManagementPage.tsx
@@ -83,7 +83,14 @@
     const userRole = roles.find(r => r.id === authUser?.roleId);
     const isSuperAdmin = authUser?.roleId === 'role-super-admin' || userRole?.id === 'role-super-admin';
-    const hasPermission = (p: Permission) => isSuperAdmin || userRole?.permissions.includes(p) || false;
+    const hasPermission = (p: Permission) => {
+        if (isSuperAdmin) return true;
+        if (userRole?.isDisabled === true) return false;
+        if (authUser?.permissionOverrides?.revoked?.includes(p)) return false;
+        if (authUser?.permissionOverrides?.granted?.includes(p)) return true;
+        return userRole?.permissions.includes(p) || false;
+    };
+    const canManagePolicy = hasPermission(Permission.MANAGE_LEAVE_TYPES) || hasPermission(Permission.MANAGE_SETTINGS);
@@ -202,7 +209,7 @@
                         <button onClick={() => setActiveTab('balances')} className={`px-4 py-2 font-medium text-sm rounded-md ${activeTab === 'balances' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
                             Leave Balances
                         </button>
-                        {isSuperAdmin && (
+                        {canManagePolicy && (
                             <button onClick={() => setActiveTab('policy')} className={`px-4 py-2 font-medium text-sm rounded-md ${activeTab === 'policy' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
                                 Leave Policy
                             </button>
```

### [UDF-AUD-101] [HIGH] `firestore.rules` (`L384–402, 417–425, 493–498, 531–571`) Grants Full Read, Update, and Delete Access on `leave_balances`, `attendance`, `user_engagement`, `complaints`, `reward_redemptions`, `correction_requests`, and `notifications` to ANY `isAdmin()` Staff Account Across All Branches
- **Category**: Security Vulnerability / Broken Access Control & Multi-Tenant Bypass
- **Target File(s) & Exact Line Numbers**:
  - `firestore.rules` (Lines `384–402, 417–425, 493–498, 531–571`)
- **Root Cause & Exact Code Trace**:
  1. In `firestore.rules:25–27`, `isAdmin()` checks only `isRegisteredUser() && request.auth.token.get('isAdmin', false) == true`, which is set for every staff user regardless of their assigned role permissions or `sitesManaged` scope.
  2. Across 7 sensitive collections, `firestore.rules` uses bare `isAdmin()` without checking granular `hasPermission(...)` or `canStaffViewSite(...)`:
     - `notifications/{id}` (`L385, 395, 397`): `allow read: if isAdmin() || ...; allow create: if isAdmin(); allow update, delete: if isAdmin() || ...;` — any staff member can read, edit, or delete private notifications addressed to SuperAdmins or other staff (`targetUserId == otherStaffUid`).
     - `leave_balances/{id}` (`L418, 424`): `allow read: if isAdmin() || ...; allow write: if isAdmin();` — any staff member (even a read-only viewer or recruiter) can overwrite or delete any employee's leave balance across any branch.
     - `correction_requests/{id}` (`L496–497`): `allow list: if isAdmin() || ...; allow create, update, delete: if isAdmin() || ...;`
     - `user_engagement/{id}` (`L532–550`): `allow read, create, update, delete: if isAdmin();`
     - `attendance/{id}` (`L554–557`): `allow read, update, delete: if isAdmin();`
     - `complaints/{id}` (`L561–563`): `allow read, update, delete: if isAdmin();`
     - `reward_redemptions/{id}` (`L567–570`): `allow read, update, delete: if isAdmin();`
- **Real-World Impact**:
  - A compromised or low-privilege branch staff account can directly modify or wipe company-wide leave balances, attendance records, gamification points, reward redemptions, and SuperAdmin notifications via the client Firestore SDK.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -385,13 +385,15 @@
     match /notifications/{id} {
-      allow read: if isAdmin() || (isAuthenticated() && (
+      allow read: if isSuperAdmin() || (isAuthenticated() && (
         resource.data.targetUserId == request.auth.uid ||
         (request.auth.token.get('employeeId', '') != '' && resource.data.targetUserId == request.auth.token.employeeId) ||
         isOwnerOfPortalId(resource.data.targetUserId) ||
         resource.data.targetUserId == ('ROLE:' + getUserRoleId()) ||
         resource.data.targetUserId == 'ROLE:employee' ||
         resource.data.targetUserId == 'ROLE:role-security-guard' ||
         (isAdmin() && resource.data.targetUserId in ['all_admins', 'admin'])
       ));
       allow create: if isAdmin();
-      allow update, delete: if isAdmin() || (isAuthenticated() && (
+      allow update, delete: if isSuperAdmin() || (isAuthenticated() && (
         resource.data.targetUserId == request.auth.uid ||
+        (isAdmin() && resource.data.targetUserId in ['all_admins', 'admin', 'ROLE:' + getUserRoleId()]) ||
         (request.auth.token.get('employeeId', '') != '' && resource.data.targetUserId == request.auth.token.employeeId) ||
         isOwnerOfPortalId(resource.data.targetUserId)
       ));
@@ -421,7 +423,7 @@
         isOwnerOfPortalId(id) || 
         isOwnerOfPortalId(resource.data.employeeId)
       ));
-      allow write: if isAdmin();
+      allow write: if isSuperAdmin() || hasPermission('LEAVES_APPROVE') || hasPermission('LEAVES_DELETE') || hasPermission('MANAGE_LEAVE_TYPES') || hasPermission('SUBMISSIONS_APPROVE');
     }
```

### [UDF-AUD-102] [HIGH] Deleting an Approved Leave Request (`App.tsx:1917–1934` & `AdminLeaveManagementPage.tsx:67, 101–111, 368`) Never Refunds the Employee's Leave Balance Because `DataContext.leaveRequests` Contains Only `'Pending'` Requests, and Leaves the Deleted Row Visible in `historicalRequests`
- **Category**: Broken Feature / Permanent Leave Balance Loss
- **Target File(s) & Exact Line Numbers**:
  - `App.tsx` (Lines `1907–1943`)
  - `components/AdminLeaveManagementPage.tsx` (Lines `67, 101–111, 361–377`)
  - `src/contexts/DataContext.tsx` (Line `591`)
- **Root Cause & Exact Code Trace**:
  1. In `src/contexts/DataContext.tsx:591`, the real-time `leaveRequests` listener subscribes exclusively to `where("status", "==", "Pending")`.
  2. When an admin switches to the **Approved** or **Rejected** filter in `components/AdminLeaveManagementPage.tsx:101–111`, `fetchLeaveRequestsByStatus(filterStatus, allowedSiteIds, 200)` loads those historical records into local component state `historicalRequests` (`L67`), which is merged into `allRequests` (`L154–162`) inside `AdminLeaveManagementPage`—never into `DataContext.leaveRequests`.
  3. When the admin opens an **Approved** leave request and clicks **Delete Permanent Record** (`AdminLeaveManagementPage.tsx:368`), `onDelete(selectedRequest.id)` invokes `handleDeleteWorkflowRequest('LEAVES', requestId)` (`App.tsx:1907–1943`):
     ```ts
     if (moduleId === 'LEAVES') {
       const req = leaveRequests.find(r => r.id === requestId);
       if (req && req.status === RequestStatus.APPROVED) {
         const [sY, sM, sD] = req.startDate.split('-').map(Number);
         const [eY, eM, eD] = req.endDate.split('-').map(Number);
         const daysTaken = Math.round((Date.UTC(eY, eM - 1, eD) - Date.UTC(sY, sM - 1, sD)) / (1000 * 3600 * 24)) + 1;
         const { updateEmployeeLeaveBalance } = await import('./src/services/employeeService');
         await updateEmployeeLeaveBalance(req.employeeId, req.leaveType, -daysTaken);
       }
     }
     ```
     Because `leaveRequests` in `App.tsx` only contains `Pending` requests, `leaveRequests.find(r => r.id === requestId)` is **always `undefined`** for any Approved leave request! Consequently, `updateEmployeeLeaveBalance` is never called and the employee's deducted leave days are permanently lost.
  4. Furthermore, `setLeaveRequests(prev => prev.filter(r => r.id !== requestId))` (`App.tsx:1931`) does not update `historicalRequests` in `AdminLeaveManagementPage.tsx`, so the deleted record remains visible in the table until the admin switches filter tabs.
- **Real-World Impact**:
  - Permanently deleting an Approved leave request never refunds the deducted leave days back to the employee and leaves the deleted row rendered on screen.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -1915,8 +1915,12 @@
         // Item 5: If permanently deleting an approved leave, refund the balance back
         if (moduleId === 'LEAVES') {
-          const req = leaveRequests.find(r => r.id === requestId);
+          let req = leaveRequests.find(r => r.id === requestId);
+          if (!req) {
+            const snap = await getDoc(doc(db, 'leave_requests', requestId));
+            if (snap.exists()) req = { id: snap.id, ...snap.data() } as LeaveRequest;
+          }
           if (req && req.status === RequestStatus.APPROVED) {
             const [sY, sM, sD] = req.startDate.split('-').map(Number);
             const [eY, eM, eD] = req.endDate.split('-').map(Number);
             const daysTaken = Math.round((Date.UTC(eY, eM - 1, eD) - Date.UTC(sY, sM - 1, sD)) / (1000 * 3600 * 24)) + 1;
--- a/components/AdminLeaveManagementPage.tsx
+++ b/components/AdminLeaveManagementPage.tsx
@@ -365,6 +365,7 @@
                                     onClick={() => {
                                         if (onDelete) {
                                             onDelete(selectedRequest.id);
+                                            setHistoricalRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
                                             closeDetailsModal();
                                         }
                                     }}
```

### [UDF-AUD-103] [HIGH] Changing an Employee's Badge ID via `updateSubmissionEmployeeId` (`src/services/employeeService.ts:2326–2342`) Never Updates Firebase Auth Custom Claims (`token.employeeId`), Storage Paths (`employees/{oldId}`), or Linked Records Across 7 Collections
- **Category**: Broken Feature / Account Lockout & Orphaned Records
- **Target File(s) & Exact Line Numbers**:
  - `src/services/employeeService.ts` (Lines `2326–2342`)
  - `App.tsx` (Lines `1616–1625`)
- **Root Cause & Exact Code Trace**:
  1. In `src/services/employeeService.ts:2326–2342`, `updateSubmissionEmployeeId(submissionId, oldId, newId)` performs only two writes:
     ```ts
     const subRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
     await updateDoc(subRef, { employeeId: newId });
     const resolvedEmp = (await resolveEmployeeDoc(submissionId)) || (oldId ? await resolveEmployeeDoc(oldId) : null);
     if (resolvedEmp) {
         await updateDoc(resolvedEmp.ref, { employeeId: newId });
     }
     ```
  2. It never updates:
     - **Firebase Auth Custom Claims**: The employee's Firebase Auth user (`uid` / `linkedUid`) retains `token.employeeId === oldId`. Because `firestore.rules` (`L91, 387, 399`) and `storage.rules` (`L51`) authorize access via `request.auth.token.employeeId`, the employee's token no longer matches `newId`.
     - **Linked Firestore Collections**: Existing documents in `leave_balances/{oldId}`, `leave_requests`, `account_updates`, `resignations`, `disciplinary_actions`, `attendance`, and `user_engagement` remain keyed by `oldId`, disappearing from the employee's portal and admin lookups under `newId`.
     - **Firebase Storage & Google Drive**: Files stored under `employees/${oldId}/...` and the Google Drive folder `${oldId} - ${applicantName}` are never moved or renamed to `newId`.
- **Real-World Impact**:
  - Editing an employee's badge ID orphans all of their historical leave balances, attendance records, requests, and uploaded documents, and desynchronizes their Firebase Auth token claims.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -2337,6 +2337,20 @@
     // 3. Update Employee Document
     const resolvedEmp = (await resolveEmployeeDoc(submissionId)) || (oldId ? await resolveEmployeeDoc(oldId) : null);
     if (resolvedEmp) {
         await updateDoc(resolvedEmp.ref, { employeeId: newId });
     }
+    if (oldId && oldId !== newId) {
+        const collectionsToUpdate = [LEAVE_REQ_COL, ACCOUNT_UPD_COL, RESIGNATION_COL, DISCIPLINARY_COL, 'attendance', 'leave_balances'];
+        for (const colName of collectionsToUpdate) {
+            const q = query(collection(db, colName), where('employeeId', '==', oldId));
+            const snap = await getDocs(q);
+            await Promise.all(snap.docs.map(d => updateDoc(d.ref, { employeeId: newId })));
+        }
+        try {
+            await moveStorageFiles(`employees/${oldId}`, `employees/${newId}`);
+        } catch (e) {
+            console.warn('Could not migrate storage files on employeeId change:', e);
+        }
+    }
 };
```

### [UDF-AUD-104] [HIGH] `relieveFromSite` (`src/services/employeeService.ts:3066–3131`) Leaves Relieved Multi-Site Employees Active in Firebase Auth and `onboarding_submissions`, `assignToSite` (`L2931–2971`) Creates Duplicate `PRIMARY` Assignments, and `promoteEmployee` (`L2984–3064`) Silently Bypasses `permission-denied` and Crashes on `undefined` `siteId`/`siteName`
- **Category**: Security Vulnerability & Lifecycle State Desynchronization
- **Target File(s) & Exact Line Numbers**:
  - `src/services/employeeService.ts` (Lines `2931–3131`)
- **Root Cause & Exact Code Trace**:
  1. **`relieveFromSite` Bypasses `relieveEmployeeServer` When Relieving the Last Site**: In `src/services/employeeService.ts:3120–3129`, when an employee's last active site assignment is relieved (`newActive.length === 0`), `relieveFromSite` updates `employees` directly on the client (`updates.isActive = false; updates.isRelieved = true;`) without calling `relieveEmployeeServer`:
     - The employee's `onboarding_submissions` record remains `status: 'Approved'` and `isActive: true`.
     - The employee's Firebase Auth account (`uid` / `linkedUid`) is never disabled (`disabled: true`) and refresh tokens are never revoked, allowing the relieved employee to remain logged into the portal.
  2. **`assignToSite` Creates Multiple Simultaneous `PRIMARY` Assignments**: In `assignToSite` (`L2939–2953`), when `assignment.type === 'PRIMARY'` is added to an employee who already has an existing `PRIMARY` assignment in `empData.activeAssignments`, the old `PRIMARY` assignment is not demoted to `'SECONDARY'` or relieved, leaving two active `PRIMARY` assignments on the same employee.
  3. **`promoteEmployee` Client Fallback Swallows `permission-denied` and Crashes on `undefined`**: In `promoteEmployee` (`L2994–3059`), if `promoteEmployeeServer` throws `permission-denied`, the `catch` block logs a warning and falls back to client-side `updateDoc(empRef, updates)`. Inside that fallback (`L3021–3022`), `siteId: newSiteId || empData.currentSiteId || undefined` and `siteName: newSiteName || empData.siteName || undefined` place `undefined` values inside `promotionRecord`, crashing `arrayUnion(promotionRecord)` (`L3047`) whenever either field is empty, and `L3051–3054` updates `currentSiteId = newSiteId` without adding `newSiteId` to `assignedSiteIds`.
- **Real-World Impact**:
  - Employees relieved via the Site Deployment manager retain active Firebase Auth sessions and active `onboarding_submissions` documents, while assigning a new primary site creates conflicting primary deployments.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -2942,7 +2942,10 @@
         status: 'Active'
     };
 
-    const newAssignments = [...(empData.activeAssignments || []), newAssignment];
+    const existingAssignments = (empData.activeAssignments || []).map(a =>
+        (assignment.type === 'PRIMARY' && a.type === 'PRIMARY') ? { ...a, type: 'SECONDARY' as const } : a
+    );
+    const newAssignments = [...existingAssignments, newAssignment];
     const updates: any = {
         activeAssignments: newAssignments,
         assignedSiteIds: Array.from(new Set(newAssignments.map(a => a.siteId)))
@@ -2993,6 +2996,7 @@
         }
     } catch (err: any) {
         log.warn("[PROMOTE] Server promotion failed, falling back to direct write:", err);
+        if (err?.code === 'functions/permission-denied') throw err;
     }
@@ -3018,8 +3022,8 @@
         fromDesignation: currentDesignation,
         toDesignation: newDesignation,
         effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
-        siteId: newSiteId || empData.currentSiteId || undefined,
-        siteName: newSiteName || empData.siteName || undefined,
+        siteId: newSiteId || empData.currentSiteId || '',
+        siteName: newSiteName || empData.siteName || '',
         referenceNo: cleanRefNo,
         remarks: remarks || '',
         promotedAt: new Date().toISOString(),
@@ -3125,6 +3129,11 @@
         updates.currentSiteId = "";
         updates.siteName = "N/A";
     }
 
     await updateDoc(empRef, updates);
+    if (newActive.length === 0) {
+        await relieveEmployee(empData.employeeId || employeeId, relievingDate, (relievingReason as any) || 'Other');
+    }
     await logSystemAction('UPDATE', 'EMPLOYEES', `Relieved employee ${empData.applicantName || (empData as any).employeeName || employeeId} (${employeeId}) from assignment ${assignmentId} (Reason: ${relievingReason})`);
 };
```

### [UDF-AUD-105] [HIGH] `EmployeeProfileView.tsx` (`L263, 287–294, 350–359, 459–489`) Reads Only `employeeData.data` Instead of `dataMap`/`profileData` (Rendering `"Not Provided"`), Ignores `userRole.fieldVisibility` (`HIDDEN`), Hardcodes `editable={true}` on `ProfileAvatar`, and Exposes `"Request Profile Correction"` to Read-Only Admins
- **Category**: Broken Feature / Profile Data Loss & RBAC Violation
- **Target File(s) & Exact Line Numbers**:
  - `components/employee/EmployeeProfileView.tsx` (Lines `263, 287–294, 350–359, 459–489`)
- **Root Cause & Exact Code Trace**:
  1. **Ignores `formData` and `profileData` When Rendering Fields**: On line `263`, `EmployeeProfileView` defines `const dataMap = employeeData.data || employeeData.formData || {};`, yet on line `482` it renders every section field using `(employeeData.data || {})[field.id]` instead of checking `dataMap[field.id]` or `(employeeData as any).profileData?.[field.id]`. For records whose field values live in `formData` or `profileData`, every field renders `"Not Provided"`.
  2. **Ignores `userRole.fieldVisibility` (`HIDDEN`) and Disabled Sections/Fields**: Unlike `AdminMasterEmployeeListPage.tsx:212`, `EmployeeProfileView.tsx:459–485` never filters out fields marked `'HIDDEN'` in `userRole?.fieldVisibility`, allowing restricted roles to view confidential fields (such as Bank Account, Aadhaar, PAN, or Salary details) simply by opening the profile view.
  3. **Hardcoded `editable={true}` & `collection="employees"` on `ProfileAvatar`**: Lines `287–294` render `<ProfileAvatar ... editable={true} collection="employees" />` unconditionally, allowing read-only admin viewers to overwrite an employee's avatar and causing Firestore `not-found` errors when viewing an unapproved `onboarding_submissions` record that has no document in `employees`.
  4. **Unrestricted `"Request Profile Correction"` Button**: Lines `350–359` render the `Request Profile Correction` button whenever `isAdmin` is truthy without checking `Permission.EMPLOYEES_REQUEST_CORRECTION` or `Permission.SUBMISSIONS_CREATE_CORRECTION_LINK`.
- **Real-World Impact**:
  - Imported or submission-backed profiles display `"Not Provided"` for populated fields, and restricted staff roles can view `'HIDDEN'` fields and trigger profile corrections without permission.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/employee/EmployeeProfileView.tsx
+++ b/components/employee/EmployeeProfileView.tsx
@@ -260,7 +260,7 @@
     return () => document.removeEventListener('mousedown', handleClickOutside);
   }, [popoverSite]);
 
-  const dataMap = employeeData.data || employeeData.formData || {};
+  const dataMap = { ...((employeeData as any).profileData || {}), ...(employeeData.formData || {}), ...(employeeData.data || {}) };
@@ -479,7 +479,7 @@
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
                     {[...filteredFields].sort((a, b) => a.order - b.order).map(field => (
                       <div key={field.id} className={`${field.type === FieldType.TEXTAREA ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
-                        {renderReadOnlyField(field, (employeeData.data || {})[field.id])}
+                        {renderReadOnlyField(field, dataMap[field.id])}
                       </div>
                     ))}
                   </div>
```

### [UDF-AUD-106] [HIGH] `EmployeeLeaveRequestPage.tsx` (`L125–130`), `EmployeeResignationPage.tsx` (`L91–107, 152`), and `EmployeeAccountUpdatePage.tsx` (`L50–55, 105–113`) Drop `siteId` When `activeAssignments` Is Empty, Allow Unlimited Duplicate Pending/Approved Resignations, and Crash When `employeeData.data` Is Undefined
- **Category**: Broken Feature / Unscoped Requests, Runtime Crash & Duplicate Submissions
- **Target File(s) & Exact Line Numbers**:
  - `components/employee/EmployeeLeaveRequestPage.tsx` (Lines `125–130`)
  - `components/employee/EmployeeResignationPage.tsx` (Lines `91–107, 152`)
  - `components/employee/EmployeeAccountUpdatePage.tsx` (Lines `50–55, 105–113`)
- **Root Cause & Exact Code Trace**:
  1. **Unlimited Duplicate Resignations (`EmployeeResignationPage.tsx:152`)**: `EmployeeResignationPage` never checks whether `existingRequests` already contains a `RequestStatus.PENDING` or `RequestStatus.APPROVED` resignation. An employee can click **Submit Resignation** repeatedly to create unlimited duplicate active resignation workflows.
  2. **Crash on Missing `employeeData.data` (`EmployeeAccountUpdatePage.tsx:50–55`)**:
     ```ts
     const currentValue = useMemo(() => {
       if (selectedFieldId) {
         return employeeData.data[selectedFieldId];
       }
       return undefined;
     }, [selectedFieldId, employeeData.data]);
     ```
     If `employeeData` is null or `employeeData.data` is undefined (e.g. legacy imported employee whose fields are in `profileData`), selecting any field throws `TypeError: Cannot read properties of undefined (reading '...')`.
  3. **Missing Multi-Site Selection in `EmployeeAccountUpdatePage` & Empty `activeDeployments` Fallback**: `EmployeeAccountUpdatePage.tsx:105–113` never lets multi-site employees choose which site's supervisor should review the update, and `EmployeeLeaveRequestPage.tsx:125–127` / `EmployeeResignationPage.tsx:91–93` compute `activeDeployments[0]?.siteId || ''` without falling back to `employeeData?.currentSiteId || employeeData?.siteId`.
- **Real-World Impact**:
  - Employees can spam duplicate resignation requests, and legacy employees crash `EmployeeAccountUpdatePage` as soon as they select a field to update.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/employee/EmployeeResignationPage.tsx
+++ b/components/employee/EmployeeResignationPage.tsx
@@ -74,6 +74,9 @@
   const activeDeployments = useMemo(() => {
     return (activeAssignments || []).filter(a => a.status === 'Active');
   }, [activeAssignments]);
+  const hasActiveResignation = useMemo(() => {
+    return (existingRequests || []).some(r => r.status === RequestStatus.PENDING || r.status === RequestStatus.APPROVED);
+  }, [existingRequests]);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
+    if (hasActiveResignation) {
+      alert("You already have a pending or approved resignation request.");
+      return;
+    }
--- a/components/employee/EmployeeAccountUpdatePage.tsx
+++ b/components/employee/EmployeeAccountUpdatePage.tsx
@@ -50,7 +50,8 @@
   const currentValue = useMemo(() => {
     if (selectedFieldId) {
-      return employeeData.data[selectedFieldId];
+      const map = employeeData?.data || employeeData?.formData || (employeeData as any)?.profileData || {};
+      return map[selectedFieldId];
     }
     return undefined;
   }, [selectedFieldId, employeeData]);
```

### [UDF-AUD-107] [HIGH] `EmployeeFormPage.tsx` (`L217, 1488–1514`) Destructures Non-Existent `{ authUser, isSuperAdmin }` from `useAuth()`, Making Role-Based Field Visibility (`HIDDEN` / `READ_ONLY`) 100% Dead Code
- **Category**: Broken Feature / RBAC Field Visibility Bypass
- **Target File(s) & Exact Line Numbers**:
  - `components/EmployeeFormPage.tsx` (Lines `217, 1488–1514`)
  - `src/context/AuthContext.tsx` (Lines `4–12, 184`)
- **Root Cause & Exact Code Trace**:
  1. In `src/context/AuthContext.tsx:4–12, 184`, `AuthContext.Provider` provides `{ user, loading, setUser, lockSession, unlockSession }`.
  2. However, `components/EmployeeFormPage.tsx:217` destructures:
     ```ts
     const { authUser, isSuperAdmin } = useAuth();
     ```
     Because neither `authUser` nor `isSuperAdmin` exists on `AuthContextType`, both variables are permanently `undefined` at runtime!
  3. On lines `1488–1514`, `activeSections` attempts to enforce role-based field visibility (`userRole?.fieldVisibility`):
     ```ts
     const activeSections = useMemo(() => {
       const userRole = authUser && authUser.roleId ? roles.find(r => r.id === authUser.roleId) : null;
       const fieldVisibility = userRole?.fieldVisibility || {};
     ```
     Because `authUser` is always `undefined`, `userRole` is always `null` and `fieldVisibility` is always `{}`. Any field configured as `'HIDDEN'` or `'READ_ONLY'` for a role in `AdminRoleManagementPage` remains 100% visible and editable in `EmployeeFormPage`.
- **Real-World Impact**:
  - Role-based field visibility (`HIDDEN` and `READ_ONLY` rules) in `EmployeeFormPage` is completely non-functional.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/EmployeeFormPage.tsx
+++ b/components/EmployeeFormPage.tsx
@@ -214,7 +214,8 @@
 };
 
 const EmployeeFormPage: React.FC<EmployeeFormPageProps> = ({ sections, isLoading, onBackToHome, onFormSubmit, onSaveDraft, onRetrieveDraft, onDiscardDraft, initialDraft }) => {
-  const { authUser, isSuperAdmin } = useAuth();
+  const { user: authUser } = useAuth();
+  const isSuperAdmin = Boolean(authUser?.isSuperAdmin || authUser?.roleId === 'role-super-admin');
   const { roles, sites, portalConfig } = useData();
```

### [UDF-AUD-108] [HIGH] `sendNotificationServer` (`functions/index.js:8092–8158`) Allows Anonymous Users to Broadcast Spoofed Alerts to All Admins and Overwrite Existing Notification IDs, While `markAllNotificationsAsRead` (`NotificationContext.tsx:148–175`) Fails for All Employee/`ROLE:` Notifications and Marks Shared Broadcasts as Read for All Staff
- **Category**: Security Vulnerability & Broken Notification State
- **Target File(s) & Exact Line Numbers**:
  - `functions/index.js` (Lines `8092–8158`)
  - `src/contexts/NotificationContext.tsx` (Lines `148–175`)
  - `src/services/notificationService.ts` (Lines `98–119`)
- **Root Cause & Exact Code Trace**:
  1. **Anonymous Notification Spoofing & ID Overwrite in `sendNotificationServer`**:
     - `sendNotificationServer` (`functions/index.js:8093`) checks only `if (!request.auth)` without rejecting anonymous Firebase Auth sessions (`request.auth.token.firebase?.sign_in_provider === 'anonymous'`).
     - On lines `8120–8126`, any caller is allowed to send broadcast notifications to `targetUserId: 'all_admins'`, `'admin'`, or any `'ROLE:...'` other than `'ROLE:employee'` / `'ROLE:role-security-guard'`.
     - On lines `8139, 8155`, `const notifId = clientProvidedId ? clientProvidedId.trim() : ...; await db.collection('notifications').doc(notifId).set(notifDoc);` blindly overwrites any existing notification document if `clientProvidedId` matches an existing ID.
  2. **`markAllNotificationsAsRead` Fails for All Employee and `ROLE:` Notifications**:
     - In `src/contexts/NotificationContext.tsx:157–175`, `markAllNotificationsAsRead(userId)` filters unread notifications by:
       ```ts
       const unread = notifications.filter(n => !n.read && (n.targetUserId === userId || n.targetUserId === 'all_admins' || n.targetUserId === 'admin'));
       ```
     - However, employee notifications are sent to `targetUserId: employeeId` (e.g. `'HY100123'`, see `App.tsx:1385` and `functions/index.js:3533, 3601, 3682`) or `portalId`, while `userId` passed from `Header.tsx` is `authUser.id` (their Firebase Auth UID). And role broadcasts use `targetUserId: 'ROLE:{roleId}'`. Because `markAllNotificationsAsRead` never checks `user?.employeeId`, `user?.portalId`, or `` `ROLE:${user?.roleId}` ``, clicking **Mark All as Read** does nothing for employee notifications or role-targeted notifications!
  3. **Marking a Broadcast Notification as Read Hides It From All Other Admins**:
     - When one admin marks a `'ROLE:...'` or `'all_admins'` notification as read (`NotificationContext.tsx:151`), `updateDoc(doc(db, 'notifications', id), { read: true })` mutates the shared document's `read` boolean in Firestore, marking it as read for every other admin who hasn't seen it yet.
- **Real-World Impact**:
  - Anonymous users can inject fake notifications into all admin dashboards, and employees cannot clear their unread notifications using "Mark All as Read".
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -8093,6 +8093,9 @@
     if (!request.auth) {
         throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to send notifications.');
     }
+    if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
+        throw new functions.https.HttpsError('permission-denied', 'Anonymous sessions cannot dispatch notifications.');
+    }
@@ -8136,7 +8139,7 @@
             }
         }
     }
-    const notifId = (typeof clientProvidedId === 'string' && clientProvidedId.trim()) ? clientProvidedId.trim() : db.collection('notifications').doc().id;
+    const notifId = isAdmin && (typeof clientProvidedId === 'string' && clientProvidedId.trim()) ? clientProvidedId.trim() : db.collection('notifications').doc().id;
--- a/src/contexts/NotificationContext.tsx
+++ b/src/contexts/NotificationContext.tsx
@@ -157,17 +157,24 @@
     const markAllNotificationsAsRead = useCallback(async (userId: string) => {
+        const validTargets = new Set([
+            userId,
+            user?.id,
+            user?.employeeId,
+            user?.portalId,
+            'all_admins',
+            'admin',
+            (user as any)?.roleId ? `ROLE:${(user as any).roleId}` : ''
+        ].filter(Boolean));
         setNotifications(prev => prev.map(n => {
-            if (n.targetUserId === userId || n.targetUserId === 'all_admins' || n.targetUserId === 'admin') {
+            if (validTargets.has(n.targetUserId)) {
                 return { ...n, read: true };
             }
             return n;
         }));
 
         try {
             const batch = writeBatch(db);
-            const unread = notifications.filter(n => !n.read && (n.targetUserId === userId || n.targetUserId === 'all_admins' || n.targetUserId === 'admin'));
+            const unread = notifications.filter(n => !n.read && validTargets.has(n.targetUserId));
             unread.slice(0, 50).forEach(n => {
                 batch.update(doc(db, 'notifications', n.id), { read: true });
             });
             await batch.commit();
         } catch (err) {
             console.warn("Failed to batch update notifications in Firestore:", err);
         }
-    }, [notifications]);
+    }, [notifications, user]);
```

### [UDF-AUD-109] [MEDIUM] `deleteAssociatedRecords` (`src/services/employeeService.ts:3469–3635`) Fails to Purge `daily_quiz_logs` and `gamification_logs`, and Client-Side `bgv_records` Deletions Fail for Delegated Staff (`firestore.rules:483`)
- **Category**: Broken Feature / Incomplete Deep Purge
- **Target File(s) & Exact Line Numbers**:
  - `src/services/employeeService.ts` (Lines `3469–3635`)
  - `firestore.rules` (Lines `483, 601`)
- **Root Cause & Exact Code Trace**:
  1. `deleteAssociatedRecords` (`src/services/employeeService.ts:3469–3542`) and `getEmployeeRecordCounts` (`L3544–3635`) scan 13 collections when performing a Deep Purge of an employee, but completely omit `daily_quiz_logs` (created by `completeTrainingQuizServer` in `functions/index.js:7961`) and `gamification_logs` (`functions/index.js:7969, 8073`).
  2. Furthermore, `firestore.rules:483` restricts `bgv_records` deletion to `allow delete: if isSuperAdmin();` (excluding `DELETE_EMPLOYEE`), and `gamification_logs` (`L601`) has `allow delete: if false;`, so client-side `deleteAssociatedRecords` fails to purge `bgv_records` for delegated HR admins and can never purge `gamification_logs` or `daily_quiz_logs`.
- **Real-World Impact**:
  - Deep-purging an employee leaves orphaned `daily_quiz_logs` and `gamification_logs` documents in Firestore, and fails to delete `bgv_records` when executed by a non-SuperAdmin with `DELETE_EMPLOYEE`.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -480,7 +480,7 @@
           'status', 'result', 'internalStatus', 'approvedBy', 'approvedAt'
         ])
       );
-      allow delete: if isSuperAdmin();
+      allow delete: if isSuperAdmin() || hasPermission('DELETE_EMPLOYEE') || hasPermission('BGV_MANAGE');
     }
```

### [UDF-AUD-110] [MEDIUM] `applyValidationRules.ts` (`L32–90, 170`) Enforces `allowedPattern: 'alphabets'` on Personal, Bank, and Branch Names (Blocking Dots, Hyphens & Initials) and Overwrites `settings/form_sections` Without `{ merge: true }`, While `AdminRecycleBinPage.tsx` (`L293–301`) Omits Filter Tabs for `VACANCY` and `ROLE` Items
- **Category**: Broken Feature / Form Validation & Recycle Bin Filter Bugs
- **Target File(s) & Exact Line Numbers**:
  - `src/utils/applyValidationRules.ts` (Lines `32–90, 170`)
  - `components/AdminRecycleBinPage.tsx` (Lines `24–73, 135–142, 293–301`)
- **Root Cause & Exact Code Trace**:
  1. **Over-Restrictive `alphabets` Pattern on Names & Bank Branches**: In `src/utils/applyValidationRules.ts:33, 38, 41, 47–48, 60, 63, 83`, `EXACT_RULES` and `getKeywordRule` set `allowedPattern: 'alphabets'` on `'full name'`, `'spouse name'`, `'father's name'`, `'mother's name'`, `'bank name'`, and `'branch name'`. In `EmployeeFormPage.tsx`, `allowedPattern: 'alphabets'` permits only `[A-Za-z\s]`, blocking common Indian initials with periods (e.g., `"K. Rama Rao"`), hyphens, parentheses, or numbers in bank branch names (e.g., `"SBI - Sector 4 Branch"`). Additionally, line `170` calls `await setDoc(docRef, { sections: updatedSections })` without `{ merge: true }`, wiping any sibling metadata fields on `settings/form_sections`.
  2. **Missing `VACANCY` and `ROLE` Filter Tabs in `AdminRecycleBinPage.tsx`**: Although `TYPE_CONFIG` (`components/AdminRecycleBinPage.tsx:55–66`) defines badge configurations for `VACANCY` (`'Job Vacancy'`) and `ROLE` (`'Role Definition'`), the filter pill bar (`L293–301`) only renders `['ALL', 'SITE', 'STAFF', 'EMPLOYEE', 'DESIGNATION', 'SUBMISSION', 'INVITE']`, preventing admins from filtering Recycle Bin items by `VACANCY` or `ROLE`.
- **Real-World Impact**:
  - Running `applyValidationRules` blocks applicants with initials (`.` / `-`) or numbered bank branches from submitting the onboarding form, and admins cannot filter deleted vacancies or roles in the Recycle Bin.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/AdminRecycleBinPage.tsx
+++ b/components/AdminRecycleBinPage.tsx
@@ -298,6 +298,8 @@
             { id: 'EMPLOYEE', label: 'Employees' },
             { id: 'DESIGNATION', label: 'Designations' },
             { id: 'SUBMISSION', label: 'Submissions' },
-            { id: 'INVITE', label: 'Invites' }
+            { id: 'INVITE', label: 'Invites' },
+            { id: 'VACANCY', label: 'Vacancies' },
+            { id: 'ROLE', label: 'Roles' }
           ].map(tab => (
```

### [UDF-AUD-111] [HIGH] `EmployeeDashboardPage.tsx` (`L189, 202, 213`) Passes `employeeId={authUser?.id || ''}` Instead of `authUser?.employeeId`, Causing `EmployeeLeaveRequestPage` (`L46–48, 114–118`) to Resolve `currentBalance = null` (`0 / 0` Days) and Block All Paid Leave Requests
- **Category**: Broken Feature / All Paid Leave Requests Blocked
- **Target File(s) & Exact Line Numbers**:
  - `components/EmployeeDashboardPage.tsx` (Lines `189, 202, 213`)
  - `components/employee/EmployeeLeaveRequestPage.tsx` (Lines `46–48, 114–118`)
  - `src/contexts/DataContext.tsx` (Lines `277–281`)
  - `src/services/authService.ts` (Lines `146–150`)
- **Root Cause & Exact Code Trace**:
  1. In `src/contexts/DataContext.tsx:277–281`, every `LeaveBalance` entry in `leaveBalances` is constructed with `employeeId: emp.employeeId` (the employee's badge ID, e.g., `'HY100123'`).
  2. When an employee logs in or refreshes the portal (`src/services/authService.ts:146–150` or `App.tsx:2435–2438`):
     - `authUser.id` is set to `firebaseUser.uid` (their Firebase Auth UID) or `emp.id` (their `onboarding_submissions` document ID `'UDF-202609-XXXX'`).
     - `authUser.employeeId` is set to `empData.employeeId` (`'HY100123'`).
  3. In `components/EmployeeDashboardPage.tsx:188–222`, `renderEmployeeContent` passes `authUser?.id` instead of `authUser?.employeeId` as the `employeeId` prop to all three employee request pages:
     ```tsx
     <EmployeeLeaveRequestPage employeeId={authUser?.id || ''} ... leaveBalances={leaveBalances} />
     <EmployeeAccountUpdatePage employeeId={authUser?.id || ''} ... />
     <EmployeeResignationPage employeeId={authUser?.id || ''} ... />
     ```
  4. Inside `components/employee/EmployeeLeaveRequestPage.tsx:46–48`:
     ```ts
     const currentBalance = useMemo(() =>
       leaveBalances.find(b => b.employeeId === employeeId) || null
       , [leaveBalances, employeeId]);
     ```
     Because `b.employeeId` is `'HY100123'` while the `employeeId` prop is `authUser.id` (`'UDF-202609-XXXX'` or Google UID), `leaveBalances.find(...)` returns `undefined` (`currentBalance === null`)!
  5. With `currentBalance === null`, `getBalance(type)` (`L51`) returns `{ total: 0, used: 0, remaining: 0 }` for every paid leave type, displaying **`0 / 0`** across all balance cards and blocking every paid leave submission at lines `115–118`:
     ```ts
     if (balanceInfo.remaining !== '∞' && (balanceInfo.remaining as number) < daysRequested) {
       setFormError(`Insufficient leave balance. You have ${balanceInfo.remaining} days remaining...`);
       return;
     }
     ```
- **Real-World Impact**:
  - Self-onboarded and Google-authenticated employees see `0 / 0` leave balances on their Leave Request page and are blocked from submitting any paid leave request (`Casual Leave`, `Sick Leave`, `Earned Leave`), while `EmployeeResignationPage` displays their raw Firebase UID instead of their badge Employee ID.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/EmployeeDashboardPage.tsx
+++ b/components/EmployeeDashboardPage.tsx
@@ -186,7 +186,7 @@
         break;
       case AppView.EMPLOYEE_LEAVE_REQUESTS:
         content = <EmployeeLeaveRequestPage
-          employeeId={authUser?.id || ''}
+          employeeId={authUser?.employeeId || employeeData?.employeeId || authUser?.id || ''}
           existingRequests={leaveRequests}
           onSubmitRequest={onSubmitLeaveRequest}
           roles={roles}
@@ -199,7 +199,7 @@
         break;
       case AppView.EMPLOYEE_ACCOUNT_UPDATES:
         content = <EmployeeAccountUpdatePage
-          employeeId={authUser?.id || ''}
+          employeeId={authUser?.employeeId || employeeData?.employeeId || authUser?.id || ''}
           employeeData={employeeData}
           existingRequests={accountUpdateRequests}
           onSubmitRequest={onSubmitAccountUpdateRequest}
@@ -210,7 +210,7 @@
         break;
       case AppView.EMPLOYEE_RESIGNATION:
         content = <EmployeeResignationPage
-          employeeId={authUser?.id || ''}
+          employeeId={authUser?.employeeId || employeeData?.employeeId || authUser?.id || ''}
           employeeData={employeeData}
           existingRequests={resignationRequests}
           onSubmitRequest={onSubmitResignationRequest}
--- a/components/employee/EmployeeLeaveRequestPage.tsx
+++ b/components/employee/EmployeeLeaveRequestPage.tsx
@@ -44,7 +44,7 @@
 
   // Get current balance for this employee
   const currentBalance = useMemo(() =>
-    leaveBalances.find(b => b.employeeId === employeeId) || null
+    leaveBalances.find(b => b.employeeId === employeeId) || leaveBalances[0] || null
     , [leaveBalances, employeeId]);
```

### [UDF-AUD-112] [HIGH] Shift Attendance Points (`attendancePoints = 5`) Are Never Credited Anywhere on Client or Server (`AttendanceCalendar.tsx:107–146`, `engagementService.ts:274–277`, `functions/index.js:7796–7915`)
- **Category**: Broken Feature / Gamification Points Never Awarded
- **Target File(s) & Exact Line Numbers**:
  - `components/employee/AttendanceCalendar.tsx` (Lines `107–146`)
  - `src/services/engagementService.ts` (Lines `237–285`)
  - `functions/index.js` (Lines `7796–7915`)
- **Root Cause & Exact Code Trace**:
  1. When an employee opens the dashboard (`EmployeeEngagementHub.tsx:66` or `BlogDashboardPage.tsx:86`), `updateOrCreateStreak(userId, userName)` invokes `recordDailyStreakServer` (`functions/index.js:7796`), which records `lastVisitDate = today` on `user_engagement/{userId}` and credits `streakPoints` (`1` point).
  2. When the employee then marks their daily shift attendance as `'P'` (Present) in `components/employee/AttendanceCalendar.tsx:100–146`:
     - `markAttendanceForDate` (`src/services/engagementService.ts:275–277`) calls `updateOrCreateStreak(userId, userName)`, which sees `lastVisitDate === today` (`functions/index.js:7889`) and exits immediately with `alreadyRecordedToday: true` (`0` points added).
     - Next, `AttendanceCalendar.tsx:113–142` fetches `pointsToAdd = rulesSnap.data().attendancePoints ?? 5`, logs `console.log("[ATTENDANCE POINTS] Awarded +5 points")`, and executes:
       ```ts
       // SEC-17: Do not directly mutate points from client; points are ledgered server-side
       await setDoc(streakRef, {
           ...streakData,
           userId,
           userName
       }, { merge: true });
       ```
     - Because `points: currentPoints + pointsToAdd` was removed from `AttendanceCalendar.tsx:137` under `SEC-17` without adding any server-side callable or Firestore trigger to award `attendancePoints`, marking shift attendance as Present awards **0 points** on both client and server!
- **Real-World Impact**:
  - Employees marking daily shift attendance (`Present`) never receive the configured `+5` attendance points (`settings/gamification_rules.attendancePoints`), despite the console logging `"Awarded +5 points"`.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -7840,11 +7840,13 @@
     // Read streak points from gamification_rules
     let streakPoints = 1;
+    let attendancePoints = 5;
     try {
         const rulesSnap = await db.collection('settings').doc('gamification_rules').get();
         if (rulesSnap.exists) {
             streakPoints = rulesSnap.data().streakPoints ?? 1;
+            attendancePoints = rulesSnap.data().attendancePoints ?? 5;
         }
     } catch (e) {
         console.warn('[recordDailyStreakServer] Failed to read gamification_rules:', e);
     }
+    const isAttendanceCheckIn = Boolean(request.data && request.data.isAttendanceCheckIn === true);
```

### [UDF-AUD-113] [HIGH] `BlogDashboardPage.tsx` (`L106–123, 158–194, 237–239`) Selects a Different Daily Quiz Than `completeTrainingQuizServer` (`functions/index.js:7985–7989`), Fails to Restore Quiz Completion State on Reload, Omits `siteId` on Grievances, and Renders a Hardcoded 1-User Leaderboard
- **Category**: Broken Feature / Dual Engagement Hub Desynchronization
- **Target File(s) & Exact Line Numbers**:
  - `components/BlogDashboardPage.tsx` (Lines `106–123, 158–194, 237–239`)
  - `components/employee/EmployeeEngagementHub.tsx` (Lines `39–46, 74–84, 147–149`)
  - `functions/index.js` (Lines `7985–7989`)
- **Root Cause & Exact Code Trace**:
  1. **Quiz Selection Mismatch**: In `components/BlogDashboardPage.tsx:106–111` (mounted at `/dashboard` and linked from `PublicHeader.tsx:26`), custom quizzes are fetched via `getDocs(collection(db, 'safety_quizzes'))` (ordered by document ID) and selected via `const dayIndex = new Date().getDate() % list.length;` (day of month `1..31`). By contrast, `EmployeeEngagementHub.tsx:39–45` and `completeTrainingQuizServer` (`functions/index.js:7985–7989`) order by `orderBy('createdAt', 'desc')` and select via `Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % list.length`.
  2. **Missing Quiz Completion Persistence on Reload**: Unlike `EmployeeEngagementHub.tsx:74–84` (which checks `streak.lastQuizDate === today` and sets `quizSubmitted = true`), `BlogDashboardPage.tsx` never checks `streak.lastQuizDate` or `daily_quiz_logs`, nor does it update `lastQuizDate` on `user_engagement/{userId}` after submission. Refreshing `/dashboard` resets the quiz to unanswered, and when the employee submits again, `completeTrainingQuizServer` throws `already-exists` (`L179`), displaying `✓ Correct! (+10 Points Added)` (`L403`) without actually awarding points.
  3. **Unscoped Grievances**: On line `194`, `BlogDashboardPage.tsx` calls `submitComplaint(userId, userName, complaintText)` without passing the employee's `siteId` or `siteName`, creating grievances with `siteId: null`.
  4. **Hardcoded 1-User Leaderboard**: Lines `237–239` hardcode `const leaderboard = [{ name: userName || 'You', site: "Active Station", points: points, isCurrentUser: true }];`, so the `"UDF India Leaderboard"` section never queries top scorers.
- **Real-World Impact**:
  - Employees visiting `/dashboard` from the main site header experience inconsistent daily quizzes, lose quiz completion state on page refresh, submit unscoped grievances, and see a fake 1-row leaderboard.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/BlogDashboardPage.tsx
+++ b/components/BlogDashboardPage.tsx
@@ -25,7 +25,7 @@
 import AttendanceCalendar from './employee/AttendanceCalendar';
-import { getUserStreak, updateOrCreateStreak, submitComplaint, createRewardRedemption, UserStreak } from '../src/services/engagementService';
+import { getUserStreak, updateOrCreateStreak, submitComplaint, createRewardRedemption, getLocalDateString, UserStreak } from '../src/services/engagementService';
 import { db, functions } from '../src/firebase/config';
-import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
+import { doc, setDoc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
@@ -106,10 +106,10 @@
             // 2. Fetch custom quizzes
-            const quizzesSnap = await getDocs(collection(db, 'safety_quizzes'));
+            const quizzesSnap = await getDocs(query(collection(db, 'safety_quizzes'), orderBy('createdAt', 'desc')));
             if (!quizzesSnap.empty) {
                 const list = quizzesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
-                // Pick a daily question based on the day of the month
-                const dayIndex = new Date().getDate() % list.length;
+                const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % list.length;
                 const activeQuiz = list[dayIndex];
```

### [UDF-AUD-114] [HIGH] `BusinessSolutionsPage.tsx` (`L25, 48–84, 152–162, 314–330`) Discards 100% of B2B Quote Requests via a Dummy `alert()` Handler and Ignores CMS Services/Counts, While `ServicesPage.tsx` (`L34–49`) Is Unrouted Dead Code
- **Category**: Broken Feature / B2B Sales Lead Loss & CMS Desynchronization
- **Target File(s) & Exact Line Numbers**:
  - `components/BusinessSolutionsPage.tsx` (Lines `25, 48–84, 152–162, 314–330`)
  - `components/ServicesPage.tsx` (Lines `34–49`)
  - `src/routes/AppRoutes.tsx` (Line `287`)
- **Root Cause & Exact Code Trace**:
  1. **100% of B2B Quote Requests Silently Discarded**: In `components/BusinessSolutionsPage.tsx:314–330`, the **"Get a Service Quote"** form has no state variables and its `onSubmit` handler simply calls `alert()`:
     ```tsx
     <form className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs" onSubmit={(e) => { e.preventDefault(); alert('Proposal request sent successfully! Our representative will call you shortly.'); }}>
     ```
     No document is written to `contact_messages` in Firestore and no notification is sent to administrators. Every corporate prospect requesting a security quote believes their inquiry was submitted when it was completely discarded.
  2. **CMS `services` and Officer/Site Counts Ignored on `/business`**: Even though `BusinessSolutionsPage.tsx:37–38` loads `config = await getWebsiteConfig()`, lines `48–84` use a hardcoded `servicesList` array and lines `152, 160` hardcode `15,000+` and `800+` instead of `config.services`, `config.aboutActiveOfficersCount`, and `config.aboutSecuredSitesCount`. Meanwhile, `AppRoutes.tsx:287` redirects `/services` to `/business` (`<Route path="/services" element={<Navigate to="/business" replace />} />`), leaving `components/ServicesPage.tsx` completely unreachable (and `ServicesPage.tsx:34–49` lacks icon mappings for `'PawPrint'`, `'Car'`, `'Calendar'`, and `'Cpu'`).
  3. **Unused `SEOHead` Import**: `BusinessSolutionsPage.tsx:25` imports `SEOHead` but never renders `<SEOHead />` in its JSX.
- **Real-World Impact**:
  - Every B2B quote request submitted on `/business` is lost, and edits made by admins to the Services list in `AdminWebsiteManager` never appear on `/business` or `/services`.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/BusinessSolutionsPage.tsx
+++ b/components/BusinessSolutionsPage.tsx
@@ -24,11 +24,17 @@
 import PublicFooter from './common/PublicFooter';
 import { getWebsiteConfig, WebsiteServiceData } from '../src/services/websiteService';
 import SEOHead from '../src/components/common/SEOHead';
+import { db } from '../src/firebase/config';
+import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
 
 const BusinessSolutionsPage: React.FC = () => {
     const navigate = useNavigate();
     const [config, setConfig] = useState<WebsiteServiceData | null>(null);
     const [loading, setLoading] = useState(true);
+    const [companyName, setCompanyName] = useState('');
+    const [contactInfo, setContactInfo] = useState('');
+    const [scopeText, setScopeText] = useState('');
+    const [submittingQuote, setSubmittingQuote] = useState(false);
@@ -314,19 +320,33 @@
-                        <form className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs" onSubmit={(e) => { e.preventDefault(); alert('Proposal request sent successfully! Our representative will call you shortly.'); }}>
+                        <form className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs" onSubmit={async (e) => {
+                            e.preventDefault();
+                            setSubmittingQuote(true);
+                            try {
+                                await addDoc(collection(db, 'contact_messages'), {
+                                    name: `${companyName.trim()} (${contactInfo.trim()})`.slice(0, 100),
+                                    email: '',
+                                    phone: contactInfo.trim(),
+                                    subject: 'B2B Proposal Quote Request',
+                                    message: scopeText.trim(),
+                                    honeypot: '',
+                                    timestamp: serverTimestamp()
+                                });
+                                setCompanyName(''); setContactInfo(''); setScopeText('');
+                                alert('Proposal request sent successfully! Our representative will call you shortly.');
+                            } catch (err) {
+                                alert('Failed to submit proposal request. Please call our office directly.');
+                            } finally {
+                                setSubmittingQuote(false);
+                            }
+                        }}>
```

### [UDF-AUD-115] [HIGH] `RequestCorrectionModal.tsx` (`L35–52, 115–128, 365–368`) Never Resets `selectedFields` When Props Change, Directly Mutates `fieldReasons` State Inside `setSelectedFields`, and Exposes Disabled/Hidden Form Fields
- **Category**: Broken Feature / React State Mutation & RBAC Leak
- **Target File(s) & Exact Line Numbers**:
  - `components/common/RequestCorrectionModal.tsx` (Lines `35–52, 115–128, 365–368`)
- **Root Cause & Exact Code Trace**:
  1. **Stale `initialSelectedFields` Across Modal Opens**: In `components/common/RequestCorrectionModal.tsx:35–52`, `selectedFields` and `fieldReasons` are initialized via `useState(() => ...)` only on initial mount. When `RequestCorrectionModal` is rendered persistently by a parent component and opened with different `initialSelectedFields` or `targetId`, `selectedFields` and `fieldReasons` do not sync with the updated props.
  2. **Direct State Mutation in `handleSelectSectionFields`**: On lines `120–127`:
     ```ts
     setSelectedFields(prev => {
       const copy = { ...prev };
       fieldIds.forEach(id => {
         copy[id] = selectAll;
         if (!selectAll) delete fieldReasons[id];
       });
       return copy;
     });
     ```
     `delete fieldReasons[id]` mutates the `fieldReasons` React state object directly inside a `setSelectedFields` updater function instead of calling `setFieldReasons`.
  3. **Includes Disabled Sections and Disabled Fields**: On lines `365–368`, `formSections.map(sec => ...)` filters out only `FieldType.HEADER` and `FieldType.INFO_TEXT`, without filtering out `!sec.isDisabled` and `!f.isDisabled`.
- **Real-World Impact**:
  - Admins can accidentally generate correction links for disabled form sections/fields, and pre-selected duplicate/conflict fields fail to populate when `RequestCorrectionModal` stays mounted.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/common/RequestCorrectionModal.tsx
+++ b/components/common/RequestCorrectionModal.tsx
@@ -121,10 +121,17 @@
     setSelectedFields(prev => {
       const copy = { ...prev };
       fieldIds.forEach(id => {
         copy[id] = selectAll;
-        if (!selectAll) delete fieldReasons[id];
       });
       return copy;
     });
+    if (!selectAll) {
+      setFieldReasons(prev => {
+        const copy = { ...prev };
+        fieldIds.forEach(id => { delete copy[id]; });
+        return copy;
+      });
+    }
   };
@@ -365,9 +372,9 @@
-              {formSections.map(sec => {
+              {formSections.filter(sec => !sec.isDisabled).map(sec => {
                 // Filter out non-input structural items (headers and helper texts)
-                const inputFields = sec.fields?.filter(f => f.type !== FieldType.HEADER && f.type !== FieldType.INFO_TEXT) || [];
+                const inputFields = sec.fields?.filter(f => !f.isDisabled && f.type !== FieldType.HEADER && f.type !== FieldType.INFO_TEXT) || [];
                 if (inputFields.length === 0) return null;
```

### [UDF-AUD-116] [MEDIUM] `ProfileAvatar.tsx` (`L28, 34–57, 86–97`) Never Syncs `photoURL` State When `currentPhotoURL` Prop Changes, and Uploading an Employee Avatar Never Updates `onboarding_submissions.profilePhotoURL`
- **Category**: Broken Feature / Stale UI State & Collection Desynchronization
- **Target File(s) & Exact Line Numbers**:
  - `components/ProfileAvatar.tsx` (Lines `28, 34–57, 86–97`)
- **Root Cause & Exact Code Trace**:
  1. In `components/ProfileAvatar.tsx:28`:
     ```ts
     const [photoURL, setPhotoURL] = useState<string | undefined>(currentPhotoURL);
     ```
     Because `photoURL` is never updated via `useEffect(() => { setPhotoURL(currentPhotoURL); }, [currentPhotoURL])`, whenever `currentPhotoURL` arrives asynchronously after mount or the parent switches to viewing a different employee without unmounting `ProfileAvatar`, the avatar continues displaying the old `photoURL` (or initials fallback).
  2. In `handleFileSelect` (`L86–92`), when `targetCollection === 'employees'`, `ProfileAvatar` updates `profilePhotoURL` only on the `employees` document and never syncs `profilePhotoURL` to the linked `onboarding_submissions` document.
- **Real-World Impact**:
  - Employee avatars fail to update when `currentPhotoURL` loads asynchronously or when switching between employee profiles.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/ProfileAvatar.tsx
+++ b/components/ProfileAvatar.tsx
@@ -33,6 +33,10 @@
     const [showPreview, setShowPreview] = useState(false);
     const fileInputRef = useRef<HTMLInputElement>(null);
 
+    React.useEffect(() => {
+        setPhotoURL(currentPhotoURL);
+    }, [currentPhotoURL]);
+
     React.useEffect(() => {
         let isMounted = true;
```

### [UDF-AUD-117] [MEDIUM] `ContactPage.tsx` (`L47–71, 189–255`) Lacks Client-Side Length Validation Matching `firestore.rules` (`L158–169`), Causing Short Messages or Untrimmed Inputs to Fail With `permission-denied`
- **Category**: Broken Feature / Validation Mismatch
- **Target File(s) & Exact Line Numbers**:
  - `components/ContactPage.tsx` (Lines `47–71, 189–255`)
  - `firestore.rules` (Lines `158–169`)
- **Root Cause & Exact Code Trace**:
  1. `firestore.rules:160–167` enforces strict length constraints on `contact_messages`:
     - `name.size() >= 2 && name.size() <= 100`
     - `email == '' || (email.size() >= 5 && email.size() <= 120)`
     - `message.size() >= 5 && message.size() <= 3000`
     - `honeypot == ''`
  2. However, `components/ContactPage.tsx:47–71, 189–255` places no `minLength` or `maxLength` attributes on its form inputs and does not validate or `.trim()` `name`, `email`, or `message` before calling `addDoc(collection(db, 'contact_messages'), ...)`. If a visitor submits a 1-letter name or a 4-character message (e.g. `"Help"`), Firestore rejects the write with `permission-denied` and `ContactPage` displays `"Something went wrong. Please try calling our support hotline directly."`.
- **Real-World Impact**:
  - Visitors submitting short contact messages or untrimmed inputs receive a generic server failure message instead of a validation prompt.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/ContactPage.tsx
+++ b/components/ContactPage.tsx
@@ -49,13 +49,23 @@
     const handleSubmit = async (e: React.FormEvent) => {
         e.preventDefault();
+        const cleanName = name.trim();
+        const cleanEmail = email.trim();
+        const cleanMessage = message.trim();
+        if (cleanName.length < 2 || cleanName.length > 100) {
+            setError('Please enter a valid name (2–100 characters).');
+            return;
+        }
+        if (cleanMessage.length < 5 || cleanMessage.length > 3000) {
+            setError('Please enter a message between 5 and 3,000 characters.');
+            return;
+        }
         setSubmitting(true);
         setError('');
         try {
             await addDoc(collection(db, 'contact_messages'), {
-                name,
-                email,
-                phone,
+                name: cleanName,
+                email: cleanEmail,
+                phone: phone.trim(),
                 subject,
-                message,
+                message: cleanMessage,
+                honeypot: '',
                 timestamp: serverTimestamp()
             });
```

### [UDF-AUD-118] [MEDIUM] `PublicFooter.tsx` (`L89–95, 111–117`) Sends Applicants Clicking `"Join UDF (Apply Online)"` to an External Legacy Google Form (`https://forms.gle/f86UXjTiusatMUVd7`) Instead of `/join`
- **Category**: Broken Feature / Legacy External Redirect
- **Target File(s) & Exact Line Numbers**:
  - `components/common/PublicFooter.tsx` (Lines `89–95, 111–117`)
  - `components/common/PublicHeader.tsx` (Lines `150–155, 225–233`)
- **Root Cause & Exact Code Trace**:
  1. In `components/common/PublicFooter.tsx:89–95` (non-homepage footer) and `111–117` (homepage footer), the **"Join UDF (Apply Online)"** CTA is an external anchor tag pointing to a legacy Google Form:
     ```tsx
     <a
         href="https://forms.gle/f86UXjTiusatMUVd7"
         target="_blank"
         rel="noopener noreferrer"
         ...
     >
         Join UDF (Apply Online)
     </a>
     ```
  2. Meanwhile, `PublicHeader.tsx:151–152, 229–230` hides its `/join` button via `className="hidden ..." style={{ display: 'none' }}`. As a result, applicants clicking "Join UDF (Apply Online)" in the footer are sent to an external Google Form that bypasses the portal's `/join` onboarding flow, Firestore `onboarding_submissions`, Aadhaar OCR, and referral attribution.
- **Real-World Impact**:
  - Candidates applying via the website footer submit to a legacy external Google Form instead of the UDF HR & Onboarding Portal.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/components/common/PublicFooter.tsx
+++ b/components/common/PublicFooter.tsx
@@ -88,14 +88,12 @@
                             </ul>
-                            <a
-                                href="https://forms.gle/f86UXjTiusatMUVd7"
-                                target="_blank"
-                                rel="noopener noreferrer"
+                            <button
+                                onClick={() => navigate('/join')}
                                 className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-center"
                             >
                                 Join UDF (Apply Online)
-                            </a>
+                            </button>
                         </div>
                     ) : (
@@ -110,14 +108,12 @@
                                     Contact Our Team
                                 </button>
-                                <a
-                                    href="https://forms.gle/f86UXjTiusatMUVd7"
-                                    target="_blank"
-                                    rel="noopener noreferrer"
+                                <button
+                                    onClick={() => navigate('/join')}
                                     className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-center block"
                                 >
                                     Join UDF (Apply Online)
-                                </a>
+                                </button>
                             </div>
                         </div>
```

### [UDF-AUD-119] [MEDIUM] `AppRoutes.tsx` (`L188–197, 246–255`) Enters a Cross-Subdomain Infinite Redirect Loop When `authUser.type` Mismatches `VITE_APP_TARGET` (`admin` vs `employee`), and `AdDemoPage.tsx` (`/ad-demo`) Is Unrouted
- **Category**: Broken Feature / Infinite Redirect Loop & Dead Route
- **Target File(s) & Exact Line Numbers**:
  - `src/routes/AppRoutes.tsx` (Lines `188–197, 246–255, 281–292`)
  - `src/components/guards/AuthGuard.tsx` (Lines `45–53`)
  - `components/AdDemoPage.tsx` (Line `21`)
- **Root Cause & Exact Code Trace**:
  1. When `appTarget === 'admin'` (`admin.udfonline.in`), `AppRoutes.tsx:188–197` mounts `<AuthGuard allowedUserTypes={[UserType.ADMIN]}>` on both `/admin/*` and `/*`. If the browser has an authenticated `UserType.EMPLOYEE` session, `AuthGuard.tsx:48` redirects via `<Navigate to="/employee/dashboard" replace />`. Inside `appTarget === 'admin'`, `/employee/dashboard` matches `path="/*"` (`L193`), which renders the same `<AuthGuard allowedUserTypes={[UserType.ADMIN]}>` again—triggering an infinite `<Navigate to="/employee/dashboard" replace />` loop!
  2. Symmetrically, when `appTarget === 'employee'` (`employee.udfonline.in`), `AppRoutes.tsx:246–255` mounts `<AuthGuard allowedUserTypes={[UserType.EMPLOYEE]}>` on `/employee/*` and `/*`. If the browser has an authenticated `UserType.ADMIN` session, `AuthGuard.tsx:46` redirects via `<Navigate to="/admin/dashboard" replace />`, which matches `path="/*"` (`L251`) inside `appTarget === 'employee'` in an infinite loop!
  3. Additionally, `components/AdDemoPage.tsx` (`canonicalUrl="https://udfonline.in/ad-demo"`) is never imported or routed in `src/routes/AppRoutes.tsx`.
- **Real-World Impact**:
  - Visiting `admin.udfonline.in` while logged in as an employee (or `employee.udfonline.in` while logged in as an admin) freezes the browser in an infinite React Router redirect loop.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/src/routes/AppRoutes.tsx
+++ b/src/routes/AppRoutes.tsx
@@ -186,6 +186,7 @@
                     <Route path="/admin/login" element={<Navigate to="/" replace />} />
                     <Route path="/admin/dashboard" element={<Navigate to="/dashboard" replace />} />
+                    <Route path="/employee/*" element={<RedirectToExternal url="https://employee.udfonline.in/dashboard" label="Employee Dashboard" />} />
                     <Route path="/admin/*" element={
                         <AuthGuard allowedUserTypes={[UserType.ADMIN]}>
                             <AdminPortalPage {...props.adminProps} />
@@ -243,6 +244,7 @@
                         />
                     } />
                     <Route path="/employee/dashboard" element={<Navigate to="/dashboard" replace />} />
+                    <Route path="/admin/*" element={<RedirectToExternal url="https://admin.udfonline.in/dashboard" label="Admin Portal" />} />
                     <Route path="/employee/*" element={
                         <AuthGuard allowedUserTypes={[UserType.EMPLOYEE]}>
                             <EmployeeDashboardPage {...props.employeeProps} />
```

### [UDF-AUD-120] [MEDIUM] `resolveEmployeeDoc` (`src/services/employeeService.ts:73–110`) Never Queries by `uid` or `linkedUid`, Breaking Employee Document Resolution When Called With a Firebase Auth UID, and `scripts/search-user.js` (`L19`) Crashes With `ReferenceError: fs is not defined`
- **Category**: Broken Feature / Helper Resolution Gap & Script Crash
- **Target File(s) & Exact Line Numbers**:
  - `src/services/employeeService.ts` (Lines `73–110`)
  - `scripts/search-user.js` (Lines `1–20`)
- **Root Cause & Exact Code Trace**:
  1. In `src/services/employeeService.ts:73–110`, `resolveEmployeeDoc(idOrEmployeeId)` checks only:
     - Direct doc ID (`doc(db, 'employees', cleanId)`)
     - `where('employeeId', '==', cleanId)`
     - `where('portalId', '==', cleanId)`
     - `where('submissionId', '==', cleanId)`
     It never checks `where('uid', '==', cleanId)` or `where('linkedUid', '==', cleanId)`. Whenever a caller such as `ProfileAvatar.tsx:88` or `AdminLeaveManagementPage.tsx:55` passes an employee's Firebase Auth UID (`authUser.id`) for an employee whose Firestore document is keyed by their badge ID (`HY...`) or submission ID (`UDF-...`), `resolveEmployeeDoc` returns `null`.
  2. In `scripts/search-user.js:18–19`:
     ```js
     const saPath = path.resolve(__dirname, '..', 'service-account.json');
     serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
     ```
     `fs` is never imported at the top of `scripts/search-user.js` (`L1–4` only import `admin`, `dotenv`, `path`, and `fileURLToPath`), causing `ReferenceError: fs is not defined` whenever the fallback branch executes.
- **Real-World Impact**:
  - Lookup and update operations passing an employee's Firebase Auth UID fail to locate their `employees` record, and `scripts/search-user.js` crashes when loading `service-account.json`.
- **Exact Copy-Paste Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -106,6 +106,20 @@
         return { ref: doc0.ref, snap: doc0, data: { id: doc0.id, ...doc0.data() } as unknown as FirestoreEmployee };
     }
 
+    // 5. Query by uid or linkedUid
+    const qUid = query(collection(db, EMPLOYEES_COLLECTION), where('uid', '==', cleanId), limit(1));
+    const snapUid = await getDocs(qUid);
+    if (!snapUid.empty) {
+        const doc0 = snapUid.docs[0];
+        return { ref: doc0.ref, snap: doc0, data: { id: doc0.id, ...doc0.data() } as unknown as FirestoreEmployee };
+    }
+    const qLinkedUid = query(collection(db, EMPLOYEES_COLLECTION), where('linkedUid', '==', cleanId), limit(1));
+    const snapLinkedUid = await getDocs(qLinkedUid);
+    if (!snapLinkedUid.empty) {
+        const doc0 = snapLinkedUid.docs[0];
+        return { ref: doc0.ref, snap: doc0, data: { id: doc0.id, ...doc0.data() } as unknown as FirestoreEmployee };
+    }
+
     return null;
 };
--- a/scripts/search-user.js
+++ b/scripts/search-user.js
@@ -1,5 +1,6 @@
 import admin from 'firebase-admin';
 import dotenv from 'dotenv';
+import fs from 'fs';
 import path from 'path';
 import { fileURLToPath } from 'url';
```

### `UDF-AUD-121` — **HIGH**: `AdminMasterEmployeeListPage` Partial 25-Row CSV Export, `VIEW_SENSITIVE_INFO` V1/V2 Permission Mismatch, `"Joined On"` Timestamp Override & Unscoped Site Dropdown
- **Target File(s)**: `components/AdminMasterEmployeeListPage.tsx` (`L911`, `L940–943`, `L1212–1213`), `components/AdminPortalPage.tsx` (`L264–286`)
- **Root Cause & Exact Code Trace**:
  1. On `AdminMasterEmployeeListPage.tsx:911`, the **"Export CSV"** button calls `onClick={() => onExport(employees)}`, where `employees` is aliased to the raw 25-row current pagination page (`paginatedData`, `L206`) rather than `filteredEmployees` (`L855`).
  2. In `AdminPortalPage.tsx:268`, `handleExportData` checks `const canViewSensitive = isSuperAdmin || hasPermission(Permission.VIEW_SENSITIVE_INFO);` (the legacy v1 enum value `'VIEW_SENSITIVE_INFO'`), whereas `AdminRoleManagementPage.tsx:177` assigns `Permission.EMPLOYEES_VIEW_SENSITIVE_INFO` (`'EMPLOYEES_VIEW_SENSITIVE_INFO'`). Consequently, any non-SuperAdmin staff granted `"View Sensitive Info"` in Role Manager still gets `canViewSensitive = false` during CSV export!
  3. On `AdminMasterEmployeeListPage.tsx:1212–1213`, the **"Joined On"** column renders `new Date(emp.timestamp || (safeEmp as any).joiningDate).toLocaleDateString()`. Because `emp.timestamp` (the onboarding form submission timestamp) is truthy on every onboarded employee, it always takes precedence over `emp.joiningDate`—even after an admin explicitly updates the official joining date via `handleSaveJoiningDate` (`L303–335`)!
  4. On `AdminMasterEmployeeListPage.tsx:940–943`, the Site Filter dropdown renders `<option value="ALL">All Company Sites</option>` followed by all active sites in `safeSites` without filtering by `effectiveAllowedSiteIds` when `!hasViewScopeAll`.
- **Real-World Impact**:
  - CSV exports silently drop search/column filters and mask sensitive columns even for authorized HR staff with `EMPLOYEES_VIEW_SENSITIVE_INFO`.
  - Editing an employee's Official Joining Date never updates the `"Joined On"` column in the Master Employee List table.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminPortalPage.tsx
+++ b/components/AdminPortalPage.tsx
@@ -265,7 +265,7 @@
   const handleExportData = async (data: SubmittedFormData[]) => {
     try {
       const { exportEmployeesToCSV } = await import('../utils/exportUtils');
       // SECURITY: Pass RBAC permissions to the export generator
-      const canViewSensitive = isSuperAdmin || hasPermission(Permission.VIEW_SENSITIVE_INFO);
+      const canViewSensitive = isSuperAdmin || hasPermission(Permission.EMPLOYEES_VIEW_SENSITIVE_INFO) || hasPermission(Permission.VIEW_SENSITIVE_INFO);
       const getVisibleFieldIds = () => {
--- a/components/AdminMasterEmployeeListPage.tsx
+++ b/components/AdminMasterEmployeeListPage.tsx
@@ -908,7 +908,7 @@
             {hasPermission(Permission.EXPORT_DATA) && (
               <Button
                 variant="secondary"
-                onClick={() => onExport(employees)}
+                onClick={() => onExport(filteredEmployees)}
                 className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center"
               >
                 <Download size={15} className="mr-1.5 text-gray-500" /> Export CSV
@@ -938,7 +938,9 @@
               <div className="w-full sm:w-64">
                 <Select value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
                   <option value="ALL">{hasViewScopeAll ? 'All Company Sites' : 'All Assigned Sites'}</option>
-                  {safeSites.filter(s => s && s.status === 'Active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
+                  {safeSites
+                    .filter(s => s && s.status === 'Active' && (hasViewScopeAll || effectiveAllowedSiteIds.includes(s.id)))
+                    .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                 </Select>
               </div>
             )}
@@ -1209,8 +1211,8 @@
                       {isColumnVisible('joiningDate') && (
                         <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-400 font-bold">
                           {(() => {
-                            const d = emp.timestamp || (safeEmp as any).joiningDate;
+                            const d = (safeEmp as any).joiningDate || emp.timestamp;
                             return d ? new Date(d).toLocaleDateString() : 'N/A';
                           })()}
                         </td>
                       )}
```

### `UDF-AUD-122` — **HIGH**: `AdminStaffProfilePage` Zeroed Portfolio Headcounts (`supervisorIds`/`sitesManaged` Ignored) & Vanishing Staff Profile Avatars (`profilePhotoURL` Dropped in `authService.ts`)
- **Target File(s)**: `components/AdminStaffProfilePage.tsx` (`L37–40`, `L57–59`, `L76`, `L95`), `src/services/authService.ts` (`L187–195`, `L225–233`, `L260–266`, `L279–285`)
- **Root Cause & Exact Code Trace**:
  1. In `components/AdminStaffProfilePage.tsx:57–59`, `assignedSites` is computed via `sites.filter(s => s.supervisorId === authUser?.id && s.status === 'Active')`, and line `76` computes `foSites` via `sites.filter(s => s.supervisorId === fo.id && s.status === 'Active')`. Both filters check only the legacy single `s.supervisorId` field and ignore `s.supervisorIds` (the multi-supervisor array on `Site`) as well as `staffDetails?.sitesManaged` (`authUser?.sitesManaged`).
  2. Line `95` passes `currentPhotoURL={authUser?.profilePhotoURL}` to `<ProfileAvatar>`, which saves uploaded staff avatars to `staff_accounts/{uid}.profilePhotoURL` (`src/services/profilePhotoService.ts:69`). However, `getStaffProfile` (`src/services/authService.ts:187–195, 225–233`) and `getAdminProfile` (`L260–266, 279–285`) never copy `data.profilePhotoURL` onto the returned `User` object!
  3. Lines `37–40` (`hasPermission`) ignore `userRole?.isDisabled === true` and `authUser?.permissionOverrides`.
- **Real-World Impact**:
  - Field Officers and supervisors assigned via `sitesManaged` or co-supervisor `supervisorIds` see `"0 Assigned Sites"`, `"0 Total Guards"`, and `"No Direct Assignments"` on their profile page.
  - Every staff member's uploaded profile avatar disappears as soon as they refresh the browser or log back in.
- **Remediation (`diff`)**:
```diff
--- a/src/services/authService.ts
+++ b/src/services/authService.ts
@@ -192,6 +192,7 @@
         roleId: data.roleId,
         isDisabled: data.isDisabled || false,
         permissionOverrides: data.permissionOverrides || {},
+        profilePhotoURL: data.profilePhotoURL,
         ...(Array.isArray(data.sitesManaged) ? { sitesManaged: data.sitesManaged } : {}),
         ...(Array.isArray(data.allowedPrefillFieldIds) ? { allowedPrefillFieldIds: data.allowedPrefillFieldIds } : {})
     };
--- a/components/AdminStaffProfilePage.tsx
+++ b/components/AdminStaffProfilePage.tsx
@@ -54,9 +54,14 @@
-  // Sites assigned to this user
+  // Sites assigned to this user (including supervisorIds and sitesManaged)
   const assignedSites = useMemo(() => {
-    return sites.filter(s => s.supervisorId === authUser?.id && s.status === 'Active');
-  }, [sites, authUser]);
+    const managedIds = new Set(Array.isArray(staffDetails?.sitesManaged) ? staffDetails.sitesManaged : []);
+    return sites.filter(s =>
+      s.status === 'Active' &&
+      (s.supervisorId === authUser?.id ||
+       (Array.isArray(s.supervisorIds) && Boolean(authUser?.id) && s.supervisorIds.includes(authUser!.id)) ||
+       managedIds.has(s.id))
+    );
+  }, [sites, authUser, staffDetails]);
```

### `UDF-AUD-123` — **HIGH**: Private Internal Blog Posts Leaked on Public Homepage (`BlogPage.tsx`) to `UserType.PUBLIC` Sessions While All Admins Are Locked Out on `BlogsPage.tsx`
- **Target File(s)**: `components/BlogPage.tsx` (`L79–84`, `L142`, `L273`), `components/BlogsPage.tsx` (`L42`, `L77`, `L141`, `L198`)
- **Root Cause & Exact Code Trace**:
  1. On the public homepage `components/BlogPage.tsx:79–84`, `getBlogPosts()` fetches all blog posts. Because `firestore.rules:575` permits reading `isPrivate == true` posts whenever `isAuthenticated()` is true, any job candidate signed in with Google (`UserType.PUBLIC`) or anonymous Firebase Auth session receives all private posts from `getBlogPosts()`. Then `BlogPage.tsx:142` (`const recentPosts = posts.slice(0, 3);`) and `L273` render those posts and their full modal content **without filtering out `post.isPrivate`**!
  2. Conversely, in `components/BlogsPage.tsx:42`, `const isEmployee = user && user.type === UserType.EMPLOYEE;` excludes `user?.type === UserType.ADMIN`. Lines `77` and `141` block any post where `post.isPrivate && !isEmployee`, locking SuperAdmins and HR Admins out of viewing the private blog posts they authored (`"Employee-Only Access — Log In as Employee"`).
  3. On `BlogsPage.tsx:198`, `<SEOHead ogImage={selectedPost?.coverImage} />` reads `coverImage`, whereas `BlogPost` (`src/services/blogService.ts:13`) and lines `253, 311` store the image URL in `imageUrl`.
- **Real-World Impact**:
  - Internal employee-only announcements and SOPs marked `"Employee-Only (Private Post)"` are exposed on the public `/` landing page to any Google-authenticated job applicant, while company administrators cannot view them on `/blogs`.
- **Remediation (`diff`)**:
```diff
--- a/components/BlogPage.tsx
+++ b/components/BlogPage.tsx
@@ -139,7 +139,8 @@
-    const recentPosts = posts.slice(0, 3);
+    const canViewPrivate = Boolean(user && (user.type === UserType.EMPLOYEE || user.type === UserType.ADMIN));
+    const recentPosts = posts.filter(p => !p.isPrivate || canViewPrivate).slice(0, 3);
--- a/components/BlogsPage.tsx
+++ b/components/BlogsPage.tsx
@@ -39,7 +39,7 @@
-    const isEmployee = user && user.type === UserType.EMPLOYEE;
+    const isEmployee = Boolean(user && (user.type === UserType.EMPLOYEE || user.type === UserType.ADMIN));
@@ -195,7 +195,7 @@
                 description={selectedPost ? selectedPost.excerpt : "Read the latest articles..."}
-                ogImage={selectedPost?.coverImage}
+                ogImage={selectedPost?.imageUrl}
                 ogType={selectedPost ? "article" : "website"}
```

### `UDF-AUD-124` — **MEDIUM**: `AdminWorkflowConfigPage` Assigns Disabled Roles to Approval Levels, Crashes `setDoc()` When Clearing `minLength`/`maxLength`, and Leaves `isRequiredByDefault` Dead
- **Target File(s)**: `components/AdminWorkflowConfigPage.tsx` (`L34`, `L103`, `L158`, `L167–175`, `L272`, `L374`, `L380`, `L388`), `components/AdminSiteManagementPage.tsx` (`L56`, `L400–407`, `L547`)
- **Root Cause & Exact Code Trace**:
  1. In `components/AdminWorkflowConfigPage.tsx:34`, `addLevel` assigns `roleId: roles[0]?.id || ''` without filtering out suspended roles (`!r.isDisabled`), and line `103` renders all roles in the approval level `<Select>` including suspended roles.
  2. On lines `374` and `380`, clearing the `Min Length` or `Max Length` input on a Client ID definition calls `updateClientIdDefinition(def.id, { minLength: e.target.value ? parseInt(e.target.value) : undefined })`. Because `clientIdDefinitions` is an array of objects written via `setDoc(doc(db, 'settings', 'portal_config'), config)` (`src/services/adminService.ts:276`), setting an object property to `undefined` inside a Firestore array throws `FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined`.
  3. The `"Required for New Sites"` checkbox (`def.isRequiredByDefault`, `L158, 272, 388`) is never read when opening the `"Add New Site"` modal in `AdminSiteManagementPage.tsx:56, 404, 547` (`requiredClientIdIds` is always initialized to `[]`).
- **Real-World Impact**:
  - Clearing a min/max length constraint on an existing Client ID definition fails to save to Firestore, and Client IDs marked `"Required for New Sites"` are never pre-selected when creating new sites.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminWorkflowConfigPage.tsx
+++ b/components/AdminWorkflowConfigPage.tsx
@@ -31,7 +31,8 @@
     const nextLevel = config.levels.length + 1;
+    const activeRoles = roles.filter(r => !r.isDisabled);
     const newLevels: WorkflowLevel[] = [
       ...config.levels,
-      { level: nextLevel, roleId: roles[0]?.id || '', description: `Level ${nextLevel} Review` }
+      { level: nextLevel, roleId: activeRoles[0]?.id || '', description: `Level ${nextLevel} Review` }
     ];
@@ -167,8 +168,14 @@
   const updateClientIdDefinition = (id: string, updates: Partial<ClientIdDefinition>) => {
     const current = portalConfig.clientIdDefinitions || [];
-    const updated = current.map(d => d.id === id ? { ...d, ...updates } : d);
+    const updated = current.map(d => {
+      if (d.id !== id) return d;
+      const merged: Record<string, any> = { ...d, ...updates };
+      Object.keys(merged).forEach(k => { if (merged[k] === undefined) delete merged[k]; });
+      return merged as ClientIdDefinition;
+    });
     const newConfig = { ...portalConfig, clientIdDefinitions: updated };
```

### `UDF-AUD-125` — **HIGH**: `AdminMasterEmployeeListPage` Unimplemented `"Send Nudge"` Stub, Unscoped Deployment/Rejoin/Promote Site Dropdowns, Desynced `managementTarget` State & Duplicate Rehire ID Inputs
- **Target File(s)**: `components/AdminMasterEmployeeListPage.tsx` (`L1649–1651`, `L1739–1745`, `L1763`, `L1802–1807`, `L2172–2177`, `L2219`, `L2293–2305`, `L2576`)
- **Root Cause & Exact Code Trace**:
  1. On lines `1649–1651`, clicking **"Send Nudge / Reminder"** (`Permission.EMPLOYEES_SEND_PROFILE_NUDGE`) executes `alert("Reminder feature coming soon.")` instead of dispatching a notification via `sendNotificationServer`.
  2. On lines `1763` (Deployments Tab `"Assign to New Site"`), `2219` (Rejoin Modal `"Site *"`), and `2576` (Promote Modal `"Operational Site"`), the site `<Select>` dropdowns list all active sites in `safeSites`/`sites` without filtering by `effectiveAllowedSiteIds` when `!hasViewScopeAll`.
  3. On lines `1739–1745` (`relieveFromSite`) and `1802–1807` (`assignToSite`), the handlers update `setPaginatedData` (injecting a synthetic `id: 'temp-' + Date.now()` on `assignToSite`) but **never update `setManagementTarget`**. Because the open Deployments modal renders `managementTarget.activeAssignments` (`L1711, 1716`), the UI inside the open modal never reflects the added or relieved assignment, and clicking Relieve on a `'temp-...'` assignment passes a non-existent ID to Firestore.
  4. In the Rejoin Modal, checking `"Re-hire with New Employee ID"` (`isRehiring`) renders **two duplicate `"New Employee ID"` text boxes** bound to `rehireId`—one at lines `2172–2177` and a second one at lines `2293–2305`.
- **Real-World Impact**:
  - HR staff cannot send profile completion reminders; site-restricted supervisors can deploy, rejoin, or promote guards into unauthorized branch sites; and the Deployments modal fails to update its active assignments list in place.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminMasterEmployeeListPage.tsx
+++ b/components/AdminMasterEmployeeListPage.tsx
@@ -1740,6 +1740,10 @@
                                       await relieveFromSite(managementTarget.id, asgn.id, new Date().toISOString(), reason);
                                       // Local update for immediate feedback
+                                      const nextAssignments = (managementTarget.activeAssignments || []).filter(a => a.id !== asgn.id);
+                                      setManagementTarget(prev => prev ? { ...prev, activeAssignments: nextAssignments } as any : null);
                                       setPaginatedData(prev => prev.map(emp => emp.id === managementTarget.id ? {
                                         ...emp,
-                                        activeAssignments: (emp.activeAssignments || []).filter(a => a.id !== asgn.id)
+                                        activeAssignments: nextAssignments
                                       } : emp));
```

### `UDF-AUD-126` — **HIGH**: `AdminRoleManagementPage` Unrevocable User Permission Overrides (`setDoc` Nested Merge Bug), Dropped `allowedPrefillFieldIds`, Missing Claims Sync & Blank Section Headers
- **Target File(s)**: `components/AdminRoleManagementPage.tsx` (`L413–455`, `L590–601`, `L681–735`, `L1110–1114`, `L1486`, `L1520`, `L1551`, `L1553`)
- **Root Cause & Exact Code Trace**:
  1. In `saveUserOverrides` (`L724–726`), the component calls:
     ```ts
     await setDoc(doc(db, 'staff_accounts', updatedUser.id), {
       permissionOverrides: updatedUser.permissionOverrides || {}
     }, { merge: true });
     ```
     In Firestore, `setDoc(..., { merge: true })` deep-merges nested map objects. Whenever an admin sets an overridden permission back to `"Inherit Default"` (`delete overrides[key]` at `L682–684, 694, 702, 709`) or clicks `"Reset to Default"` (`permissionOverrides: {}` at `L1111`), `setDoc` with `{ merge: true }` **leaves all omitted keys untouched in Firestore**! Once a user override (`true` or `false`) is saved in Firestore, it can **never be reset to Inherit**!
  2. `saveUserOverrides` (`L724–726`) writes only `permissionOverrides` and omits `allowedPrefillFieldIds: updatedUser.allowedPrefillFieldIds || []`, silently discarding all user-specific prefill field configurations toggled via `toggleAllowedPrefillField` (`L590–601`).
  3. `saveRoleEdit` (`L413–432`), `toggleRoleStatus` (`L434–455`), and `saveUserOverrides` (`L719–735`) never call `refreshAdminClaims`, leaving stale permissions active in Firebase Auth custom claims.
  4. Lines `1486` and `1551` render `{section.name}` instead of `{section.title}` (rendering blank section headers), line `1520` styles the active `"Hidden"` button as `bg-red-50 text-white` (invisible white text on light-pink background), and line `1553` checks `f.type !== 'Section Header' && f.type !== 'Information Text'` instead of `FieldType.HEADER` and `FieldType.INFO_TEXT`.
- **Real-World Impact**:
  - Revoking or resetting a staff member's custom permission override in the UI appears to succeed locally, but the old override persists permanently in Firestore `staff_accounts/{id}.permissionOverrides` and re-applies on page reload!
- **Remediation (`diff`)**:
```diff
--- a/components/AdminRoleManagementPage.tsx
+++ b/components/AdminRoleManagementPage.tsx
@@ -13,7 +13,7 @@
 import { v4 as uuidv4 } from 'uuid';
 import { updateRoles } from '../src/services/adminService';
-import { doc, setDoc } from 'firebase/firestore';
+import { doc, updateDoc } from 'firebase/firestore';
 import { db } from '../src/firebase/config';
@@ -723,9 +723,10 @@
       setStaffUsers(prev => prev.map(s => s.id === updatedUser.id ? updatedUser : s));
       try {
-        await setDoc(doc(db, 'staff_accounts', updatedUser.id), {
-          permissionOverrides: updatedUser.permissionOverrides || {}
-        }, { merge: true });
+        await updateDoc(doc(db, 'staff_accounts', updatedUser.id), {
+          permissionOverrides: updatedUser.permissionOverrides || {},
+          allowedPrefillFieldIds: updatedUser.allowedPrefillFieldIds || []
+        });
         onNotify(`Permission overrides updated for ${updatedUser.name} and saved to server.`, 'success');
```

### `UDF-AUD-127` — **HIGH**: `AdminStaffManagementPage` Auth Email & Custom Claims Desync on Create/Edit/Transfer and Broken Undo Link Restoration
- **Target File(s)**: `components/AdminStaffManagementPage.tsx` (`L257–262`, `L309–338`, `L439–526`, `L608–657`, `L690–700`)
- **Root Cause & Exact Code Trace**:
  1. In `handleAddStaff` (`L247–262`), `createStaffUser` invokes `createStaffUserServer` without `sitesManaged`, so the Cloud Function computes initial Auth custom claims with `sitesManaged: []`. Lines `258–260` then write `sitesManaged: createSelectedSites` directly to Firestore `staff_accounts/{uid}` from the client without recomputing Auth claims—leaving the new staff member's Auth token with `sitesManaged: []` on first login.
  2. In `saveStaffEdit` (`L309–338`) and `handleExecuteTransfer` (`L439–526`), updates to a staff member's `email`, `name`, `roleId`, and `sitesManaged` are written directly to Firestore `staff_accounts/{id}` without updating Firebase Auth (`admin.auth().updateUser(uid, { email, displayName })`) or calling `computeAndApplyUserClaims`.
  3. In `confirmDelete` (`L608–657`), deleting a staff account immediately strips their ID from `settings/sites`, `employees.supervisorId`, and `onboarding_submissions.assignedStaffId` before showing the 10-second Undo toast (`L690–700`). Clicking **Undo** restores `staff_accounts/{id}` from `recycle_bin` and re-enables Auth, but never restores the wiped site, employee, or submission links.
- **Real-World Impact**:
  - Changing a staff user's email in `AdminStaffManagementPage` updates Firestore while Firebase Auth still requires their old email to sign in, and 1-Click Site Handover (`handleExecuteTransfer`) leaves both source and target staff with stale `sitesManaged` custom claims in `firestore.rules`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminStaffManagementPage.tsx
+++ b/components/AdminStaffManagementPage.tsx
@@ -319,6 +319,10 @@
         await setDoc(doc(db, 'staff_accounts', editingStaff.id), {
           ...updates,
           sitesManaged: sitesToSave
         }, { merge: true });
+        await updateDoc(doc(db, 'staff_accounts', editingStaff.id), {
+          sitesManaged: sitesToSave,
+          allowedPrefillFieldIds: updates.allowedPrefillFieldIds || []
+        });
```

### `UDF-AUD-128` — **HIGH**: `AdminSiteManagementPage` Locks Out `Permission.SITES_MANAGE`, Exposes Edit Controls in Hierarchy View, Fails to Sync `staff_accounts.sitesManaged`, Uses `s.name` Instead of `s.title` & Crashes on Undefined `emp.data`
- **Target File(s)**: `components/AdminSiteManagementPage.tsx` (`L69`, `L209`, `L370–424`, `L441`, `L769–777`, `L850`, `L993`, `L1020`, `L1186`, `L1277`)
- **Root Cause & Exact Code Trace**:
  1. Line `69` hardcodes `const hasManagePerm = Boolean(isSuperAdmin);`, ignoring `Permission.SITES_MANAGE` (`userRole?.permissions.includes(Permission.SITES_MANAGE)`) and locking all non-SuperAdmin staff granted `SITES_MANAGE` into `"READ-ONLY"` mode.
  2. In the Hierarchy List View (`L769–777`), the Edit (`setIsEditModalOpen(true)`) and Power (`toggleSiteStatus(site.id)`) buttons are rendered unconditionally without checking `hasManagePerm`.
  3. When a supervisor is assigned or changed in `handleAddSite` (`L378–392`) or `handleSaveEdit` (`L409–424`), it updates `settings/sites` (`site.supervisorId` / `site.supervisorIds`), **but never updates `staff_accounts/{supervisorId}.sitesManaged`**, leaving `staff_accounts` and `computeAndApplyUserClaims` desynchronized from `settings/sites`.
  4. Lines `209, 441, 850, 993, 1020, 1186` search for the Job Details section via `sourceSections.find(s => s.name === "Job Details")`. Because `FormSection` objects store their title in `s.title` (`"Job Details"`), `jobSection` is `undefined`, breaking `"Sync from Form Builder"` (`L991–1010`) and designation cleanup on site/designation deletion.
  5. Line `1277` (`emp.data['eb3617dc-9f1d-475d-a2db-005b6bc2500c']`) accesses `emp.data` without optional chaining, crashing the View Personnel modal with `TypeError: Cannot read properties of undefined` whenever an employee record stores its fields in `emp.profileData` or `emp.formData`.
- **Real-World Impact**:
  - Staff granted `SITES_MANAGE` cannot manage sites; assigning a supervisor in `AdminSiteManagementPage` does not grant them `sitesManaged` in `staff_accounts`; `"Sync from Form Builder"` always fails; and opening `"View Personnel"` on a site with bulk-imported employees crashes the modal.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminSiteManagementPage.tsx
+++ b/components/AdminSiteManagementPage.tsx
@@ -68,2 +68,4 @@
-  // Strictly Super Admin only can create and manage sites; all other roles have view-only access
-  const hasManagePerm = Boolean(isSuperAdmin);
+  const hasManagePerm = Boolean(
+    isSuperAdmin || (!userRole?.isDisabled && (userRole?.permissions?.includes(Permission.SITES_MANAGE) || userRole?.permissions?.includes(Permission.MANAGE_SITES)))
+  );
@@ -208,3 +210,3 @@
       const sourceSections = sections.length > 0 ? sections : defaultFormSections;
-      const jobSection = sourceSections.find(s => s.name === "Job Details");
+      const jobSection = sourceSections.find(s => (s.title || s.name) === "Job Details");
@@ -1276,3 +1278,3 @@
                   <div className="text-right">
-                    <p className="text-xs text-gray-500">{emp.data['eb3617dc-9f1d-475d-a2db-005b6bc2500c'] || 'No Phone'}</p>
+                    <p className="text-xs text-gray-500">{emp.data?.['eb3617dc-9f1d-475d-a2db-005b6bc2500c'] || emp.profileData?.['eb3617dc-9f1d-475d-a2db-005b6bc2500c'] || emp.phoneNumber || 'No Phone'}</p>
                   </div>
```

### `UDF-AUD-129` — **HIGH**: `AdminReviewSubmissionsPage` Biodata Preview & Print Bypass `onboardingFieldVisibility` (`HIDDEN`), Render Blank `{sec.name}` Headers & Ignore `permissionOverrides` on `canAssignId`
- **Target File(s)**: `components/AdminReviewSubmissionsPage.tsx` (`L613–1036`, `L855`, `L2251`, `L3091–3109`, `L3114–3350`)
- **Root Cause & Exact Code Trace**:
  1. In the Submission Details Modal (`L3093–3097`), fields where `userRole?.onboardingFieldVisibility?.[f.id] === 'HIDDEN'` are filtered out. However, both `handlePrintBiodata` (`L613–1036`) and the on-screen Biodata Preview Modal (`isBiodataModalOpen`, `L3114–3350`) unconditionally extract and display every sensitive PII/financial field (`aadharNo`, `panNo`, `uanNo`, `esicNo`, `bankName`, `accountNo`, `ifscCode`, `branchName`, `phone`, `presentAddress`, `permanentAddress`, `fatherMobile`, `motherMobile`, `photoUrl`) **without checking `userRole?.onboardingFieldVisibility` or `Permission.EMPLOYEES_VIEW_SENSITIVE_INFO` / `Permission.SUBMISSIONS_PREVIEW_DOCS`**!
  2. On line `3103`, the Submission Details Modal renders `<h4 className="...">{sec.name}</h4>` instead of `{sec.title || (sec as any).name}`, rendering blank section titles across the modal.
  3. On line `2251`, `const canAssignId = userRole?.permissions.includes(Permission.SUBMISSIONS_ASSIGN_EMPLOYEE_ID) || isSuperAdmin;` checks `userRole?.permissions` directly instead of `hasPermission(Permission.SUBMISSIONS_ASSIGN_EMPLOYEE_ID)`, ignoring `userRole?.isDisabled` and `authUser?.permissionOverrides`.
  4. On line `855` (and in the Biodata modal preview), the registration number is hardcoded as `<div>Reg. No.: HY _________________</div>` instead of displaying `sub.employeeId` when assigned.
- **Real-World Impact**:
  - Any reviewer with `SUBMISSIONS_PRINT_BIODATA` can bypass field-level privacy rules (`onboardingFieldVisibility: 'HIDDEN'`) and view/print full unmasked Aadhaar, PAN, and Bank Account details.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminReviewSubmissionsPage.tsx
+++ b/components/AdminReviewSubmissionsPage.tsx
@@ -490,7 +490,11 @@
   const getFieldValue = (sub: SubmittedFormData, id: string, label: string) => {
     if (!sub || !sub.data) return '';
+    if (!effectiveIsSuperAdmin && userRole?.onboardingFieldVisibility?.[id] === 'HIDDEN') {
+      return '•••••••• (Restricted)';
+    }
     if (sub.data[id] !== undefined && sub.data[id] !== null) {
@@ -2251,3 +2255,3 @@
-                const canAssignId = userRole?.permissions.includes(Permission.SUBMISSIONS_ASSIGN_EMPLOYEE_ID) || isSuperAdmin;
+                const canAssignId = hasPermission(Permission.SUBMISSIONS_ASSIGN_EMPLOYEE_ID);
@@ -3103,3 +3107,3 @@
                 <div key={sec.id} className="mt-4">
-                  <h4 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">{sec.name}</h4>
+                  <h4 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">{sec.title || (sec as any).name}</h4>
```

### `UDF-AUD-130` — **HIGH**: `AdminPortalPage` Sidebar & Route Guard Permission Mismatches Hide 7 Modules From Custom V2 Roles and Block BGV Vendors (`BGV_VENDOR`) & Timeline Users (`EMPLOYEES_VIEW_TIMELINE`)
- **Target File(s)**: `components/AdminPortalPage.tsx` (`L368–436`, `L531`, `L614`, `L637–710`, `L757`, `L833`)
- **Root Cause & Exact Code Trace**:
  1. In `AdminPortalPage.tsx:379–383, 390, 413`, `navStructure` checks only legacy v1 permissions (`MANAGE_SUBMISSIONS`/`VIEW_SUBMISSIONS`, `MANAGE_LEAVES`/`VIEW_LEAVES`, `MANAGE_ACCOUNT_UPDATES`/`VIEW_ACCOUNT_UPDATES`, `MANAGE_RESIGNATIONS`/`VIEW_RESIGNATIONS`, `MANAGE_DISCIPLINE`/`VIEW_DISCIPLINE`, `VIEW_MASTER_EMPLOYEE_LIST`, `MANAGE_SITES`/`VIEW_SITES`) and **never checks the v2 permissions saved by `AdminRoleManagementPage.tsx`** (`SUBMISSIONS_VIEW`, `LEAVES_VIEW`, `ACCOUNT_UPDATES_VIEW`, `RESIGNATIONS_VIEW`, `DISCIPLINE_VIEW`, `EMPLOYEES_VIEW`, `SITES_VIEW`)!
  2. On line `833` (`case AppView.ADMIN_PORTAL_BGV_MANAGEMENT`), the route guard checks `if (!hasPermission(Permission.BGV_VIEW) && !hasPermission(Permission.BGV_MANAGE)) return accessDenied;`—omitting `hasPermission(Permission.BGV_VENDOR)` (which is visible in the sidebar at `L391`). Every 3rd-party BGV vendor user gets `"Access Denied"` when clicking `"BGV Clearance"`.
  3. Lines `392` and `531` hardcode `AdminTimelineSearchPage` ("Employee Inquiry") to `isSuperAdmin`, blocking staff granted `Permission.EMPLOYEES_VIEW_TIMELINE` (`AdminRoleManagementPage.tsx:178`).
  4. Line `757` (`case AppView.ADMIN_PORTAL_INVITES`) omits `Permission.INVITES_CREATE` (which is allowed in the sidebar at `L402`), and lines `637–710` omit route-level permission guards on `SUBMISSION_REVIEW`, `LEAVE_MANAGEMENT`, `ACCOUNT_UPDATE_MANAGEMENT`, `RESIGNATION_MANAGEMENT`, and `DISCIPLINARY_MANAGEMENT`.
  5. Line `436` (`useMemo` dependency array `[userRole, isSuperAdmin]`) omits `authUser` (ignoring `authUser.permissionOverrides`), and line `614` renders `{section.name}` instead of `{section.title}`.
- **Real-World Impact**:
  - Any custom staff role created or edited in `AdminRoleManagementPage` has 7 core modules hidden from their left navigation sidebar, and external BGV vendors (`BGV_VENDOR`) cannot open the BGV Clearance page.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminPortalPage.tsx
+++ b/components/AdminPortalPage.tsx
@@ -379,15 +379,15 @@
-        { id: AppView.ADMIN_PORTAL_SUBMISSION_REVIEW, view: AppView.ADMIN_PORTAL_SUBMISSION_REVIEW, label: 'New Joiners', icon: <UserPlus size={18} />, visible: canSeeModule(Permission.MANAGE_SUBMISSIONS, Permission.VIEW_SUBMISSIONS) },
-        { id: AppView.ADMIN_PORTAL_LEAVE_MANAGEMENT, view: AppView.ADMIN_PORTAL_LEAVE_MANAGEMENT, label: 'Leave Requests', icon: <CalendarCheck size={18} />, visible: canSeeModule(Permission.MANAGE_LEAVES, Permission.VIEW_LEAVES) },
-        { id: AppView.ADMIN_PORTAL_ACCOUNT_UPDATE_MANAGEMENT, view: AppView.ADMIN_PORTAL_ACCOUNT_UPDATE_MANAGEMENT, label: 'Account Updates', icon: <UserCheck size={18} />, visible: canSeeModule(Permission.MANAGE_ACCOUNT_UPDATES, Permission.VIEW_ACCOUNT_UPDATES) },
-        { id: AppView.ADMIN_PORTAL_RESIGNATION_MANAGEMENT, view: AppView.ADMIN_PORTAL_RESIGNATION_MANAGEMENT, label: 'Resignations', icon: <UserMinus size={18} />, visible: canSeeModule(Permission.MANAGE_RESIGNATIONS, Permission.VIEW_RESIGNATIONS) },
-        { id: AppView.ADMIN_PORTAL_DISCIPLINARY_MANAGEMENT, view: AppView.ADMIN_PORTAL_DISCIPLINARY_MANAGEMENT, label: 'Disciplinary Actions', icon: <Gavel size={18} />, visible: canSeeModule(Permission.MANAGE_DISCIPLINE, Permission.VIEW_DISCIPLINE) },
+        { id: AppView.ADMIN_PORTAL_SUBMISSION_REVIEW, view: AppView.ADMIN_PORTAL_SUBMISSION_REVIEW, label: 'New Joiners', icon: <UserPlus size={18} />, visible: canSeeModule(Permission.SUBMISSIONS_VIEW, Permission.SUBMISSIONS_APPROVE, Permission.MANAGE_SUBMISSIONS, Permission.VIEW_SUBMISSIONS) },
+        { id: AppView.ADMIN_PORTAL_LEAVE_MANAGEMENT, view: AppView.ADMIN_PORTAL_LEAVE_MANAGEMENT, label: 'Leave Requests', icon: <CalendarCheck size={18} />, visible: canSeeModule(Permission.LEAVES_VIEW, Permission.LEAVES_APPROVE, Permission.MANAGE_LEAVES, Permission.VIEW_LEAVES) },
+        { id: AppView.ADMIN_PORTAL_ACCOUNT_UPDATE_MANAGEMENT, view: AppView.ADMIN_PORTAL_ACCOUNT_UPDATE_MANAGEMENT, label: 'Account Updates', icon: <UserCheck size={18} />, visible: canSeeModule(Permission.ACCOUNT_UPDATES_VIEW, Permission.ACCOUNT_UPDATES_APPROVE, Permission.MANAGE_ACCOUNT_UPDATES, Permission.VIEW_ACCOUNT_UPDATES) },
+        { id: AppView.ADMIN_PORTAL_RESIGNATION_MANAGEMENT, view: AppView.ADMIN_PORTAL_RESIGNATION_MANAGEMENT, label: 'Resignations', icon: <UserMinus size={18} />, visible: canSeeModule(Permission.RESIGNATIONS_VIEW, Permission.RESIGNATIONS_APPROVE, Permission.MANAGE_RESIGNATIONS, Permission.VIEW_RESIGNATIONS) },
+        { id: AppView.ADMIN_PORTAL_DISCIPLINARY_MANAGEMENT, view: AppView.ADMIN_PORTAL_DISCIPLINARY_MANAGEMENT, label: 'Disciplinary Actions', icon: <Gavel size={18} />, visible: canSeeModule(Permission.DISCIPLINE_VIEW, Permission.DISCIPLINE_MANAGE, Permission.MANAGE_DISCIPLINE, Permission.VIEW_DISCIPLINE) },
         { id: AppView.ADMIN_PORTAL_DRAFTS, view: AppView.ADMIN_PORTAL_DRAFTS, label: 'Onboarding Drafts', icon: <FileClock size={18} />, visible: hasPermission(Permission.SUBMISSIONS_VIEW_DRAFTS) },
         { id: AppView.ADMIN_PORTAL_CORRECTION_REQUESTS, view: AppView.ADMIN_PORTAL_CORRECTION_REQUESTS, label: 'Correction Links', icon: <Link2 size={18} />, visible: isSuperAdmin || hasPermission(Permission.SUBMISSIONS_VIEW_CORRECTION_LINKS) },
         { id: AppView.ADMIN_PORTAL_GRIEVANCES, view: AppView.ADMIN_PORTAL_GRIEVANCES, label: 'Grievances & Inquiries', icon: <MessageSquare size={18} />, visible: isSuperAdmin || hasPermission(Permission.GRIEVANCES_VIEW) || hasPermission(Permission.REWARDS_VIEW) || hasPermission(Permission.REWARDS_MANAGE) || hasPermission(Permission.MANAGE_SYSTEM) },
       ]
     },
-    { id: AppView.ADMIN_PORTAL_MASTER_EMPLOYEE_LIST, view: AppView.ADMIN_PORTAL_MASTER_EMPLOYEE_LIST, label: 'Master Employee List', icon: <List size={20} />, visible: hasPermission(Permission.VIEW_MASTER_EMPLOYEE_LIST) },
+    { id: AppView.ADMIN_PORTAL_MASTER_EMPLOYEE_LIST, view: AppView.ADMIN_PORTAL_MASTER_EMPLOYEE_LIST, label: 'Master Employee List', icon: <List size={20} />, visible: canSeeModule(Permission.EMPLOYEES_VIEW, Permission.VIEW_MASTER_EMPLOYEE_LIST) },
     { id: AppView.ADMIN_PORTAL_BGV_MANAGEMENT, view: AppView.ADMIN_PORTAL_BGV_MANAGEMENT, label: 'BGV Clearance', icon: <ShieldCheck size={20} />, visible: isSuperAdmin || hasPermission(Permission.BGV_VIEW) || hasPermission(Permission.BGV_MANAGE) || hasPermission(Permission.BGV_VENDOR) },
-    { id: AppView.ADMIN_PORTAL_TIMELINE_SEARCH, view: AppView.ADMIN_PORTAL_TIMELINE_SEARCH, label: 'Employee Inquiry', icon: <Search size={20} />, visible: isSuperAdmin },
+    { id: AppView.ADMIN_PORTAL_TIMELINE_SEARCH, view: AppView.ADMIN_PORTAL_TIMELINE_SEARCH, label: 'Employee Inquiry', icon: <Search size={20} />, visible: isSuperAdmin || hasPermission(Permission.EMPLOYEES_VIEW_TIMELINE) },
@@ -413,3 +413,3 @@
-        { id: AppView.ADMIN_PORTAL_SITE_MANAGEMENT, view: AppView.ADMIN_PORTAL_SITE_MANAGEMENT, label: 'Site Management', icon: <MapPin size={18} />, visible: canSeeModule(Permission.MANAGE_SITES, Permission.VIEW_SITES) },
+        { id: AppView.ADMIN_PORTAL_SITE_MANAGEMENT, view: AppView.ADMIN_PORTAL_SITE_MANAGEMENT, label: 'Site Management', icon: <MapPin size={18} />, visible: canSeeModule(Permission.SITES_VIEW, Permission.SITES_MANAGE, Permission.MANAGE_SITES, Permission.VIEW_SITES) },
@@ -832,3 +832,3 @@
       case AppView.ADMIN_PORTAL_BGV_MANAGEMENT:
-        if (!hasPermission(Permission.BGV_VIEW) && !hasPermission(Permission.BGV_MANAGE)) return accessDenied;
+        if (!hasPermission(Permission.BGV_VIEW) && !hasPermission(Permission.BGV_MANAGE) && !hasPermission(Permission.BGV_VENDOR)) return accessDenied;
```

### `UDF-AUD-131` — **HIGH**: `AdminAccountUpdateManagementPage` Renders `"[object Object]"` for File Upload Account Updates & Never Loads Historical Approved/Rejected Requests
- **Target File(s)**: `components/AdminAccountUpdateManagementPage.tsx` (`L40`, `L68–86`, `L148–161`), `src/services/requestService.ts` (`L171–187`)
- **Root Cause & Exact Code Trace**:
  1. When an employee requests an update to a `FILE_UPLOAD` field in `EmployeeAccountUpdatePage.tsx`, `EmployeeFileUploadField` stores an object `{ name, type, size, storagePath }` in `currentValue` and `requestedValue`. In `AdminAccountUpdateManagementPage.tsx:148, 156`, the preview check only tests `typeof selectedRequest.currentValue === 'string'` and `typeof selectedRequest.requestedValue === 'string'`. Object values fall through to `String(selectedRequest.currentValue)` (`L151`) and `String(selectedRequest.requestedValue)` (`L159`), rendering **`"[object Object]"`** instead of `<SecureDocumentLink>`!
  2. `subscribeToAccountUpdates` (`src/services/requestService.ts:171–187`) subscribes only to `where('status', '==', 'Pending')`. Unlike `AdminLeaveManagementPage`, `AdminAccountUpdateManagementPage.tsx:68–86` has no on-demand query for `Approved` or `Rejected` requests, so the `"Approved (0)"` and `"Rejected (0)"` tabs permanently show `0` records.
- **Real-World Impact**:
  - Admins cannot view or verify any uploaded document (Aadhaar card, PAN card, passbook, photo) in an account update request because the modal displays `"[object Object]"`, and historical approved/rejected account updates are completely inaccessible.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminAccountUpdateManagementPage.tsx
+++ b/components/AdminAccountUpdateManagementPage.tsx
@@ -146,16 +146,24 @@
               <div>
                 <p className="text-xs text-gray-400 uppercase font-bold">Current</p>
-                {typeof selectedRequest.currentValue === 'string' && (selectedRequest.currentValue.startsWith('employees/') || selectedRequest.currentValue.startsWith('onboarding/') || selectedRequest.currentValue.startsWith('http')) ? (
-                  <SecureDocumentLink path={selectedRequest.currentValue} className="text-sm text-gray-600 underline">View Current File</SecureDocumentLink>
+                {(() => {
+                  const curPath = typeof selectedRequest.currentValue === 'object' && selectedRequest.currentValue !== null
+                    ? (selectedRequest.currentValue as any).storagePath || (selectedRequest.currentValue as any).url
+                    : selectedRequest.currentValue;
+                  return typeof curPath === 'string' && (curPath.startsWith('employees/') || curPath.startsWith('onboarding/') || curPath.startsWith('http')) ? (
+                    <SecureDocumentLink path={curPath} className="text-sm text-gray-600 underline">View Current File</SecureDocumentLink>
+                  ) : (
+                    <p className="text-gray-500">{String(selectedRequest.currentValue || 'None')}</p>
+                  );
+                })()}
-                ) : (
-                  <p className="text-gray-500">{String(selectedRequest.currentValue || 'None')}</p>
-                )}
               </div>
               <div>
                 <p className="text-xs text-blue-600 uppercase font-bold">Requested</p>
-                {typeof selectedRequest.requestedValue === 'string' && (selectedRequest.requestedValue.startsWith('employees/') || selectedRequest.requestedValue.startsWith('onboarding/') || selectedRequest.requestedValue.startsWith('http')) ? (
-                  <SecureDocumentLink path={selectedRequest.requestedValue} className="text-sm font-bold text-blue-700 underline">View New Uploaded File</SecureDocumentLink>
+                {(() => {
+                  const reqPath = typeof selectedRequest.requestedValue === 'object' && selectedRequest.requestedValue !== null
+                    ? (selectedRequest.requestedValue as any).storagePath || (selectedRequest.requestedValue as any).url
+                    : selectedRequest.requestedValue;
+                  return typeof reqPath === 'string' && (reqPath.startsWith('employees/') || reqPath.startsWith('onboarding/') || reqPath.startsWith('http')) ? (
+                    <SecureDocumentLink path={reqPath} className="text-sm font-bold text-blue-700 underline">View New Uploaded File</SecureDocumentLink>
+                  ) : (
+                    <p className="font-bold text-blue-700">{String(selectedRequest.requestedValue)}</p>
+                  );
+                })()}
-                ) : (
-                  <p className="font-bold text-blue-700">{String(selectedRequest.requestedValue)}</p>
-                )}
               </div>
```

### `UDF-AUD-132` — **HIGH**: `AdminResignationManagementPage` Permanently Shows `0` Approved/Rejected Resignations & Passes `undefined` Path to `<SecureDocumentLink>` for Resignation Letters
- **Target File(s)**: `components/AdminResignationManagementPage.tsx` (`L44`, `L74–94`, `L207–222`), `src/services/requestService.ts` (`L244–260`)
- **Root Cause & Exact Code Trace**:
  1. `subscribeToResignationRequests` (`src/services/requestService.ts:244–260`) queries only `where('status', '==', 'Pending')`, and `AdminResignationManagementPage.tsx:74–94` has no on-demand query to load `Approved` or `Rejected` resignations when the admin switches filter tabs—causing `"Approved (0)"` and `"Rejected (0)"` to permanently display `0`.
  2. When a resignation letter is uploaded as `{ name, storagePath }`, line `216` passes `path={typeof selectedRequest.document === 'string' ? selectedRequest.document : (selectedRequest.document as any).url}`—ignoring `.storagePath` and passing `undefined` to `<SecureDocumentLink>`.
- **Real-World Impact**:
  - Admins cannot view any historical approved or rejected resignation records in the Resignations module, and attached resignation letter objects with `storagePath` fail to open.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminResignationManagementPage.tsx
+++ b/components/AdminResignationManagementPage.tsx
@@ -215,3 +215,3 @@
                 <SecureDocumentLink
-                  path={typeof selectedRequest.document === 'string' ? selectedRequest.document : (selectedRequest.document as any).url}
+                  path={typeof selectedRequest.document === 'string' ? selectedRequest.document : ((selectedRequest.document as any).storagePath || (selectedRequest.document as any).url)}
                   className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline"
```

### `UDF-AUD-133` — **HIGH**: `DataContext.leaveBalances` Is Permanently Empty (`employees = []`) & `AdminLeaveManagementPage` Wipes Historical Leave Counts When Switching to `"Total"` or `"Pending"`
- **Target File(s)**: `src/contexts/DataContext.tsx` (`L139`, `L221–283`), `components/AdminLeaveManagementPage.tsx` (`L100–139`, `L154–169`, `L220–228`)
- **Root Cause & Exact Code Trace**:
  1. In `src/contexts/DataContext.tsx:139`, `const [employees, setEmployees] = useState<FirestoreEmployee[]>([]);` is declared, and `setEmployees` is **never called anywhere in the application**. Because `employees` is permanently `[]` (and `leaveRequests` in `DataContext` only contains `'Pending'` requests), `DataContext.leaveBalances` (`L221–283`) is **permanently `[]`**!
  2. In `components/AdminLeaveManagementPage.tsx:100–111`:
     ```ts
     if (filterStatus === RequestStatus.APPROVED || filterStatus === RequestStatus.REJECTED) {
       fetchLeaveRequestsByStatus(filterStatus, allowedSiteIds, 200)...
     } else {
       setHistoricalRequests([]);
     }
     ```
     On initial mount (`filterStatus === 'ALL'`) and whenever the admin clicks `"Total"` or `"Pending"`, `setHistoricalRequests([])` wipes out all loaded historical requests! Consequently, on the `"Total"` tab, only Pending requests are shown, and the `"Approved (0)"` and `"Rejected (0)"` tab badges always display `0`!
- **Real-World Impact**:
  - The `"Total"` filter tab in Leave Management never displays approved or rejected leaves, and the Approved/Rejected counters reset to `0` whenever viewing `"Total"` or `"Pending"`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminLeaveManagementPage.tsx
+++ b/components/AdminLeaveManagementPage.tsx
@@ -100,11 +100,16 @@
     // Fetch historical data on-demand when filter changes to Approved/Rejected
     useEffect(() => {
-        if (filterStatus === RequestStatus.APPROVED || filterStatus === RequestStatus.REJECTED) {
+        if (filterStatus === 'ALL' || filterStatus === RequestStatus.APPROVED || filterStatus === RequestStatus.REJECTED) {
             setIsLoadingHistorical(true);
-            fetchLeaveRequestsByStatus(filterStatus, allowedSiteIds, 200)
-                .then(data => setHistoricalRequests(data))
+            Promise.all([
+                fetchLeaveRequestsByStatus(RequestStatus.APPROVED, allowedSiteIds, 200),
+                fetchLeaveRequestsByStatus(RequestStatus.REJECTED, allowedSiteIds, 200)
+            ])
+                .then(([approved, rejected]) => setHistoricalRequests([...approved, ...rejected]))
                 .catch(err => console.error('Failed to fetch historical leave data:', err))
                 .finally(() => setIsLoadingHistorical(false));
         }
     }, [filterStatus, allowedSiteIds]);
```

### `UDF-AUD-134` — **HIGH**: `AdminLegacySystemsPage` Stale `imports = []` Closure Defeats Smart Merge, Silently Drops Invalid CSV Rows, Rejects `.xlsx` Files & Fails Firestore Rules for `EMPLOYEES_IMPORT`
- **Target File(s)**: `components/AdminLegacySystemsPage.tsx` (`L126–134`, `L164–255`, `L465`, `L475`), `components/AdminPortalPage.tsx` (`L849`), `firestore.rules` (`L473`, `L558`)
- **Root Cause & Exact Code Trace**:
  1. In `components/AdminLegacySystemsPage.tsx:164–255`, `handleFileUpload` is wrapped in `useCallback(..., [logAction])` (`L255`), **omitting `imports` from its dependency array**. Because `imports` is `[]` on initial mount before `subscribeToLegacyImports` resolves, `handleFileUpload` closes over a stale `imports = []` array! At line `218`, `const existing = imports.find(imp => imp.employeeId.toUpperCase() === row.employeeId.toUpperCase());` **always evaluates to `undefined`**, completely defeating Smart Merge!
  2. At lines `182–207`, `parsed.map(...).filter(Boolean)` returns `null` and strips out any row where `!employeeId || !fullName` (`L186`) **before** lines `210–214` check `if (!r.employeeId)` / `if (!r.fullName)` to populate `errors`. Thus, malformed rows are silently dropped and `errors` is always `[]`.
  3. Line `465` instructs admins to `"Upload a CSV or Excel file"`, but line `475` (`accept=".csv,.txt"`) and line `172` (`await file.text()`) have no Excel (`.xlsx`) parser support.
  4. `AdminPortalPage.tsx:849` grants access to `AdminLegacySystemsPage` for staff with `Permission.EMPLOYEES_IMPORT`, whereas `firestore.rules:473, 558` restricts `settings/legacy_claim_config` and `legacy_employees` writes to `isSuperAdmin() || hasPermission('MANAGE_SYSTEM')`.
- **Real-World Impact**:
  - Re-uploading a partial CSV in `AdminLegacySystemsPage` to merge additional columns into existing legacy employee records fails to merge with in-memory records and silently drops rows with missing names or IDs without reporting errors.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminLegacySystemsPage.tsx
+++ b/components/AdminLegacySystemsPage.tsx
@@ -252,4 +252,4 @@
         setIsUploading(false);
         // Reset file input
         e.target.value = '';
-    }, [logAction]);
+    }, [logAction, imports]);
```

### `UDF-AUD-135` — **CRITICAL**: `AdminBgvManagementPage` Fails Open When `allowedSiteIds` Is Empty (`[]`) and Leaks All Undispatched `PENDING` Candidates & Aadhaar Dossiers to External BGV Vendors
- **Target File(s)**: `components/AdminBgvManagementPage.tsx` (`L242–253`, `L722`, `L798–805`, `L1033`)
- **Root Cause & Exact Code Trace**:
  1. In `components/AdminBgvManagementPage.tsx:243–245`:
     ```ts
     // Scope to allowed sites if supervisor and doesn't have BGV_VIEW_SCOPE_ALL
     if (!hasScopeAll && allowedSiteIds && allowedSiteIds.length > 0 && !allowedSiteIds.includes(record.siteId)) {
       return false;
     }
     ```
     When a non-SuperAdmin staff member without `BGV_VIEW_SCOPE_ALL` has **no assigned sites** (`allowedSiteIds = []`), `allowedSiteIds.length > 0` evaluates to **`false`**, so the filter **fails open** and displays **100% of BGV records across every site in the company**!
  2. In `components/AdminBgvManagementPage.tsx:249–253`:
     ```ts
     // If user is a vendor, restrict to cases dispatched to their vendor name (if set)
     if (isVendor && authUser?.name) {
       if (record.vendorName && !record.vendorName.toLowerCase().includes(authUser.name.toLowerCase())) {
         return false;
       }
     }
     ```
     For every `BgvStatus.PENDING` record that has not yet been dispatched to a vendor, `record.vendorName` is `undefined`/`""`. Because `if (record.vendorName && ...)` only filters when `record.vendorName` is truthy, **every external 3rd-party BGV vendor (`Permission.BGV_VENDOR`) is shown 100% of undispatched `PENDING` candidates across the entire company** (including their full Aadhaar numbers, phone numbers, and uploaded private Aadhaar documents)!
  3. Lines `798–805` render candidate photos in the main table without checking `!isFieldHiddenForRole('photo')` and without resolving `photoBlobUrls[item.id]` (which is only fetched when opening the modal at `L152–162`), causing raw Storage paths (`employees/...`) to fail with 404s.
  4. Line `1033` renders `{sec.name}` instead of `{sec.title || (sec as any).name}` in the Configure BGV Dossier Extraction Fields modal.
- **Real-World Impact**:
  - Unassigned staff and external 3rd-party BGV vendors gain unauthorized read access to sensitive Aadhaar/PII dossiers of employees at sites or cases never assigned to them.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminBgvManagementPage.tsx
+++ b/components/AdminBgvManagementPage.tsx
@@ -242,12 +242,12 @@
   const filteredRecords = useMemo(() => {
     return records.filter(record => {
       // Scope to allowed sites if supervisor and doesn't have BGV_VIEW_SCOPE_ALL
-      if (!hasScopeAll && allowedSiteIds && allowedSiteIds.length > 0 && !allowedSiteIds.includes(record.siteId)) {
+      if (!hasScopeAll && !isVendor && (!allowedSiteIds || !allowedSiteIds.includes(record.siteId))) {
         return false;
       }
 
       // If user is a vendor, restrict to cases dispatched to their vendor name (if set)
-      if (isVendor && authUser?.name) {
-        if (record.vendorName && !record.vendorName.toLowerCase().includes(authUser.name.toLowerCase())) {
+      if (isVendor) {
+        if (!authUser?.name || !record.vendorName || !record.vendorName.toLowerCase().includes(authUser.name.toLowerCase())) {
           return false;
         }
       }
```

### `UDF-AUD-136` — **CRITICAL**: `AdminWebsiteManager` "Emergency LOCK Database", "Read-Only Mode", and Circuit Breaker Caps Are 100% Unenforced Placebos Across Firestore, Storage & Cloud Functions
- **Target File(s)**: `components/AdminWebsiteManager.tsx` (`L1184–1201`, `L1332–1442`), `firestore.rules`, `storage.rules`, `functions/src/cron.ts`
- **Root Cause & Exact Code Trace**:
  - In `components/AdminWebsiteManager.tsx:1332–1442`, the **Usage & Billing Control Center** provides SuperAdmin controls that write to `settings/portal_config`:
    - `manualEmergencyLock` (`L1418`: `"Emergency LOCK Database"` — displays a flashing red alert at `L1184–1191`: `"Active Status: Locked — The database is manually LOCKED. All guest and employee requests are blocked."`)
    - `manualReadOnly` (`L1430`: `"Enable Read-Only Mode"` — displays an amber alert at `L1193–1200`: `"Active Status: Read-Only — The database is in READ-ONLY mode. Modifications are blocked."`)
    - `blockReadsOnLimit` (`L1379`), `blockWritesOnLimit` (`L1388`), `blockUploadsOnLimit` (`L1397`), `dbReadCap` (`L1345`), `dbWriteCap` (`L1356`), `storageCap` (`L1367`)
    - `autoDeleteAbandonedSubmissions` (`L1406`: `"Nightly Cleanup: Automatically purge abandoned submissions older than 30 days"`)
  - Exhaustive codebase-wide search confirms that **`manualEmergencyLock`, `manualReadOnly`, `blockReadsOnLimit`, `blockWritesOnLimit`, `blockUploadsOnLimit`, `dbReadCap`, `dbWriteCap`, and `storageCap` are not referenced or enforced anywhere in `firestore.rules`, `storage.rules`, `functions/src/`, or the frontend services**! Furthermore, `autoDeleteAbandonedSubmissions` exists only in the legacy uncompiled `functions/index.js:2756` and is completely omitted from the active `functions/src/cron.ts` (`dailyCleanupCron`)!
- **Real-World Impact**:
  - If a SuperAdmin activates **"Emergency LOCK Database"** or **"Enable Read-Only Mode"** during an active security incident, DoS attack, or billing runaway, the UI falsely reports that all guest and employee requests/modifications are blocked while **100% of Firestore reads/writes, Cloud Function calls, and Cloud Storage uploads continue completely unrestricted**!
- **Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -8,6 +8,14 @@
     function isAuthenticated() {
       return request.auth != null;
     }
+    function getPortalConfig() {
+      return get(/databases/$(database)/documents/settings/portal_config).data;
+    }
+    function isNotEmergencyLocked() {
+      return isSuperAdmin() || !(exists(/databases/$(database)/documents/settings/portal_config) && getPortalConfig().get('manualEmergencyLock', false) == true);
+    }
+    function isNotReadOnlyMode() {
+      return isSuperAdmin() || !(exists(/databases/$(database)/documents/settings/portal_config) && (getPortalConfig().get('manualReadOnly', false) == true || getPortalConfig().get('manualEmergencyLock', false) == true));
+    }
```

### `UDF-AUD-137` — **HIGH**: `AdminAuditLogPage` Destructures Non-Existent `useAuth().authUser` (Bypassing Non-Admin `actorId` Filter), Implements a Hidden Audit Log Tamper/Delete Backdoor & Omits `filterAction` UI
- **Target File(s)**: `components/AdminAuditLogPage.tsx` (`L14`, `L17`, `L21–105`, `L113`, `L150–183`), `firestore.rules` (`L504–510`)
- **Root Cause & Exact Code Trace**:
  1. On line `14`, `AdminAuditLogPage.tsx` executes `const { authUser } = useAuth();`. However, `useAuth()` (`src/context/AuthContext.tsx:311–321`) returns `{ user, loading, ... }` and has **no `authUser` property**! Because `authUser` is always `undefined`, line `94` (`if (!hasFullAccess && authUser?.uid)`) never executes, leaving `filter` as `undefined` and subscribing to all audit logs without an `actorId` filter.
  2. Lines `21–83` implement a hidden backdoor (`Ctrl + Shift + Alt + Delete` at `L34–39`, contradicting the comment at `L22` stating `Ctrl + Shift + Alt + L`) that allows modifying (`_updateAuditLogDetails`) and deleting (`_deleteAuditLog`) security audit log entries, backed by `firestore.rules:509` (`allow update, delete: if isSuperAdmin();`).
  3. Line `17` declares `const [filterAction, setFilterAction] = useState<string>('ALL')` and filters by `entry.actionType === filterAction` at line `113`, but no Action Type dropdown is rendered in the filter bar (`L150–183`).
- **Real-World Impact**:
  - Security audit logs can be silently altered or deleted in production, compromising forensic integrity, and admins cannot filter audit logs by action type (`CREATE`, `DELETE`, `APPROVAL`, `EXPORT`, etc.) in the UI.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminAuditLogPage.tsx
+++ b/components/AdminAuditLogPage.tsx
@@ -14,7 +14,7 @@
 const AdminAuditLogPage: React.FC<AdminAuditLogPageProps> = ({ userRole, isSuperAdmin }) => {
-    const { authUser } = useAuth();
+    const { user: authUser } = useAuth();
     const [searchTerm, setSearchTerm] = useState('');
@@ -94,3 +94,3 @@
-        if (!hasFullAccess && authUser?.uid) {
-            filter = { actorId: authUser.uid };
+        if (!hasFullAccess && (authUser?.uid || authUser?.id)) {
+            filter = { actorId: authUser.uid || authUser.id };
         }
```

### `UDF-AUD-138` — **HIGH**: `AdminInvitesPage` Allows Site-Restricted Staff to Generate Referral Links for Any Company Site, Truncates Global Referred Candidates to an Arbitrary `limit(50)` & Uses Legacy `s.name` / `f.type` Strings
- **Target File(s)**: `components/AdminInvitesPage.tsx` (`L167`, `L174`, `L181`, `L214`, `L240`, `L258–262`, `L326–330`, `L834`, `L1005`, `L1164`)
- **Root Cause & Exact Code Trace**:
  1. Line `174` computes `const activeSites = useMemo(() => sites.filter(s => s.status === 'Active'), [sites]);` without filtering by the logged-in staff member's assigned sites (`allowedSiteIds` / `sitesManaged`). As a result, a site-restricted Field Officer with `INVITES_CREATE` can generate and edit referral onboarding links for **any site across the company** (`L834, 1164`).
  2. Lines `326–330`: When a user has ` isSuperAdmin || hasPermission(Permission.INVITES_VIEW_ALL) || hasPermission(Permission.INVITES_MANAGE)`, `AdminInvitesPage` queries `query(collection(db, 'employees'), limit(50))` and `query(collection(db, 'onboarding_submissions'), limit(50))` **without any `where('recruitedBy', '!=', null)` or `orderBy` clause**, downloading an arbitrary 50 employees/submissions by document ID and filtering in memory (`L384, 412: if (hasInvite || data.recruitedBy)`). In any database with more than 50 total employees, the `"Referred Candidates"` tab misses almost all referred candidates!
  3. Line `167` (`hasPermission`) ignores `userRole?.isDisabled === true` and `authUser?.permissionOverrides`.
  4. Lines `181, 214, 240` look up `formSections?.find(s => s.name === "Job Details")` instead of `s.title === "Job Details"`, and lines `261, 1005` compare `f.type` against legacy display strings (`'Section Header'`, `'Information Text'`, `'File Upload'`, `'Date Picker'`) instead of `FieldType.HEADER`, `FieldType.INFO_TEXT`, `FieldType.FILE_UPLOAD`, and `FieldType.DATE`.
- **Real-World Impact**:
  - Site-restricted recruiters can generate invite links for unauthorized sites, and the `"Referred Candidates"` tab for SuperAdmins/HR Managers silently drops referred candidates once the company exceeds 50 total employees.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminInvitesPage.tsx
+++ b/components/AdminInvitesPage.tsx
@@ -180,3 +180,3 @@
-    const jobSection = formSections?.find(s => s.name === "Job Details");
+    const jobSection = formSections?.find(s => (s.title || s.name) === "Job Details");
@@ -258,4 +258,4 @@
   const allFormFields = useMemo(() => {
     return formSections
       .flatMap(s => s.fields || [])
-      .filter(f => f.type !== 'Section Header' && f.type !== 'Information Text' && f.type !== 'File Upload' && f.id !== 'siteName');
+      .filter(f => ![FieldType.HEADER, FieldType.INFO_TEXT, FieldType.FILE_UPLOAD, 'Section Header', 'Information Text', 'File Upload'].includes(f.type as any) && f.id !== 'siteName');
   }, [formSections]);
```

### `UDF-AUD-139` — **MEDIUM**: `AdminDashboardPage` "Leave Insights" Chart Reads Non-Existent `stats.leavesByType` (Permanently Empty) & Leaks Global `pendingResignations` / `pendingProfiles` Counts to Unassigned Staff
- **Target File(s)**: `components/AdminDashboardPage.tsx` (`L37–54`, `L137–160`, `L233–261`)
- **Root Cause & Exact Code Trace**:
  1. In `components/AdminDashboardPage.tsx:233–261`, the **"Leave Insights"** card checks `Object.entries(stats.leavesByType || {}).length === 0`. However, `stats` in `src/contexts/DataContext.tsx:158–165` only has `{ pendingSubmissions, activeEmployees, pendingLeaves, pendingUpdates, pendingProfiles, pendingResignations }` and **never has a `leavesByType` property** (`leavesByType` is a property of `dashboardAnalytics`, not `stats`!)! Therefore, `stats.leavesByType` is always `undefined`, and the "Leave Insights" chart permanently displays `"No leave data available."`!
  2. Lines `50–53` guard `pendingSubmissionsCount`, `pendingLeavesCount`, `pendingUpdatesCount`, and `activeEmployeesCount` with `isUnassignedStaff ? 0 : ...`, **but lines `137–143` (`stats.pendingResignations`) and lines `153–159` (`stats.pendingProfiles`) read `stats.pendingResignations` and `stats.pendingProfiles` directly without checking `isUnassignedStaff`**.
  3. Lines `37–42` (`hasPermission`) ignore `userRole?.isDisabled === true`, and lines `44–46` (`hasViewScopeAll`) omit `LEAVES_VIEW_SCOPE_ALL`, `ACCOUNT_UPDATES_VIEW_SCOPE_ALL`, and `RESIGNATIONS_VIEW_SCOPE_ALL`.
- **Real-World Impact**:
  - The "Leave Insights" chart on the Admin Dashboard never renders data for any user, and unassigned staff see global company resignation and incomplete profile counts.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminDashboardPage.tsx
+++ b/components/AdminDashboardPage.tsx
@@ -38,6 +38,7 @@
     const hasPermission = (permission: Permission) => {
         if (isSuperAdmin) return true;
+        if (userRole?.isDisabled === true) return false;
         if (authUser?.permissionOverrides?.[permission] === true) return true;
@@ -53,3 +54,5 @@
     const activeEmployeesCount = isUnassignedStaff ? 0 : stats.activeEmployees;
+    const pendingResignationsCount = isUnassignedStaff ? 0 : stats.pendingResignations;
+    const pendingProfilesCount = isUnassignedStaff ? 0 : stats.pendingProfiles;
@@ -233,5 +236,5 @@
                                 <div className="space-y-3">
-                                    {Object.entries(stats.leavesByType || {}).length === 0 ? (
+                                    {Object.entries(dashboardAnalytics?.leavesByType || {}).length === 0 ? (
                                         <p className="text-gray-400 text-sm text-center py-4">No leave data available.</p>
                                     ) : (
-                                        Object.entries(stats.leavesByType || {}).map(([type, counts]: [string, any]) => (
+                                        Object.entries(dashboardAnalytics?.leavesByType || {}).map(([type, counts]: [string, any]) => (
```

### `UDF-AUD-140` — **MEDIUM**: `BulkImportModal` Unscoped `sites` Prop Allows Cross-Site Bulk Imports, Corrupts Multi-Line Excel Cells via `sheet_to_csv` + `parseCSV`, and Silently Bypasses Failed Duplicate Checks
- **Target File(s)**: `components/BulkImportModal.tsx` (`L58–62`, `L113–129`, `L166–173`), `components/AdminMasterEmployeeListPage.tsx` (`L2464`)
- **Root Cause & Exact Code Trace**:
  1. In `components/AdminMasterEmployeeListPage.tsx:2464`, `<BulkImportModal sites={sites} ... />` passes the unfiltered global `sites` list instead of scoping to `effectiveAllowedSiteIds` when `!hasViewScopeAll`, allowing a site-restricted staff member with `EMPLOYEES_IMPORT` to bulk-import employees into any company site.
  2. In `components/BulkImportModal.tsx:58–62`, when uploading an Excel (`.xlsx`/`.xls`) workbook, `handleFileUpload` converts the sheet to CSV text via `const csvContent = XLSX.utils.sheet_to_csv(worksheet);` and passes it to `parseCSV(csvContent)` (`src/utils/bulkImportUtils.ts:132`). Because `parseCSV` splits raw text by `text.split(/
?
/)` **before** parsing quotes, any Excel cell containing a multi-line address (`Present Address` / `Permanent Address` with `Alt+Enter` line breaks) is split across multiple lines, corrupting the row and creating phantom employee rows!
  3. In `components/BulkImportModal.tsx:123–126`, if `checkForDatabaseDuplicates(parsedData, formSections)` throws an error, the `catch` block logs the error and immediately calls `handleStartImport()` (`L125`), silently bypassing duplicate detection and importing duplicate records.
  4. In `components/BulkImportModal.tsx:166–173`, `handleClose` does not reset `setDuplicateConflicts([])` or `setShowSettings(false)`.
- **Real-World Impact**:
  - Uploading a real-world Excel roster containing multi-line address cells corrupts rows and fails validation or creates malformed employee records, and site-restricted staff can bulk-import personnel into unauthorized sites.
- **Remediation (`diff`)**:
```diff
--- a/components/BulkImportModal.tsx
+++ b/components/BulkImportModal.tsx
@@ -61,7 +61,7 @@
                     const firstSheetName = workbook.SheetNames[0];
                     const worksheet = workbook.Sheets[firstSheetName];
-                    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
+                    const csvContent = XLSX.utils.sheet_to_csv(worksheet, { RS: '\n', strip: false });
                     const rows = parseCSV(csvContent.replace(/"([^"]*)"/g, (m) => m.replace(/\r?\n/g, ', ')));
                     setParsedData(rows);
@@ -166,8 +166,10 @@
     const handleClose = () => {
         setStep('upload');
         setParsedData([]);
         setValidationErrors([]);
         setValidationWarnings([]);
+        setDuplicateConflicts([]);
+        setShowSettings(false);
         setImportResult(null);
         onClose();
     };
```

---

### `UDF-AUD-141` — `[HIGH]` `ProfileClaimPage.tsx` Invokes Non-Existent Cloud Function `claimEmployeeProfile` & Is Orphaned From `AppRoutes.tsx`
- **Target File(s):** `components/employee/ProfileClaimPage.tsx` (`L73`), `firebase.json` (`L267–269, L599–601`), `src/routes/AppRoutes.tsx`
- **Root Cause & Exact Code Trace:**
  1. In `components/employee/ProfileClaimPage.tsx:73`, submitting the legacy employee profile claim form executes:
     ```ts
     const claimFn = httpsCallable<any, any>(firebaseFunctions, 'claimEmployeeProfile');
     const res = await claimFn({ employeeId: employeeId.trim().toUpperCase(), answers });
     ```
     And `firebase.json` (`L267–269, L599–601`) defines a hosting rewrite mapping `/api/claimEmployeeProfile` to `"function": "claimEmployeeProfile"`.
  2. However, no Cloud Function named `claimEmployeeProfile` exists anywhere in `functions/src/` or `functions/index.js`—the actual deployed Cloud Function in `functions/src/auth.ts` is `verifyLegacyClaim`.
  3. Furthermore, `ProfileClaimPage.tsx` is never imported or mounted on any `<Route>` in `src/routes/AppRoutes.tsx`.
- **Real-World Impact:**
  - Any attempt to invoke `/api/claimEmployeeProfile` or use `ProfileClaimPage` fails immediately with a Firebase Functions `not-found` error, and direct links to `/claim-profile` hit the wildcard redirect instead of rendering the claim page.
- **Remediation (`diff`):**
```diff
--- a/components/employee/ProfileClaimPage.tsx
+++ b/components/employee/ProfileClaimPage.tsx
@@ -70,7 +70,7 @@
         setError('');
         setIsSubmitting(true);
         try {
-            const claimFn = httpsCallable<any, any>(firebaseFunctions, 'claimEmployeeProfile');
+            const claimFn = httpsCallable<any, any>(firebaseFunctions, 'verifyLegacyClaim');
             const res = await claimFn({
                 employeeId: employeeId.trim().toUpperCase(),
                 answers,
```

---

### `UDF-AUD-142` — `[MEDIUM]` `DocumentCaptureModal.tsx` Unenforced `maxSizeMB`, Blank `"data:,"` Hang When Video Is Not Ready, Aspect Ratio Lock Desync & Pre-Permission `enumerateDevices()` Failure
- **Target File(s):** `components/common/DocumentCaptureModal.tsx` (`L13, L69, L145–158, L216–247, L250–305, L617`)
- **Root Cause & Exact Code Trace:**
  1. **Unenforced `maxSizeMB`**: `DocumentCaptureModalProps` (`L13, L69`) accepts `maxSizeMB = 5`, but `maxSizeMB` is only rendered as display text (`L542`) and is never checked in `handleFileChange` (`L236–247`) or `handleSaveCrop` (`L250–305`), allowing 50 MB+ images to be loaded into memory and uploaded.
  2. **`0x0` Canvas `"data:,"` Hang**: In `capturePhoto` (`L216–233`), if the user clicks Capture before the camera stream has decoded its first frame (`video.videoWidth === 0` or `video.videoHeight === 0`), `captureCanvas.width` and `height` are set to `0`, `captureCanvas.toDataURL('image/jpeg', 0.92)` returns `"data:,"`, and `onSelectFile("data:,", ...)` sets `isNormalizingExif = true` while `new Image()` fires `onerror` (which has no handler in `normalizeImageOrientation`), permanently freezing the modal on `"Processing image orientation..."`.
  3. **Pre-Permission `enumerateDevices()`**: Lines `145–158` call `navigator.mediaDevices.enumerateDevices()` *before* `getUserMedia()` grants camera permission. Per the W3C Media Capture spec, browsers return empty `device.label === ""` before permission is granted, so `d.label.toLowerCase().includes('back')` (`L151`) always fails on first use.
  4. **Aspect Ratio Lock Desync**: Toggling the `"Lock Aspect Ratio"` button (`L617`: `onClick={() => setLockAspect(!lockAspect)}`) sets `lockAspect = true` without recalculating `crop` or `completedCrop` to match `targetAspectRatio`.
- **Real-World Impact:**
  - Candidates on mobile devices can freeze the document capture modal by tapping Capture too early, fail to auto-select the rear camera on first permission grant, save un-cropped aspect ratios after locking aspect ratio, or upload oversized files that exceed backend limits.
- **Remediation (`diff`):**
```diff
--- a/components/common/DocumentCaptureModal.tsx
+++ b/components/common/DocumentCaptureModal.tsx
@@ -215,6 +215,10 @@
     const capturePhoto = () => {
         if (videoRef.current && canvasRef.current) {
             const video = videoRef.current;
+            if (!video.videoWidth || !video.videoHeight) {
+                setCameraError('Camera stream is still initializing. Please wait a moment and try again.');
+                return;
+            }
             const captureCanvas = document.createElement('canvas');
             captureCanvas.width = video.videoWidth;
             captureCanvas.height = video.videoHeight;
@@ -236,6 +240,10 @@
     const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
         if (e.target.files && e.target.files.length > 0) {
             const file = e.target.files[0];
+            if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
+                alert(`File size exceeds maximum limit of ${maxSizeMB} MB.`);
+                return;
+            }
             const reader = new FileReader();
             reader.addEventListener('load', () =>
                 onSelectFile(reader.result?.toString() || '', file.name)
```

---

### `UDF-AUD-143` — `[MEDIUM]` `EmployeeTimelinePage.tsx` Omits Form Builder UUID Lookups for Name/Designation/Site and Omits `case 'RESIGNATION'` in `getBgColor`
- **Target File(s):** `components/events/EmployeeTimelinePage.tsx` (`L55–65, L70–81`)
- **Root Cause & Exact Code Trace:**
  1. In `components/events/EmployeeTimelinePage.tsx:70–81`, the employee profile header resolves `empName`, `designation`, and `currentSite` via:
     ```ts
     const empName = employeeRecord?.data?.['Applicant Name'] || employeeRecord?.data?.['Full Name'] || employeeRecord?.applicantName || 'Employee Record';
     const designation = employeeRecord?.data?.['Post Applied For'] || employeeRecord?.data?.['designation'] || employeeRecord?.designation || 'Staff';
     const currentSite = employeeRecord?.data?.['Unit'] || employeeRecord?.data?.['currentSite'] || employeeRecord?.siteName || 'Unassigned';
     ```
     It never checks the Form Builder field UUIDs (`'7debf274-baee-4bac-a137-4b4b46719874'` for Name, `'db307195-cf54-4a6e-9056-f3974b050c4d'` for Post of Apply, `'52ae217b-2602-4337-a1cd-a1f9bd36a4b0'` for Unit or Facility) or `employeeRecord?.name` / `employeeRecord?.currentSiteId`.
  2. In `getBgColor` (`L55–65`), `case 'RESIGNATION':` is omitted (even though `getIcon` at `L49` handles `case 'RESIGNATION':`), causing resignation events to render with a plain default border instead of an orange warning border.
- **Real-World Impact:**
  - Viewing the timeline of an employee whose profile fields are stored under Form Builder UUIDs displays `'Employee Record'`, `'Staff'`, and `'Unassigned'` instead of their actual name, designation, and site.
- **Remediation (`diff`):**
```diff
--- a/components/events/EmployeeTimelinePage.tsx
+++ b/components/events/EmployeeTimelinePage.tsx
@@ -60,6 +60,7 @@
             case 'PROMOTION': return 'bg-purple-50 border-purple-200';
             case 'TRANSFER': return 'bg-blue-50 border-blue-200';
             case 'RELIEVED': return 'bg-amber-50 border-amber-200';
+            case 'RESIGNATION': return 'bg-orange-50 border-orange-200';
             case 'REJOINED': return 'bg-teal-50 border-teal-200';
             case 'TERMINATED': return 'bg-red-50 border-red-200';
             case 'DISCIPLINARY': return 'bg-rose-50 border-rose-200';
@@ -68,15 +69,18 @@
     };
 
     const empName =
+        employeeRecord?.data?.['7debf274-baee-4bac-a137-4b4b46719874'] ||
         employeeRecord?.data?.['Applicant Name'] ||
         employeeRecord?.data?.['Full Name'] ||
         employeeRecord?.applicantName ||
+        employeeRecord?.name ||
         'Employee Record';
     const designation =
+        employeeRecord?.data?.['db307195-cf54-4a6e-9056-f3974b050c4d'] ||
         employeeRecord?.data?.['Post Applied For'] ||
         employeeRecord?.data?.['designation'] ||
         employeeRecord?.designation ||
         'Staff';
     const currentSite =
+        employeeRecord?.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0'] ||
         employeeRecord?.data?.['Unit'] ||
         employeeRecord?.data?.['currentSite'] ||
         employeeRecord?.siteName ||
```

---

### `UDF-AUD-144` — `[HIGH]` `EmployeeLoginPage.tsx` Cross-Subdomain `?sso=google` Popup Blocked by Browsers, Fake Step 2 `"Verify"` Button in Password Reset & Untrimmed `employeeId`
- **Target File(s):** `components/EmployeeLoginPage.tsx` (`L44–50, L67, L152, L363–365`)
- **Root Cause & Exact Code Trace:**
  1. **Cross-Subdomain Popup Blocked**: When an employee clicks `"Sign in with Google"` on `udfonline.in/login`, line `152` redirects the browser to `https://employee.udfonline.in/login?sso=google`. On load, `useEffect` (`L44–50`) automatically calls `handleGoogleLogin()` (`signInWithPopup`). Because `useEffect` runs on page load without a transient user activation gesture, modern browsers (Chrome, Safari, Firefox, Edge) block the popup with `auth/popup-blocked`.
  2. **Fake Step 2 Verification in Forgot Password**: In Step 2 of Strict Password Reset (`L363–365`), clicking `"Verify"` executes:
     ```ts
     setResetError(null);
     setResetStep(3);
     ```
     It makes **zero backend verification call** and displays `"Verification complete. Enter your new password."` (`L381`) even if the user entered completely wrong DOB/Aadhaar/Phone/Bank digits! When the user subsequently submits Step 3 (`handleStrictResetSubmit`, `L192–228`), `verifyAndResetEmployeePassword` rejects the identity answers, leaving the user stuck on Step 3 with an identity mismatch error and no `"Back to Step 2"` button to fix their answers!
  3. **Untrimmed `employeeId` Login**: Line `67` calls `await employeeLogin(employeeId, password)` without `.trim().toUpperCase()`, causing login failures when mobile keyboards append a trailing space or lowercase prefix.
- **Real-World Impact:**
  - Employees initiating Google Sign-In from `udfonline.in/login` hit popup-blocked failures on arrival at `employee.udfonline.in`, employees resetting their password cannot correct typos in Step 2 after advancing to Step 3, and mobile whitespace in Employee IDs causes false login rejections.
- **Remediation (`diff`):**
```diff
--- a/components/EmployeeLoginPage.tsx
+++ b/components/EmployeeLoginPage.tsx
@@ -64,7 +64,7 @@
         setLoading(true);
         try {
             lockSession();
-            const res = await employeeLogin(employeeId, password);
+            const res = await employeeLogin(employeeId.trim().toUpperCase(), password);
             if (res.success && res.token) {
                 await signInWithCustomToken(auth, res.token);
                 localStorage.setItem('portalType', 'employee');
@@ -220,6 +220,9 @@
             }
         } catch (err: any) {
             setResetError(err.message || 'Verification failed. Details do not match our records.');
+            if (err.message?.toLowerCase().includes('verification') || err.message?.toLowerCase().includes('match')) {
+                setResetStep(2);
+            }
         } finally {
             setResetLoading(false);
         }
```

---

### `UDF-AUD-145` — `[HIGH]` `workflowHelper.ts` Halts Auto-Escalation on Empty Global Roles, Cross-Module `*_VIEW_SCOPE_ALL` Permissions & Suspended (`isDisabled`) Roles
- **Target File(s):** `src/utils/workflowHelper.ts` (`L15–43`)
- **Root Cause & Exact Code Trace:**
  1. In `src/utils/workflowHelper.ts:15–27`, `isRoleAssignedToSite` checks:
     ```ts
     const roleObj = roles.find(r => r.id === roleId);
     if (roleObj && !roleObj.isDisabled) {
         const hasGlobalScope = roleObj.permissions?.some(p =>
             p === Permission.EMPLOYEES_VIEW_SCOPE_ALL ||
             p === Permission.SUBMISSIONS_VIEW_SCOPE_ALL ||
             p === Permission.LEAVES_VIEW_SCOPE_ALL ||
             p === Permission.REQUESTS_VIEW_SCOPE_ALL ||
             p === Permission.SITES_VIEW_SCOPE_ALL
         );
         if (hasGlobalScope) return true;
     }
     ```
     - It returns `true` **without checking whether any active staff member in `staffUsers` actually holds `roleId`**! If a global role has 0 active staff members assigned to it, `isRoleAssignedToSite` still returns `true`, halting auto-escalation at a dead level with no approvers!
     - It checks *any* of the 5 `*_VIEW_SCOPE_ALL` permissions regardless of which module workflow is running (e.g., a role with `SITES_VIEW_SCOPE_ALL` is treated as globally assigned to every site for `LEAVES` approvals even if no staff member with that role manages the employee's site).
  2. Even worse, look at lines `17` and `30–43`: when `roleObj.isDisabled === true`, the `if (roleObj && !roleObj.isDisabled)` block is skipped, **and execution falls through to step 2 (`L30–43`)**, which returns `true` if any active staff member with that `roleId` has `siteId` in `sitesManaged`—never returning `false` when `roleObj.isDisabled === true`!
- **Real-World Impact:**
  - Leave, resignation, account update, and onboarding requests get stuck permanently at approval levels assigned to suspended (`isDisabled: true`) roles or global roles that currently have zero active staff users.
- **Remediation (`diff`):**
```diff
--- a/src/utils/workflowHelper.ts
+++ b/src/utils/workflowHelper.ts
@@ -13,8 +13,10 @@
     if (!roleId) return false;
 
     // 1. Check if the Role itself has Global Scope permissions
     const roleObj = roles.find(r => r.id === roleId);
-    if (roleObj && !roleObj.isDisabled) {
+    if (!roleObj || roleObj.isDisabled) return false;
+    const activeRoleHolders = staffUsers.filter(u => u.roleId === roleId && !u.isDisabled);
+    if (activeRoleHolders.length === 0) return false;
+    if (roleObj) {
         const hasGlobalScope = roleObj.permissions?.some(p =>
             p === Permission.EMPLOYEES_VIEW_SCOPE_ALL ||
             p === Permission.SUBMISSIONS_VIEW_SCOPE_ALL ||
```

---

### `UDF-AUD-146` — `[HIGH]` `useFormBuilder.ts` & `SectionItem.tsx` Splice Unsorted Arrays Using Sorted UI Indices (Corrupting Form Order) & Cache Stale `section.name`
- **Target File(s):** `hooks/useFormBuilder.ts` (`L40–49, L111–128`), `components/SectionItem.tsx` (`L49, L84–92`), `components/AdminPortalPage.tsx` (`L575–583`)
- **Root Cause & Exact Code Trace:**
  1. In `components/AdminPortalPage.tsx:575–583`, sections are sorted by `.order` before rendering (`[...formSections].sort((a, b) => a.order - b.order)`), and the **sorted index** is passed to `onMoveUp={() => reorderSections(index, index - 1)}`. Similarly, `components/SectionItem.tsx:84–92` sorts fields by `.order` (`[...section.fields].sort((a, b) => a.order - b.order)`) and passes the sorted index to `reorderFields(section.id, currentIndex, newIndex)`.
  2. However, in `hooks/useFormBuilder.ts:40–49` (`reorderSections`) and `L111–128` (`reorderFields`), `.splice(sourceIndex, 1)` is executed directly on the **unsorted** `prev` and `section.fields` arrays without sorting them by `.order` first! Whenever the array storage order in Firestore differs from `.order` (for example, after `adminService.ts:45–55` mutates `.order` on `'Job Details'` fields), clicking Move Up/Down splices and reorders the wrong section or field!
  3. Additionally, `components/SectionItem.tsx:49` initializes `const [newName, setNewName] = useState(section.name);` (ignoring `section.title` and lacking a `useEffect` to sync when props change).
- **Real-World Impact:**
  - Reordering form sections or fields in the Admin Form Builder scrambles unrelated fields/sections whenever array position and `.order` diverge, and editing a section whose title is stored in `section.title` opens an empty input box.
- **Remediation (`diff`):**
```diff
--- a/hooks/useFormBuilder.ts
+++ b/hooks/useFormBuilder.ts
@@ -39,7 +39,7 @@
 
     const reorderSections = useCallback((sourceIndex: number, destIndex: number) => {
         setFormSections(prev => {
-            const result = Array.from(prev);
+            const result = Array.from(prev).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
             const [removed] = result.splice(sourceIndex, 1);
             result.splice(destIndex, 0, removed);
             return result.map((section, index) => ({ ...section, order: index + 1 }));
@@ -112,7 +112,7 @@
         setFormSections(prev =>
             prev.map(section => {
                 if (section.id === sectionId) {
-                    const fields = Array.from(section.fields);
+                    const fields = Array.from(section.fields).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                     const [removed] = fields.splice(sourceIndex, 1);
                     fields.splice(destIndex, 0, removed);
                     const updatedFields = fields.map((field, index) => ({ ...field, order: index + 1 }));
```

---

### `UDF-AUD-147` — `[MEDIUM]` `subUnitUtils.ts` Matches Inactive Sites/Sub-Units & Silently Overwrites Common Sub-Unit Names Across Sites
- **Target File(s):** `src/utils/subUnitUtils.ts` (`L10–59, L92–104`)
- **Root Cause & Exact Code Trace:**
  1. `buildSiteLookupMap` (`L10–25`), `buildUnitCodeLookupMap` (`L30–41`), `buildSubUnitLookupMap` (`L46–59`), and `getAllValidLocationNames` (`L92–104`) iterate over all `sites` and `site.subUnits` without filtering out `site.status === 'Inactive'` or `subUnit.status === 'Inactive'`.
  2. `buildSubUnitLookupMap` (`L46–59`) keys a flat global `Map<string, { site: Site; subUnitName: string }>` by `subUnit.name.toLowerCase().trim()`. If two different sites both have a sub-unit named `"Main Gate"`, `"Block A"`, or `"Tower 1"`, the later site in the array silently overwrites the earlier site in the lookup map!
- **Real-World Impact:**
  - Bulk imports and location lookups silently route employees to deactivated sites or to the wrong parent site whenever two sites share a generic sub-unit name.
- **Remediation (`diff`):**
```diff
--- a/src/utils/subUnitUtils.ts
+++ b/src/utils/subUnitUtils.ts
@@ -11,6 +11,7 @@
     const map = new Map<string, Site>();
 
     sites.forEach(site => {
+        if (site.status === 'Inactive') return;
         // Map by exact name (case-insensitive)
         map.set(site.name.toLowerCase().trim(), site);
 
@@ -47,8 +48,10 @@
     const map = new Map<string, { site: Site; subUnitName: string }>();
 
     sites.forEach(site => {
+        if (site.status === 'Inactive') return;
         if (site.subUnits && site.subUnits.length > 0) {
             site.subUnits.forEach(subUnit => {
+                if (subUnit.status === 'Inactive') return;
                 map.set(subUnit.name.toLowerCase().trim(), {
                     site,
                     subUnitName: subUnit.name
```

---

### `UDF-AUD-148` — `[HIGH]` `googleAuthHelper.ts` Native Capacitor `googleLinkForOnboarding` Destroys Anonymous UID & Web `setPersistence` Downgrades Global Auth to Session-Only
- **Target File(s):** `src/utils/googleAuthHelper.ts` (`L178, L194–200`)
- **Root Cause & Exact Code Trace:**
  1. In `src/utils/googleAuthHelper.ts:194–197`, `googleLinkForOnboarding` handles native Capacitor platforms by calling:
     ```ts
     if (Capacitor.isNativePlatform()) {
         return googleSignInForOnboarding();
     }
     ```
     Whereas the web branch (`L202–207`) calls `linkWithPopup(auth.currentUser, provider)` to **preserve** the anonymous candidate's `uid` (or falls back on credential conflict), `googleSignInForOnboarding()` calls `signInWithCredential(auth, credential)` directly—**destroying the anonymous session UID** and orphaning any draft or uploaded files already keyed under the anonymous UID!
  2. At lines `178` and `200`, both functions execute `await setPersistence(auth, browserSessionPersistence);` on the global `auth` singleton, permanently downgrading Firebase Auth persistence for the entire browser context so subsequent employee or admin logins are lost on tab close.
- **Real-World Impact:**
  - Mobile app candidates who link their Google account mid-onboarding lose their anonymous UID and in-progress draft association, and web users have their global Firebase Auth persistence downgraded to session-only.
- **Remediation (`diff`):**
```diff
--- a/src/utils/googleAuthHelper.ts
+++ b/src/utils/googleAuthHelper.ts
@@ -1,6 +1,6 @@
 import { Capacitor } from '@capacitor/core';
 import {
-    GoogleAuthProvider, signInWithPopup, signInWithCredential, linkWithPopup, User as FirebaseUser,
+    GoogleAuthProvider, signInWithPopup, signInWithCredential, linkWithPopup, linkWithCredential, User as FirebaseUser,
     setPersistence, browserSessionPersistence
 } from 'firebase/auth';
 import { auth } from '../firebase/config';
@@ -192,7 +192,18 @@
 export async function googleLinkForOnboarding(): Promise<{ user: FirebaseUser; email: string; displayName: string | null }> {
     if (Capacitor.isNativePlatform()) {
-        return googleSignInForOnboarding();
+        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
+        await GoogleAuth.initialize({ clientId: WEB_CLIENT_ID, scopes: ['profile', 'email'], grantOfflineAccess: false });
+        try { await GoogleAuth.signOut(); } catch (_) {}
+        const googleUser = await GoogleAuth.signIn();
+        const idToken = googleUser?.authentication?.idToken;
+        if (!idToken) throw new Error('Google Sign-In did not return an ID token.');
+        const credential = GoogleAuthProvider.credential(idToken);
+        if (auth.currentUser && auth.currentUser.isAnonymous) {
+            const res = await linkWithCredential(auth.currentUser, credential);
+            return { user: res.user, email: res.user.email || googleUser.email, displayName: res.user.displayName || googleUser.name || null };
+        }
+        const res = await signInWithCredential(auth, credential);
+        return { user: res.user, email: res.user.email || googleUser.email, displayName: res.user.displayName || googleUser.name || null };
     }
```

---

### `UDF-AUD-149` — `[HIGH]` `utils/formDataHelper.ts` Substring Collisions: `getApplicantPAN` Extracts `"Previous Company & Experience"` (`com-pan-y`) as PAN Card Number & `getApplicantName` Matches `"Father's Name"`/`"Bank Name"`
- **Target File(s):** `utils/formDataHelper.ts` (`L15, L26, L110, L126–131`)
- **Root Cause & Exact Code Trace:**
  1. Look at `utils/formDataHelper.ts:121–137` (`getApplicantPAN`):
     ```ts
     for (const section of formSections) {
         for (const field of section.fields) {
             const labelLower = field.label.toLowerCase();
             if (labelLower.includes('pan') && !labelLower.includes('upload') && !labelLower.includes('card (') && !labelLower.includes('copy')) {
                 const val = data[field.id] || data[field.label];
                 if (val && typeof val === 'string') {
                     const clean = val.trim().toUpperCase();
                     if (clean.length > 0) return clean;
                 }
             }
         }
     }
     ```
     In `defaultFormSections` (`src/constants/defaults.ts`), **Section 2 (`Job Details`)** appears *before* **Section 4 (`Government Identifications`)**, and Section 2 contains the field `"Previous Company & Experience"` (`id: 'd16a6da1-fc29-405e-bbb6-cb186b8f8666'`). Because `"previous company & experience".includes("pan")` is **`true`** (`com-pan-y`!), `getApplicantPAN` matches `"Previous Company & Experience"` in Section 2 and returns the applicant's previous employer/experience text (e.g., `"G4S SECURITY 3 YEARS"`) as their **PAN Card Number** before ever reaching Section 4's `"PAN Card No"` (`da8edb18-4bed-41ca-8233-2280b97dac8d`)!
  2. In `getApplicantName` (`L15, L26`), `nameFieldLabels.full` includes bare `'name'`, and line `26` checks `nameFieldLabels.full.some(l => labelLower.includes(l))`, which matches `"Spouse Name"`, `"Reference Name"`, `"Father Name"`, `"Mother Name"`, `"Bank Name"`, and `"Branch Name"` whenever the primary Name field is empty or reordered.
  3. Neither `getApplicantAadhaar` (`L110`: `if (digits.length > 0) return digits;`) nor `getApplicantPAN` (`L131`: `if (clean.length > 0) return clean;`) checks the direct Form Builder UUIDs first or validates format (`12` digits for Aadhaar; `/^[A-Z]{5}[0-9]{4}[A-Z]$/` for PAN).
- **Real-World Impact:**
  - Every candidate who fills in `"Previous Company & Experience"` has their previous employer string extracted as their PAN number across duplicate checks, submission summaries, and employee records!
- **Remediation (`diff`):**
```diff
--- a/utils/formDataHelper.ts
+++ b/utils/formDataHelper.ts
@@ -12,7 +12,7 @@
  */
 
 const nameFieldLabels = {
-    full: ['full name', 'applicant name', 'employee name', 'candidate name', 'name'],
+    full: ['full name', 'applicant name', 'employee name', 'candidate name'],
     first: ['first name', 'firstname', 'given name'],
     last: ['last name', 'lastname', 'surname', 'family name']
 };
@@ -101,6 +101,8 @@
 export const getApplicantAadhaar = (data: SubmittedFormData, formSections: FormSection[]): string => {
     if (!data) return '';
+    const directUuid = data['18855ee9-0d66-41d6-988b-128b776a8c5b'];
+    if (typeof directUuid === 'string' && directUuid.replace(/\D/g, '').length === 12) return directUuid.replace(/\D/g, '');
 
     if (formSections && formSections.length > 0) {
         for (const section of formSections) {
@@ -120,11 +122,13 @@
 export const getApplicantPAN = (data: SubmittedFormData, formSections: FormSection[]): string => {
     if (!data) return '';
+    const directUuid = data['da8edb18-4bed-41ca-8233-2280b97dac8d'];
+    if (typeof directUuid === 'string' && directUuid.trim()) return directUuid.trim().toUpperCase();
 
     if (formSections && formSections.length > 0) {
         for (const section of formSections) {
             for (const field of section.fields) {
                 const labelLower = field.label.toLowerCase();
-                if (labelLower.includes('pan') && !labelLower.includes('upload') && !labelLower.includes('card (') && !labelLower.includes('copy')) {
+                if (/\bpan\b/.test(labelLower) && !labelLower.includes('upload') && !labelLower.includes('card (') && !labelLower.includes('copy')) {
                     const val = data[field.id] || data[field.label];
                     if (val && typeof val === 'string') {
```

---

### `UDF-AUD-150` — `[HIGH]` `utils/exportUtils.ts` Exports Unmasked Aadhaar (`"Aadhar Card No"`), UAN & ESIC Numbers When `canViewSensitive === false`, Ignores `profileData`/`formData` & Outputs `[object Object]` for Files
- **Target File(s):** `utils/exportUtils.ts` (`L23, L50–52, L76`)
- **Root Cause & Exact Code Trace:**
  1. Look at `utils/exportUtils.ts:21–26` (`isSensitiveField`):
     ```ts
     const isSensitiveField = (label: string): boolean => {
         const l = label.toLowerCase();
         const sensitiveKeywords = ['aadhaar', 'pan', 'bank', 'account', 'ifsc', 'salary', 'basic', 'hra', 'allowance', 'deduction', 'pf', 'esi'];
         return sensitiveKeywords.some(kw => l.includes(kw));
     };
     ```
     And look at `maskValue` (`L10–19`):
     - In `defaultFormSections` (`src/constants/defaults.ts` and `src/constants/googleFormMapping.ts:41`), the Aadhaar field label is spelled **`"Aadhar Card No"`** (with **one `'a'`**, not `'aadhaar'`). Because `sensitiveKeywords` only contains `'aadhaar'` (two `'a'`s) and omits `'aadhar'` and `'uan'`, `isSensitiveField("Aadhar Card No")` and `isSensitiveField("UAN No or EPFO")`(unless `'pf'` matches `'epfo'`) return **`false`**!
     - Even when `isSensitiveField` returns `true` (e.g., for `"ESI No"` or `"Bank Name"`), `maskValue(val, label)` (`L10–19`) only masks values if `l.includes('aadhaar') || l.includes('account')` or `l.includes('pan')` or `l.includes('ifsc')`—it has **no branch for `'aadhar'`, `'uan'`, `'epfo'`, or `'esi'`**, returning the **unmasked value `val` verbatim** at line `18` (`return val;`)!
  2. Line `50` reads `const empData = isFullObject ? (emp.data || {}) : emp;`, ignoring `emp.profileData` and `emp.formData` on legacy/bulk-imported employees.
  3. Line `76` executes `let displayVal = val !== undefined && val !== null ? String(val) : '';`, converting `FILE_UPLOAD` objects (`{ name, storagePath }`) into literal `"[object Object]"` in CSV exports.
- **Real-World Impact:**
  - Staff users who are explicitly denied `VIEW_SENSITIVE_INFO` (`canViewSensitive === false`) can click Export CSV and download 100% of employees' full unmasked 12-digit Aadhaar numbers (`"Aadhar Card No"`), UAN numbers, and ESIC numbers!
- **Remediation (`diff`):**
```diff
--- a/utils/exportUtils.ts
+++ b/utils/exportUtils.ts
@@ -9,17 +9,18 @@
 const maskValue = (val: string, label: string): string => {
     if (!val) return '';
     const l = label.toLowerCase();
-    if (l.includes('aadhaar') || l.includes('account')) {
+    if (l.includes('aadhaar') || l.includes('aadhar') || l.includes('account') || l.includes('uan') || l.includes('esi')) {
         return val.length > 4 ? `XXXX-XXXX-${val.slice(-4)}` : 'XXXX';
     }
     if (l.includes('pan')) {
         return val.length > 4 ? `XXXXXX${val.slice(-4)}` : 'XXXX';
     }
     if (l.includes('ifsc')) {
         return 'XXXX0XXXXXX';
     }
-    return val;
+    return 'REDACTED';
 };
 
 const isSensitiveField = (label: string): boolean => {
     const l = label.toLowerCase();
-    const sensitiveKeywords = ['aadhaar', 'pan', 'bank', 'account', 'ifsc', 'salary', 'basic', 'hra', 'allowance', 'deduction', 'pf', 'esi'];
+    const sensitiveKeywords = ['aadhaar', 'aadhar', 'pan', 'bank', 'account', 'ifsc', 'salary', 'basic', 'hra', 'allowance', 'deduction', 'pf', 'epfo', 'uan', 'esi'];
     return sensitiveKeywords.some(kw => l.includes(kw));
 };
```

---

### `UDF-AUD-151` — `[MEDIUM]` Duplicate `src/components/employeeFormFields/EmployeeFileUploadField.tsx` Bypasses Validation/Compression/Encryption & `migrationHelper.ts` Writes to Non-Existent `'staff'` Collection
- **Target File(s):** `src/components/employeeFormFields/EmployeeFileUploadField.tsx` (`L33–55`), `src/utils/migrationHelper.ts` (`L12`)
- **Root Cause & Exact Code Trace:**
  1. The repository contains two divergent copies of `EmployeeFileUploadField.tsx`: `components/employeeFormFields/EmployeeFileUploadField.tsx` and `src/components/employeeFormFields/EmployeeFileUploadField.tsx`. In `src/components/employeeFormFields/EmployeeFileUploadField.tsx:33–55`, `handleFileChange` uploads raw files directly via `uploadSubmissionDocument(field.id, file, ...)` without checking `field.maxFileSizeMB` or `field.allowedFileTypes`, without opening `DocumentCaptureModal` for cropping/orientation normalization, and without caching in `fileSessionStore`.
  2. In `src/utils/migrationHelper.ts:12`, `promoteToSuperAdmin(userId)` executes `await setDoc(doc(db, 'staff', userId), ...)`—writing to a non-existent `'staff'` collection instead of `'staff_accounts'` (which is rejected by `firestore.rules` default deny and never read by `authService.ts`).
- **Real-World Impact:**
  - Any module importing `@/src/components/employeeFormFields/EmployeeFileUploadField` bypasses all file size/type constraints and document cropping, and `promoteToSuperAdmin` fails with `PERMISSION_DENIED`.
- **Remediation (`diff`):**
```diff
--- a/src/utils/migrationHelper.ts
+++ b/src/utils/migrationHelper.ts
@@ -9,7 +9,7 @@
 export const promoteToSuperAdmin = async (userId: string, email: string) => {
     if (!userId) return;
     try {
-        const staffRef = doc(db, 'staff', userId);
+        const staffRef = doc(db, 'staff_accounts', userId);
         await setDoc(staffRef, {
             id: userId,
             email: email,
```

---

### `UDF-AUD-152` — `[MEDIUM]` `src/utils/sanitizeHtml.ts` Protocol-Relative `//attacker.com` URL Bypass & Incomplete Non-DOM Regex Fallback
- **Target File(s):** `src/utils/sanitizeHtml.ts` (`L19, L26–31`)
- **Root Cause & Exact Code Trace:**
  1. In `src/utils/sanitizeHtml.ts:19`:
     ```ts
     const SAFE_URL_PATTERN = /^(https?:\/\/|\/|#|mailto:|tel:)/i;
     ```
     Because `SAFE_URL_PATTERN` allows any URL starting with a single `/`, it also matches **protocol-relative external URLs starting with `//`** (e.g., `href="//evil.com/phish"` or `src="//evil.com/steal"`).
  2. In the non-DOM fallback (`L26–31`), the regex only strips `<script>` tags, `on\w+="..."`, and literal `javascript:`—failing to strip `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<meta http-equiv="refresh">`, or HTML-entity-encoded `&#106;avascript:` URIs.
- **Real-World Impact:**
  - Protocol-relative external links or tracking pixels (`//attacker.com/...`) pass through `SAFE_URL_PATTERN` even if `https://` is restricted, and SSR/static generation contexts lacking `DOMParser` are exposed to `<iframe>`/`<svg>`/entity-encoded XSS payloads.
- **Remediation (`diff`):**
```diff
--- a/src/utils/sanitizeHtml.ts
+++ b/src/utils/sanitizeHtml.ts
@@ -16,7 +16,7 @@
     'colspan', 'rowspan'
 ]);
 
-const SAFE_URL_PATTERN = /^(https?:\/\/|\/|#|mailto:|tel:)/i;
+const SAFE_URL_PATTERN = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;
 
 export function sanitizeHtml(dirty: string): string {
     if (!dirty || typeof dirty !== 'string') return '';
```

---

### `UDF-AUD-153` — `[MEDIUM]` `PrivacyPolicyPage.tsx` & `TermsOfServicePage.tsx` Broken `"Careers"` Navigation Link (`navigate('/')` Instead of `'/careers'`) & `AboutPage.tsx` Inflated `'15,000+'` Fallback
- **Target File(s):** `components/PrivacyPolicyPage.tsx` (`L33`), `components/TermsOfServicePage.tsx` (`L33`), `components/AboutPage.tsx` (`L130, L136`)
- **Root Cause & Exact Code Trace:**
  1. In both `components/PrivacyPolicyPage.tsx:33` and `components/TermsOfServicePage.tsx:33`, the top navigation bar renders:
     ```tsx
     <span onClick={() => navigate('/')} className="hover:text-blue-600 cursor-pointer transition-colors">Careers</span>
     ```
     Clicking `"Careers"` sends the visitor to `'/'` instead of `'/careers'`, and both pages hardcode a stripped-down custom navbar/footer instead of using `<PublicHeader />` and `<PublicFooter />`.
  2. In `components/AboutPage.tsx:130, 136`, the stat cards render `config?.aboutActiveOfficersCount ? `${config.aboutActiveOfficersCount.toLocaleString()}+` : '15,000+'` and `config?.aboutSecuredSitesCount ? `${config.aboutSecuredSitesCount}+` : '800+'` (matching `DEFAULT_CONFIG` in `websiteService.ts:32–33`), displaying inflated hardcoded numbers (`15,000+` guards and `800+` sites) instead of reading live headcounts from `getPublicStats()` when CMS stats are unset or `0`.
- **Real-World Impact:**
  - Visitors clicking `"Careers"` from the Privacy Policy or Terms of Service pages are sent to the homepage instead of the Careers portal.
- **Remediation (`diff`):**
```diff
--- a/components/PrivacyPolicyPage.tsx
+++ b/components/PrivacyPolicyPage.tsx
@@ -30,7 +30,7 @@
                     <div className="hidden md:flex space-x-8 text-sm font-medium text-gray-600">
                         <span onClick={() => navigate('/')} className="hover:text-blue-600 cursor-pointer transition-colors">Home</span>
                         <span onClick={() => navigate('/about')} className="hover:text-blue-600 cursor-pointer transition-colors">About Us</span>
-                        <span onClick={() => navigate('/')} className="hover:text-blue-600 cursor-pointer transition-colors">Careers</span>
+                        <span onClick={() => navigate('/careers')} className="hover:text-blue-600 cursor-pointer transition-colors">Careers</span>
                         <span onClick={() => navigate('/contact')} className="hover:text-blue-600 cursor-pointer transition-colors">Contact</span>
                     </div>
```

---

### `UDF-AUD-154` — `[MEDIUM]` `CookieConsent.tsx` Is a Cosmetic Placebo That Never Suppresses Tracking Cookies, `ProgressBar.tsx` Uses Duplicate React Keys & `TagInput.tsx` Drops Typed Text on Blur
- **Target File(s):** `components/common/CookieConsent.tsx` (`L21–29`), `components/common/ProgressBar.tsx` (`L31`), `components/common/TagInput.tsx` (`L16–27`), `components/common/AdSenseUnit.tsx`
- **Root Cause & Exact Code Trace:**
  1. **Placebo Cookie Consent**: `PrivacyPolicyPage.tsx` (`L97`) and `scripts/generateStaticPages.js:364` explicitly state: *"Choosing 'Decline Optional' prevents the deployment of optional tracking cookies from advertising partners."* However, `components/common/CookieConsent.tsx:21–29` merely writes `localStorage.setItem('cookieConsent', 'declined')`, and **no file in the entire repository ever reads `localStorage.getItem('cookieConsent')`** (`AdSenseUnit.tsx` loads and pushes ads unconditionally without checking `cookieConsent`).
  2. **Duplicate Keys in `ProgressBar.tsx`**: Line `31` maps `sections.map((sectionName, index) => (<div key={sectionName} ...>))`, causing duplicate React key warnings and state collisions if two sections have the same title or blank `section.name` (`undefined`).
  3. **Dropped Input in `TagInput.tsx`**: `components/common/TagInput.tsx:16–27` only commits a tag on `onKeyDown` (`Enter` or `,`). When a user types a site designation or tag into `TagInput` and clicks `"Save"` (triggering `onBlur` without pressing `Enter`), the typed tag is silently discarded!
- **Real-World Impact:**
  - Declining optional cookies in the banner does not suppress AdSense or notify any component (creating DPDP Act / GDPR / AdSense policy compliance exposure), and admins typing a single designation into `TagInput` and clicking Save lose their input.
- **Remediation (`diff`):**
```diff
--- a/components/common/TagInput.tsx
+++ b/components/common/TagInput.tsx
@@ -13,12 +13,18 @@
 }) => {
     const [inputValue, setInputValue] = useState('');
 
+    const commitTag = () => {
+        const newTag = inputValue.trim();
+        if (newTag && !tags.includes(newTag)) {
+            onChange([...tags, newTag]);
+        }
+        setInputValue('');
+    };
+
     const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
         if (e.key === 'Enter' || e.key === ',') {
             e.preventDefault();
-            const newTag = inputValue.trim();
-            if (newTag && !tags.includes(newTag)) {
-                onChange([...tags, newTag]);
-            }
-            setInputValue('');
+            commitTag();
         } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
             onChange(tags.slice(0, -1));
         }
@@ -47,6 +53,7 @@
                 type="text"
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 onKeyDown={handleKeyDown}
+                onBlur={commitTag}
                 placeholder={tags.length === 0 ? placeholder : ''}
```

---

### `UDF-AUD-155` — `[MEDIUM]` `EmployeeEngagementHub.tsx` Payday Countdown Shows `0`/`-0` on the 7th, Omits Form Builder Site UUID on Grievances & Overwrites Server Quiz State With Client `setDoc`
- **Target File(s):** `components/employee/EmployeeEngagementHub.tsx` (`L89–118, L125–137, L147`)
- **Root Cause & Exact Code Trace:**
  1. **Payday Countdown Off-By-One on the 7th**: Look at `components/employee/EmployeeEngagementHub.tsx:125–137`:
     ```ts
     const today = new Date();
     let payday = new Date(today.getFullYear(), today.getMonth(), 7);
     if (today.getDate() > 7) {
         payday = new Date(today.getFullYear(), today.getMonth() + 1, 7);
     }
     const diffTime = payday.getTime() - today.getTime();
     const daysToPayday = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
     ```
     On the 7th of the month (`today.getDate() === 7`), `payday` is midnight `00:00:00.000` of the 7th while `today` is later that day (e.g., `14:30:00`). Thus `diffTime` is negative (between `-1` and `-86,399,999` ms), and `Math.ceil(diffTime / 86400000)` evaluates to **`-0`**, rendering `"-0 Days Remaining"` instead of `"Payday Today!"` (and on non-7th days, failing to zero out `today.setHours(0,0,0,0)` adds an extra day after midnight).
  2. **Missing Form Builder Site Fallback on Grievances**: Line `147` checks `const empSiteId = employeeData?.currentSiteId || (employeeData as any)?.siteId || '';` without checking `employeeData?.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0']` or `employeeData?.unit`, submitting grievances with `siteId: ''` that site-scoped managers cannot see.
  3. **Client `setDoc` Overwriting Server Quiz State**: In `handleQuizAnswer` (`L89–118`), after calling `completeTrainingQuizServer` (`L97–102`), the client unconditionally executes `await setDoc(docRef, updated, { merge: true });` (`L115`) using client-computed `isCorrect` (`L90`) and increments local UI points (`setEngagementData(prev => ({ ...prev, points: (prev?.points || 0) + awarded }))`, `L116`) even if `completeTrainingQuizServer` returned `alreadyCompleted: true` or threw an error (`catch (err)` at `L103–105` falls straight through to `L108–118`!).
- **Real-World Impact:**
  - Employees taking the Daily Safety Quiz when offline or after already completing it on another device still see their points locally increment and overwrite `user_engagement/{userId}` in Firestore, and grievances from onboarding-approved employees lack `siteId`.
- **Remediation (`diff`):**
```diff
--- a/components/employee/EmployeeEngagementHub.tsx
+++ b/components/employee/EmployeeEngagementHub.tsx
@@ -101,10 +101,11 @@
             if (typeof res.data?.pointsAwarded === 'number') {
                 awarded = res.data.pointsAwarded;
             }
+            setEngagementData(prev => ({ ...(prev || {}), ...updated, points: (prev?.points || 0) + awarded }));
         } catch (err) {
             console.warn('Server quiz callable fallback:', err);
+            return;
         }
-        setEngagementData(prev => ({ ...(prev || {}), ...updated, points: (prev?.points || 0) + awarded }));
     };
 
     // Payday countdown (7th of every month)
-    const today = new Date();
+    const today = new Date();
+    today.setHours(0, 0, 0, 0);
     let payday = new Date(today.getFullYear(), today.getMonth(), 7);
```

---

### `UDF-AUD-156` — `[MEDIUM]` `EmployeeDisciplinaryPage.tsx` Crashes on Object `document` Attachment & `LegacyClaimModal.tsx` Leaks Form State Across Reopens
- **Target File(s):** `components/employee/EmployeeDisciplinaryPage.tsx` (`L76–83`), `components/LegacyClaimModal.tsx` (`L44–55, L78`)
- **Root Cause & Exact Code Trace:**
  1. In `components/employee/EmployeeDisciplinaryPage.tsx:76–83`:
     ```tsx
     {(action.documentUrl || (action as any).document) && (
         <SecureDocumentLink
             path={action.documentUrl || (action as any).document}
             label="View Official Notice Document"
     ```
     If `(action as any).document` is stored as a file metadata object `{ name, storagePath, url }` rather than a string, `<SecureDocumentLink>` (`components/common/SecureDocumentLink.tsx:27`) executes `path.startsWith('data:')`, throwing an unhandled TypeError (`path.startsWith is not a function`) that crashes the entire Disciplinary Actions page!
  2. In `components/LegacyClaimModal.tsx:44–55`, `employeeId`, `verificationData`, `error`, and `attemptInfo` are never reset when `isOpen` toggles, and line `78` (`await signInWithCustomToken(auth, result.token)`) omits `lockSession()`/`unlockSession()` around custom token sign-in.
- **Real-World Impact:**
  - Employees viewing a disciplinary notice with an object-formatted attachment hit a white-screen crash, and closing/reopening `LegacyClaimModal` retains previous PII inputs and error banners.
- **Remediation (`diff`):**
```diff
--- a/components/employee/EmployeeDisciplinaryPage.tsx
+++ b/components/employee/EmployeeDisciplinaryPage.tsx
@@ -75,7 +75,7 @@
                                 {(action.documentUrl || (action as any).document) && (
                                     <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                                         <SecureDocumentLink
-                                            path={action.documentUrl || (action as any).document}
+                                            path={action.documentUrl || (action as any).document?.storagePath || (action as any).document?.url || (typeof (action as any).document === 'string' ? (action as any).document : '')}
                                             label="View Official Notice Document"
                                             className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg"
                                         />
```

---

### `UDF-AUD-157` — `[HIGH]` `scripts/generateStaticPages.js` Unauthenticated `blog_posts?pageSize=100` REST Call Is Rejected by `firestore.rules` (`403 PERMISSION_DENIED`), Pre-Rendering 0 Blog Posts & Wiping Blog URLs From `sitemap.xml`
- **Target File(s):** `scripts/generateStaticPages.js` (`L64–76, L102–125, L514–536`), `firestore.rules` (`L277`)
- **Root Cause & Exact Code Trace:**
  1. Look at `scripts/generateStaticPages.js:102–120`:
     ```js
     async function fetchBlogPosts() {
       try {
         console.log('  Fetching blog posts from Firestore...');
         const data = await fetchFirestore('blog_posts?pageSize=100');
         if (!data.documents) return [];
     ```
     `fetchFirestore` makes an **unauthenticated HTTP GET request** to `https://firestore.googleapis.com/v1/projects/hr-portal-unique-delta/databases/(default)/documents/blog_posts?pageSize=100` without a `where('isPrivate', '==', false)` query filter, intending to filter `.filter(p => !p.isPrivate ...)` in Node.js (`L120`).
  2. Now look at `firestore.rules:276–279`:
     ```
     match /blog_posts/{postId} {
       allow read: if resource.data.isPrivate != true || request.auth != null;
     ```
     In Cloud Firestore, **security rules are not filters**! An unauthenticated `list` query (`GET /documents/blog_posts?pageSize=100`) that does not include a query constraint proving `isPrivate == false` (or when any single document in `blog_posts` has `isPrivate: true`) is **rejected by Firestore with HTTP `403 PERMISSION_DENIED` (`"Missing or insufficient permissions"`)**!
  3. Because `fetchFirestore` (`L64–76`) never checks `res.statusCode`, it parses the `403` JSON error body `{"error": {"code": 403, "message": "Missing or insufficient permissions.", "status": "PERMISSION_DENIED"}}`, sees `!data.documents` (`L106`), and **silently returns `[]`**!
  4. Even worse, `updateSitemap` (`L514–536`) then overwrites `public/sitemap.xml` and `dist-public/sitemap.xml` with **0 blog post URLs** (`blogEntries` is empty because local fallback slugs at `L589–590` explicitly comment `// These won't be added to sitemap - only Firestore posts go in sitemap`)!
- **Real-World Impact:**
  - Every production build (`npm run build:web:public`) silently fails to fetch Firestore blog posts (`Found 0 blog posts in Firestore`), fails to pre-render any dynamic blog post published via the CMS, and strips all blog post URLs from `sitemap.xml`!
- **Remediation (`diff`):**
```diff
--- a/scripts/generateStaticPages.js
+++ b/scripts/generateStaticPages.js
@@ -102,12 +102,34 @@
 async function fetchBlogPosts() {
   try {
     console.log('  Fetching blog posts from Firestore...');
-    const data = await fetchFirestore('blog_posts?pageSize=100');
-    if (!data.documents) return [];
-    return data.documents.map(doc => {
+    const runQueryUrl = `${FIRESTORE_BASE}:runQuery`;
+    const queryPayload = JSON.stringify({
+      structuredQuery: {
+        from: [{ collectionId: 'blog_posts' }],
+        where: {
+          fieldFilter: {
+            field: { fieldPath: 'isPrivate' },
+            op: 'EQUAL',
+            value: { booleanValue: false }
+          }
+        },
+        limit: 100
+      }
+    });
+    const rows = await new Promise((resolve, reject) => {
+      const req = https.request(runQueryUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
+        let body = '';
+        res.on('data', c => body += c);
+        res.on('end', () => {
+          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
+        });
+      });
+      req.on('error', reject);
+      req.write(queryPayload);
+      req.end();
+    });
+    const docs = Array.isArray(rows) ? rows.filter(r => r.document).map(r => r.document) : [];
+    return docs.map(doc => {
       const f = doc.fields || {};
```

---

### `UDF-AUD-158` — `[HIGH]` `firebase.json` Content-Security-Policy Blocks Google AdSense (`<AdSenseUnit>`) in Production & `vercel.json`/`netlify.toml` Point to Non-Existent `dist` Without `/api/*` Rewrites or Security Headers
- **Target File(s):** `firebase.json` (`L43, L439, L771`), `vercel.json` (`L1–13`), `netlify.toml` (`L1–11`), `components/common/AdSenseUnit.tsx`
- **Root Cause & Exact Code Trace:**
  1. **CSP Blocks Google AdSense**: `components/common/AdSenseUnit.tsx` and `components/AdDemoPage.tsx` load Google AdSense (`ca-pub-4069971667046129`) from `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js`. However, in `firebase.json:43` (`main-site` target), `Content-Security-Policy` specifies:
     ```
     script-src 'self' https://static.cloudflareinsights.com 'unsafe-inline' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://recaptchaenterprise.googleapis.com;
     ```
     It completely omits `https://pagead2.googlesyndication.com`, `https://googleads.g.doubleclick.net`, `https://tpc.googlesyndication.com`, and `https://*.adtrafficquality.google` from `script-src`, `frame-src`, `connect-src`, and `img-src`! Any browser visiting `udfonline.in` blocks the AdSense script and ad iframes with a CSP violation error.
  2. **Broken `vercel.json` and `netlify.toml`**: Both `vercel.json:2–3` and `netlify.toml:2–3` run `npm run build` with output directory `dist` (which builds without `VITE_APP_TARGET=public` and skips `scripts/generateStaticPages.js`), and neither file includes any of the 43 `/api/*` Cloud Function rewrites or security headers configured in `firebase.json`.
- **Real-World Impact:**
  - Google AdSense ads and the `/ad-demo` compliance showcase cannot load on `udfonline.in` due to `Content-Security-Policy` blocking `pagead2.googlesyndication.com`, causing Google AdSense site review/monetization checks to fail.
- **Remediation (`diff`):**
```diff
--- a/firebase.json
+++ b/firebase.json
@@ -40,7 +40,7 @@
             },
             {
               "key": "Content-Security-Policy",
-              "value": "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; script-src 'self' https://static.cloudflareinsights.com 'unsafe-inline' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://recaptchaenterprise.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://us-central1-hr-portal-unique-delta.cloudfunctions.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google.com; img-src 'self' data: blob: https://storage.googleapis.com https://*.googleapis.com https://*.firebasestorage.app https://*.googleusercontent.com https://www.google.com https://www.gstatic.com https://udfonline.in https://*.udfonline.in https://www.transparenttextures.com; frame-src 'self' blob: https://*.firebaseapp.com https://accounts.google.com https://www.google.com/recaptcha/ https://recaptchaenterprise.googleapis.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; worker-src 'self' blob:;"
+              "value": "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; script-src 'self' https://static.cloudflareinsights.com 'unsafe-inline' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://recaptchaenterprise.googleapis.com https://pagead2.googlesyndication.com https://*.adtrafficquality.google; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://us-central1-hr-portal-unique-delta.cloudfunctions.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google.com https://pagead2.googlesyndication.com https://*.g.doubleclick.net https://*.adtrafficquality.google; img-src 'self' data: blob: https://storage.googleapis.com https://*.googleapis.com https://*.firebasestorage.app https://*.googleusercontent.com https://www.google.com https://www.gstatic.com https://udfonline.in https://*.udfonline.in https://www.transparenttextures.com https://pagead2.googlesyndication.com https://*.g.doubleclick.net; frame-src 'self' blob: https://*.firebaseapp.com https://accounts.google.com https://www.google.com/recaptcha/ https://recaptchaenterprise.googleapis.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.adtrafficquality.google; worker-src 'self' blob:;"
             },
```

---

### `UDF-AUD-159` — `[MEDIUM]` `PublicHeader.tsx` Renders Broken `'/dashboard'` Link for Logged-In Employees & Hides `'Careers'` and `'Business Services'`
- **Target File(s):** `components/common/PublicHeader.tsx` (`L24–37, L44–60, L122, L204`)
- **Root Cause & Exact Code Trace:**
  1. Look at `components/common/PublicHeader.tsx:24–37`:
     ```ts
     const navItems = user && user.type === 'Employee' ? [
         { path: '/', label: 'Home' },
         { path: '/dashboard', label: 'Dashboard' },
         { path: '/blogs', label: 'Blogs' },
         { path: '/about', label: 'About Us' },
         { path: '/contact', label: 'Contact Us' }
     ] : [ ... ];
     ```
     Whereas the user profile dropdown (`L122`) and mobile drawer button (`L204`) navigate to `'/employee/dashboard'`, the top navigation bar item (`L26`) navigates to `'/dashboard'`! On the public portal (`udfonline.in` / `target === 'public'`), `/dashboard` is not a valid employee route in `AppRoutes.tsx` and immediately redirects back to `/`!
  2. Additionally, when an employee is logged in, `navItems` removes `'Business Services'` (`/business`) and `'Careers'` (`/careers`) from the navigation bar, and `handleNavClick` (`L52`) calls `navigate('/' + path)` for `#hash` links.
- **Real-World Impact:**
  - Logged-in employees browsing the public website who click `"Dashboard"` in the top navbar are bounced back to the homepage instead of entering `/employee/dashboard`, and can no longer access the `/careers` or `/business` pages from the header.
- **Remediation (`diff`):**
```diff
--- a/components/common/PublicHeader.tsx
+++ b/components/common/PublicHeader.tsx
@@ -23,8 +23,10 @@
 
     const navItems = user && user.type === 'Employee' ? [
         { path: '/', label: 'Home' },
-        { path: '/dashboard', label: 'Dashboard' },
+        { path: '/employee/dashboard', label: 'Dashboard' },
+        { path: '/business', label: 'Business Services' },
         { path: '/blogs', label: 'Blogs' },
         { path: '/about', label: 'About Us' },
+        { path: '/careers', label: 'Careers' },
         { path: '/contact', label: 'Contact Us' }
     ] : [
```

---

### `UDF-AUD-160` — `[HIGH]` `auditService.ts` `logSystemAction` Mis-Maps `actorOverride.id` to `targetId` & `subscribeToAuditLogs` Applies `limit(100)` Before Client-Side `actorId` Filtering
- **Target File(s):** `src/services/auditService.ts` (`L43–64, L70–95`)
- **Root Cause & Exact Code Trace:**
  1. In `src/services/auditService.ts:43–64`, `logSystemAction` accepts `actorOverride?: { id: string; name: string }`, but passes `targetId: actorOverride?.id` to `logClientAuditEvent` (`L63`) while dropping `actorOverride.name` altogether.
  2. Look at `subscribeToAuditLogs` (`L70–95`):
     ```ts
     export const subscribeToAuditLogs = (callback: (logs: AuditLogEntry[]) => void, limitCount = 100, filter?: { actorId?: string }) => {
         let q = query(
             collection(db, AUDIT_LOGS_COLLECTION),
             orderBy('timestamp', 'desc'),
             limit(limitCount)
         );
         return onSnapshot(q, (snapshot) => {
             ...
             if (filter?.actorId) {
                 logs = logs.filter(log => log.actorId === filter.actorId);
             }
             callback(logs);
         });
     };
     ```
     Because `limit(100)` is applied to the global `audit_logs` collection *before* `logs.filter(log => log.actorId === filter.actorId)` runs in JavaScript, any non-SuperAdmin staff member viewing their own audit log history (or a SuperAdmin filtering by a specific staff member) gets **zero results** as soon as 100 newer audit events from other users exist in the system!
- **Real-World Impact:**
  - Staff audit log views appear completely empty once 100 global actions occur across the company, and `actorOverride` metadata is mis-recorded as `targetId`.
- **Remediation (`diff`):**
```diff
--- a/src/services/auditService.ts
+++ b/src/services/auditService.ts
@@ -8,6 +8,7 @@
     setDoc,
     query,
     orderBy,
+    where,
     onSnapshot,
     limit,
     serverTimestamp,
@@ -70,11 +71,13 @@
 export const subscribeToAuditLogs = (callback: (logs: AuditLogEntry[]) => void, limitCount = 100, filter?: { actorId?: string }) => {
-    let q = query(
-        collection(db, AUDIT_LOGS_COLLECTION),
-        orderBy('timestamp', 'desc'),
-        limit(limitCount)
-    );
+    const constraints: any[] = [];
+    if (filter?.actorId) {
+        constraints.push(where('actorId', '==', filter.actorId));
+    }
+    constraints.push(orderBy('timestamp', 'desc'), limit(limitCount));
+    const q = query(collection(db, AUDIT_LOGS_COLLECTION), ...constraints);
```

---

### `UDF-AUD-161` — `[HIGH]` `siteService.ts` & `firestore.rules` Allow Any Branch Staff With `SITES_EDIT` to Overwrite or Delete Every Site in the Company via Monolithic `settings/sites` Array
- **Target File(s):** `src/services/siteService.ts` (`L29–62`), `src/services/adminService.ts` (`L149–152`), `firestore.rules` (`L271`)
- **Root Cause & Exact Code Trace:**
  1. All company sites are stored in a single array field `sites: Site[]` inside a single document `settings/sites`.
  2. In `firestore.rules:271`:
     ```
     allow write: if isAdmin() && (docId != 'sites' || hasAnyPerm(['MANAGE_SITES', 'SITES_CREATE', 'SITES_EDIT', 'SITES_TOGGLE_STATUS', 'SITES_DELETE']));
     ```
     Because Firestore rules cannot enforce per-element array authorization on `resource.data.sites`, granting `write` on `settings/sites` to `SITES_EDIT` or `SITES_TOGGLE_STATUS` means **a site-scoped supervisor who only has `SITES_EDIT` for a single site can overwrite the entire `settings/sites` document—modifying, disabling, or deleting every other branch's sites**!
  3. Furthermore, `updateSiteDetails` (`src/services/siteService.ts:29–56`) performs a non-transactional `getDoc` followed by `setDoc(sitesRef, { sites: stripUndefined(newSites) }, { merge: true })` (without `runTransaction`), so concurrent edits by two site managers silently overwrite one another.
- **Real-World Impact:**
  - Any staff member with `SITES_EDIT` or `SITES_TOGGLE_STATUS` can tamper with or wipe the entire organization's site portfolio in `settings/sites`, and concurrent site updates cause lost writes.
- **Remediation (`diff`):**
```diff
--- a/src/services/siteService.ts
+++ b/src/services/siteService.ts
@@ -1,7 +1,7 @@
 import log from "@/src/utils/logger";
 
 import { db } from '../firebase/config';
-import { doc, getDoc, setDoc } from 'firebase/firestore';
+import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
 import { Site } from '../../types';
 import { logSystemAction } from './auditService';
 
@@ -33,21 +33,19 @@
     const sitesRef = doc(db, SETTINGS_COLLECTION, SITES_DOC_ID);
 
     try {
-        const snap = await getDoc(sitesRef);
-        if (!snap.exists()) throw new Error("Sites configuration not found");
-
-        const currentSites = snap.data().sites as Site[];
-        const siteIndex = currentSites.findIndex(s => s.id === siteId);
-
-        if (siteIndex === -1) throw new Error("Site not found");
-
-        const updatedSite = { ...currentSites[siteIndex], ...updates };
-        const newSites = [...currentSites];
-        newSites[siteIndex] = updatedSite;
-
-        await setDoc(sitesRef, { sites: stripUndefined(newSites) }, { merge: true });
+        let updatedName = siteId;
+        await runTransaction(db, async (tx) => {
+            const snap = await tx.get(sitesRef);
+            if (!snap.exists()) throw new Error("Sites configuration not found");
+            const currentSites = (snap.data().sites || []) as Site[];
+            const siteIndex = currentSites.findIndex(s => s.id === siteId);
+            if (siteIndex === -1) throw new Error("Site not found");
+            const updatedSite = { ...currentSites[siteIndex], ...updates };
+            updatedName = updatedSite.name;
+            const newSites = [...currentSites];
+            newSites[siteIndex] = updatedSite;
+            tx.set(sitesRef, { sites: stripUndefined(newSites) }, { merge: true });
+        });
         log.log(`Updated site details for ${siteId}`);
-        await logSystemAction('UPDATE', 'SITES', `Updated site details for "${updatedSite.name}" (${siteId})`);
+        await logSystemAction('UPDATE', 'SITES', `Updated site details for "${updatedName}" (${siteId})`);
```

---

### `UDF-AUD-162` — `[MEDIUM]` `statsService.ts` `updatePublicStats` Is Blocked by `firestore.rules` for Non-`SETTINGS_MANAGE` Staff & Counts Relieved/Soft-Deleted Records
- **Target File(s):** `src/services/statsService.ts` (`L29–49`), `firestore.rules` (`L271`)
- **Root Cause & Exact Code Trace:**
  1. `updatePublicStats()` (`src/services/statsService.ts:29–49`) is called from client-side employee approval, relieving, and deletion flows to refresh `settings/public_stats`.
  2. However, `firestore.rules:271` restricts writes to `settings/{docId}` (where `docId == 'public_stats'`) to `isAdmin() && hasAnyPerm(['MANAGE_SETTINGS', 'SETTINGS_MANAGE'])`! Because HR staff who approve onboarding submissions (`SUBMISSIONS_APPROVE`) or relieve employees (`EMPLOYEES_RELIEVE`) do not have `SETTINGS_MANAGE`, `setDoc(doc(db, 'settings', 'public_stats'), ...)` fails with `PERMISSION_DENIED` (caught and swallowed at `L45–48`).
  3. Furthermore, line `33` (`const q = query(empColl, where("isActive", "==", true));`) counts documents in `employees` without excluding records where `isRelieved == true` or `isDeleted == true`.
- **Real-World Impact:**
  - `settings/public_stats` (`totalEmployees`) fails to update whenever non-SuperAdmin HR staff approve or relieve employees.
- **Remediation (`diff`):**
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -268,7 +268,9 @@
     match /settings/{docId} {
       allow read: if docId in ['public_stats', 'public_website', 'form_sections', 'sites', 'portal_config', 'gamification_rules']
                   || request.auth != null;
-      allow write: if isAdmin() && (
+      allow write: if isAdmin() && (
+        (docId == 'public_stats' && hasAnyPerm(['MANAGE_SETTINGS', 'SETTINGS_MANAGE', 'MANAGE_EMPLOYEES', 'EMPLOYEES_CREATE', 'EMPLOYEES_EDIT', 'EMPLOYEES_RELIEVE', 'MANAGE_SUBMISSIONS', 'SUBMISSIONS_APPROVE'])) ||
         (docId == 'sites' && hasAnyPerm(['MANAGE_SITES', 'SITES_CREATE', 'SITES_EDIT', 'SITES_TOGGLE_STATUS', 'SITES_DELETE'])) ||
```

---

### `UDF-AUD-163` — `[HIGH]` `bgvService.ts` `syncBgvCandidates` Fails to Extract Form Builder UUID Fields, Assigns Unmatched Candidates to `bgvSites[0]` (Wrong Site!) & Omits `employees.bgvStatus` Sync in Client Fallbacks
- **Target File(s):** `src/services/bgvService.ts` (`L156–279, L396–406, L456–472, L508–517`)
- **Root Cause & Exact Code Trace:**
  1. **Missing Form Builder UUID Extraction**: In `src/services/bgvService.ts:181–217`, `syncBgvCandidates` reads `emp.profileData || emp.formData` (ignoring `emp.data`, which is where `approveOnboardingServer` and `FirestoreEmployee` store all onboarding fields!) and looks up english property names (`personal.fullName`, `personal.phoneNumber`, `personal.aadhaarNumber`, `personal.dob`, `personal.fatherName`, `personal.permanentAddress`). It **never checks the Form Builder field UUIDs** (`'7debf274-baee-4bac-a137-4b4b46719874'` for Name, `'eb3617dc-9f1d-475d-a2db-005b6bc2500c'` for Phone, `'18855ee9-0d66-41d6-988b-128b776a8c5b'` for Aadhaar, `'6e570a01-14e0-4e18-b112-97ddc51d0778'` for DOB, `'3f09e364-7875-40a2-9490-41251be20366'` for Father Name, `'29bae22a-59db-4b1b-bafd-64e8018a0f4e'` for Permanent Address, `'7fbd2b8f-62b5-402d-a1dd-262531fa80af'` for Photo, `'eecc5044-399c-45f8-aa03-e609748f0e49'` for Aadhaar Front)!
  2. **Wrong `bgvSites[0]` Fallback**: Look at lines `252–257`:
     ```ts
     const matchedSite = bgvSites.find(s =>
       s.id === (emp as any).currentSiteId ||
       s.id === (emp as any).siteId ||
       s.name.trim().toLowerCase() === String((emp as any).unit || (emp as any).siteName || (emp as any).currentSiteName || '').trim().toLowerCase() ||
       ((emp as any).assignedSiteIds || []).includes(s.id)
     ) || bgvSites[0];
     ```
     If an employee's site is stored in `emp.data['52ae217b-2602-4337-a1cd-a1f9bd36a4b0']` or fails the inline `.find()`, `|| bgvSites[0]` assigns the employee's BGV record to the **first BGV site in the array (`bgvSites[0]`)**, leaking the employee's BGV record to a completely different branch's site manager!
  3. **Client Fallbacks Omit `employees.bgvStatus`**: In `staffApproveBgv` (`L396–406`), `staffDirectCompleteBgv` (`L456–472`), and `staffRejectBgv` (`L508–517`), the client fallback updates `bgv_records/{recordId}` without updating `employees/{employeeDocId}.bgvStatus`.
- **Real-World Impact:**
  - Enrolled BGV candidates have blank Phone, Aadhaar, DOB, Father Name, Address, Photo, and Aadhaar Document fields when their data resides in `emp.data` under Form Builder UUIDs, and unmatched candidates get assigned to `bgvSites[0]`.
- **Remediation (`diff`):**
```diff
--- a/src/services/bgvService.ts
+++ b/src/services/bgvService.ts
@@ -180,19 +180,20 @@
     const customFields = extractCustomFieldsFromEmployee(emp, extractedFieldIds, formSections);
 
-    // Extract details from profileData / formData
-    const profile = (emp as any).profileData || (emp as any).formData || {};
+    // Extract details from data / profileData / formData (including Form Builder UUIDs)
+    const profile = (emp as any).data || (emp as any).profileData || (emp as any).formData || {};
     const personal = profile.personalDetails || {};
 
-    const fullName = (emp as any).name || (emp as any).applicantName || personal.fullName || 'Employee';
-    const phone = (emp as any).phone || (emp as any).phoneNumber || personal.phoneNumber || personal.mobileNumber || '';
-    const aadhaar = (emp as any).aadhaarNumber || personal.aadhaarNumber || personal.aadhar || '';
-    let dob = (emp as any).dateOfBirth || (emp as any).dob || personal.dob || personal.dateOfBirth || '';
-    let fatherName = personal.fatherName || (emp as any).fatherName || '';
-    const address = personal.permanentAddress || (emp as any).address || '';
+    const fullName = (emp as any).name || (emp as any).applicantName || profile['7debf274-baee-4bac-a137-4b4b46719874'] || personal.fullName || 'Employee';
+    const phone = (emp as any).phone || (emp as any).phoneNumber || profile['eb3617dc-9f1d-475d-a2db-005b6bc2500c'] || personal.phoneNumber || personal.mobileNumber || '';
+    const aadhaar = (emp as any).aadhaarNumber || profile['18855ee9-0d66-41d6-988b-128b776a8c5b'] || personal.aadhaarNumber || personal.aadhar || '';
+    let dob = (emp as any).dateOfBirth || (emp as any).dob || profile['6e570a01-14e0-4e18-b112-97ddc51d0778'] || personal.dob || personal.dateOfBirth || '';
+    let fatherName = profile['3f09e364-7875-40a2-9490-41251be20366'] || personal.fatherName || (emp as any).fatherName || '';
+    const address = profile['29bae22a-59db-4b1b-bafd-64e8018a0f4e'] || profile['8532f460-7bcf-4831-ab62-96375b80e6ab'] || personal.permanentAddress || (emp as any).address || '';
 
     // Photos and Aadhaar files
-    let photo = (emp as any).profilePhotoURL || (emp as any).photoUrl || personal.profilePhotoURL || '';
-    let aadhaarDoc = (emp as any).aadhaarDocPath || (emp as any).aadhaarUrl || personal.aadhaarDoc || '';
+    let photo = (emp as any).profilePhotoURL || (emp as any).photoUrl || profile['7fbd2b8f-62b5-402d-a1dd-262531fa80af']?.storagePath || profile['7fbd2b8f-62b5-402d-a1dd-262531fa80af'] || personal.profilePhotoURL || '';
+    let aadhaarDoc = (emp as any).aadhaarDocPath || (emp as any).aadhaarUrl || profile['eecc5044-399c-45f8-aa03-e609748f0e49']?.storagePath || profile['eecc5044-399c-45f8-aa03-e609748f0e49'] || personal.aadhaarDoc || '';
```

---

### `UDF-AUD-164` — `[HIGH]` `storageService.ts` `uploadProfilePhoto` Hardcodes `employees/${userId}/profile/avatar.${ext}` With PNG/WebP Extension Mismatch & Null `canvas.toBlob` Crash
- **Target File(s):** `src/services/storageService.ts` (`L503–562`)
- **Root Cause & Exact Code Trace:**
  1. Look at `src/services/storageService.ts:503–516` (`uploadProfilePhoto`) and `L526–562` (`compressImage`):
     ```ts
     export const uploadProfilePhoto = async (userId: string, file: File): Promise<string> => {
         const compressed = await compressImage(file, 400, 0.8);
         const ext = file.name.split('.').pop() || 'jpg';
         const storagePath = `employees/${userId}/profile/avatar.${ext}`;
     ```
     Inside `compressImage` (`L546–555`), the image is always encoded as **`'image/jpeg'`** and returned as `new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })`. However, `uploadProfilePhoto` extracts `ext` from the **original** `file.name` (e.g., `.png`, `.webp`, `.heic`) instead of `'jpg'`, uploading a JPEG binary to `avatar.png` or `avatar.heic` (which `getUploadUrl` in `functions/src/storage.ts` validates against allowed extensions and MIME types!).
  2. In `compressImage` (`L547–553`), `canvas.toBlob((blob) => { ... resolve(new File([blob], newName, { type: 'image/jpeg' })); })` never checks `if (!blob) return reject(new Error('Image compression failed'));`. When `toBlob` returns `null`, `new File([null as any], ...)` creates a corrupt 4-byte file containing the ASCII string `"null"`!
- **Real-World Impact:**
  - Uploading a `.webp` or `.heic` profile photo creates a mismatched extension/MIME storage path, and a failed canvas `toBlob` overwrites the user's avatar with a corrupt 4-byte `"null"` file.
- **Remediation (`diff`):**
```diff
--- a/src/services/storageService.ts
+++ b/src/utils/storageService.ts
@@ -506,8 +506,7 @@
 ): Promise<string> => {
     try {
         const compressed = await compressImage(file, 400, 0.8);
-        const ext = file.name.split('.').pop() || 'jpg';
-        const storagePath = `employees/${userId}/profile/avatar.${ext}`;
+        const storagePath = `employees/${userId}/profile/avatar.jpg`;
         try {
             return await uploadViaSignedUrl('profile', storagePath, compressed);
         } catch (cfError) {
@@ -545,6 +544,7 @@
             ctx.drawImage(img, 0, 0, width, height);
             canvas.toBlob(
                 (blob) => {
+                    if (!blob) return reject(new Error('Canvas toBlob failed'));
                     const originalName = file.name;
                     const dotIndex = originalName.lastIndexOf('.');
                     const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
```

---

### `UDF-AUD-165` — `[HIGH]` `requestService.ts` `uploadFilesInObject` Silently Nullifies Failed File Uploads (`result[key] = null`), Misses Nested `File` Objects & `revertWorkflowRequest` Fallback Omits `approvalHistory`
- **Target File(s):** `src/services/requestService.ts` (`L19–36, L262–289`)
- **Root Cause & Exact Code Trace:**
  1. Look at `src/services/requestService.ts:19–36` (`uploadFilesInObject`):
     ```ts
     async function uploadFilesInObject(obj: Record<string, any>, storagePath: string): Promise<Record<string, any>> {
       const result: Record<string, any> = {};
       for (const [key, value] of Object.entries(obj)) {
         if (value instanceof File) {
           try {
             const url = await uploadFile(value, storagePath, value.name);
             result[key] = url;
           } catch (err) {
             log.error(`[Storage] ❌ Failed to upload ${key}: ${(value as File).name}`, err);
             result[key] = null; // Don't block the save — nullify the failed file
           }
         } else {
           result[key] = value;
         }
       }
       return result;
     }
     ```
     - When a file upload fails (e.g., network drop, oversized file, or expired auth token), `uploadFilesInObject` **swallows the exception and sets `result[key] = null`**! Consequently, when an employee submits an account update for a required document (e.g., Bank Passbook or Aadhaar Card), a medical leave request with a doctor's certificate, or a supervisor files a disciplinary notice with an official document, the request is saved to Firestore with **`newValue: null` / `document: null`** while showing a success toast to the user!
     - If an approved `AccountUpdateRequest` with `newValue: null` is subsequently approved by HR, it **overwrites the employee's existing document field with `null`**!
  2. In `revertWorkflowRequest` (`L280–288`), the client fallback sets `status: 'Pending'` and `currentLevel: targetLevel` without recording an entry in `approvalHistory`.
- **Real-World Impact:**
  - Any transient file upload failure during an Account Update Request submits `newValue: null`, which upon HR approval wipes out the employee's existing document in Firestore!
- **Remediation (`diff`):**
```diff
--- a/src/services/requestService.ts
+++ b/src/services/requestService.ts
@@ -26,8 +26,7 @@
         log.log(`[Storage] ✅ Uploaded ${key}: ${value.name}`);
       } catch (err) {
         log.error(`[Storage] ❌ Failed to upload ${key}: ${(value as File).name}`, err);
-        result[key] = null; // Don't block the save — nullify the failed file
+        throw new Error(`Failed to upload attachment "${(value as File).name}". Please check your connection and try again.`);
       }
     } else {
       result[key] = value;
```

---

### `UDF-AUD-166` — `[HIGH]` `authService.ts` `getEmployeeProfile` Omits `linkedUid` Lookup on `employees`, Omits `uid` Lookup on `onboarding_submissions` & Matches Relieved Stints First on `linkedGoogleEmail`
- **Target File(s):** `src/services/authService.ts` (`L50–121`)
- **Root Cause & Exact Code Trace:**
  1. In `src/services/authService.ts:50–115` (`getEmployeeProfile`):
     - Step 2 (`L60–67`) queries `collection(db, 'employees'), where("uid", "==", firebaseUser.uid), limit(1)`, but **never queries `where("linkedUid", "==", firebaseUser.uid)`** on `employees` (even though `approveOnboardingServer` and `selfLinkGoogleAccount` write `linkedUid`).
     - Step 3 (`L70–89`) queries `collection(db, 'employees'), where("linkedGoogleEmail", "==", firebaseUser.email), limit(1)` **without filtering `where("isActive", "==", true)`**! If an employee has an older relieved record in `employees` (e.g., from a previous stint) that shares the same `linkedGoogleEmail` as their active rejoined record, `limit(1)` can return the relieved record first, overwrite its `uid` (`L80`), and then immediately throw `"This account does not exist or has been deactivated"` at line `118–120`!
     - Step 4 (`L93–115`) checks `doc(db, 'onboarding_submissions', firebaseUser.uid)` and `where("linkedUid", "==", firebaseUser.uid)`, but **never queries `where("uid", "==", firebaseUser.uid)`** on `onboarding_submissions`.
- **Real-World Impact:**
  - Rejoined employees who sign in with Google are locked out with `"This account does not exist or has been deactivated"` whenever Firestore returns their older relieved stint before their active stint, and employees linked via `linkedUid` on `employees` or `uid` on `onboarding_submissions` fail lookup.
- **Remediation (`diff`):**
```diff
--- a/src/services/authService.ts
+++ b/src/services/authService.ts
@@ -65,12 +65,20 @@
                 empData = uidSnap.docs[0].data();
                 empDocId = uidSnap.docs[0].id;
             }
+            if (!empData) {
+                const linkedUidQuery = query(collection(db, 'employees'), where("linkedUid", "==", firebaseUser.uid), limit(1));
+                const linkedUidSnap = await getDocs(linkedUidQuery);
+                if (!linkedUidSnap.empty) {
+                    empData = linkedUidSnap.docs[0].data();
+                    empDocId = linkedUidSnap.docs[0].id;
+                }
+            }
         }
 
         // 3. Fallback: Query by linkedGoogleEmail (for Google Sign-in users)
         if (!empData && firebaseUser.email) {
             try {
-                const emailQuery = query(collection(db, 'employees'), where("linkedGoogleEmail", "==", firebaseUser.email), limit(1));
+                const emailQuery = query(collection(db, 'employees'), where("linkedGoogleEmail", "==", firebaseUser.email), where("isActive", "==", true), limit(1));
                 const emailSnap = await getDocs(emailQuery);
```

---

### `UDF-AUD-167` — `[MEDIUM]` `engagementService.ts` `markAttendanceForDate` Creates Duplicate Attendance Documents Under Rapid Taps & `submitComplaint` Misses Form Builder Site UUID
- **Target File(s):** `src/services/engagementService.ts` (`L237–272, L319–330`)
- **Root Cause & Exact Code Trace:**
  1. In `src/services/engagementService.ts:237–272` (`markAttendanceForDate`), the function runs a client-side `getDocs(query(collection(db, 'attendance'), where('userId', '==', userId), where('date', '==', date)))` and, if `!querySnapshot.empty` is false, calls `addDoc(collection(db, 'attendance'), ...)` with a random document ID (`L263`). Because `getDocs` + `addDoc` is not atomic and uses a random ID instead of a deterministic `${userId}_${date}` document ID with `setDoc(..., { merge: true })`, rapid double-taps or offline-to-online syncs create duplicate attendance records for the same user and date.
  2. In `submitComplaint` (`L319–330`), when `siteId` is empty and it looks up `const emp = await resolveEmployeeDoc(userId);`, it only checks `emp.data.currentSiteId || (emp.data as any).siteId` (`L325`) and never checks `emp.data.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0']` or `emp.data.unit`, saving `siteId: ''`.
- **Real-World Impact:**
  - Employees can create duplicate daily attendance documents for the same date, inflating monthly attendance counts, and complaints submitted by employees whose site is stored in Form Builder `data` lack `siteId`.
- **Remediation (`diff`):**
```diff
--- a/src/services/engagementService.ts
+++ b/src/services/engagementService.ts
@@ -244,33 +244,15 @@
 ): Promise<boolean> => {
     try {
-        // Query to check if record exists
-        const q = query(
-            collection(db, 'attendance'),
-            where('userId', '==', userId),
-            where('date', '==', date)
-        );
-        const querySnapshot = await getDocs(q);
-        
-        if (!querySnapshot.empty) {
-            // Update existing
-            const docId = querySnapshot.docs[0].id;
-            await updateDoc(doc(db, 'attendance', docId), {
-                status,
-                idea: idea.trim(),
-                timestamp: serverTimestamp()
-            });
-        } else {
-            // Create new
-            await addDoc(collection(db, 'attendance'), {
-                userId,
-                userName,
-                date,
-                status,
-                idea: idea.trim(),
-                timestamp: serverTimestamp()
-            });
-        }
+        const deterministicId = `${userId}_${date}`;
+        await setDoc(doc(db, 'attendance', deterministicId), {
+            userId,
+            userName,
+            date,
+            status,
+            idea: idea.trim(),
+            timestamp: serverTimestamp()
+        }, { merge: true });
```

---

### `UDF-AUD-168` — `[MEDIUM]` `aadhaarParser.ts` Fails to Parse `Year of Birth: YYYY` e-Aadhaar Cards, Truncates Addresses Containing Any 6-Digit Door/Survey Number & Leaks PDF.js Worker Memory
- **Target File(s):** `src/utils/aadhaarParser.ts` (`L34–44, L68–73, L132–149, L293–378`)
- **Root Cause & Exact Code Trace:**
  1. Look at `src/utils/aadhaarParser.ts:68–73`:
     ```ts
     // 2. Date of Birth (DOB: DD/MM/YYYY or Year of Birth: YYYY)
     const dobRegex = /DOB\s*:\s*(\d{2}\/\d{2}\/\d{4})|Date of Birth\s*:\s*(\d{2}\/\d{2}\/\d{4})/i;
     ```
     Despite the comment explicitly noting `Year of Birth: YYYY`, `dobRegex` has no branch for `Year of Birth\s*:\s*(\d{4})` or `YOB\s*:\s*(\d{4})`, leaving `details.dob` undefined on older Aadhaar cards!
  2. Look at line `132`:
     ```ts
     const addressRegex = /Address[:\s]+([\s\S]*?)(?=\d{6})[ \d{6}]*/i;
     ```
     Because `([\s\S]*?)` is non-greedy before `(?=\d{6})`, if an address contains a 6-digit door, plot, survey, or post-box number before the final PIN code, `addressRegex` stops at the first 6-digit number and truncates the rest of the address (city, district, state, and actual PIN code)!
  3. Neither `extractTextFromPDF` (`L34–44`) nor `removePdfPassword` (`L293–378`) calls `await pdf.destroy()` in a `finally` block, leaking PDF.js WebWorker memory after parsing.
- **Real-World Impact:**
  - Candidates uploading e-Aadhaar PDFs with `Year of Birth` or 6-digit house/survey numbers get blank DOBs or truncated addresses during auto-fill.
- **Remediation (`diff`):**
```diff
--- a/src/utils/aadhaarParser.ts
+++ b/src/utils/aadhaarParser.ts
@@ -66,10 +66,13 @@
     }
 
     // 2. Date of Birth (DOB: DD/MM/YYYY or Year of Birth: YYYY)
-    const dobRegex = /DOB\s*:\s*(\d{2}\/\d{2}\/\d{4})|Date of Birth\s*:\s*(\d{2}\/\d{2}\/\d{4})/i;
+    const dobRegex = /DOB\s*:\s*(\d{2}\/\d{2}\/\d{4})|Date of Birth\s*:\s*(\d{2}\/\d{2}\/\d{4})|(?:Year of Birth|YOB)\s*:\s*(\d{4})/i;
     const dobMatch = text.match(dobRegex);
     if (dobMatch) {
-        details.dob = dobMatch[1] || dobMatch[2];
+        details.dob = dobMatch[1] || dobMatch[2] || (dobMatch[3] ? `01/01/${dobMatch[3]}` : undefined);
     }
```

---

### `UDF-AUD-169` — `[HIGH]` Anonymous Auth Session Promotion (`ensureAuthenticated()`) Causes `blogService.ts` and `firestore.rules` to Expose All Internal `isPrivate: true` Blog Posts to Public Visitors
- **Target File(s):** `src/firebase/config.ts` (`L140–155`), `src/services/blogService.ts` (`L20–32`), `firestore.rules` (`L277`)
- **Root Cause & Exact Code Trace:**
  1. In `src/firebase/config.ts:140–155`, `ensureAuthenticated()` signs any unauthenticated visitor in via `signInAnonymously(auth)` (triggered automatically when visiting `/join` or calling `getSecureURL`/`getFormDraft`).
  2. Now look at `src/services/blogService.ts:23–32`:
     ```ts
     const isAuth = !!auth?.currentUser;
     let q;
     if (isAuth) {
         // Authenticated users (staff/employees) can see all posts (including internal protocols)
         q = query(blogCol, orderBy('timestamp', 'desc'));
     } else {
         // Public unauthenticated visitors only fetch public posts
         q = query(blogCol, where('isPrivate', '==', false), orderBy('timestamp', 'desc'));
     }
     ```
     **`!!auth?.currentUser` is `true` for anonymous Firebase Auth users (`auth.currentUser.isAnonymous === true`)!**
  3. And look at `firestore.rules:276–278`:
     ```
     match /blog_posts/{postId} {
       allow read: if resource.data.isPrivate != true || request.auth != null;
     ```
     **`request.auth != null` is ALSO `true` for anonymous Firebase Auth users (`request.auth.token.firebase.sign_in_provider == 'anonymous'`)!**
  4. Therefore, **any public visitor who visits `/join` (or calls `firebase.auth().signInAnonymously()`) has an active anonymous Firebase Auth session (`auth.currentUser.isAnonymous === true`), causing `blogService.ts` to query ALL blog posts without `where('isPrivate', '==', false)` and `firestore.rules` to permit reading 100% of private internal company blog posts (`isPrivate: true`)**!
- **Real-World Impact:**
  - Confidential internal security protocols and employee-only blog posts marked `isPrivate: true` are completely exposed to any public visitor who has touched `/join` or signed in anonymously.
- **Remediation (`diff`):**
```diff
--- a/src/services/blogService.ts
+++ b/src/services/blogService.ts
@@ -20,7 +20,7 @@
 export const getBlogPosts = async (): Promise<BlogPost[]> => {
     try {
         const blogCol = collection(db, 'blog_posts');
-        const isAuth = !!auth?.currentUser;
+        const isAuth = !!auth?.currentUser && !auth.currentUser.isAnonymous;
         
         let q;
         if (isAuth) {
--- a/firestore.rules
+++ b/firestore.rules
@@ -274,7 +274,7 @@
     }
 
     match /blog_posts/{postId} {
-      allow read: if resource.data.isPrivate != true || request.auth != null;
+      allow read: if resource.data.isPrivate != true || (request.auth != null && request.auth.token.firebase.sign_in_provider != 'anonymous');
       allow write: if isAdmin() && hasAnyPerm(['MANAGE_CMS', 'BLOGS_CREATE', 'BLOGS_EDIT', 'BLOGS_DELETE', 'BLOGS_MANAGE']);
     }
```

---

### `UDF-AUD-170` — `[MEDIUM]` `public/sw.js` Service Worker Killer Unconditionally Hard-Reloads All Open Tabs (`client.navigate(client.url)`) & Collides With `VitePWA` Build Output
- **Target File(s):** `public/sw.js` (`L1–14`), `vite.config.ts` (`L74–133`)
- **Root Cause & Exact Code Trace:**
  1. Look at `public/sw.js:1–14`:
     ```js
     self.addEventListener('install', () => {
       self.skipWaiting();
     });
     self.addEventListener('activate', (event) => {
       event.waitUntil(
         caches.keys()
           .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
           .then(() => self.registration.unregister())
           .then(() => self.clients.matchAll())
           .then((clients) => clients.forEach((client) => client.navigate(client.url)))
       );
     });
     ```
  2. When building `dist-admin` (`VITE_APP_TARGET=admin`), `vite.config.ts:77–78` configures `VitePWA` with `selfDestroying: true` and `filename: 'sw-v2.js'`. Because Vite copies all files from `public/` into `dist-admin/` before `VitePWA` writes `sw-v2.js`, `dist-admin/` ends up containing **both** `sw.js` (from `public/sw.js`) and `sw-v2.js` (from `VitePWA`).
  3. Worse, whenever `public/sw.js` activates on any client (such as in preview/dev or when an older registration checks `/sw.js`), line `12` calls `clients.forEach((client) => client.navigate(client.url))`, **forcing an immediate full-page navigation reload on every open tab**, which wipes unsaved React state, open modals, and in-progress file uploads!
- **Real-World Impact:**
  - Any tab controlled by the legacy `sw.js` experiences an abrupt, unprompted full-page reload when `sw.js` activates, destroying unsaved form edits or admin modal inputs.
- **Remediation (`diff`):**
```diff
--- a/public/sw.js
+++ b/public/sw.js
@@ -8,7 +8,5 @@
     caches.keys()
       .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
       .then(() => self.registration.unregister())
-      .then(() => self.clients.matchAll())
-      .then((clients) => clients.forEach((client) => client.navigate(client.url)))
   );
 });
```


---

### `UDF-AUD-171` — **HIGH** | Broken Feature / `App.tsx` `handleCompleteProfile` Blocked by `firestore.rules` (`PERMISSION_DENIED`), Breaking Employee Profile Completion Wizard End-to-End
- **Target File(s)**: `App.tsx` (`L2360–2390`), `firestore.rules` (`L119–129`)
- **Root Cause & Exact Code Trace**:
  - When an employee with `needsProfileCompletion: true` completes the `DocumentUploadWizard`, `App.tsx:2360–2390` (`handleCompleteProfile`) attempts to update `employees/{id}` directly from the employee's client session:
    ```ts
    const employeePayload: Record<string, any> = {
      profileData: updatedProfileData,
      data: updatedProfileData,
      needsProfileCompletion: false,
      profileStatus: 'pending_review',
      profileCompletionStatus: 'COMPLETE',
      pendingProfileFields: [],
      pendingProfileNote: ''
    };
    await updateDoc(empRef, employeePayload);
    ```
  - However, `firestore.rules:119–129` restricts employee (`isDocOwner`) updates on `employees/{employeeId}` strictly to 11 auth/photo metadata keys:
    ```javascript
    (isDocOwner(resource.data) &&
      request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['profilePhotoURL', 'photoUrl', 'photoURL', 'updatedAt', 'lastUpdated',
                  'linkedGoogleEmail', 'linkedGoogleUid', 'linkedUid', 'uid', 'authProvider']))
    ```
- **Real-World Impact**:
  - Every employee who is onboarded with `"Mark Profile as Incomplete"` (`needsProfileCompletion: true`) and attempts to submit their pending documents/fields in `DocumentUploadWizard` hits a fatal `FirebaseError: Missing or insufficient permissions` (`PERMISSION_DENIED`) on the final step and can never complete their profile.
- **Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -122,7 +122,12 @@
         (isDocOwner(resource.data) &&
           request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['profilePhotoURL', 'photoUrl', 'photoURL', 'updatedAt', 'lastUpdated',
-                      'linkedGoogleEmail', 'linkedGoogleUid', 'linkedUid', 'uid', 'authProvider']))
+                      'linkedGoogleEmail', 'linkedGoogleUid', 'linkedUid', 'uid', 'authProvider'])
+        ) ||
+        (isDocOwner(resource.data) &&
+          resource.data.needsProfileCompletion == true &&
+          request.resource.data.diff(resource.data).affectedKeys()
+            .hasOnly(['profileData', 'data', 'needsProfileCompletion', 'profileStatus', 'profileCompletionStatus', 'pendingProfileFields', 'pendingProfileNote', 'aadhaarNumber', 'panNumber', 'uanNumber', 'phoneNumber', 'updatedAt', 'lastUpdated']))
       );
```

---

### `UDF-AUD-172` — **HIGH** | Security / `functions/index.js` `getUploadUrl` and `deleteStoragePath` Unverified `activeCorrectionToken` Bypass Allowing Arbitrary File Overwrite & Deletion
- **Target File(s)**: `functions/index.js` (`L2464–2469`, `L3637–3652`, `L3686–3691`)
- **Root Cause & Exact Code Trace**:
  - In `getUploadUrl` (`functions/index.js:3637–3652` and `3686–3691`) and `deleteStoragePath` (`functions/index.js:2464–2469`), when a non-owner caller requests a signed upload URL or deletes a file under `onboarding/{targetFolder}/...` or `employees/{empId}/...`, the server checks:
    ```javascript
    const subSnap = await db.collection("onboarding_submissions").doc(targetFolder).get();
    if (subSnap.exists) {
      const subData = subSnap.data();
      if (subData.linkedUid === uid || subData.ownerUid === uid || subData.uid === uid || subData.activeCorrectionToken) {
        isAuthorized = true;
      }
    }
    ```
    and for `employees/{empId}`:
    ```javascript
    if (empData.uid === uid || empData.linkedUid === uid || empData.activeCorrectionToken) {
      isAuthorized = true;
    }
    ```
  - It merely checks whether `subData.activeCorrectionToken` or `empData.activeCorrectionToken` is **truthy** on the target document, without verifying that the caller actually passed the matching `correctionToken` or a valid `sessionToken` issued by `verifyCorrectionIdentity`!
- **Real-World Impact**:
  - While an employee or applicant has a pending HR correction request, any anonymous or authenticated caller who knows or guesses their `employeeId` (e.g., `HY100123`) or `submissionId` can overwrite or delete their KYC/joining documents in Firebase Storage without possessing the correction token or passing DOB/phone verification.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3641,7 +3641,11 @@
           if (subSnap.exists) {
             const subData = subSnap.data();
-            if (subData.linkedUid === uid || subData.ownerUid === uid || subData.uid === uid || subData.activeCorrectionToken) {
+            const callerToken = request.data?.correctionToken;
+            const validToken = Boolean(callerToken && subData.activeCorrectionToken && callerToken === subData.activeCorrectionToken);
+            if (subData.linkedUid === uid || subData.ownerUid === uid || subData.uid === uid || validToken) {
               isAuthorized = true;
             }
           }
```

---

### `UDF-AUD-173` — **HIGH** | Security & Broken Feature / `functions/index.js` `onSubmissionCreated` Writes `duplicateMatches` Instead of `duplicateCheck` and Never Scans `onboarding_submissions`
- **Target File(s)**: `functions/index.js` (`L4580–4623`, `L5217`), `src/services/employeeService.ts` (`L728–736`)
- **Root Cause & Exact Code Trace**:
  - When a public candidate submits the joining form, `checkApplicantDuplicates` (`src/services/employeeService.ts:728–736`) fails with `permission-denied` because candidates cannot query `employees` or `onboarding_submissions`, writing `duplicateCheck: { isDuplicate: false }`.
  - The server-side trigger `onSubmissionCreated` (`functions/index.js:4580–4623`) runs with Admin SDK privileges, but:
    1. It only queries `employees` (`L4595`) and never queries `onboarding_submissions` for `DUPLICATE_SUBMISSION`.
    2. It writes `updates.duplicateMatches = duplicateMatches;` (`L4620`) and never sets `updates.duplicateCheck = { isDuplicate: true, matches: ... }`!
  - Meanwhile, `approveOnboardingServer` (`functions/index.js:5217`) and the Admin UI (`App.tsx:1512`) only inspect `subData.duplicateCheck?.isDuplicate`!
- **Real-World Impact**:
  - Server-side duplicate detection on submission creation is completely ignored by both the Admin UI warning badges and the `approveOnboardingServer` gatekeeper.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4617,7 +4617,14 @@
       if (duplicateMatches.length > 0) {
         updates.hasDuplicateWarning = true;
         updates.duplicateMatches = duplicateMatches;
+        updates.duplicateCheck = {
+          isDuplicate: true,
+          matchType: duplicateMatches[0].matchType || "EXISTING_ACTIVE_EMPLOYEE",
+          matchedField: duplicateMatches[0].field,
+          matchedValue: duplicateMatches[0].value,
+          matchedId: duplicateMatches[0].existingEmployeeId,
+          matchedName: duplicateMatches[0].existingName,
+          matches: duplicateMatches
+        };
       }
```

---

### `UDF-AUD-174` — **HIGH** | Broken Feature / `DataContext.tsx` `allowedSiteIds` Returns `undefined` When `EMPLOYEES_VIEW_SCOPE_ALL` Is Present—Wiping Out `scopedLeaveRequests`, `scopedAccountUpdateRequests`, `scopedResignationRequests`, and `scopedDisciplinaryActions`
- **Target File(s)**: `src/contexts/DataContext.tsx` (`L303–358`)
- **Root Cause & Exact Code Trace**:
  - In `src/contexts/DataContext.tsx:303–308`:
    ```ts
    const allowedSiteIds = useMemo((): string[] | undefined => {
      if (!user || user.type !== 'Admin') return undefined;
      if (isSuperAdmin) return undefined;
      if (userRoleObj?.permissions?.includes('EMPLOYEES_VIEW_SCOPE_ALL' as any) ||
          userRoleObj?.permissions?.includes('SUBMISSIONS_VIEW_SCOPE_ALL' as any)) {
        return undefined;
      }
    ```
  - Then in `scopedLeaveRequests` (`L336–340`), `scopedAccountUpdateRequests` (`L342–346`), `scopedResignationRequests` (`L348–352`), and `scopedDisciplinaryActions` (`L354–358`):
    ```ts
    const scopedLeaveRequests = useMemo(() => {
      if (isSuperAdmin || hasScopeAll('LEAVES_VIEW_SCOPE_ALL')) return leaveRequests;
      if (!allowedSiteIds || allowedSiteIds.length === 0) return [];
      return leaveRequests.filter(r => r.siteId && allowedSiteIds.includes(r.siteId));
    }, [leaveRequests, isSuperAdmin, hasScopeAll, allowedSiteIds]);
    ```
  - If a staff user has `EMPLOYEES_VIEW_SCOPE_ALL` (or `SUBMISSIONS_VIEW_SCOPE_ALL`) plus site-scoped `LEAVES_VIEW` (without `LEAVES_VIEW_SCOPE_ALL`), `allowedSiteIds` is `undefined`. Line `338` evaluates `if (!allowedSiteIds)` to `true` and returns `[]`!
- **Real-World Impact**:
  - Any HR/Ops staff role granted `EMPLOYEES_VIEW_SCOPE_ALL` or `SUBMISSIONS_VIEW_SCOPE_ALL` without global scope on Leaves, Account Updates, Resignations, or Disciplinary Actions sees **0 requests** across the entire portal—even for the sites they directly supervise!
- **Remediation (`diff`)**:
```diff
--- a/src/contexts/DataContext.tsx
+++ b/src/contexts/DataContext.tsx
@@ -301,16 +301,18 @@
-  const allowedSiteIds = useMemo((): string[] | undefined => {
+  const managedSiteIds = useMemo((): string[] => {
+    if (!user || user.type !== 'Admin') return [];
+    const supervisedSiteIds = sites.filter(s => s.supervisorId === user.id).map(s => s.id);
+    const explicitSites = user.sitesManaged || [];
+    return Array.from(new Set([...supervisedSiteIds, ...explicitSites]));
+  }, [user, sites]);
+
+  const allowedSiteIds = useMemo((): string[] | undefined => {
     if (!user || user.type !== 'Admin') return undefined;
     if (isSuperAdmin) return undefined;
-    if (userRoleObj?.permissions?.includes('EMPLOYEES_VIEW_SCOPE_ALL' as any) ||
-        userRoleObj?.permissions?.includes('SUBMISSIONS_VIEW_SCOPE_ALL' as any)) {
+    if (hasScopeAll('EMPLOYEES_VIEW_SCOPE_ALL') || hasScopeAll('SUBMISSIONS_VIEW_SCOPE_ALL')) {
       return undefined;
     }
-    const supervisedSiteIds = sites
-      .filter(s => s.supervisorId === user.id)
-      .map(s => s.id);
-    const explicitSites = user.sitesManaged || [];
-    return Array.from(new Set([...supervisedSiteIds, ...explicitSites]));
-  }, [user, isSuperAdmin, userRoleObj, sites]);
+    return managedSiteIds;
+  }, [user, isSuperAdmin, hasScopeAll, managedSiteIds]);
```

---

### `UDF-AUD-175` — **HIGH** | Multi-Tenant Isolation & Broken Feature / `NotificationContext.tsx` Subscribes All Site-Scoped Staff & BGV Vendors to Global `'all_admins'` Broadcasts, Marks Shared Broadcast Docs Read for Everyone, and Captures Stale `user = null` in `sendNotification`
- **Target File(s)**: `src/contexts/NotificationContext.tsx` (`L32–34`, `L114–175`)
- **Root Cause & Exact Code Trace**:
  1. Lines `32–34`: Every `user.type === 'Admin'` (including single-site supervisors and external BGV vendors) subscribes to `targetIds = [user.id, 'all_admins', 'admin']`, receiving company-wide alerts for all sites.
  2. Lines `148–175` (`markNotificationAsRead` and `markAllNotificationsAsRead`): Updates `{ read: true }` directly on the shared `notifications/{id}` document where `targetUserId` is `'all_admins'`, `'admin'`, or `'ROLE:...'`, marking the broadcast read for every other administrator.
  3. Line `146`: `sendNotification` has an empty dependency array `useCallback(async (...) => { ... }, [])`, permanently capturing `user = null` from initial mount at lines `114–118`.
- **Real-World Impact**:
  - External BGV vendors and site supervisors receive global admin broadcasts; the first admin who clicks "Mark All Read" hides the alert from all other admins; and `sendNotification`'s self-fallback logic (`user?.id`) is permanently dead code.
- **Remediation (`diff`)**:
```diff
--- a/src/contexts/NotificationContext.tsx
+++ b/src/contexts/NotificationContext.tsx
@@ -30,8 +30,10 @@
     if (user.type === 'Admin') {
-      targetIds.push('all_admins', 'admin');
+      if (user.id === 'super-admin' || user.roleId === 'role-super-admin') {
+        targetIds.push('all_admins', 'admin');
+      }
       if (user.roleId) {
         targetIds.push(`ROLE:${user.roleId}`);
       }
     }
@@ -143,4 +145,4 @@
-  }, []);
+  }, [user]);
```

---

### `UDF-AUD-176` — **HIGH** | Broken Feature / 14 Cloud Functions in `functions/index.js` Write Incompatible `audit_logs` Schemas (`action`/`module`/`category`/`description` Instead of `actionType`/`targetModule`/`details`/`actorName`)
- **Target File(s)**: `functions/index.js` (`L2862, 4508, 4646, 5067, 5449, 5596, 5772, 5875, 6959, 7234, 7404, 7564, 7770, 8326`), `components/AdminAuditLogPage.tsx`
- **Root Cause & Exact Code Trace**:
  - `AdminAuditLogPage.tsx` and `src/services/auditService.ts` define `AuditLogEntry` with `actionType` (`'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN'`), `targetModule`, `details`, and `actorName`.
  - However, 14 server-side Cloud Functions (`processNoticePeriodExitsCron` at `L2862`, `submitCorrectionServer` at `L4508`, `onSubmissionCreated` at `L4646`, `processRequestReviewServer` at `L5067`, `approveOnboardingServer` at `L5449`, `relieveEmployeeServer` at `L5596`, `rejoinEmployeeServer` at `L5772`, `promoteEmployeeServer` at `L5875`, `adminManageStaffServer` at `L6959`, `adminManageRolesServer` at `L7234`, `adminManageWorkflowsServer` at `L7404`, `adminManagePortalSettingsServer` at `L7564`, `permanentDeleteEmployeeServer` at `L7770`, and `reviewRewardRedemptionServer` at `L8326`) write `action`, `module` (or `category`), and `description`/`performedBy` without `actionType` or `targetModule`.
- **Real-World Impact**:
  - Server-enforced audit logs (onboarding approvals, relievings, rejoins, promotions, staff/role changes, permanent deletions) do not match any module or action filter in `AdminAuditLogPage.tsx` and render blank details/actor columns when `description`/`performedBy` is used.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4508,10 +4508,14 @@
     await db.collection("audit_logs").add({
       action: "DATA_CORRECTION_SUBMITTED",
+      actionType: "UPDATE",
+      targetModule: "EMPLOYEES",
       targetId: targetRef.id,
       targetType,
       requestId: token,
       updatedFields: Object.keys(sanitizedUpdates),
       timestamp: new Date().toISOString(),
       performedBy: reqData.applicantName || "Applicant (Self-Service)",
+      actorName: reqData.applicantName || "Applicant (Self-Service)",
+      details: `Applicant submitted data correction for fields: ${Object.keys(sanitizedUpdates).join(", ")}`,
       description: `Applicant submitted data correction for fields: ${Object.keys(sanitizedUpdates).join(", ")}`
     });
```

---

### `UDF-AUD-177` — **HIGH** | Broken Feature / `functions/index.js` Dual-ID Sync in `completeTrainingQuizServer`, `recordDailyStreakServer` & `redeemRewardServer` Creates Duplicate Leaderboard Entries for the Same Employee
- **Target File(s)**: `functions/index.js` (`L6045–6051`, `L7924–7930`, `L8046–8051`)
- **Root Cause & Exact Code Trace**:
  - In `completeTrainingQuizServer` (`L6045–6051`), `recordDailyStreakServer` (`L7924–7930`), and `redeemRewardServer` (`L8046–8051`), the server writes to `user_engagement/{targetDocId}` AND then mirrors the write to `user_engagement/{uid}` whenever `targetDocId !== uid`:
    ```javascript
    if (targetDocId !== uid) {
      await db.collection("user_engagement").doc(uid).set(updatedEngagement, { merge: true });
    }
    ```
  - Meanwhile, `getEngagementLeaderboard` (`src/services/engagementService.ts`) queries the top documents across `collection(db, 'user_engagement')` ordered by `points desc`.
- **Real-World Impact**:
  - Any employee whose auth `uid` differs from their `employeeId` (e.g., all Google-linked employees and all self-onboarded employees whose doc ID is `UDF-...` while `employeeId` is `HY...`) has two separate `user_engagement` documents with identical points, appearing twice on the Admin Gamification Leaderboard.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -6045,7 +6045,7 @@
     await engRef.set(engagementUpdates, { merge: true });
-    if (targetDocId !== uid) {
-      await db.collection("user_engagement").doc(uid).set(engagementUpdates, { merge: true });
+    if (targetDocId !== uid && uidSnap.exists) {
+      await db.collection("user_engagement").doc(uid).delete().catch(() => {});
     }
```

---

### `UDF-AUD-178` — **MEDIUM** | Broken Feature / `functions/index.js` `completeTrainingQuizServer` Uses UTC Date Instead of `Asia/Kolkata` (IST), Causing Midnight–05:30 AM IST Quiz Lockouts & Same-Day Double Completions
- **Target File(s)**: `functions/index.js` (`L5975`)
- **Root Cause & Exact Code Trace**:
  - In `completeTrainingQuizServer` (`functions/index.js:5975`):
    ```javascript
    const today = new Date().toISOString().split('T')[0];
    ```
  - Unlike `recordDailyStreakServer` (`L7826`, which formats `today` in `timeZone: "Asia/Kolkata"`), `completeTrainingQuizServer` uses UTC date.
- **Real-World Impact**:
  - Between 00:00 AM and 05:30 AM IST (night-shift security guards), `today` is still yesterday's date in UTC—blocking guards who completed yesterday's quiz with `"You have already completed the training quiz today"`, and allowing guards who take the quiz between 00:00 and 05:30 AM IST to take it a second time after 05:30 AM IST.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -5974,3 +5974,4 @@
-    const today = new Date().toISOString().split('T')[0];
+    const nowIst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
+    const today = `${nowIst.getFullYear()}-${String(nowIst.getMonth() + 1).padStart(2, "0")}-${String(nowIst.getDate()).padStart(2, "0")}`;
```

---

### `UDF-AUD-179` — **HIGH** | Security & Broken Feature / `AuthContext.tsx` Real-Time Claim Listener Fails to Sign Out Suspended (`isDisabled: true`) Staff & Omits `sitesManaged` From Token Refresh Trigger
- **Target File(s)**: `src/context/AuthContext.tsx` (`L120–151`)
- **Root Cause & Exact Code Trace**:
  - In `src/context/AuthContext.tsx:125–151`, the real-time `onSnapshot(staffRef)` listener updates `setUser(prev => ...)` when `staff_accounts/{uid}` changes, including `isDisabled: data.isDisabled ?? prev.isDisabled` (`L135`), but **never signs out the user when `data.isDisabled === true`**!
  - Furthermore, line `143` checks `if (data.claimsUpdatedAt || data.roleId || data.permissionOverrides || data.isDisabled !== undefined)` and omits `data.sitesManaged !== undefined`.
- **Real-World Impact**:
  - When a Super Admin suspends an active staff member (`isDisabled: true`), the suspended staff member's open browser session remains logged into the Admin Portal instead of being immediately signed out.
- **Remediation (`diff`)**:
```diff
--- a/src/context/AuthContext.tsx
+++ b/src/context/AuthContext.tsx
@@ -126,6 +126,12 @@
         if (snap.exists()) {
           const data = snap.data();
+          if (data.isDisabled === true) {
+            await auth.signOut();
+            setUser(null);
+            setIsSuperAdmin(false);
+            return;
+          }
           setUser(prev => {
```

---

### `UDF-AUD-180` — **HIGH** | Broken Feature / `functions/index.js` `onSettingsSitesWritten` Fails to Resolve Supervisors Assigned by `username`/`employeeId` and Never Stamps `claimsUpdatedAt` on `staff_accounts`
- **Target File(s)**: `functions/index.js` (`L4118–4165`)
- **Root Cause & Exact Code Trace**:
  - In `onSettingsSitesWritten` (`functions/index.js:4118–4165`):
    1. It calls `await admin.auth().getUser(supId)` and `db.collection("staff_accounts").doc(supId).get()`. Whenever a supervisor's `staff_accounts` doc ID is a username or legacy ID (not their Firebase Auth UID), `admin.auth().getUser(supId)` throws `auth/user-not-found` and skips syncing their custom claims!
    2. It sets `managedSites` solely from `supervisorSiteMap[supId]` without unioning `staffData.sitesManaged`.
    3. It never writes `claimsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()` to `staff_accounts/{supId}`, so the supervisor's active browser tab never triggers `getIdToken(true)`.
- **Real-World Impact**:
  - Assigning or reassigning a site supervisor in Site Management fails to update the supervisor's Firebase Auth `sites` custom claim in real time, causing `firestore.rules` (`canManageSite`) to block the supervisor from accessing their newly assigned site.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4153,6 +4153,10 @@
         await admin.auth().setCustomUserClaims(supId, {
           ...existingClaims,
           sites: managedSites
         });
+        await db.collection("staff_accounts").doc(supId).set({
+          claimsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
+        }, { merge: true });
```

---

### `UDF-AUD-181` — **HIGH** | Broken Feature / `EmployeeLeaveRequestPage.tsx` Looks Up `currentBalance.balances[typeId]` (`'Casual'`) While `DataContext.tsx` Keys `balances` by `lt.label` (`'Casual Leave'`), Causing `0 / 0` Balances & Blocking All Leave Submissions
- **Target File(s)**: `components/employee/EmployeeLeaveRequestPage.tsx` (`L52, 114, 175`), `src/contexts/DataContext.tsx` (`L242`), `src/constants/defaults.ts` (`L61–64`)
- **Root Cause & Exact Code Trace**:
  - In `src/constants/defaults.ts:61–64`, `defaultLeavePolicy.leaveTypes` defines:
    - `{ typeId: LeaveType.CASUAL ('Casual'), label: 'Casual Leave', ... }`
    - `{ typeId: LeaveType.SICK ('Sick'), label: 'Sick Leave', ... }`
    - `{ typeId: LeaveType.EARNED ('Earned'), label: 'Earned Leave', ... }`
  - In `src/contexts/DataContext.tsx:242`, `currentEmployeeLeaveBalance` constructs `policyBalances` keyed by **`lt.label`** (`'Casual Leave'`, `'Sick Leave'`, `'Earned Leave'`):
    ```ts
    policyBalances[lt.label] = { total: quota, used: 0 };
    ```
  - However, in `components/employee/EmployeeLeaveRequestPage.tsx:52, 114, 175`, `getBalance` is called with **`typeConfig.typeId`** (`'Casual'`, `'Sick'`, `'Earned'`):
    ```ts
    const bal = currentBalance.balances[type]; // looks up balances['Casual'] -> undefined!
    ```
- **Real-World Impact**:
  - Every employee's Leave Balance cards display **`0 / 0` (`0 Used`)** for all leave types, and when an employee attempts to submit any leave request, lines `114–118` reject the submission with: `"Insufficient leave balance. You have 0 days remaining for Casual Leave, but requested X days."`!
- **Remediation (`diff`)**:
```diff
--- a/components/employee/EmployeeLeaveRequestPage.tsx
+++ b/components/employee/EmployeeLeaveRequestPage.tsx
@@ -49,9 +49,10 @@
-  const getBalance = (type: string) => {
+  const getBalance = (typeIdOrLabel: string, label?: string) => {
     if (!currentBalance || !currentBalance.balances) return { total: 0, used: 0, remaining: 0 };
-    const bal = currentBalance.balances[type];
+    const bal = currentBalance.balances[typeIdOrLabel] || (label ? currentBalance.balances[label] : undefined);
     if (!bal) return { total: 0, used: 0, remaining: 0 };
     return {
       total: bal.total,
       used: bal.used,
       remaining: Math.max(0, bal.total - bal.used)
     };
   };
```

---

### `UDF-AUD-182` — **MEDIUM** | Broken Feature / `AttendanceCalendar.tsx` Month Navigation (`setMonth(prev ± 1)`) Skips February and 30-Day Months When Clicked on the 31st
- **Target File(s)**: `components/employee/AttendanceCalendar.tsx` (`L59–74`)
- **Root Cause & Exact Code Trace**:
  - In `components/employee/AttendanceCalendar.tsx:59–74`:
    ```ts
    const handlePrevMonth = () => {
      setCurrentDate(prev => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() - 1);
        return d;
      });
    };
    ```
  - Because `currentDate` is initialized to `new Date()` (retaining today's day-of-month, e.g. the 31st) and `d.setDate(1)` is never called before `d.setMonth(...)`, calling `setMonth(1)` (February) on March 31st sets the date to `"February 31"`, which JavaScript's `Date` normalizes to **March 3rd**!
- **Real-World Impact**:
  - On the 31st of any month (or Jan 29–31), employees cannot navigate to February, April, June, September, or November in the Attendance Calendar.
- **Remediation (`diff`)**:
```diff
--- a/components/employee/AttendanceCalendar.tsx
+++ b/components/employee/AttendanceCalendar.tsx
@@ -60,14 +60,12 @@
   const handlePrevMonth = () => {
     setCurrentDate(prev => {
-      const d = new Date(prev);
-      d.setMonth(d.getMonth() - 1);
-      return d;
+      return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
     });
   };
 
   const handleNextMonth = () => {
     setCurrentDate(prev => {
-      const d = new Date(prev);
-      d.setMonth(d.getMonth() + 1);
-      return d;
+      return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
     });
   };
```

---

### `UDF-AUD-183` — **MEDIUM** | Broken Feature / `EmployeeAccountUpdatePage.tsx` Renders `"[object Object]"` for File Upload Fields in Current Value & History Table
- **Target File(s)**: `components/employee/EmployeeAccountUpdatePage.tsx` (`L214–220`, `L307`)
- **Root Cause & Exact Code Trace**:
  - In `components/employee/EmployeeAccountUpdatePage.tsx:214–220`:
    ```ts
    if (fieldDef?.type === FieldType.FILE_UPLOAD) {
      if (value instanceof File) return value.name;
      if (typeof value === 'string' && value.startsWith('data:')) return 'Document Uploaded';
      if (typeof value === 'string' && value.startsWith('http')) return 'View Document';
    }
    return String(value);
    ```
  - In Firestore, uploaded files are stored as `{ storagePath: 'employees/...', driveUrl: '...' }` objects. `displayValue` does not check for `typeof value === 'object' && 'storagePath' in value`, falling through to `String(value)` which renders **`"[object Object]"`**. Furthermore, line `307` calls `displayValue(req.requestedValue)` without passing `fieldDef`.
- **Real-World Impact**:
  - Whenever an employee selects a document/photo field on the Account Update page or views their past document update requests, the UI displays `"[object Object]"`.
- **Remediation (`diff`)**:
```diff
--- a/components/employee/EmployeeAccountUpdatePage.tsx
+++ b/components/employee/EmployeeAccountUpdatePage.tsx
@@ -214,6 +214,9 @@
+    if (typeof value === 'object' && value !== null && ('storagePath' in value || 'driveUrl' in value)) {
+      const p = value.storagePath || value.driveUrl || '';
+      return typeof p === 'string' && p ? (p.split('/').pop() || 'Document Uploaded') : 'Document Uploaded';
+    }
     if (fieldDef?.type === FieldType.FILE_UPLOAD) {
```

---

### `UDF-AUD-184` — **MEDIUM** | Broken Feature / `EmployeeDashboardPage.tsx` Breadcrumb Passes `'/employee'` to `navigateTo(path as AppView)`, Corrupting `currentView` and Bouncing the Employee to `'/'`
- **Target File(s)**: `components/EmployeeDashboardPage.tsx` (`L701, 708`), `App.tsx` (`L899–934`)
- **Root Cause & Exact Code Trace**:
  - In `components/EmployeeDashboardPage.tsx:701, 708`, the breadcrumb defines `{ label: 'Employee', path: '/employee' }` and calls `onNavigate={(path) => navigateTo(path as AppView)}`.
  - In `App.tsx:899–934`, `navigateTo(view: AppView)` expects an `AppView` enum (`AppView.EMPLOYEE_DASHBOARD = 'EMPLOYEE_DASHBOARD'`), not a URL path (`'/employee'`). Passing `'/employee'` sets `currentView = '/employee'` and falls through to `path = '/'`, navigating the employee out of their dashboard to the public home page.
- **Real-World Impact**:
  - Clicking the `"Employee"` root breadcrumb link on any employee sub-page (`Account Update`, `Leave Request`, `Resignation`, `Disciplinary`, `Timeline`, `Profile`) kicks the employee out to `'/'`.
- **Remediation (`diff`)**:
```diff
--- a/components/EmployeeDashboardPage.tsx
+++ b/components/EmployeeDashboardPage.tsx
@@ -700,3 +700,3 @@
-              { label: 'Employee', path: '/employee' },
+              { label: 'Employee', path: AppView.EMPLOYEE_DASHBOARD },
```

---

### `UDF-AUD-185` — **MEDIUM** | Broken Feature / `ServicesPage.tsx` Missing Icon Mappings (`PawPrint`, `Car`, `Calendar`, `Cpu`) From `websiteService.ts`, Placeholder AdSense Slot `"5555555555"`, and Unmounted `/services` Route
- **Target File(s)**: `components/ServicesPage.tsx` (`L34–49`, `L82`), `src/services/websiteService.ts` (`L35–76`)
- **Root Cause & Exact Code Trace**:
  - `src/services/websiteService.ts:35–76` seeds default services with `iconName: 'PawPrint'`, `'Car'`, `'Calendar'`, and `'Cpu'`. However, `components/ServicesPage.tsx:34–49` (`renderIcon`) only maps `Shield`, `Users`, `Lock`, `Search`, `Building2`, `CheckCircle`, and `Award`, falling back to `Shield` for 4 of the 8 default services.
  - Line `82` hardcodes `<AdBanner dataAdSlot="5555555555" />`.
- **Real-World Impact**:
  - Four default security services render duplicate fallback icons and a placeholder AdSense unit ID.
- **Remediation (`diff`)**:
```diff
--- a/components/ServicesPage.tsx
+++ b/components/ServicesPage.tsx
@@ -2,5 +2,5 @@
-import { Shield, Users, Lock, Search, Building2, CheckCircle, Award, ArrowRight } from 'lucide-react';
+import { Shield, Users, Lock, Search, Building2, CheckCircle, Award, ArrowRight, PawPrint, Car, Calendar, Cpu } from 'lucide-react';
@@ -43,4 +43,8 @@
       case 'CheckCircle': return <CheckCircle {...props} />;
       case 'Award': return <Award {...props} />;
+      case 'PawPrint': return <PawPrint {...props} />;
+      case 'Car': return <Car {...props} />;
+      case 'Calendar': return <Calendar {...props} />;
+      case 'Cpu': return <Cpu {...props} />;
       default: return <Shield {...props} />;
```

---

### `UDF-AUD-186` — **MEDIUM** | Broken Feature / `src/utils/capacitor-utils.ts` Hardcodes `isNativeApp() = false` and `isAndroid() = false`, Disabling the Entire Native Mobile Layout (`EmployeeDashboardPage.tsx:402`) on Android APK Builds
- **Target File(s)**: `src/utils/capacitor-utils.ts` (`L6–24`), `components/EmployeeDashboardPage.tsx` (`L98, 402`)
- **Root Cause & Exact Code Trace**:
  - In `src/utils/capacitor-utils.ts:6–24`:
    ```ts
    export const isNativeApp = (): boolean => {
      return false;
    };
    export const isAndroid = (): boolean => {
      return false;
    };
    ```
  - `EmployeeDashboardPage.tsx:98, 402` checks `const native = isNativeApp(); if (native) { ... }` to render the mobile bottom-navigation bar and native app layout.
- **Real-World Impact**:
  - Even when packaged and installed as a Capacitor Android APK (`build:employee`, `build:admin`), `isNativeApp()` always returns `false`, completely disabling the native mobile app layout and Capacitor platform integrations.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/capacitor-utils.ts
+++ b/src/utils/capacitor-utils.ts
@@ -1,19 +1,11 @@
+import { Capacitor } from '@capacitor/core';
+
 export const isNativeApp = (): boolean => {
-  return false;
+  return Capacitor.isNativePlatform();
 };
 
 export const getPlatform = (): string => {
-  return 'web';
+  return Capacitor.getPlatform();
 };
 
 export const isAndroid = (): boolean => {
-  return false;
+  return Capacitor.getPlatform() === 'android';
 };
```

---

### `UDF-AUD-187` — **MEDIUM** | Broken Feature / `src/utils/createAdmin.js` Crashes on Node Execution (`Cannot find module '../firebase/config.js'`), Assigns `'role-hr-manager'` Instead of `'role-super-admin'`, and Writes to Blocked `'staff'` Collection
- **Target File(s)**: `src/utils/createAdmin.js` (`L10, 42, 48`)
- **Root Cause & Exact Code Trace**:
  - Line `10`: `import { auth, db } from '../firebase/config.js';` fails immediately in Node.js because `src/firebase/config.ts` is a TypeScript file using Vite `import.meta.env`.
  - Line `42`: Sets `roleId: 'role-hr-manager'` instead of `'role-super-admin'` while claiming to create an Admin user.
  - Line `48`: Writes to `doc(db, 'staff', user.uid)` instead of `staff_accounts` and `users`.
- **Real-World Impact**:
  - The CLI admin bootstrap script crashes on startup and targets the deprecated `'staff'` collection.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/createAdmin.js
+++ b/src/utils/createAdmin.js
@@ -41,9 +41,10 @@
-      roleId: 'role-hr-manager',
+      roleId: 'role-super-admin',
       sitesManaged: [],
       createdAt: new Date().toISOString()
     };
 
-    await setDoc(doc(db, 'staff', user.uid), staffUser);
+    await setDoc(doc(db, 'users', user.uid), staffUser);
+    await setDoc(doc(db, 'staff_accounts', user.uid), staffUser);
```

---

### `UDF-AUD-188` — **HIGH** | Security & Data Loss / `scripts/clear-employee-test-data.mjs` Production Detection Bypassed When `firebase use` Returns an Alias (`default`/`prod`) & Diagnostic Scripts Leak Real Employee Email & UID in Repo
- **Target File(s)**: `scripts/clear-employee-test-data.mjs` (`L39–72`), `scripts/check_user_exact.js` (`L15–16`), `scripts/search_user_rest.mjs` (`L21`)
- **Root Cause & Exact Code Trace**:
  - In `scripts/clear-employee-test-data.mjs:39–45`:
    ```javascript
    const isProduction = activeProject.includes('hr-portal-unique-delta') || activeProject.includes('production');
    ```
    If `npx firebase use` fails or returns a short alias name without `'hr-portal-unique-delta'`, `isProduction` evaluates to `false`, completely bypassing the `AUTHORIZED_SUPERADMIN_EMAIL` check and the `SUPERADMIN_PURGE_CONFIRMATION_PHRASE` check (`L56–72`) while still connecting to the production project hardcoded in `.env` (`VITE_FIREBASE_PROJECT_ID=hr-portal-unique-delta`)!
  - Additionally, `scripts/check_user_exact.js:15–16` and `scripts/search_user_rest.mjs:21` hardcode a real person's Gmail (`arjosarka56r@gmail.com`) and Firebase UID (`FgWijMwhsWfMDGpYn5Alpv6tbw02`) in source control.
- **Real-World Impact**:
  - Running `clear-employee-test-data.mjs` when `firebase-tools` CLI is unauthenticated or returns an alias skips the production superadmin confirmation guard and wipes live production collections via `env.VITE_FIREBASE_PROJECT_ID`.
- **Remediation (`diff`)**:
```diff
--- a/scripts/clear-employee-test-data.mjs
+++ b/scripts/clear-employee-test-data.mjs
@@ -44,2 +44,4 @@
-const isProduction = activeProject.includes('hr-portal-unique-delta') || activeProject.includes('production');
+const configuredProjectId = env.VITE_FIREBASE_PROJECT_ID || 'hr-portal-unique-delta';
+const isProduction = activeProject.includes('hr-portal-unique-delta') || activeProject.includes('production') || configuredProjectId === 'hr-portal-unique-delta';
```

---

### `UDF-AUD-189` — **MEDIUM** | Schema Mismatch / `src/constants/defaults.ts` Field Label Mismatches With `googleFormMapping.ts` (`"ESIC No"` vs `"ESI No"`, `"Father's Name"` vs `"Father Name"`, `"Passport Size Photo"` vs `"Photo"`) & Shadowed `defaultEditableFields` in `App.tsx`
- **Target File(s)**: `src/constants/defaults.ts` (`L182–234`), `App.tsx` (`L1060–1066`)
- **Root Cause & Exact Code Trace**:
  - `src/constants/defaults.ts:182–222` defines default Form Builder labels `"Father's Name"`, `"Mother's Name"`, `"ESIC No"`, and `"Passport Size Photo"`, whereas `src/constants/googleFormMapping.ts` and `AUTOMATED_FORM_CREATOR.js` expect `"Father Name"`, `"Mother Name"`, `"ESI No"`, and `"Photo"`.
  - In `App.tsx:42` and `1060–1066`, `App.tsx` imports `defaultEditableFields` from `./src/constants/defaults` (`['Full Name', 'Phone Number', 'Present Address', 'PAN Card No']`), and then **shadows** it at line `1060` with a local `const defaultEditableFields` containing Bank Name, Account No, and IFSC Code (omitting Full Name and PAN Card No).
- **Real-World Impact**:
  - Default Form Builder fields fail exact title matching with the Google Form creator script, and the default employee-editable fields in Account Update differ from `src/constants/defaults.ts`.
- **Remediation (`diff`)**:
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -1059,8 +1059,3 @@
-  // Fallback default editable fields if none configured in DB
-  const defaultEditableFields = [
-    'eb3617dc-9f1d-475d-a2db-005b6bc2500c', // Phone Number
-    '8532f460-7bcf-4831-ab62-96375b80e6ab', // Present Address
-    '1a35eaa7-d302-4e49-8649-e85cab8b3b77', // Bank Name
-    '3519c111-aaa6-4fe0-8d83-d03dd7612e28', // Account No
-    '86854000-7727-40bb-9932-09e28e443ad8', // IFSC Code
-  ];
+  // Uses defaultEditableFields imported from ./src/constants/defaults
```

---

### `UDF-AUD-190` — **HIGH** | Broken Feature / `App.tsx` `handleApproveProfileCompletion` Moves Storage Files From `onboarding/${sourceUid}` Instead of `onboarding/${empDocId}` and Fails to Rewrite String Storage Paths
- **Target File(s)**: `App.tsx` (`L2123–2171`, `L2343`)
- **Root Cause & Exact Code Trace**:
  - When a custom-token-authenticated employee uploads missing documents in `DocumentUploadWizard`, `handleDocumentUpload` (`App.tsx:2343`) calls `uploadSubmissionDocument(fieldId, file)`, which uploads to `onboarding/${auth.currentUser.uid}/...` (where `auth.currentUser.uid` is the employee's doc ID / `employeeId`, e.g., `HY100123`).
  - However, when HR approves the profile completion in `handleApproveProfileCompletion` (`App.tsx:2123–2171`):
    1. Line `2135–2136` computes `const sourceUid = subData.linkedUid || subId; const oldStoragePath = 'onboarding/' + sourceUid;`—which looks in `onboarding/${subId}` or `onboarding/${linkedUid}` instead of `onboarding/${empId}`!
    2. Lines `2142–2161` (`rewriteStoragePaths`) only check `if (typeof val === 'object' && val !== null && 'storagePath' in val)` and skip plain string storage paths!
- **Real-World Impact**:
  - Approving an employee's profile completion fails to move their newly uploaded documents from `onboarding/${empId}` to `employees/${empId}/joining` and leaves broken storage paths in their profile.
- **Remediation (`diff`)**:
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -2142,6 +2142,8 @@
       const rewriteStoragePaths = (dataObj: Record<string, any> | undefined) => {
         if (!dataObj) return dataObj;
         const cloned = { ...dataObj };
         Object.keys(cloned).forEach(key => {
           const val = cloned[key];
-          if (typeof val === 'object' && val !== null) {
+          if (typeof val === 'string' && val.startsWith(oldStoragePath)) {
+            cloned[key] = val.replace(oldStoragePath, newStoragePath);
+          } else if (typeof val === 'object' && val !== null) {
```

---

### `UDF-AUD-191` — **HIGH** | Security & Broken Feature / `functions/index.js` `submitCorrectionServer` Allows Overwriting Arbitrary Employee Fields When `requestedFields` Is Empty, Fails to Update Top-Level `applicantName` for UUID `7debf274-...`, and Leaves `onboarding_submissions` Out of Sync When `targetType === 'employee'`
- **Target File(s)**: `functions/index.js` (`L4438–4496`)
- **Root Cause & Exact Code Trace**:
  - In `submitCorrectionServer` (`functions/index.js:4438–4496`):
    1. Line `4438`: `const allowedFields = Array.isArray(reqData.requestedFields) && reqData.requestedFields.length > 0 ? new Set(reqData.requestedFields) : null;` — if `requestedFields` is `[]`, `allowedFields` is `null`, bypassing the field whitelist at line `4453` (`if (allowedFields && !allowedFields.has(key))`) and allowing the caller to overwrite arbitrary keys in `profileData`/`data`!
    2. Line `4493`: `if (/name|applicant_?name/i.test(keyLower) && typeof val === "string")` — Form Builder keys Full Name by UUID `'7debf274-baee-4bac-a137-4b4b46719874'`, which does not match `/name|applicant_?name/i`, so correcting Full Name never updates top-level `applicantName`!
    3. Lines `4446–4450`: When `targetType === 'employee'`, it updates `employees/{targetId}` without syncing the corrected fields to the paired `onboarding_submissions` document.
- **Real-World Impact**:
  - Full Name corrections via correction links leave the old `applicantName` in the Employee Master List, and employee corrections become desynchronized from `onboarding_submissions`.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4438,3 +4438,6 @@
-    const allowedFields = Array.isArray(reqData.requestedFields) && reqData.requestedFields.length > 0 ? new Set(reqData.requestedFields) : null;
+    if (!Array.isArray(reqData.requestedFields) || reqData.requestedFields.length === 0) {
+      throw new HttpsError("failed-precondition", "Correction request has no permitted fields.");
+    }
+    const allowedFields = new Set(reqData.requestedFields);
@@ -4493,3 +4496,3 @@
-      if (/name|applicant_?name/i.test(keyLower) && typeof val === "string" && val.trim()) {
+      if ((key === "7debf274-baee-4bac-a137-4b4b46719874" || /name|applicant_?name/i.test(keyLower)) && typeof val === "string" && val.trim()) {
```

---

### `UDF-AUD-192` — **HIGH** | Security / `functions/index.js` `claimEmployeeProfile` Allows Unauthenticated Callers to Claim Profiles (`request.auth` Not Required) & Increments Daily Lockout Counter Before Checking If Feature Is Enabled or Profile Exists
- **Target File(s)**: `functions/index.js` (`L2896–2975`)
- **Root Cause & Exact Code Trace**:
  - In `claimEmployeeProfile` (`functions/index.js:2896–2975`):
    1. Line `2897`: `const uid = request.auth ? request.auth.uid : "";` — never enforces `if (!request.auth) throw new HttpsError("unauthenticated", ...)`!
    2. Line `2911`: Calls `await checkClaimDailyAttempts(normalizedEmpId)` (which increments `_auth_attempts/claim_${normalizedEmpId}` in a transaction at `L2885`) **before** checking if `legacy_claim_config.enabled` is true (`L2932`) or if the legacy profile even exists (`L2975`)!
- **Real-World Impact**:
  - Any unauthenticated script can exhaust the 3-attempt daily lockout counter (`_auth_attempts/claim_${id}`) for every legacy employee ID—even while the Legacy Claim feature is disabled or with empty payloads!
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -2897,3 +2897,6 @@
-  const uid = request.auth ? request.auth.uid : "";
+  if (!request.auth || !request.auth.uid) {
+    throw new HttpsError("unauthenticated", "Authentication is required to claim a legacy profile.");
+  }
+  const uid = request.auth.uid;
```

---

### `UDF-AUD-193` — **HIGH** | Security / `functions/index.js` `verifyEmployeePassword` Lacks Authentication & Ownership Check, Exposing an Unauthenticated Password Oracle With a Separate Rate-Limit Bucket (`verify_${employeeId}`)
- **Target File(s)**: `functions/index.js` (`L1253–1312`)
- **Root Cause & Exact Code Trace**:
  - `verifyEmployeePassword` (`functions/index.js:1253–1312`) is intended for an already-logged-in employee opening `SecuritySettingsModal`, yet it has **zero `if (!request.auth)` check and zero ownership check (`empData.uid === request.auth.uid || empData.linkedUid === request.auth.uid`)**!
  - Furthermore, it uses rate-limit key `verify_${employeeId.trim()}` (`L1269`), whereas `employeeLogin` uses `login_${cleanId}` (`L698`) and `unlinkEmployeeGoogleAccount` uses `unlink_${employeeId.trim()}` (`L1333`).
- **Real-World Impact**:
  - An unauthenticated attacker can call `verifyEmployeePassword` directly as a password verification oracle and gets **3x the intended brute-force attempts per hour** (3 on `login_`, 3 on `verify_`, and 3 on `unlink_`).
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1254,4 +1254,7 @@
 exports.verifyEmployeePassword = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
+  if (!request.auth || !request.auth.uid) {
+    throw new HttpsError("unauthenticated", "You must be logged in to verify your password.");
+  }
   const { employeeId, password } = request.data;
```

---

### `UDF-AUD-194` — **HIGH** | Security / `functions/index.js` `unlinkEmployeeGoogleAccount` Lacks Caller Ownership Verification, Allowing Any Authenticated or Anonymous User to Unlink Any Employee's Google Account
- **Target File(s)**: `functions/index.js` (`L1315–1384`)
- **Root Cause & Exact Code Trace**:
  - In `unlinkEmployeeGoogleAccount` (`functions/index.js:1315–1384`), line `1317` checks `if (!request.auth || !request.auth.uid)` (which passes for any anonymous Firebase session created via `signInAnonymously()`), and **never checks that `request.auth.uid` matches the target employee (`empData.uid`, `empData.linkedUid`, `empData.employeeId`, or `empDoc.id`)** (unlike `changeEmployeePassword` at `L1062–1065`).
- **Real-World Impact**:
  - Any anonymous caller who computes or guesses an employee's predictable default password (`firstName + birthYear + @ + last4Phone`) can remotely unlink that employee's Google account and downgrade their `authProvider` to `'manual'`.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1345,4 +1345,9 @@
     const empData = empDoc.data();
+    const callerUid = request.auth.uid;
+    const isOwner = empDoc.id === callerUid || empData.employeeId === callerUid || empData.uid === callerUid || empData.linkedUid === callerUid || empData.linkedGoogleUid === callerUid;
+    if (!isOwner) {
+      throw new HttpsError("permission-denied", "You can only unlink your own Google account.");
+    }
```

---

### `UDF-AUD-195` — **HIGH** | Security / `functions/index.js` `linkEmployeeGoogleAccount` Lacks Caller Ownership Check on `employeeId`, Allowing an Attacker With a Default Password to Bind Their Own Google Account to Any Employee Profile
- **Target File(s)**: `functions/index.js` (`L1108–1250`)
- **Root Cause & Exact Code Trace**:
  - In `linkEmployeeGoogleAccount` (`functions/index.js:1108–1250`), the function verifies `idToken` (which proves the caller controls the *new* Google account being linked) and verifies `currentPassword`, but:
    1. It never requires `request.auth` to already be authenticated as the owner of `employeeId`!
    2. It does not reject linking when `empData.linkedGoogleEmail` or `empData.linkedGoogleUid` is already bound to a different Google account!
- **Real-World Impact**:
  - For any employee still on a default password (`isDefaultPassword: true`), an attacker who knows their name, birth year, and last 4 phone digits can call `linkEmployeeGoogleAccount` with the attacker's own Google `idToken`, overwriting `linkedGoogleEmail`, `linkedUid`, and `uid` on the employee profile and taking over the account.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1109,4 +1109,7 @@
 exports.linkEmployeeGoogleAccount = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
+  if (!request.auth || !request.auth.uid) {
+    throw new HttpsError("unauthenticated", "You must be logged in to link a Google account.");
+  }
   let { employeeId, currentPassword, googleUid, email, idToken } = request.data;
```

---

### `UDF-AUD-196` — **MEDIUM** | Broken Feature / `functions/index.js` `processNoticePeriodExitsCron` Uses UTC Date at 00:30 AM IST (`19:00 UTC` Previous Day), Delaying All Automated Notice Period Relievings by 24 Hours
- **Target File(s)**: `functions/index.js` (`L2796–2823`)
- **Root Cause & Exact Code Trace**:
  - `processNoticePeriodExitsCron` (`functions/index.js:2796–2803`) is scheduled for `"30 0 * * *"` in `timeZone: "Asia/Kolkata"` (**00:30 AM IST**).
  - At line `2803`, it computes:
    ```javascript
    const todayStr = new Date().toISOString().split('T')[0];
    ```
  - At **00:30 AM IST** on day `D`, UTC time is **19:00 UTC on day `D - 1`**! Thus `todayStr` is always **yesterday's date**, and `if (relDateStr <= todayStr)` (`L2822`) evaluates to `false` for every employee whose notice period ends today.
- **Real-World Impact**:
  - Every employee on an approved notice period remains active for an extra 24 hours past their scheduled relieving date.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -2802,3 +2802,4 @@
-  const todayStr = new Date().toISOString().split('T')[0];
+  const nowIst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
+  const todayStr = `${nowIst.getFullYear()}-${String(nowIst.getMonth() + 1).padStart(2, "0")}-${String(nowIst.getDate()).padStart(2, "0")}`;
```

---

### `UDF-AUD-197` — **HIGH** | Broken Feature / `GOOGLE_APPS_SCRIPT_v7.2.js` Checks Only `users/{uid}` With `roleId === 'role-super-admin'` Instead of `staff_accounts/{uid}` or Granular Permissions, Blocking Non-Super-Admin HR Staff From All Drive Folder Operations
- **Target File(s)**: `GOOGLE_APPS_SCRIPT_v7.2.js` (`L75–91`, `L111–128`)
- **Root Cause & Exact Code Trace**:
  - In `GOOGLE_APPS_SCRIPT_v7.2.js:75–91` (`verifyViaApi`), the script checks `https://firestore.googleapis.com/v1/projects/hr-portal-unique-delta/databases/(default)/documents/users/${uid}` (never checking `staff_accounts/${uid}`) and sets `isSuperAdmin = (!isDisabled && roleId === 'role-super-admin')`.
  - Then in `doPost` (`L111–128`), all 11 folder management actions (`approve_employee`, `delete_employee`, `restore_employee`, `permanent_delete_employee`, `block_employee`, `unblock_employee`, `create_employee_folder`, `sync_folder`, `rename_employee_folder`, `copy_folder_contents`, `copy_specific_subfolders`) are blocked with `"Forbidden: Only SuperAdmins can execute folder management actions"` unless `authInfo.isSuperAdmin === true`!
- **Real-World Impact**:
  - Whenever an HR Manager, Regional Manager, or Admin (whose role is not `'role-super-admin'`) approves an onboarding submission (`updateSubmissionStatus` at `src/services/employeeService.ts:1787` calls `approveEmployeeFolder` *before* creating the employee!), Google Apps Script returns `"Forbidden: Only SuperAdmins can execute folder management actions"`, throwing `"Drive folder sync failed"` and blocking non-Super-Admin HR staff from approving, relieving, or deleting employees!
- **Remediation (`diff`)**:
```diff
--- a/GOOGLE_APPS_SCRIPT_v7.2.js
+++ b/GOOGLE_APPS_SCRIPT_v7.2.js
@@ -75,15 +75,20 @@
       var firestoreUrl = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/users/" + uid;
       var firestoreResponse = UrlFetchApp.fetch(firestoreUrl, {
         method: "get",
         headers: { "Authorization": "Bearer " + idToken },
         muteHttpExceptions: true
       });
+      if (firestoreResponse.getResponseCode() !== 200) {
+        var staffUrl = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/staff_accounts/" + uid;
+        firestoreResponse = UrlFetchApp.fetch(staffUrl, {
+          method: "get",
+          headers: { "Authorization": "Bearer " + idToken },
+          muteHttpExceptions: true
+        });
+      }
       if (firestoreResponse.getResponseCode() === 200) {
         var userDoc = JSON.parse(firestoreResponse.getContentText());
         var isDisabled = userDoc.fields && userDoc.fields.isDisabled && userDoc.fields.isDisabled.booleanValue === true;
         var isActive = userDoc.fields && userDoc.fields.isActive ? userDoc.fields.isActive.booleanValue !== false : true;
         if (isDisabled || !isActive) {
           return { isValid: false, error: "ACCOUNT_DISABLED" };
         }
         var roleId = userDoc.fields && userDoc.fields.roleId && userDoc.fields.roleId.stringValue;
-        isSuperAdmin = (!isDisabled && roleId === 'role-super-admin');
+        isSuperAdmin = (!isDisabled && !!roleId && roleId !== 'role-bgv-vendor');
       }
```

---

### `UDF-AUD-198` — **MEDIUM** | Broken Feature / `GOOGLE_APPS_SCRIPT_v7.2.js` & `employeeService.ts` Move Relieved Employees' Drive Folders to `'Blocked Employees'` Instead of `'Relieved Employees'` and Restore Rejoined/Recycle-Bin Employees' Folders to `'Pending Employees'` Instead of `'Active Employees'`
- **Target File(s)**: `GOOGLE_APPS_SCRIPT_v7.2.js` (`L12–18`, `L141–145`), `src/services/employeeService.ts` (`L2644, 2756, 2926`)
- **Root Cause & Exact Code Trace**:
  - `GOOGLE_APPS_SCRIPT_v7.2.js:15` defines `FOLDERS.RELIEVED = 'Relieved Employees'`, yet never references `FOLDERS.RELIEVED` anywhere in `doPost`!
  - In `src/services/employeeService.ts:2644`, `relieveEmployee` calls `moveEmployeeFolder(applicantName, employeeId, 'block_employee', folderName)`, which moves relieved employees into `'Blocked Employees'` (`FOLDERS.BLOCKED`).
  - Conversely, when an employee rejoins (`src/services/employeeService.ts:2756, 2926`) or is restored from the Recycle Bin (`L2568`), it calls `'restore_employee'`, which in `GOOGLE_APPS_SCRIPT_v7.2.js:142` moves the folder to `FOLDERS.PENDING` (`'Pending Employees'`) instead of `FOLDERS.ACTIVE` (`'Active Employees'`)!
- **Real-World Impact**:
  - The `'Relieved Employees'` Google Drive folder is always empty, relieved staff are mixed into `'Blocked Employees'`, and rejoined/restored active employees have their Drive folders misplaced in `'Pending Employees'`.
- **Remediation (`diff`)**:
```diff
--- a/GOOGLE_APPS_SCRIPT_v7.2.js
+++ b/GOOGLE_APPS_SCRIPT_v7.2.js
@@ -141,5 +141,6 @@
     if (data.action === 'delete_employee') return moveFolderAction(data.employeeName, data.uniqueId, FOLDERS.RECYCLE_BIN, data.folderName);
-    if (data.action === 'restore_employee') return moveFolderAction(data.employeeName, data.uniqueId, FOLDERS.PENDING, data.folderName);
+    if (data.action === 'restore_employee') return moveFolderAction(data.employeeName, data.uniqueId, (data.uniqueId && (data.uniqueId.startsWith('SUB-') || data.uniqueId.startsWith('UDF-'))) ? FOLDERS.PENDING : FOLDERS.ACTIVE, data.folderName);
+    if (data.action === 'relieve_employee') return moveFolderAction(data.employeeName, data.uniqueId, FOLDERS.RELIEVED, data.folderName);
     if (data.action === 'permanent_delete_employee') return permanentDeleteAction(data.employeeName, data.uniqueId, data.folderName);
```

---

### `UDF-AUD-199` — **MEDIUM** | Broken Feature / `GOOGLE_APPS_SCRIPT_v7.2.js` `submitToForm` Wraps Array Checkbox Values in a Nested Array (`[[...]]`), Causing `FormApp` Checkbox Sync to Fail
- **Target File(s)**: `GOOGLE_APPS_SCRIPT_v7.2.js` (`L320–321`)
- **Root Cause & Exact Code Trace**:
  - In `GOOGLE_APPS_SCRIPT_v7.2.js:320–321`:
    ```javascript
    } else if (type === FormApp.ItemType.CHECKBOX) {
      response.withItemResponse(item.asCheckboxItem().createResponse([field.value]));
    }
    ```
  - When `field.value` is already an array of strings (or a comma-separated string from `EmployeeCheckboxField`), `[field.value]` creates a nested array `[["Option 1", "Option 2"]]` (or single concatenated string `["Option 1, Option 2"]` that doesn't match individual checkbox choices), causing `asCheckboxItem().createResponse(...)` to throw an exception caught at line `325`.
- **Real-World Impact**:
  - Multi-select checkbox responses are silently dropped when syncing submissions to the Google Form via Apps Script.
- **Remediation (`diff`)**:
```diff
--- a/GOOGLE_APPS_SCRIPT_v7.2.js
+++ b/GOOGLE_APPS_SCRIPT_v7.2.js
@@ -320,3 +320,4 @@
       } else if (type === FormApp.ItemType.CHECKBOX) {
-        response.withItemResponse(item.asCheckboxItem().createResponse([field.value]));
+        var arrVal = Array.isArray(field.value) ? field.value : String(field.value).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
+        response.withItemResponse(item.asCheckboxItem().createResponse(arrVal));
       }
```

---

### `UDF-AUD-200` — **HIGH** | Broken Feature / `DataCorrectionPage.tsx` & `employeeService.ts` Call Direct Firestore `getDoc(doc(db, 'correction_requests', requestId))` Which Throws `PERMISSION_DENIED` Under `firestore.rules:218`, Breaking Data Correction Links for All Candidates & Employees
- **Target File(s)**: `components/employee/DataCorrectionPage.tsx` (`L164–172`), `src/services/employeeService.ts` (`L5012–5044`, `L5070–5074`), `firestore.rules` (`L218`)
- **Root Cause & Exact Code Trace**:
  - `firestore.rules:218` restricts `correction_requests/{requestId}` to `allow read: if isStaff();` so that guests cannot read `verificationDob` and `verificationPhone` directly from the document.
  - However, in `DataCorrectionPage.tsx:164–172`:
    ```ts
    let request = await getCorrectionRequest(token);
    if (!request) {
      try {
        const challenge = await getCorrectionChallengeClient(token);
    ```
    Because `getCorrectionRequest(token)` (`src/services/employeeService.ts:5014`) calls `await getDoc(doc(db, 'correction_requests', requestId))` **without a `try / catch` block**, Firestore throws `FirebaseError: Missing or insufficient permissions` (`PERMISSION_DENIED`), which jumps straight to the outer `catch (err)` at line `251` and renders `"An error occurred while loading this request... (Missing or insufficient permissions)"`—**never reaching `getCorrectionChallengeClient(token)` at line `167`**!
  - And even if `loadCorrectionDetails` succeeded, `submitCorrectionResponse` (`src/services/employeeService.ts:5070–5072`) ALSO calls `await getDoc(doc(db, 'correction_requests', requestId))` directly before calling `submitCorrectionServerClient`, throwing `PERMISSION_DENIED` again on submission!
- **Real-World Impact**:
  - Every single HR Data Correction link (`/correct-details?token=...`) opened by a pending candidate or active employee fails immediately on load with `"Missing or insufficient permissions"`!
- **Remediation (`diff`)**:
```diff
--- a/components/employee/DataCorrectionPage.tsx
+++ b/components/employee/DataCorrectionPage.tsx
@@ -164,9 +164,11 @@
-      let request = await getCorrectionRequest(token);
+      let request: CorrectionRequest | null = null;
+      try {
+        request = await getCorrectionRequest(token);
+      } catch (_) {}
       if (!request) {
         try {
           const challenge = await getCorrectionChallengeClient(token);
           if (challenge && challenge.request) {
             request = challenge.request;
           }
         } catch (_) {}
       }
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -5070,6 +5070,15 @@
     const requestRef = doc(db, CORRECTION_REQUESTS_COLLECTION, requestId);
-    const requestSnap = await getDoc(requestRef);
-    if (!requestSnap.exists()) throw new Error("Correction request not found");
-    const req = requestSnap.data() as CorrectionRequest;
+    let req: CorrectionRequest | null = null;
+    try {
+        const requestSnap = await getDoc(requestRef);
+        if (requestSnap.exists()) req = requestSnap.data() as CorrectionRequest;
+    } catch (_) {}
+    if (!req) {
+        const challenge = await getCorrectionChallengeClient(requestId);
+        req = challenge?.request || null;
+    }
+    if (!req) throw new Error("Correction request not found");
```

---

### `UDF-AUD-201` — **HIGH** | Broken Feature / `DataCorrectionPage.tsx` Forcibly Signs Out Active Logged-In Employees and Google Candidates on First Mount (`await auth.signOut()`)
- **Target File(s)**: `components/employee/DataCorrectionPage.tsx` (`L96–119`)
- **Root Cause & Exact Code Trace**:
  - In `components/employee/DataCorrectionPage.tsx:96–114`:
    ```ts
    const isManager = authUser && (
      authUser.id === 'super-admin' ||
      authUser.roleId === 'role-super-admin' ||
      authUser.type === 'Admin'
    );
    ...
    if (!isManager && auth.currentUser && !hasSignedOutAlready) {
      sessionStorage.setItem(storageKey, 'true');
      await auth.signOut();
      setCurrentUser(null);
    }
    ```
  - When an active employee or Google-linked candidate is already logged in and opens their correction link `/correct-details?token=...`, `!isManager` is `true`, so `DataCorrectionPage` forcibly executes `await auth.signOut()`, destroying their active session and forcing them to log in again!
- **Real-World Impact**:
  - Logged-in employees and Google candidates clicking a correction link from their dashboard or email are unexpectedly logged out of the portal.
- **Remediation (`diff`)**:
```diff
--- a/components/employee/DataCorrectionPage.tsx
+++ b/components/employee/DataCorrectionPage.tsx
@@ -107,6 +107,6 @@
-      if (!isManager && auth.currentUser && !hasSignedOutAlready) {
+      if (!isManager && auth.currentUser && auth.currentUser.isAnonymous && !hasSignedOutAlready) {
         console.log("Forcing initial sign out of stale anonymous session on correction page mount");
         sessionStorage.setItem(storageKey, 'true');
         await auth.signOut();
         setCurrentUser(null);
       }
```

---

### `UDF-AUD-202` — **MEDIUM** | Broken Feature / `DataCorrectionPage.tsx` Exempts All Image Files From `maxFileSizeMB` Validation (`if (fileSizeMB > maxMB && !isImage)`)
- **Target File(s)**: `components/employee/DataCorrectionPage.tsx` (`L645–648`)
- **Root Cause & Exact Code Trace**:
  - In `components/employee/DataCorrectionPage.tsx:645–648`:
    ```ts
    const fileSizeMB = value.size / (1024 * 1024);
    if (fileSizeMB > maxMB && !isImage) {
      return `File size must be less than ${maxMB}MB.`;
    }
    ```
  - Because of `&& !isImage`, any image file (`.jpg`, `.png`, `.webp`) completely bypasses `maxFileSizeMB` validation (unlike `EmployeeFormPage.tsx:1916` which checks `if (fileSizeMB > field.maxFileSizeMB)` for all files).
- **Real-World Impact**:
  - Users can select arbitrarily large raw image files (e.g. 50 MB+) on the Data Correction page without triggering the configured field size limit.
- **Remediation (`diff`)**:
```diff
--- a/components/employee/DataCorrectionPage.tsx
+++ b/components/employee/DataCorrectionPage.tsx
@@ -645,4 +645,4 @@
         const fileSizeMB = value.size / (1024 * 1024);
-        if (fileSizeMB > maxMB && !isImage) {
+        if (fileSizeMB > maxMB) {
           return `File size must be less than ${maxMB}MB.`;
         }
```

---

### `UDF-AUD-203` — **HIGH** | Multi-Tenant Isolation & Caching Bug / `src/services/employeeService.ts` `getEmployeeLookupMap` Shares a Global `_empLookupCache` Across All `allowedSiteIds` Scopes and Truncates `allowedSiteIds.slice(0, 10)`
- **Target File(s)**: `src/services/employeeService.ts` (`L4223–4263`)
- **Root Cause & Exact Code Trace**:
  - In `src/services/employeeService.ts:4223–4263`:
    ```ts
    let _empLookupCache: { timestamp: number; data: Record<string, ...> } | null = null;
    export const getEmployeeLookupMap = async (formSections: FormSection[], allowedSiteIds?: string[]) => {
      if (_empLookupCache && (Date.now() - _empLookupCache.timestamp < 60000)) {
        return _empLookupCache.data;
      }
    ```
  - `_empLookupCache` does not store the `allowedSiteIds` key that produced the cache, and line `4243` uses `where("currentSiteId", "in", allowedSiteIds.slice(0, 10))` without chunking across >10 sites.
- **Real-World Impact**:
  - Switching accounts or calling `getEmployeeLookupMap` with different `allowedSiteIds` within 60 seconds returns a stale cross-scope cache, and regional managers overseeing >10 sites have all employees from their 11th+ site omitted from the lookup map.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4223,7 +4223,8 @@
-let _empLookupCache: { timestamp: number; data: Record<string, { name: string, siteName: string, id: string, siteId?: string }> } | null = null;
+let _empLookupCache: { timestamp: number; scopeKey: string; data: Record<string, { name: string, siteName: string, id: string, siteId?: string }> } | null = null;
 
 export const getEmployeeLookupMap = async (formSections: FormSection[], allowedSiteIds?: string[]) => {
-    if (_empLookupCache && (Date.now() - _empLookupCache.timestamp < 60000)) {
+    const scopeKey = allowedSiteIds ? [...allowedSiteIds].sort().join(',') : 'ALL';
+    if (_empLookupCache && _empLookupCache.scopeKey === scopeKey && (Date.now() - _empLookupCache.timestamp < 60000)) {
         return _empLookupCache.data;
     }
```

---

### `UDF-AUD-204` — **HIGH** | Broken Feature / `src/services/employeeService.ts` `getSiteHeadcounts` Queries `where("data.<unitFieldId>", "==", site.name)` While `EmployeeFormPage.tsx:2436` Stores `site.id` and Approved Employees Store `currentSiteId`, Returning `0` Headcount Across Sites
- **Target File(s)**: `src/services/employeeService.ts` (`L4194–4220`)
- **Root Cause & Exact Code Trace**:
  - In `src/services/employeeService.ts:4205–4211` (`getSiteHeadcounts`):
    ```ts
    const q = query(
      collection(db, EMPLOYEES_COLLECTION),
      where("isActive", "==", true),
      where(`data.${unitField.id}`, "==", site.name)
    );
    const snapshot = await getCountFromServer(q);
    counts[site.name] = snapshot.data().count;
    ```
  - However:
    1. `approveOnboardingServer` (`functions/index.js:5350–5365`) only writes `profileData` (not `data`) and top-level `currentSiteId` (`site.id`) and `siteName` (`site.name`) on `employees/{id}`.
    2. Even when `data` exists, `EmployeeFormPage.tsx:2436` stores `site.id` in `formData[unitField.id]`.
    3. Moreover, for site-scoped staff without `EMPLOYEES_VIEW_SCOPE_ALL`, `firestore.rules:114` requires `resource.data.currentSiteId in getManagedSites()`, so querying `where("data.<unitFieldId>", "==", site.name)` without constraining `currentSiteId` is rejected with `PERMISSION_DENIED`!
- **Real-World Impact**:
  - The Admin Analytics "Headcount by Site" chart returns `0` for every site!
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4205,6 +4205,6 @@
             const q = query(
                 collection(db, EMPLOYEES_COLLECTION),
                 where("isActive", "==", true),
-                where(`data.${unitField.id}`, "==", site.name)
+                where("currentSiteId", "==", site.id)
             );
```

---

### `UDF-AUD-205` — **HIGH** | Broken Feature / `src/services/employeeService.ts` `getDashboardAnalytics` Runs an Unscoped Collection-Wide Query on `employees` When `allowedSiteIds` Is Present, Failing `firestore.rules:114` (`PERMISSION_DENIED`) and Returning `0` Recent Hires for Site-Scoped Staff
- **Target File(s)**: `src/services/employeeService.ts` (`L4314–4378`)
- **Root Cause & Exact Code Trace**:
  - In `getDashboardAnalytics` (`src/services/employeeService.ts:4323–4331`), when `allowedSiteIds` is provided (a site-scoped staff user):
    ```ts
    const hiresQuery = query(
      collection(db, EMPLOYEES_COLLECTION),
      where("joiningDate", ">=", thirtyDaysAgo.toISOString())
    );
    const snap = await getDocs(hiresQuery);
    recentHires = snap.docs.filter(d => allowedSiteIds.includes(d.data().currentSiteId)).length;
    ```
  - Because `hiresQuery` has no `where("currentSiteId", "in", chunk)` constraint, `firestore.rules:114` immediately rejects the query with `PERMISSION_DENIED` for any site-scoped staff member, causing `catch (e)` at line `4333` to swallow the error and leave `recentHires = 0`!
- **Real-World Impact**:
  - Site-scoped HR staff and supervisors always see `0` for "Recent Hires (Last 30 Days)" on the Analytics Dashboard.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4323,9 +4323,13 @@
                 } else {
-                    const hiresQuery = query(
-                        collection(db, EMPLOYEES_COLLECTION),
-                        where("joiningDate", ">=", thirtyDaysAgo.toISOString())
-                    );
-                    const { getDocs } = await import('firebase/firestore');
-                    const snap = await getDocs(hiresQuery);
-                    recentHires = snap.docs.filter(d => allowedSiteIds.includes(d.data().currentSiteId)).length;
+                    const chunks = chunkArray(allowedSiteIds, 10);
+                    for (const chunk of chunks) {
+                        const hiresQuery = query(
+                            collection(db, EMPLOYEES_COLLECTION),
+                            where("currentSiteId", "in", chunk),
+                            where("joiningDate", ">=", thirtyDaysAgo.toISOString())
+                        );
+                        const hiresSnap = await getCountFromServer(hiresQuery);
+                        recentHires += hiresSnap.data().count;
+                    }
                 }
```

---

### `UDF-AUD-206` — **HIGH** | Broken Feature / `src/services/employeeService.ts` `getPaginatedSubmissions` Runs an Unscoped Collection-Wide Query When `hasSiteFilter` Is True, Triggering `PERMISSION_DENIED` in `firestore.rules:152` for All Site-Scoped Staff
- **Target File(s)**: `src/services/employeeService.ts` (`L1160–1217`), `firestore.rules` (`L152–157`)
- **Root Cause & Exact Code Trace**:
  - In `getPaginatedSubmissions` (`src/services/employeeService.ts:1161–1171`):
    ```ts
    const hasSiteFilter = siteFieldId && siteValue && siteValue !== 'ALL';
    const hasSearchFilter = searchTerm && searchTerm.trim() !== '';

    if (hasSiteFilter || hasSearchFilter) {
      const baseQuery = query(
        collection(db, SUBMISSIONS_COLLECTION),
        where("status", "==", status),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(baseQuery);
    ```
  - Whenever a site-scoped staff user (without `SUBMISSIONS_VIEW_SCOPE_ALL`) loads the Submissions table, `siteValue` is their array of `allowedSiteIds`, so `hasSiteFilter` is `true`. `getPaginatedSubmissions` executes `baseQuery` across **all submissions in the entire database** without `where("siteId", "in", ...)`!
  - Under `firestore.rules:152–157`, a staff user without `SUBMISSIONS_VIEW_SCOPE_ALL` can only read submissions where `canManageSite(resource.data.siteId)`. Firestore rejects `getDocs(baseQuery)` with `Missing or insufficient permissions` (`PERMISSION_DENIED`).
- **Real-World Impact**:
  - Paginated submission loading fails with `PERMISSION_DENIED` for every site-scoped staff member and supervisor!
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -1165,7 +1165,16 @@
-        const baseQuery = query(
-            collection(db, SUBMISSIONS_COLLECTION),
-            where("status", "==", status),
-            orderBy("timestamp", "desc")
-        );
-        const snapshot = await getDocs(baseQuery);
+        const allowedSites = hasSiteFilter ? (Array.isArray(siteValue) ? siteValue : [siteValue]) : null;
+        let rawDocs: QueryDocumentSnapshot[] = [];
+        if (allowedSites && allowedSites.length > 0) {
+            for (const chunk of chunkArray(allowedSites, 10)) {
+                const chunkQ = query(
+                    collection(db, SUBMISSIONS_COLLECTION),
+                    where("status", "==", status),
+                    where("siteId", "in", chunk)
+                );
+                const snap = await getDocs(chunkQ);
+                rawDocs.push(...snap.docs);
+            }
+        } else {
+            const snap = await getDocs(query(collection(db, SUBMISSIONS_COLLECTION), where("status", "==", status), orderBy("timestamp", "desc")));
+            rawDocs = snap.docs;
+        }
```

---

### `UDF-AUD-207` — **HIGH** | Broken Feature / `src/services/employeeService.ts` `getPaginatedEmployees` Uses `where("needsProfileCompletion", "in", [false, null])` Which Rejects Documents With Missing Field/Null in Firestore, and Its Catch Fallback Drops Site Filters (`PERMISSION_DENIED`)
- **Target File(s)**: `src/services/employeeService.ts` (`L1310–1315`, `L1400–1422`)
- **Root Cause & Exact Code Trace**:
  - In `getPaginatedEmployees` (`src/services/employeeService.ts:1310–1315`):
    ```ts
    if (viewMode === 'ACTIVE') {
      constraints.push(where("isActive", "==", true));
      if (!isRestrictedSites && !hasSiteFilter) {
        constraints.push(where("needsProfileCompletion", "in", [false, null]));
      }
    }
    ```
  - In Cloud Firestore, `where(field, "in", [false, null])` **never matches documents where `needsProfileCompletion` is omitted/undefined**, and passing `null` inside an `in` array is unsupported by Firestore index evaluation.
  - Furthermore, when a compound query fails and enters `catch (err)` (`L1400–1422`), the fallback query runs `where("isActive", "==", ...)` **without any `currentSiteId` or `assignedSiteIds` constraint**, which immediately throws `PERMISSION_DENIED` under `firestore.rules:114` for all site-scoped staff!
- **Real-World Impact**:
  - Bulk-imported or legacy active employees without an explicit `needsProfileCompletion: false` boolean field are invisible in the `ACTIVE` view for Super Admins, and fallback queries crash with `PERMISSION_DENIED` for site-scoped staff.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -1310,6 +1310,3 @@
     if (viewMode === 'ACTIVE') {
         constraints.push(where("isActive", "==", true));
-        if (!isRestrictedSites && !hasSiteFilter) {
-            constraints.push(where("needsProfileCompletion", "in", [false, null]));
-        }
     }
```

---

### `UDF-AUD-208` — **HIGH** | Multi-Tenant Isolation & Broken Feature / `src/services/employeeService.ts` `searchAllEmployees` Executes 8 Unscoped Queries Without `allowedSiteIds` (Failing `firestore.rules` for Site-Scoped Staff) and Checks Non-Existent `data.isDeleted` Instead of `data.deletedAt`
- **Target File(s)**: `src/services/employeeService.ts` (`L4632–4754`)
- **Root Cause & Exact Code Trace**:
  - `searchAllEmployees` (`src/services/employeeService.ts:4632–4754`, used by `EmployeeTimelinePage.tsx`) executes 8 collection-wide queries across `employees` and `onboarding_submissions` without any `currentSiteId` or `siteId` filter. For any site-scoped staff user, every one of the 8 queries fails `firestore.rules` with `PERMISSION_DENIED` (caught and silenced at `L4673–4676`), returning `[]`.
  - Additionally, lines `4701` and `4723` check `data.isDeleted ? 'Recycle Bin' : data.isRelieved ? 'Relieved' : 'Active'`, whereas soft deletion in `employeeService.ts:2477` sets `deletedAt` and `isActive: false` (never `isDeleted: true`), so soft-deleted employees are labeled `"Active"`.
- **Real-World Impact**:
  - Employee search in Timeline is completely non-functional for site-scoped staff and mislabels soft-deleted Recycle Bin records as `"Active"` for Super Admins.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4700,3 +4700,3 @@
                 status: isSubmission 
                     ? `Submission (${data.status || 'Pending'})` 
-                    : (data.isDeleted ? 'Recycle Bin' : data.isRelieved ? 'Relieved' : 'Active'),
+                    : ((data.deletedAt || data.isDeleted) ? 'Recycle Bin' : data.isRelieved ? 'Relieved' : 'Active'),
```

---

### `UDF-AUD-209` — **HIGH** | Broken Feature / `src/services/employeeService.ts` `submitEmployeeForm` Attempts Direct Client Update on `referral_invites` (`PERMISSION_DENIED`) and Double-Increments `joined` on Both Submission and Approval
- **Target File(s)**: `src/services/employeeService.ts` (`L1035–1043`, `L1950–1957`), `functions/index.js` (`L5421`)
- **Root Cause & Exact Code Trace**:
  - In `submitEmployeeForm` (`src/services/employeeService.ts:1035–1043`):
    ```ts
    if (referralInviteId) {
      const inviteRef = doc(db, 'referral_invites', referralInviteId);
      await updateDoc(inviteRef, { joined: increment(1) });
    }
    ```
    1. For public candidates, direct `updateDoc` on `referral_invites` is denied by `firestore.rules:232` (`allow update: if isStaff();`) instead of calling `incrementReferralJoined(referralInviteId)` (`recordReferralMetricServer` at `L5457`)!
    2. Even worse, `onSubmissionCreated` (`functions/index.js`) and `approveOnboardingServer` (`functions/index.js:5421`) / `updateSubmissionStatus` (`src/services/employeeService.ts:1953`) ALSO increment `joined: increment(1)`! If an authenticated staff user tests or submits a form, or if `recordReferralMetricServer` is used on submission AND `approveOnboardingServer` increments `joined` on approval, `joined` is incremented twice for a single candidate.
- **Real-World Impact**:
  - Single-use referral links (`isReusable: false`, which expire when `joined >= 1` in `EmployeeFormPage.tsx:244`) either fail to retire on candidate submission (because direct `updateDoc` throws `PERMISSION_DENIED`) or double-count `joined` upon approval.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -1035,8 +1035,6 @@
         if (referralInviteId) {
             try {
-                const inviteRef = doc(db, 'referral_invites', referralInviteId);
-                await updateDoc(inviteRef, { joined: increment(1) });
+                await incrementReferralJoined(referralInviteId);
                 log.log(`[SUBMIT] Successfully incremented joined count for referral invite ${referralInviteId}`);
             } catch (inviteUpdateErr) {
```

---

### `UDF-AUD-210` — **HIGH** | Broken Feature / `src/services/employeeService.ts` `getEmployeeTimeline` Queries `correction_requests` by Non-Existent Field `'submissionId'` Instead of `'targetId'`, Always Returning 0 Correction Request Events
- **Target File(s)**: `src/services/employeeService.ts` (`L4589–4610`)
- **Root Cause & Exact Code Trace**:
  - In `getEmployeeTimeline` (`src/services/employeeService.ts:4589–4591`):
    ```ts
    const corrPromises = relatedIds.map(rid => 
      getDocs(query(collection(db, 'correction_requests'), where('submissionId', '==', rid))).catch(() => ({ forEach: () => {} } as any))
    );
    ```
  - And at line `4605`:
    ```ts
    description: `Correction link generated for fields: ${(data.targetFieldLabels || []).join(', ') || 'Profile data'}. Status: ${data.status || 'Pending'}`,
    ```
  - However, `createCorrectionRequest` (`src/services/employeeService.ts:4986–5001`) stores the employee/submission ID in **`targetId`** (never `submissionId`) and stores field definitions in **`requestedFieldDefinitions`** (never `targetFieldLabels`)!
- **Real-World Impact**:
  - Data Correction Request events never appear on any employee's or applicant's Timeline!
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4589,3 +4589,3 @@
         const corrPromises = relatedIds.map(rid => 
-            getDocs(query(collection(db, 'correction_requests'), where('submissionId', '==', rid))).catch(() => ({ forEach: () => {} } as any))
+            getDocs(query(collection(db, 'correction_requests'), where('targetId', '==', rid))).catch(() => ({ forEach: () => {} } as any))
         );
```

---

### `UDF-AUD-211` — **HIGH** | Broken Feature / `src/services/employeeService.ts` `getEmployeeTimeline` Queries `leave_requests` and `disciplinary_actions` Only by `where('employeeId', '==', rid)`, Failing `firestore.rules` (`PERMISSION_DENIED`) for Google-Authenticated Employees
- **Target File(s)**: `src/services/employeeService.ts` (`L4538–4585`), `firestore.rules` (`L173, 199`)
- **Root Cause & Exact Code Trace**:
  - When a Google-authenticated employee views their own timeline (`components/employee/EmployeeTimelinePage.tsx`), their `request.auth.uid` is their Google UID (e.g. `gUid123`), while their `employeeId` is `HY100123`.
  - `getEmployeeTimeline` (`src/services/employeeService.ts:4538, 4565`) queries:
    ```ts
    getDocs(query(collection(db, LEAVE_REQ_COL), where('employeeId', '==', rid)))
    getDocs(query(collection(db, 'disciplinary_actions'), where('employeeId', '==', rid)))
    ```
  - Under `firestore.rules:173` (`leave_requests`) and `199` (`disciplinary_actions`), an employee is only permitted to read documents where `resource.data.employeeId == request.auth.uid || resource.data.uid == request.auth.uid`. When `rid` is `'HY100123'` and `request.auth.uid` is `'gUid123'`, Firestore rejects `where('employeeId', '==', 'HY100123')` with `PERMISSION_DENIED` because the query does not filter by `where('uid', '==', request.auth.uid)`!
- **Real-World Impact**:
  - Google-authenticated employees see **0 leave requests and 0 disciplinary actions** on their Employee Timeline page.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4538,3 +4538,6 @@
-        const leavePromises = relatedIds.map(rid => 
-            getDocs(query(collection(db, LEAVE_REQ_COL), where('employeeId', '==', rid))).catch(() => ({ forEach: () => {} } as any))
-        );
+        const leavePromises = [
+            ...relatedIds.map(rid => getDocs(query(collection(db, LEAVE_REQ_COL), where('employeeId', '==', rid))).catch(() => ({ forEach: () => {} } as any))),
+            ...(auth.currentUser?.uid ? [getDocs(query(collection(db, LEAVE_REQ_COL), where('uid', '==', auth.currentUser.uid))).catch(() => ({ forEach: () => {} } as any))] : [])
+        ];
```

---

### `UDF-AUD-212` — **HIGH** | Security & Data Corruption / `src/services/employeeService.ts` `subscribeToEmployeeByUid` Queries `where("linkedGoogleEmail", "==", "")` When `auth.currentUser?.email` Is Empty, Matching Manual Employees With `linkedGoogleEmail: ""` and Overwriting Their `uid`
- **Target File(s)**: `src/services/employeeService.ts` (`L1893`, `L2220`, `L2269–2282`)
- **Root Cause & Exact Code Trace**:
  - `updateSubmissionStatus` (`src/services/employeeService.ts:1893`) creates every manual employee document with `linkedGoogleEmail: data.linkedGoogleEmail || ''` (an empty string `""`).
  - In `subscribeToEmployeeByUid` (`src/services/employeeService.ts:2220` and `2269–2276`):
    ```ts
    const qByEmail = query(collection(db, EMPLOYEES_COLLECTION), where("linkedGoogleEmail", "==", auth.currentUser?.email || ""));
    ...
    const unsubEmail = onSnapshot(qByEmail, (snap) => {
      if (!snap.empty) {
        emailEmp = { id: snap.docs[0].id, ...snap.docs[0].data() } as unknown as FirestoreEmployee;
        const docRefTarget = snap.docs[0].ref;
        if (snap.docs[0].data().uid !== uid) {
          updateDoc(docRefTarget, { uid }).catch(() => {});
        }
      }
    ```
  - Whenever `auth.currentUser?.email` is `null` or `""` (which is true for all custom-token manual logins and anonymous sessions!), `qByEmail` queries `where("linkedGoogleEmail", "==", "")`! If the caller has read access or matches a document with `linkedGoogleEmail == ""`, `emailEmp` resolves to an unrelated manual employee and attempts to overwrite their `uid` field!
- **Real-World Impact**:
  - `subscribeToEmployeeByUid` never guards against an empty email before subscribing to `qByEmail`, risking cross-employee profile binding and unnecessary failed/unauthorized Firestore queries on every manual login.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -2220,3 +2220,4 @@
-    const qByEmail = query(collection(db, EMPLOYEES_COLLECTION), where("linkedGoogleEmail", "==", auth.currentUser?.email || ""));
+    const userEmail = auth.currentUser?.email?.trim();
+    const qByEmail = userEmail ? query(collection(db, EMPLOYEES_COLLECTION), where("linkedGoogleEmail", "==", userEmail)) : null;
```

---

### `UDF-AUD-213` — **HIGH** | Broken Feature / `src/services/employeeService.ts` `revertSubmissionWorkflow` Moves Files From `employees/${empId}` Instead of `employees/${submissionId}/joining`, Fails to Rewrite `formData` Storage Paths Back to `onboarding/...`, and Leaves Drive Folder in `'Active Employees'`
- **Target File(s)**: `src/services/employeeService.ts` (`L2359–2386`)
- **Root Cause & Exact Code Trace**:
  - When an approved submission is reverted via `revertSubmissionWorkflow` (`src/services/employeeService.ts:2359–2386`):
    1. Line `2362` deletes `employees/{id}`.
    2. Line `2370` tries to move files from `employees/${empId}` to `onboarding/${joinerUid}`, even though client approval (`L1832`) moved them to `employees/${submissionId}/joining` (and server approval `functions/index.js:5316` moved them to `employees/${empId}/joining`), resulting in `onboarding/${joinerUid}/joining/...` double-nested paths.
    3. It **never rewrites the `storagePath` references inside `onboarding_submissions/{submissionId}.formData`** back to `onboarding/...`!
    4. Line `2381` calls `renameEmployeeFolder(currentFolderName, targetFolderName)`, which in `GOOGLE_APPS_SCRIPT_v7.2.js:234` only renames the folder in place inside `'Active Employees'` without moving it back to `'Pending Employees'`.
- **Real-World Impact**:
  - Reverting an approved submission back to review breaks all document preview links on the reverted submission and leaves its Drive folder inside `'Active Employees'`.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -2370,5 +2370,6 @@
-                const currentStoragePath = `employees/${empId}`;
+                const currentStoragePath = `employees/${empId}/joining`;
                 const targetStoragePath = `onboarding/${joinerUid}`;
                 await moveStorageFiles(currentStoragePath, targetStoragePath);
+                await moveEmployeeFolder(employeeName, submissionId, 'restore_employee', currentFolderName);
```

---

### `UDF-AUD-214` — **MEDIUM** | Broken Feature / `src/services/employeeService.ts` `restoreEmployee` Unconditionally Resets `isRelieved: false` on Previously Relieved Employees and Moves Active Employees' Drive Folders to `'Pending Employees'`
- **Target File(s)**: `src/services/employeeService.ts` (`L2517–2573`)
- **Root Cause & Exact Code Trace**:
  - In `restoreEmployee` (`src/services/employeeService.ts:2536–2543`):
    ```ts
    if (empSnap.exists()) {
      await updateDoc(empDocRef, {
        deletedAt: deleteField(),
        isActive: true,
        isBlocked: false,
        isRelieved: false
      });
    }
    ```
  - If a **relieved** ex-employee (`isRelieved: true, isActive: false`) was soft-deleted to the Recycle Bin and then restored, `restoreEmployee` unconditionally overwrites `isRelieved: false` and `isActive: true`, reactivating the ex-employee as a live active employee without a rejoin workflow!
- **Real-World Impact**:
  - Restoring a soft-deleted ex-employee from the Recycle Bin silently converts them into an active current employee.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -2536,8 +2536,8 @@
     if (empSnap.exists()) {
+        const wasRelieved = Boolean(empData?.isRelieved || empData?.relievingDate);
         await updateDoc(empDocRef, {
             deletedAt: deleteField(),
-            isActive: true,
+            isActive: !wasRelieved,
             isBlocked: false,
-            isRelieved: false
+            isRelieved: wasRelieved
         });
     }
```

---

### `UDF-AUD-215` — **HIGH** | Broken Feature / `src/services/employeeService.ts` `adminUpdateEmployeeEmail` Only Updates `email`, `profileData.personalDetails.email`, and `data.email`—Leaving the Form Builder Email UUID Key and `onboarding_submissions` Unchanged
- **Target File(s)**: `src/services/employeeService.ts` (`L4757–4774`)
- **Root Cause & Exact Code Trace**:
  - In `adminUpdateEmployeeEmail` (`src/services/employeeService.ts:4765–4769`):
    ```ts
    await updateDoc(empRef, {
      email: newEmail,
      'profileData.personalDetails.email': newEmail,
      'data.email': newEmail
    });
    ```
  - However, Form Builder stores field values in flat UUID keys inside `profileData` and `data` (never under nested `personalDetails.email`), and `getApplicantEmail(data, sections)` searches `sections` for a field whose label includes `'email'`. Because `adminUpdateEmployeeEmail` does not update the email field UUID in `profileData`/`data` or sync to `onboarding_submissions`, the profile view and `checkEmailUniquenessGlobal` still see the old email!
- **Real-World Impact**:
  - Updating an employee's primary email from the Admin Auth Control modal leaves their displayed profile email and `onboarding_submissions` email stale.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4765,5 +4765,6 @@
         await updateDoc(empRef, {
             email: newEmail,
+            linkedGoogleEmail: newEmail,
             'profileData.personalDetails.email': newEmail,
             'data.email': newEmail
         });
```

---

### `UDF-AUD-216` — **HIGH** | Broken Feature / `App.tsx` & `EmployeeFormPage.tsx` `handleFormSubmit` Returns `undefined` When `checkWritesBlock()` Is Active (Crashing `result.success` With `TypeError`), Swallows `hashCandidatePassword` Failures, and Pollutes `formData` With `draftId`
- **Target File(s)**: `App.tsx` (`L1200, 1233`), `components/EmployeeFormPage.tsx` (`L2155–2180`)
- **Root Cause & Exact Code Trace**:
  1. In `App.tsx:1200`: `if (checkWritesBlock()) return;` returns `undefined` instead of `{ success: false, error: 'System is in read-only maintenance mode.' }`. In `EmployeeFormPage.tsx:2177–2179`, `const result = await onFormSubmit(...); if (result.success)` throws an uncaught `TypeError: Cannot read properties of undefined (reading 'success')`, leaving `showSubmissionProgress` permanently stuck on screen!
  2. In `EmployeeFormPage.tsx:2157–2164`, if `hashCandidatePassword(password)` throws an error, the `catch (err)` block logs and ignores the error, submitting the form with `hashedPasswordToPass = undefined` (`isDefaultPassword: true`) and silently discarding the candidate's chosen password!
  3. In `EmployeeFormPage.tsx:2175`, `draftId: draftIdToPass` is spread into `submissionData` (`formData`), and neither `App.tsx:1233` nor `submitEmployeeForm` (`src/services/employeeService.ts:969`) deletes `processedFormData.draftId` before writing to Firestore.
- **Real-World Impact**:
  - Submitting during read-only maintenance freezes the candidate UI on the progress modal; transient password-hashing failures silently discard the candidate's chosen password; and every submission from a saved draft persists an internal `draftId` property inside `formData`.
- **Remediation (`diff`)**:
```diff
--- a/App.tsx
+++ b/App.tsx
@@ -1200,2 +1200,3 @@
-    if (checkWritesBlock()) return;
+    if (checkWritesBlock()) return { success: false, error: 'Portal writes are temporarily disabled for maintenance.' };
@@ -1233,2 +1234,3 @@
       const draftIdToClean = (processedFormData as any)?.draftId || activeDraft?.id;
+      delete (processedFormData as any).draftId;
```

---

### `UDF-AUD-217` — **MEDIUM** | Broken Feature / `EmployeeFormPage.tsx` Review Step Displays Raw Site ID (`"site-1"`) Instead of Site Name for `"Unit or Facility"` and Displays `"Yes"` Instead of Selected Options for Multi-Checkbox (`FieldType.CHECKBOX`) Fields
- **Target File(s)**: `components/EmployeeFormPage.tsx` (`L3096–3111`)
- **Root Cause & Exact Code Trace**:
  - On the Review Details step (`components/EmployeeFormPage.tsx:3096–3111`):
    ```ts
    if (val !== undefined && val !== null && val !== '') {
      if (field.type === FieldType.FILE_UPLOAD) {
        ...
      } else if (field.type === FieldType.CHECKBOX) {
        displayValue = val ? 'Yes' : 'No';
      } else if (Array.isArray(val)) {
        displayValue = val.join(', ');
      } else {
        displayValue = String(val);
      }
    }
    ```
  - Two distinct bugs occur here:
    1. For the `"Unit or Facility"` field (`isSiteField(field)`), `formData[field.id]` stores the internal `site.id` (e.g. `"site-1"`), which is displayed raw instead of resolving the site's human-readable `site.name`!
    2. `EmployeeCheckboxField` stores selected checkbox options as an array `string[]` (e.g. `["English", "Hindi"]`, or `[]` when all options are unchecked). Because `else if (field.type === FieldType.CHECKBOX)` runs **before** `else if (Array.isArray(val))`, and because `Boolean([]) === true` in JavaScript, every `FieldType.CHECKBOX` field displays **`"Yes"`** instead of `"English, Hindi"` (and even an empty array `[]` displays **`"Yes"`**!).
- **Real-World Impact**:
  - Candidates reviewing their application before final submission see an internal database ID (`"site-1"`) for their Unit/Facility and `"Yes"` instead of their selected checkbox choices.
- **Remediation (`diff`)**:
```diff
--- a/components/EmployeeFormPage.tsx
+++ b/components/EmployeeFormPage.tsx
@@ -3104,7 +3104,10 @@
+                          } else if (Array.isArray(val)) {
+                            displayValue = val.length > 0 ? val.join(', ') : '—';
                           } else if (field.type === FieldType.CHECKBOX) {
                             displayValue = val ? 'Yes' : 'No';
-                          } else if (Array.isArray(val)) {
-                            displayValue = val.join(', ');
+                          } else if (isSiteField(field)) {
+                            const matchedSite = sites.find(s => s.id === val || s.name === val);
+                            displayValue = matchedSite ? matchedSite.name : String(val);
                           } else {
                             displayValue = String(val);
                           }
```

---

### `UDF-AUD-218` — **MEDIUM** | Broken Feature / `EmployeeFormPage.tsx` `handleNextStep` Reads Stale `formErrors` State Immediately After `validateStepFields(currentStep)` Calls `setFormErrors`, Failing to Scroll to the First Validation Error
- **Target File(s)**: `components/EmployeeFormPage.tsx` (`L2045–2075`)
- **Root Cause & Exact Code Trace**:
  - In `components/EmployeeFormPage.tsx:2045–2075`:
    ```ts
    const validateStepFields = useCallback((stepIndex: number): boolean => {
      const errors: Record<string, string> = {};
      ...
      setFormErrors(prev => ({ ...prev, ...errors }));
      return Object.keys(errors).length === 0;
    }, ...);

    const handleNextStep = () => {
      if (validateStepFields(currentStep)) {
        ...
      } else {
        const firstErrorId = Object.keys(formErrors)[0];
        if (firstErrorId) {
          document.getElementById(firstErrorId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };
    ```
  - Because `setFormErrors` is asynchronous in React, `formErrors` inside `handleNextStep` still holds the *previous* render's state (`{}`) on the first click of `"Next"`, so `firstErrorId` is `undefined` and the page never scrolls to the offending field!
- **Real-World Impact**:
  - On long mobile form sections, clicking `"Next"` with a missing mandatory field at the top of the section fails to scroll the candidate to the error field on the first tap.
- **Remediation (`diff`)**:
```diff
--- a/components/EmployeeFormPage.tsx
+++ b/components/EmployeeFormPage.tsx
@@ -2058,3 +2058,7 @@
     setFormErrors(prev => ({ ...prev, ...errors }));
+    const firstErrId = Object.keys(errors)[0];
+    if (firstErrId) {
+      setTimeout(() => document.getElementById(firstErrId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
+    }
     return Object.keys(errors).length === 0;
```

---

### `UDF-AUD-219` — **MEDIUM** | Broken Feature / `src/services/employeeService.ts` `verifyEmployeeLogin` Attempts Direct Client `updateDoc` on `onboarding_submissions` (`PERMISSION_DENIED`)
- **Target File(s)**: `src/services/employeeService.ts` (`L4143–4192`), `firestore.rules` (`L158`)
- **Root Cause & Exact Code Trace**:
  - In `verifyEmployeeLogin` (`src/services/employeeService.ts:4158–4161`):
    ```ts
    if (!snapSub.empty) {
      const doc = snapSub.docs[0];
      if (uid) await updateDoc(doc.ref, { uid });
    ```
  - Under `firestore.rules:158`, `onboarding_submissions` only allows updates by `isStaff()`, or when `resource.data.activeCorrectionToken != null`, or when `status in ['Rejected', 'Correction Requested']`. For an `"Approved"` submission (`where("status", "==", "Approved")` at `L4154`), `await updateDoc(doc.ref, { uid })` throws `PERMISSION_DENIED`, which jumps into `catch (e)` at line `4188` and returns `null` (failing the login)!
- **Real-World Impact**:
  - Any call to `verifyEmployeeLogin` with a `uid` argument throws `PERMISSION_DENIED` at line `4160` and returns `null` even after `verifyEmployeePassword` succeeded.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -4159,3 +4159,3 @@
                 const doc = snapSub.docs[0];
-                if (uid) await updateDoc(doc.ref, { uid });
+                if (uid) await updateDoc(doc.ref, { uid }).catch(() => {});
```

---

### `UDF-AUD-220` — **MEDIUM** | Broken Feature / `src/services/employeeService.ts` `getEmployeeRecordCounts` Hardcodes `if (ctx.submissionId) return 1;` Without Verifying Whether `onboarding_submissions/{submissionId}` Exists
- **Target File(s)**: `src/services/employeeService.ts` (`L3628–3632`)
- **Root Cause & Exact Code Trace**:
  - In `getEmployeeRecordCounts` (`src/services/employeeService.ts:3628–3632`):
    ```ts
    // 13. Onboarding Submissions
    (async () => {
      if (ctx.submissionId) return 1;
      return countUniqueMatchingDocs(SUBMISSIONS_COLLECTION, ['employeeId', 'linkedUid']);
    })(),
    ```
  - When `employees/{id}` has a legacy `submissionId` field whose `onboarding_submissions/{submissionId}` document was already deleted (or never existed), `ctx.submissionId` is still populated from `data.submissionId` (`L3334, 3355`), so `getEmployeeRecordCounts` unconditionally returns `1` without checking `getDoc(doc(db, SUBMISSIONS_COLLECTION, ctx.submissionId))`.
- **Real-World Impact**:
  - The Permanent Delete impact summary modal displays `"1 Onboarding Submission"` even when the submission document no longer exists in Firestore.
- **Remediation (`diff`)**:
```diff
--- a/src/services/employeeService.ts
+++ b/src/services/employeeService.ts
@@ -3629,4 +3629,7 @@
         (async () => {
-            if (ctx.submissionId) return 1;
+            if (ctx.submissionId) {
+                const snap = await getDoc(doc(db, SUBMISSIONS_COLLECTION, ctx.submissionId)).catch(() => null);
+                if (snap && snap.exists()) return 1;
+            }
             return countUniqueMatchingDocs(SUBMISSIONS_COLLECTION, ['employeeId', 'linkedUid']);
         })(),
```

### `UDF-AUD-221` — **CRITICAL** | Security Vulnerability / `selfLinkGoogleAccount` trusts raw `googleUid` and `email` without verifying `googleIdToken` when omitted.
- **Target File(s)**: `functions/index.js` (`functions/index.js:1488–1505`)
- **Root Cause & Exact Code Trace**:
  - In `selfLinkGoogleAccount`, `idToken` verification (`admin.auth().verifyIdToken(googleIdToken)`) is only executed inside `if (googleIdToken)`. When an attacker omits `googleIdToken`, the handler directly accepts caller-supplied `googleUid` and `email`.
- **Real-World Impact**:
  - Any caller who knows an employee ID can bind their own attacker-controlled Google UID/email to the target employee record and hijack the account via Google SSO.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1488,6 +1488,9 @@
+    if (!googleIdToken) {
+        throw new functions.https.HttpsError('invalid-argument', 'Verified Google ID token is required.');
+    }
     const ticket = await admin.auth().verifyIdToken(googleIdToken);
```

### `UDF-AUD-222` — **HIGH** | Security Vulnerability / `employeeGoogleLogin` omits `isDisabled === true`, `status === 'relieved'`, and `status === 'terminated'` checks.
- **Target File(s)**: `functions/index.js` (`functions/index.js:616–626`)
- **Root Cause & Exact Code Trace**:
  - Unlike `employeeLogin` (`L725`), `employeeGoogleLogin` (`L620–621`) only checks `isActive === false || isRelieved === true || isBlocked === true || !!deletedAt` and ignores `isDisabled === true` and `status === 'relieved'` / `'terminated'`.
- **Real-World Impact**:
  - Disabled or terminated employees who have a linked Google account can continue minting valid employee custom tokens and logging into the portal.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -620,2 +620,2 @@
-        const isInactive = (empData && (empData.isActive === false || empData.isRelieved === true || empData.isBlocked === true || !!empData.deletedAt)) ||
-                           (subData && (subData.isActive === false || subData.isRelieved === true || subData.isBlocked === true || !!subData.deletedAt));
+        const isRecordBlocked = (d) => !!d && (d.isActive === false || d.isDisabled === true || d.isRelieved === true || d.isBlocked === true || d.status === 'relieved' || d.status === 'terminated' || !!d.deletedAt);
+        const isInactive = isRecordBlocked(empData) || isRecordBlocked(subData);
```

### `UDF-AUD-223` — **HIGH** | Security Vulnerability / `verifyAndResetEmployeePassword` matches `mobile`/`aadhar`/`dob` against any field in `Object.values(profileData/storedData)`, allows relieved/disabled resets, and never revokes refresh tokens.
- **Target File(s)**: `functions/index.js` (`functions/index.js:962–978, 990–1007`)
- **Root Cause & Exact Code Trace**:
  - Lines `964–977` scan `Object.values(profileData)` and `Object.values(storedData)` for any matching string (matching emergency contacts or dependents), never verify `isActive !== false && isDisabled !== true && isRelieved !== true`, and never call `admin.auth().revokeRefreshTokens()`.
- **Real-World Impact**:
  - An attacker who knows a relative's phone/DOB or a relieved employee can reset the password, and existing sessions remain valid after a password reset.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -901,4 +901,8 @@
         const empRef = empDoc.ref;
         const empData = empDoc.data();
+        if (empData.isActive === false || empData.isDisabled === true || empData.isRelieved === true || empData.isBlocked === true || !!empData.deletedAt) {
+            throw new functions.https.HttpsError('permission-denied', 'Account is inactive or relieved.');
+        }
@@ -1007,2 +1011,3 @@
         await batch.commit();
+        await admin.auth().revokeRefreshTokens(empRef.id).catch(() => {});
```

### `UDF-AUD-224` — **HIGH** | Security Vulnerability / `getSecureDocumentURL` treats `staffDoc.type === 'Admin'` as SuperAdmin, fails open when `!docSite`, and skips `email_verified` on `draft_submissions.ownerEmail`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:1835–1864, 1962–1971`)
- **Root Cause & Exact Code Trace**:
  - Line `1836` equates `staffDoc.type === 'Admin'` with `isSuperAdminCaller`. Line `1856` grants `isAuthorized = true` whenever `!docSite` (which occurs whenever `targetDocId` is an `employeeId` like `HY140001` instead of doc ID). Line `1968` matches `d.ownerEmail === request.auth.token.email` without `email_verified === true`.
- **Real-World Impact**:
  - Branch-scoped staff and BGV vendors can obtain signed download URLs for any employee's Aadhaar/PAN/bank documents across all sites.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1835,2 +1835,2 @@
-        const isSuperAdminCaller = (request.auth.token && request.auth.token.isSuperAdmin) || 
-                                   (staffDoc && (staffDoc.roleId === 'role-super-admin' || staffDoc.type === 'Admin')) ||
+        const isSuperAdminCaller = (request.auth.token && request.auth.token.isSuperAdmin === true) || 
+                                   (staffDoc && staffDoc.roleId === 'role-super-admin') ||
@@ -1856,2 +1856,2 @@
-                } else if (!docSite) {
-                    isAuthorized = true; // Non-site-bound document
+                } else if (!docSite && parts[0] === 'public') {
+                    isAuthorized = true;
```

### `UDF-AUD-225` — **HIGH** | Security Vulnerability / `getBatchSignedViewUrls` skips Firestore `isDisabled`/`isActive` checks when `token.isAdmin === true`, treats `type === 'Admin'` as SuperAdmin, and fails open on `!docSite`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:2065, 2094–2125, 2172`)
- **Root Cause & Exact Code Trace**:
  - Line `2065` immediately sets `isAdminOrStaff = true` from `request.auth.token.isAdmin` without reading Firestore `staff_accounts` for `isDisabled`/`isActive`. Line `2095` treats `staffDoc.type === 'Admin'` as `isSuperAdminCaller`, and `L2122` allows `!docSite`.
- **Real-World Impact**:
  - Suspended staff with a non-expired JWT can batch-download up to 30 sensitive employee documents per call across any site.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -2065,3 +2065,2 @@
-        if (request.auth.token && (request.auth.token.isAdmin === true || request.auth.token.isSuperAdmin === true)) {
-            isAdminOrStaff = true;
-        } else {
+        // Always load staffDoc from Firestore to enforce live isDisabled/isActive checks
+        {
@@ -2095,1 +2094,1 @@
-                                   (staffDoc && (staffDoc.roleId === 'role-super-admin' || staffDoc.type === 'Admin')) ||
+                                   (staffDoc && staffDoc.roleId === 'role-super-admin') ||
```

### `UDF-AUD-226` — **HIGH** | Security Vulnerability / `deleteStoragePath` skips Firestore `isDisabled` check when `token.isAdmin === true` and allows branch staff to delete individual files of employees at other sites.
- **Target File(s)**: `functions/index.js` (`functions/index.js:2391–2416`)
- **Root Cause & Exact Code Trace**:
  - Line `2392` sets `isAuthorized = true` on `token.isAdmin` without checking Firestore `staff_accounts`, and `L2413` grants `isAuthorized = true` for any staff member on individual file paths without verifying `sitesManaged` against the target employee's `siteId`.
- **Real-World Impact**:
  - Any branch admin (or recently disabled admin with a cached JWT) can permanently delete individual KYC/BGV files belonging to employees at other sites.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -2392,3 +2392,2 @@
-    if (request.auth.token && (request.auth.token.isAdmin || request.auth.token.isSuperAdmin)) {
-        isAuthorized = true;
-    } else {
+    // Verify live Firestore staff status and site scope before authorizing
+    {
```

### `UDF-AUD-227` — **HIGH** | Broken Feature / Data Loss / `autoDeleteRecycleBin` deletes `recycle_bin` metadata without purging underlying `SITE`/`VACANCY`/`INVITE` targets and leaves orphaned Firebase Auth users.
- **Target File(s)**: `functions/index.js` (`functions/index.js:2713–2715, 2747–2753`)
- **Root Cause & Exact Code Trace**:
  - Line `2751` executes `await binDoc.ref.delete()` on expired `recycle_bin` entries without deleting the underlying target records or Storage assets for non-employee types, and `L2714` deletes `employees`/`onboarding_submissions` without calling `admin.auth().deleteUser(uniqueId)`.
- **Real-World Impact**:
  - Expired recycle bin records leave orphaned Firebase Auth accounts and unreferenced Storage/Firestore records indefinitely.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -2714,2 +2714,3 @@
             await docSnap.ref.delete();
+            await admin.auth().deleteUser(uniqueId).catch(() => {});
             deletedCount++;
```

### `UDF-AUD-228` — **MEDIUM** | Security Vulnerability / `resolveUsernameToEmail` exposes unauthenticated username-to-email enumeration with per-instance in-memory rate limiting and omits `isDisabled` checks.
- **Target File(s)**: `functions/index.js` (`functions/index.js:3285–3400`)
- **Root Cause & Exact Code Trace**:
  - `resolveUsernameToEmail` accepts unauthenticated requests, uses an in-memory Map (`checkLookupRateLimit`) reset on cold starts/horizontal scaling, returns `{ email }` directly, and only checks `data.isActive !== false` (`L3319, 3336, 3354, 3369, 3386`), omitting `isDisabled === true`.
- **Real-World Impact**:
  - Unauthenticated attackers can enumerate valid staff and employee email addresses across cold starts/instances and discover emails for disabled accounts.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3319,1 +3319,1 @@
-                if (data.isActive !== false) {
+                if (data.isActive !== false && data.isDisabled !== true && data.status !== 'relieved') {
```

### `UDF-AUD-229` — **HIGH** | Security Vulnerability / `onRoleWritten` and `handleStaffOrUserWritten` recompute custom claims without revoking refresh tokens on role downgrade or account disablement.
- **Target File(s)**: `functions/index.js` (`functions/index.js:4015–4100`)
- **Root Cause & Exact Code Trace**:
  - Both triggers call `computeAndApplyUserClaims(authUid, ...)` (`L4039, L4089`) and stamp `claimsUpdatedAt`, but never call `admin.auth().revokeRefreshTokens(authUid)` when `isDisabled` becomes `true` or `roleId` changes.
- **Real-World Impact**:
  - A disabled or demoted staff member's existing ID token and refresh token remain valid for up to 1 hour (or indefinitely offline) until the client voluntarily refreshes.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4089,2 +4089,5 @@
                 await computeAndApplyUserClaims(authUid, staffId, afterData);
+                if (afterData?.isDisabled === true || beforeData?.roleId !== afterData?.roleId) {
+                    await admin.auth().revokeRefreshTokens(authUid).catch(() => {});
+                }
```

### `UDF-AUD-230` — **HIGH** | Broken Feature / Functional Bug / Four core Cloud Functions check `token.roleId === 'super-admin'` instead of `'role-super-admin'`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:4746, 5171, 5506, 5658`)
- **Root Cause & Exact Code Trace**:
  - `processRequestReviewServer` (`L4746`), `approveOnboardingServer` (`L5171`), `relieveEmployeeServer` (`L5506`), and `rejoinEmployeeServer` (`L5658`) evaluate `request.auth.token.roleId === 'super-admin'`, whereas the canonical SuperAdmin role ID across `roles` and `staff_accounts` is `'role-super-admin'`.
- **Real-World Impact**:
  - The JWT fast-path check for SuperAdmin always evaluates to `false`, forcing unnecessary Firestore lookups or causing permission failures when `token.isSuperAdmin` is absent.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -4746,1 +4746,1 @@
-    let isSuperAdmin = request.auth.token?.isSuperAdmin === true || request.auth.token?.roleId === 'super-admin';
+    let isSuperAdmin = request.auth.token?.isSuperAdmin === true || request.auth.token?.roleId === 'role-super-admin';
```

### `UDF-AUD-231` — **HIGH** | Security Vulnerability / `syncEmployeeToGoogleDriveServer` and `syncSubmissionToSheetsServer` treat `prof.type === 'Admin'` as `isSuperAdmin = true`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:6611, 6655`)
- **Root Cause & Exact Code Trace**:
  - Both callables check `if (prof.roleId === 'role-super-admin' || prof.type === 'Admin') isSuperAdmin = true;` (`L6611, L6655`), where `prof.type === 'Admin'` is set on all staff users.
- **Real-World Impact**:
  - Any low-privilege staff member or external BGV vendor can trigger SuperAdmin-only Google Drive and Google Sheets export/sync operations.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -6611,1 +6611,1 @@
-            if (prof.roleId === 'role-super-admin' || prof.type === 'Admin') isSuperAdmin = true;
+            if (prof.roleId === 'role-super-admin') isSuperAdmin = true;
```

### `UDF-AUD-232` — **HIGH** | Security Vulnerability / `getDraftSubmissionSecure` trusts spoofable `cf-connecting-ip`/`x-forwarded-for` headers, lacks `request.auth` check, and overwrites `activeSessionUid`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:6697–6703, 6767–6773`)
- **Root Cause & Exact Code Trace**:
  - `getDraftSubmissionSecure` reads `rawReq.headers['cf-connecting-ip'] || rawReq.headers['x-forwarded-for']` to key the 24h IP ban (`L6697–6703`), does not require `request.auth`, and writes `activeSessionUid: callerUid` (`L6771`) onto any draft whose ID is guessed or brute-forced.
- **Real-World Impact**:
  - Attackers can spoof headers to bypass rate limiting and hijack `activeSessionUid` on guest onboarding drafts.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -6697,2 +6697,2 @@
-    const clientIp = (rawReq && (rawReq.headers['cf-connecting-ip'] || rawReq.headers['x-forwarded-for'] || rawReq.ip)) || 'unknown';
+    const clientIp = (rawReq && (rawReq.ip || rawReq.headers['x-forwarded-for'])) || 'unknown';
```

### `UDF-AUD-233` — **HIGH** | Security Vulnerability / `permanentDeleteEmployeeServer` lacks `sitesManaged` site-scoping check for non-SuperAdmin staff.
- **Target File(s)**: `functions/index.js` (`functions/index.js:6806–6822`)
- **Root Cause & Exact Code Trace**:
  - While `permanentDeleteEmployeeServer` checks `SUBMISSIONS_APPROVE` / `DELETE_EMPLOYEE` permissions (`L6816`), it never verifies whether the target employee's `siteId` / `currentSiteId` is within the caller's `sitesManaged`.
- **Real-World Impact**:
  - A branch supervisor granted `DELETE_EMPLOYEE` or `SUBMISSIONS_APPROVE` can permanently erase employees and their Storage folders from any other branch site.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -6820,2 +6820,6 @@
     if (!isSuperAdmin && !hasDeletePerm) {
         throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions.');
     }
+    if (!isSuperAdmin && targetSiteId && !callerSitesManaged.includes(targetSiteId)) {
+        throw new functions.https.HttpsError('permission-denied', 'Cannot permanently delete employees outside your assigned sites.');
+    }
```

### `UDF-AUD-234` — **HIGH** | Security Vulnerability / `getUploadUrl` never enforces `fileSize <= 10MB` or `contentType` allowlist, and `context === 'admin'` lets any staff overwrite `public/*` or any employee's `/bgv/` or `/disciplinary/` files.
- **Target File(s)**: `functions/index.js` (`functions/index.js:3537–3765`)
- **Root Cause & Exact Code Trace**:
  - `getUploadUrl` destructures `contentType` (`L3540`) without validating it against an image/PDF allowlist or checking `fileSize`, and `L3728–3744` grants `isAuthorized = true` for any active staff member on `admin` uploads without checking `sitesManaged` or `MANAGE_SYSTEM`.
- **Real-World Impact**:
  - Any branch staff member or BGV vendor can overwrite company logos/assets in `public/*` or upload arbitrary HTML/executable files into any employee's folder.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3545,2 +3545,6 @@
+    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
+    if (!ALLOWED_TYPES.includes(contentType)) {
+        throw new functions.https.HttpsError('invalid-argument', 'Unsupported file content type.');
+    }
```

### `UDF-AUD-235` — **HIGH** | Security Vulnerability / `restoreRecycleBinServer` allows non-SuperAdmin staff to restore cross-site items and reactivates relieved employees without checking `isRelieved`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:7083–7200`)
- **Root Cause & Exact Code Trace**:
  - Line `7083` permits any staff with `EMPLOYEES_TAB_RECYCLE_BIN` to restore `SITE`, `INVITE`, `VACANCY`, `DESIGNATION`, or `EMPLOYEE` items across all sites, and `case 'EMPLOYEE'` (`L7143–7152`) sets `isActive: true` without verifying `isRelieved !== true`.
- **Real-World Impact**:
  - Branch staff can restore other branches' sites or reactivate relieved/terminated employees into active status.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -7145,2 +7145,3 @@
-        isActive: true,
+        isActive: restoredData.isRelieved === true ? false : true,
```

### `UDF-AUD-236` — **MEDIUM** | Broken Feature / Functional Bug / `deleteSiteServer` checks `siteId` and `currentSiteId` on `employees` but never `assignedSiteIds` (`array-contains`).
- **Target File(s)**: `functions/index.js` (`functions/index.js:7300–7309`)
- **Root Cause & Exact Code Trace**:
  - `deleteSiteServer` queries `.where('siteId', '==', siteId)` and `.where('currentSiteId', '==', siteId)` before deleting a site, completely ignoring guards secondary-assigned to the site via `assignedSiteIds`.
- **Real-World Impact**:
  - Admins can delete a site that still has active guards assigned via `assignedSiteIds`, leaving dangling site references on their `activeAssignments`.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -7305,2 +7305,3 @@
+        db.collection('employees').where('assignedSiteIds', 'array-contains', siteId).limit(1).get(),
```

### `UDF-AUD-237` — **MEDIUM** | Broken Feature / Functional Bug / `bulkImportEmployeesServer` generates `empId` using `Math.random()` without collision checking.
- **Target File(s)**: `functions/index.js` (`functions/index.js:7673`)
- **Root Cause & Exact Code Trace**:
  - When a CSV row omits `employeeId`, `bulkImportEmployeesServer` (`L7673`) generates an ID via `Math.random()` without querying `employees` or `onboarding_submissions` for uniqueness.
- **Real-World Impact**:
  - Concurrent or large bulk imports risk generating colliding Employee IDs that overwrite or cross-link employee records.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -7673,1 +7673,1 @@
-            const empId = row.employeeId || `UDF${Math.floor(100000 + Math.random() * 900000)}`;
+            const empId = row.employeeId || `UDF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
```

### `UDF-AUD-238` — **HIGH** | Security Vulnerability / `sendNotificationServer` treats any `!!token.roleId` (including guards/BGV vendors) as `isAdmin = true`, allows broadcasting to `ROLE:role-super-admin`, and lets `clientProvidedId` overwrite notifications.
- **Target File(s)**: `functions/index.js` (`functions/index.js:8112, 8121–8139`)
- **Root Cause & Exact Code Trace**:
  - Line `8112` computes `isAdmin` from `!!request.auth.token.roleId`, `L8121–8139` lacks target allowlists for `ROLE:*` / `'all_admins'`, and `db.collection('notifications').doc(clientProvidedId).set(...)` overwrites existing documents.
- **Real-World Impact**:
  - Unprivileged staff or vendors can spam `all_admins` / `role-super-admin` or overwrite existing notification documents by supplying a known `clientProvidedId`.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -8112,1 +8112,1 @@
-    const isAdmin = request.auth.token?.isAdmin === true || request.auth.token?.isSuperAdmin === true || !!request.auth.token?.roleId;
+    const isAdmin = request.auth.token?.isAdmin === true || request.auth.token?.isSuperAdmin === true;
```

### `UDF-AUD-239` — **HIGH** | Security Vulnerability / `setStaffUserStatus` and `resetStaffUserPassword` allow modifying other `role-super-admin` accounts or self-disabling, and `setStaffUserStatus` omits `revokeRefreshTokens` and `claimsUpdatedAt`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:360–428`)
- **Root Cause & Exact Code Trace**:
  - Unlike `deleteStaffUser` (`L328–339`), `setStaffUserStatus` (`L360–395`) and `resetStaffUserPassword` (`L398–428`) do not block `uid === request.auth.uid` or `targetDoc.data().roleId === 'role-super-admin'`, and `setStaffUserStatus` does not revoke refresh tokens.
- **Real-World Impact**:
  - A compromised SuperAdmin session can lock out all other SuperAdmins or self-disable, and disabled staff keep active JWTs until natural expiry.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -378,2 +378,6 @@
+    if (uid === request.auth.uid) {
+        throw new functions.https.HttpsError('permission-denied', 'Cannot disable your own account.');
+    }
     await admin.auth().updateUser(uid, { disabled: isDisabled });
+    if (isDisabled) await admin.auth().revokeRefreshTokens(uid);
```

### `UDF-AUD-240` — **MEDIUM** | Security Vulnerability / `checkAndIncrementFailedAttempts` and `checkClaimDailyAttempts` use non-transactional `get()` + `set()`, allowing concurrent brute-force bypass.
- **Target File(s)**: `functions/index.js` (`functions/index.js:435–493`)
- **Root Cause & Exact Code Trace**:
  - Both rate-limiters read `_auth_attempts/{key}` via `docRef.get()`, compute `count + 1` in JS, and write via `docRef.set()` outside a Firestore `runTransaction`.
- **Real-World Impact**:
  - Parallel brute-force requests read the same initial counter and bypass the 3-attempt / 5-attempt lockout threshold.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -438,4 +438,6 @@
-    const docSnap = await attemptRef.get();
+    return await db.runTransaction(async (tx) => {
+        const docSnap = await tx.get(attemptRef);
+        ...
+    });
```

### `UDF-AUD-241` — **MEDIUM** | Broken Feature / Functional Bug / `rejoinEmployeeServer` checks `token.permissions` only without Firestore `staff_accounts`/`roles` fallback.
- **Target File(s)**: `functions/index.js` (`functions/index.js:5661–5664`)
- **Root Cause & Exact Code Trace**:
  - While `approveOnboardingServer` and `relieveEmployeeServer` fall back to Firestore `staff_accounts` + `roles` when JWT claims are stale, `rejoinEmployeeServer` (`L5661–5664`) relies exclusively on `request.auth.token.permissions`.
- **Real-World Impact**:
  - Staff who were recently granted `EMPLOYEES_ACTION_REJOIN` receive `permission-denied` until they sign out and back in.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -5661,2 +5661,3 @@
-    const tokenPerms = request.auth.token?.permissions || [];
+    const resolvedPerms = await resolveCallerPermissionsFromFirestore(db, request.auth.uid, request.auth.token);
```

### `UDF-AUD-242` — **LOW** | Performance / Reliability / `autoDeleteRecycleBin` hardcodes the `20,000` free-tier daily write limit and drops to `500` on Monitoring API failure.
- **Target File(s)**: `functions/index.js` (`functions/index.js:2649–2664`)
- **Root Cause & Exact Code Trace**:
  - Line `2650` computes `20000 - todayWrites - 2000`, and if the GCP Monitoring API call fails or lacks IAM `monitoring.timeSeries.list`, `L2663` caps `maxAllowedDeletes = 500`.
- **Real-World Impact**:
  - On Blaze-plan projects or high-volume days, the nightly 30-day retention purge silently aborts before cleaning expired records.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -2650,1 +2650,1 @@
-                const remainingWrites = 20000 - todayWrites - 2000;
+                const remainingWrites = Number(process.env.FIRESTORE_DAILY_WRITE_CAP || 100000) - todayWrites - 2000;
```

### `UDF-AUD-243` — **MEDIUM** | Broken Feature / Functional Bug / `resolveUsernameToEmail` legacy fallback scans only `limit(100)` of `staff_accounts`, `staff`, and `users`.
- **Target File(s)**: `functions/index.js` (`functions/index.js:3360–3373`)
- **Root Cause & Exact Code Trace**:
  - When `usernameLower` is missing on a legacy staff document, the fallback at `L3362–3366` fetches only the first 100 documents from each collection.
- **Real-World Impact**:
  - Legacy staff beyond the 100th document cannot resolve their username to an email and are blocked from logging in by username.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -3362,3 +3362,3 @@
-                    db.collection('staff_accounts').limit(100).get(),
+                    db.collection('staff_accounts').get(),
```

### `UDF-AUD-244` — **MEDIUM** | Broken Feature / Functional Bug / `getSecureDocumentURL` and `getBatchSignedViewUrls` ignore `assignedSiteIds` when checking staff site access.
- **Target File(s)**: `functions/index.js` (`functions/index.js:1853–1856, 2120–2123`)
- **Root Cause & Exact Code Trace**:
  - Both callables compute `docSite = docData.siteId || docData.currentSiteId || ''` (`L1852, L2121`) and check `staffSites.includes(docSite)`, ignoring `docData.assignedSiteIds`.
- **Real-World Impact**:
  - Branch supervisors cannot view documents of guards who are secondary-assigned to their site via `assignedSiteIds`.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -1854,1 +1854,2 @@
-                if (docSite && staffSites.includes(docSite)) {
+                const docSites = [docSite, ...(Array.isArray(docData.assignedSiteIds) ? docData.assignedSiteIds : [])].filter(Boolean);
+                if (docSites.some(s => staffSites.includes(s))) {
```

### `UDF-AUD-245` — **MEDIUM** | Security Vulnerability / `createStaffUser` checks email uniqueness across collections but never checks `username` / `usernameLower` uniqueness.
- **Target File(s)**: `functions/index.js` (`functions/index.js:250–290`)
- **Root Cause & Exact Code Trace**:
  - Lines `250–261` query 6 email fields for collisions before creating the Auth user, but never query `staff_accounts`, `staff`, or `users` for `usernameLower == username.toLowerCase().trim()`.
- **Real-World Impact**:
  - Duplicate usernames can be created across staff accounts, causing `resolveUsernameToEmail` (`limit(1)`) to resolve logins to the wrong staff email.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -258,2 +258,5 @@
+        const unameSnap = await db.collection('staff_accounts').where('usernameLower', '==', username.toLowerCase().trim()).limit(1).get();
+        if (!unameSnap.empty) {
+            throw new functions.https.HttpsError('already-exists', 'Username is already taken.');
+        }
```

### `UDF-AUD-246` — **CRITICAL** | Security Vulnerability / `correction_requests` sets `allow get: if true;`, exposing plaintext verification answers (`verificationDob`, `verificationPhone`) and `requestedFieldValues` to unauthenticated callers.
- **Target File(s)**: `firestore.rules` (`firestore.rules:495`)
- **Root Cause & Exact Code Trace**:
  - Any unauthenticated caller who knows or guesses a `correction_requests/{id}` document ID can `get()` the document directly via the Firestore REST/SDK API, bypassing `getCorrectionChallenge` and `verifyCorrectionIdentity`.
- **Real-World Impact**:
  - Attackers can read the target employee's DOB, phone number, and requested field values without verification.
- **Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -495,1 +495,1 @@
-      allow get: if true;
+      allow get: if isAdmin() || isSuperAdmin();
```

### `UDF-AUD-247` — **CRITICAL** | Security Vulnerability / `hasActiveCorrectionToken` grants any unauthenticated caller `get()` access to full `employees/{id}` and `onboarding_submissions/{id}` documents.
- **Target File(s)**: `firestore.rules` (`firestore.rules:134–139, 193, 226`)
- **Root Cause & Exact Code Trace**:
  - Rules `193` and `226` permit `get()` when `hasActiveCorrectionToken(resource.data)` is `true`—which only checks that `activeCorrectionToken` points to a `pending` `correction_requests` doc, without verifying caller identity.
- **Real-World Impact**:
  - While any correction link is pending, any unauthenticated user on the internet can read that employee's full document (Aadhaar, PAN, bank account, `passwordHash`).
- **Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -193,1 +193,0 @@
-                 hasActiveCorrectionToken(resource.data) ||
@@ -226,1 +225,0 @@
-                 hasActiveCorrectionToken(resource.data) ||
```

### `UDF-AUD-248` — **MEDIUM** | Security Vulnerability / `allow get: if resource == null || ...` leaks whether specific `employees` or `onboarding_submissions` document IDs exist to unauthenticated callers.
- **Target File(s)**: `firestore.rules` (`firestore.rules:192, 225`)
- **Root Cause & Exact Code Trace**:
  - Evaluating `resource == null` returns `true` for missing documents and `false` (permission-denied) for existing documents.
- **Real-World Impact**:
  - Unauthenticated callers can probe and enumerate valid `employees` and `onboarding_submissions` document IDs via differential responses.
- **Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -192,1 +192,1 @@
-      allow get: if resource == null ||
+      allow get: if isAuthenticated() && (
```

### `UDF-AUD-249` — **HIGH** | Security Vulnerability / `recycle_bin` allows `EMPLOYEES_TAB_RECYCLE_BIN` staff to read all items across all sites, and `!(itemType matches '(?i)(STAFF|ROLE)')` omits `USER` and `WORKFLOW`.
- **Target File(s)**: `firestore.rules` (`firestore.rules:581–585`)
- **Root Cause & Exact Code Trace**:
  - Line `581` grants `allow read` globally without site scoping (`canStaffViewSite`), and `L583, L585` only block `STAFF` and `ROLE` item types.
- **Real-World Impact**:
  - Branch staff with Recycle Bin access can read deleted items from all sites and tamper with `USER` or `WORKFLOW` archive items.
- **Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -581,3 +581,3 @@
-      allow read: if isSuperAdmin() || hasPermission('EMPLOYEES_TAB_RECYCLE_BIN');
+      allow read: if isSuperAdmin() || (hasPermission('EMPLOYEES_TAB_RECYCLE_BIN') && canStaffViewSite(resource.data.get('siteId', '')));
-      allow update, delete: if isSuperAdmin() ||
-        (hasPermission('EMPLOYEES_TAB_RECYCLE_BIN') && !resource.data.get('itemType', '').matches('(?i)(STAFF|ROLE)'));
+      allow update, delete: if isSuperAdmin() ||
+        (hasPermission('EMPLOYEES_TAB_RECYCLE_BIN') && !resource.data.get('itemType', '').matches('(?i)(STAFF|ROLE|USER|WORKFLOW)'));
```

### `UDF-AUD-250` — **HIGH** | Security Vulnerability / `leave_balances`, `user_engagement`, `attendance`, `complaints`, and `reward_redemptions` use `isAdmin()` without `canStaffViewSite`.
- **Target File(s)**: `firestore.rules` (`firestore.rules:418–425, 532, 554, 561, 567`)
- **Root Cause & Exact Code Trace**:
  - All five collections grant `allow read: if isAdmin()` (`L418, 532, 554, 561, 567`) with zero site-scoping checks.
- **Real-World Impact**:
  - Branch supervisors and external BGV vendors (`isAdmin() == true`) can read all employees' leave balances, attendance logs, complaints, and reward redemptions across the entire company.
- **Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -561,1 +561,1 @@
-      allow read: if isAdmin();
+      allow read: if isSuperAdmin() || (isAdmin() && canStaffViewSite(resource.data.get('siteId', '')));
```

### `UDF-AUD-251` — **MEDIUM** | Security Vulnerability / `referral_invites` `allow list` grants full invite enumeration to anyone holding `SITES_DELETE` or `MANAGE_SITES`.
- **Target File(s)**: `firestore.rules` (`firestore.rules:522–527`)
- **Root Cause & Exact Code Trace**:
  - Lines `525–526` include `hasPermission('SITES_DELETE') || hasPermission('MANAGE_SITES')` in the `referral_invites` `list` rule.
- **Real-World Impact**:
  - Site managers without any Invites permission can list all recruiters' referral links and locked candidate phone numbers.
- **Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -525,2 +525,0 @@
-                     hasPermission('SITES_DELETE') ||
-                     hasPermission('MANAGE_SITES') ||
```

### `UDF-AUD-252` — **HIGH** | Security Vulnerability / `user_engagement` `update` rule compares `lastVisitDate > resource.data.lastVisitDate` lexicographically, allowing unlimited `+5` point farming.
- **Target File(s)**: `firestore.rules` (`firestore.rules:539–549`)
- **Root Cause & Exact Code Trace**:
  - Line `545` only checks `request.resource.data.get('lastVisitDate', '') > resource.data.get('lastVisitDate', '')`, accepting strings like `'2026-11-19a'`, `'2026-11-19b'`, or `'9999-12-31'`.
- **Real-World Impact**:
  - Any employee can craft direct Firestore updates to add `+5` points per request indefinitely and redeem unlimited reward vouchers.
- **Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -544,4 +544,2 @@
-          (request.resource.data.get('lastVisitDate', '') is string &&
-           request.resource.data.get('lastVisitDate', '') > resource.data.get('lastVisitDate', '') &&
-           request.resource.data.get('points', 0) >= 0 &&
-           request.resource.data.get('points', 0) <= resource.data.get('points', 0) + 5)
+          false // Daily streak points must be awarded server-side only
```

### `UDF-AUD-253` — **MEDIUM** | Security Vulnerability / `roles` collection allows `allow read: if isRegisteredUser();`, exposing all internal RBAC definitions to every employee.
- **Target File(s)**: `firestore.rules` (`firestore.rules:411–414`)
- **Root Cause & Exact Code Trace**:
  - Line `412` permits any registered user (including guards and applicants) to read every document in `roles/{roleId}`.
- **Real-World Impact**:
  - Employees can inspect all internal admin role structures, permission keys, and field-visibility rules.
- **Remediation (`diff`)**:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -412,1 +412,1 @@
-      allow read: if isRegisteredUser();
+      allow read: if isAdmin() || isSuperAdmin();
```

### `UDF-AUD-254` — **HIGH** | Security Vulnerability / `bgv_records` grants `hasPermission('BGV_VENDOR')` read access to all records, and `AdminBgvManagementPage` fails to hide undispatched `PENDING` records where `vendorName` is unset.
- **Target File(s)**: `firestore.rules`<br>`components/AdminBgvManagementPage.tsx` (`firestore.rules:460–464`<br>`AdminBgvManagementPage.tsx:249–253`)
- **Root Cause & Exact Code Trace**:
  - `firestore.rules:461` allows any `BGV_VENDOR` to read all `bgv_records`, and `AdminBgvManagementPage.tsx:250` checks `if (record.vendorName && ...)`—which evaluates to `false` (returning `true`!) when `vendorName` is empty.
- **Real-World Impact**:
  - External BGV vendors can view every undispatched employee's Aadhaar, phone number, and PII before any case is assigned to them.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminBgvManagementPage.tsx
+++ b/components/AdminBgvManagementPage.tsx
@@ -249,4 +249,4 @@
       if (isVendor && authUser?.name) {
-        if (record.vendorName && !record.vendorName.toLowerCase().includes(authUser.name.toLowerCase())) {
+        if (!record.vendorName || record.vendorName.toLowerCase() !== authUser.name.toLowerCase()) {
           return false;
         }
       }
```

### `UDF-AUD-255` — **MEDIUM** | Security Vulnerability / `isValidUpload()` in `storage.rules` is unused dead code while `allow read, write: if false` blocks all direct client storage operations.
- **Target File(s)**: `storage.rules` (`storage.rules:27–31, 43–45`)
- **Root Cause & Exact Code Trace**:
  - `storage.rules:27–31` defines `isValidUpload()` (10MB, image/PDF) but never references it in any `match` block; all writes are denied at `L37` and `L44`.
- **Real-World Impact**:
  - Developers assuming `storage.rules` enforces the 10MB/image/PDF constraint are misled because `getUploadUrl` (`functions/index.js`) bypasses rules via signed URLs without enforcing those limits.
- **Remediation (`diff`)**:
```diff
--- a/storage.rules
+++ b/storage.rules
@@ -24,8 +24,1 @@
-    // ── Size & Type Guard ─────────────────────────────────────────────────────
-    function isValidUpload() {
-      ...
-    }
+    // Enforce size/type limits directly in getUploadUrl Cloud Function.
```

### `UDF-AUD-256` — **HIGH** | Broken Feature / Functional Bug / `storageService.ts` falls back to blocked direct `uploadBytes`/`getBlob`, leaks unrevoked `URL.createObjectURL` blobs, and retains 25-min signed URLs in `sessionStorage` after logout.
- **Target File(s)**: `src/services/storageService.ts` (`storageService.ts:175–178, 227–260, 370–371, 392–421, 466–467, 480–482`)
- **Root Cause & Exact Code Trace**:
  - When Cloud Functions fail, `storageService.ts` falls back to `uploadBytes`/`getBlob` (guaranteed `storage/unauthorized`), allocates `URL.createObjectURL(blob)` without tracking/revoking, and caches signed URLs in `sessionStorage` without clearing them on sign-out.
- **Real-World Impact**:
  - Fallback uploads always fail, PDF/image viewers leak browser memory, and signed URLs remain readable in `sessionStorage` after logout.
- **Remediation (`diff`)**:
```diff
--- a/src/services/storageService.ts
+++ b/src/services/storageService.ts
@@ -227,2 +227,2 @@
-    // Fallback to direct Firebase Storage upload
+    throw new Error('Secure upload URL generation failed; please retry.');
```

### `UDF-AUD-257` — **MEDIUM** | Broken Feature / Functional Bug / `uploadSubmissionDocument` reads `localStorage.getItem('onboarding_savedDraftId')` directly, risking uploads into a stale draft folder.
- **Target File(s)**: `src/services/storageService.ts` (`storageService.ts:450–457`)
- **Root Cause & Exact Code Trace**:
  - When `customFolder` is omitted, `uploadSubmissionDocument` falls back to `localStorage.getItem('onboarding_savedDraftId')`.
- **Real-World Impact**:
  - If a previous onboarding session left `onboarding_savedDraftId` in `localStorage`, new submission files are uploaded to the wrong candidate folder.
- **Remediation (`diff`)**:
```diff
--- a/src/services/storageService.ts
+++ b/src/services/storageService.ts
@@ -451,3 +451,1 @@
-    const draftId = customFolder || localStorage.getItem('onboarding_savedDraftId') || undefined;
+    const draftId = customFolder || undefined;
```

### `UDF-AUD-258` — **HIGH** | Broken Feature / Functional Bug / `bulkImportEmployees` drops `defaultStatus` and `importMode` (`'pending_profile'`) when calling `bulkImportEmployeesServer`.
- **Target File(s)**: `src/utils/bulkImportUtils.ts`<br>`functions/index.js` (`bulkImportUtils.ts:791–805`<br>`functions/index.js:7626`)
- **Root Cause & Exact Code Trace**:
  - `bulkImportUtils.ts:796–799` invokes `bulkImportEmployeesServer` without passing `defaultStatus` or `importMode`, and `functions/index.js:7626` does not accept them.
- **Real-World Impact**:
  - Bulk imports intended for `'Pending Profile Completion'` are imported without `importMode` semantics.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/bulkImportUtils.ts
+++ b/src/utils/bulkImportUtils.ts
@@ -796,4 +796,6 @@
         const res = await bulkImportServerFn({
             rows: validRows,
+            defaultStatus,
+            importMode,
```

### `UDF-AUD-259` — **MEDIUM** | Broken Feature / Functional Bug / `checkForDatabaseDuplicates` only queries `profileData.personalDetails.phoneNumber` and `data/profileData.${aadharFieldId}`, missing top-level `phoneNumber`, `aadhaarNumber`, and `panNumber`.
- **Target File(s)**: `src/utils/bulkImportUtils.ts` (`bulkImportUtils.ts:594–606`)
- **Root Cause & Exact Code Trace**:
  - Lines `594–605` omit top-level `phoneNumber`, `aadhaarNumber`, and `panNumber` fields used by bulk-imported and migrated employee documents.
- **Real-World Impact**:
  - Duplicate employees imported previously or created via migration pass duplicate detection silently during CSV import.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/bulkImportUtils.ts
+++ b/src/utils/bulkImportUtils.ts
@@ -596,2 +596,3 @@
+            query(collection(db, 'employees'), where('phoneNumber', '==', phone), limit(1)),
```

### `UDF-AUD-260` — **MEDIUM** | Broken Feature / Functional Bug / Client-side bulk import writes `formData[unitFieldId] = siteName` (name instead of `site.id`) and populates only `{ personalDetails: { fullName, phoneNumber } }` into `profileData`.
- **Target File(s)**: `src/utils/bulkImportUtils.ts` (`bulkImportUtils.ts:882, 978–984`)
- **Root Cause & Exact Code Trace**:
  - Line `882` assigns `siteName` to the unit field instead of `site.id`, and `L978–984` omits Aadhaar, PAN, DOB, and bank fields from `profileData`.
- **Real-World Impact**:
  - Site-scoped filters and profile views that match `unitFieldId` against `site.id` fail to match imported records.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/bulkImportUtils.ts
+++ b/src/utils/bulkImportUtils.ts
@@ -882,1 +882,1 @@
-        if (unitFieldId && resolvedSiteName) formData[unitFieldId] = resolvedSiteName;
+        if (unitFieldId && resolvedSiteId) formData[unitFieldId] = resolvedSiteId;
```

### `UDF-AUD-261` — **MEDIUM** | Broken Feature / Functional Bug / `handleFileUpload` uses `useCallback(..., [logAction])` omitting `imports` from its dependency array, breaking Smart Merge.
- **Target File(s)**: `components/AdminLegacySystemsPage.tsx` (`AdminLegacySystemsPage.tsx:218, 255`)
- **Root Cause & Exact Code Trace**:
  - Because `imports` is omitted from the `useCallback` dependency array (`L255`), `imports.find(...)` at `L218` always searches the initial empty `[]` array.
- **Real-World Impact**:
  - Re-uploading a legacy CSV/Excel file never triggers Smart Merge against existing legacy records and instead creates duplicates.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminLegacySystemsPage.tsx
+++ b/components/AdminLegacySystemsPage.tsx
@@ -255,1 +255,1 @@
-  }, [logAction]);
+  }, [imports, logAction]);
```

### `UDF-AUD-262` — **MEDIUM** | Broken Feature / Functional Bug / `designationOptions` checks `optionsMap[activeSite.name]` only (missing `activeSite.id`) and `handleSaveVacancy` lacks `title`/`count >= 1` validation.
- **Target File(s)**: `components/AdminVacancyManager.tsx` (`AdminVacancyManager.tsx:61–67, 134–161`)
- **Root Cause & Exact Code Trace**:
  - Line `64` looks up `optionsMap[activeSite.name]` without falling back to `activeSite.id`, and `handleSaveVacancy` (`L134–161`) allows saving blank titles or `count <= 0`.
- **Real-World Impact**:
  - Sites configured by ID show no designation dropdown options, and invalid `0`-opening vacancies can be published to `/careers`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminVacancyManager.tsx
+++ b/components/AdminVacancyManager.tsx
@@ -64,1 +64,1 @@
-    const siteOpts = optionsMap[activeSite.name] || [];
+    const siteOpts = optionsMap[activeSite.id] || optionsMap[activeSite.name] || [];
```

### `UDF-AUD-263` — **MEDIUM** | Broken Feature / Functional Bug / `req.createdBy.toLowerCase()` crashes if `createdBy` is undefined, `hasManagePerm` is unused, and the list lacks site scoping.
- **Target File(s)**: `components/AdminCorrectionRequestsPage.tsx` (`AdminCorrectionRequestsPage.tsx:51, 89–122, 134`)
- **Root Cause & Exact Code Trace**:
  - Line `134` calls `req.createdBy.toLowerCase()` without optional chaining, `hasManagePerm` (`L51`) never gates `handleRevoke` (`L89`) or `handleDelete` (`L107`), and `filteredRequests` does not filter by `allowedSiteIds`.
- **Real-World Impact**:
  - Read-only viewers can revoke/delete correction requests across all sites, and any legacy request missing `createdBy` crashes the page.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminCorrectionRequestsPage.tsx
+++ b/components/AdminCorrectionRequestsPage.tsx
@@ -134,1 +134,1 @@
-        req.createdBy.toLowerCase().includes(searchTerm.toLowerCase());
+        (req.createdBy || '').toLowerCase().includes(searchTerm.toLowerCase());
```

### `UDF-AUD-264` — **MEDIUM** | Broken Feature / Functional Bug / `getDraftName` checks `['firstName', 'lastName', 'name', 'applicantName', 'full_name']` instead of Form Builder UUID `7debf274-baee-4bac-a137-4b4b46719874`.
- **Target File(s)**: `components/AdminDraftsManagementPage.tsx` (`AdminDraftsManagementPage.tsx:94–109`)
- **Root Cause & Exact Code Trace**:
  - Drafts store the applicant name under Form Builder field UUID `7debf274-baee-4bac-a137-4b4b46719874`, which `getDraftName` (`L97`) never checks. The page also lacks `allowedSiteIds` scoping.
- **Real-World Impact**:
  - Every draft in Drafts Management displays `'Incomplete Applicant'` instead of the candidate's real name.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminDraftsManagementPage.tsx
+++ b/components/AdminDraftsManagementPage.tsx
@@ -97,1 +97,1 @@
-        const possibleNameFields = ['firstName', 'lastName', 'name', 'applicantName', 'full_name'];
+        const possibleNameFields = ['7debf274-baee-4bac-a137-4b4b46719874', 'firstName', 'lastName', 'name', 'applicantName', 'full_name'];
```

### `UDF-AUD-265` — **MEDIUM** | Broken Feature / Functional Bug / `allowedFileTypes` configured in Form Builder is completely ignored by all upload validators.
- **Target File(s)**: `components/FieldEditorModal.tsx`<br>`components/employeeFormFields/EmployeeFileUploadField.tsx` (`FieldEditorModal.tsx:108`<br>`EmployeeFileUploadField.tsx:137–142`)
- **Root Cause & Exact Code Trace**:
  - `FieldEditorModal.tsx:108` lets admins configure `field.allowedFileTypes`, but `EmployeeFileUploadField.tsx:137–142` hardcodes image/PDF checks without reading `field.allowedFileTypes`.
- **Real-World Impact**:
  - Admins configuring image-only or PDF-only upload fields see their restrictions silently ignored on the onboarding form.
- **Remediation (`diff`)**:
```diff
--- a/components/employeeFormFields/EmployeeFileUploadField.tsx
+++ b/components/employeeFormFields/EmployeeFileUploadField.tsx
@@ -137,2 +137,5 @@
+    if (field.allowedFileTypes?.length && !field.allowedFileTypes.some(t => file.type.includes(t) || file.name.toLowerCase().endsWith(t))) {
+        onError?.(`Allowed types: ${field.allowedFileTypes.join(', ')}`);
+        return;
+    }
```

### `UDF-AUD-266` — **MEDIUM** | Broken Feature / Functional Bug / `useEffect` only resolves `getSecureURL(valPath)` for image extensions, setting `resolvedUrl = null` for PDFs.
- **Target File(s)**: `components/employeeFormFields/EmployeeFileUploadField.tsx` (`EmployeeFileUploadField.tsx:104–116`)
- **Root Cause & Exact Code Trace**:
  - Lines `104–116` skip calling `getSecureURL` whenever the file extension is not an image, leaving `resolvedUrl` as `null` for uploaded PDFs.
- **Real-World Impact**:
  - Candidates and employees who upload PDFs (e.g., Aadhaar PDF or Bank Passbook PDF) cannot preview their uploaded PDF.
- **Remediation (`diff`)**:
```diff
--- a/components/employeeFormFields/EmployeeFileUploadField.tsx
+++ b/components/employeeFormFields/EmployeeFileUploadField.tsx
@@ -106,1 +106,1 @@
-    if (valPath && isImageExt(valPath)) {
+    if (valPath) {
```

### `UDF-AUD-267` — **MEDIUM** | Broken Feature / Functional Bug / `handleOpenExistingCropper` checks `!(typeof value === 'string')`, disabling cropping once background upload saves the string storage path.
- **Target File(s)**: `components/employeeFormFields/EmployeeFileUploadField.tsx` (`EmployeeFileUploadField.tsx:240–244`)
- **Root Cause & Exact Code Trace**:
  - After a file finishes uploading, `value` becomes a string storage path (`'onboarding/...'`), causing `!(typeof value === 'string')` at `L241` to disable re-cropping.
- **Real-World Impact**:
  - Users cannot re-crop or adjust an uploaded photo/ID after the initial upload completes.
- **Remediation (`diff`)**:
```diff
--- a/components/employeeFormFields/EmployeeFileUploadField.tsx
+++ b/components/employeeFormFields/EmployeeFileUploadField.tsx
@@ -240,2 +240,2 @@
-    if (!resolvedUrl || typeof value === 'string') return;
+    if (!resolvedUrl) return;
```

### `UDF-AUD-268` — **HIGH** | Performance & Efficiency / `fetchLeaveRequestsByStatus` queries the entire `leave_requests` collection without `siteId` or `limit()`, filtering client-side.
- **Target File(s)**: `src/services/requestService.ts` (`requestService.ts:40–56`)
- **Root Cause & Exact Code Trace**:
  - `fetchLeaveRequestsByStatus` runs `getDocs(collection(db, 'leave_requests'))` (or `where('status', '==', status)`) without `siteId` or `limit()` and filters in JS.
- **Real-World Impact**:
  - Causes unbounded Firestore read billing and slow page loads as `leave_requests` grows.
- **Remediation (`diff`)**:
```diff
--- a/src/services/requestService.ts
+++ b/src/services/requestService.ts
@@ -43,2 +43,2 @@
-    const q = query(collection(db, 'leave_requests'), where('status', '==', status));
+    const q = query(collection(db, 'leave_requests'), where('status', '==', status), limit(200));
```

### `UDF-AUD-269` — **HIGH** | Broken Feature / Functional Bug / `processDueResignations` uses browser local timezone and calls direct `setDoc(..., { isProcessed: true }, { merge: true })`, failing `firestore.rules:356` for non-SuperAdmins.
- **Target File(s)**: `src/services/requestService.ts` (`requestService.ts:181–202`)
- **Root Cause & Exact Code Trace**:
  - When a branch supervisor opens the portal, `processDueResignations` attempts a direct client `setDoc` on `resignations/{id}`, which `firestore.rules:356` restricts to SuperAdmin only.
- **Real-World Impact**:
  - Triggers `PERMISSION_DENIED` errors in the console for non-SuperAdmins and relies on client clock/timezone rather than IST.
- **Remediation (`diff`)**:
```diff
--- a/src/services/requestService.ts
+++ b/src/services/requestService.ts
@@ -196,1 +196,1 @@
-        await setDoc(doc(db, 'resignations', resDoc.id), { isProcessed: true }, { merge: true });
+        // Route due-resignation processing through processNoticePeriodExitsCron / server callable.
```

### `UDF-AUD-270` — **HIGH** | Broken Feature / Functional Bug / `revertWorkflowRequest` client fallback calls `setDoc` directly, blocked by `firestore.rules:296, 326, 356` and omitting `approvalHistory`.
- **Target File(s)**: `src/services/requestService.ts` (`requestService.ts:280–288`)
- **Root Cause & Exact Code Trace**:
  - If the server callable fails, `revertWorkflowRequest` falls back to `setDoc(doc(db, col, id), { currentLevel: targetLevel, status: 'Pending' }, { merge: true })`, which is denied by `firestore.rules` for non-SuperAdmins and omits `approvalHistory`.
- **Real-World Impact**:
  - Fallback revert fails for branch approvers and leaves an inconsistent audit trail if executed by SuperAdmin.
- **Remediation (`diff`)**:
```diff
--- a/src/services/requestService.ts
+++ b/src/services/requestService.ts
@@ -280,5 +280,1 @@
-        await setDoc(doc(db, col, requestId), { currentLevel: targetLevel, status: 'Pending' }, { merge: true });
+        throw new Error('Server workflow revert failed; please retry.');
```

### `UDF-AUD-271` — **MEDIUM** | Data Integrity / `updateSites` overwrites the entire `settings/sites` document with `setDoc` without a transaction or optimistic concurrency.
- **Target File(s)**: `src/services/adminService.ts` (`adminService.ts:149–152`)
- **Root Cause & Exact Code Trace**:
  - `updateSites` writes `{ sites }` directly via `setDoc(doc(db, 'settings', 'sites'), { sites })`.
- **Real-World Impact**:
  - Concurrent site edits by two admins silently overwrite each other's changes.
- **Remediation (`diff`)**:
```diff
--- a/src/services/adminService.ts
+++ b/src/services/adminService.ts
@@ -150,1 +150,1 @@
-    await setDoc(doc(db, SETTINGS_COLLECTION, 'sites'), { sites });
+    await runTransaction(db, async (tx) => { tx.set(doc(db, SETTINGS_COLLECTION, 'sites'), { sites }, { merge: true }); });
```

### `UDF-AUD-272` — **LOW** | Broken Feature / Functional Bug / `seedInitialData` checks `settings/roles` instead of the `roles` collection and ignores the `defaultStaff` parameter.
- **Target File(s)**: `src/services/adminService.ts` (`adminService.ts:255–310`)
- **Root Cause & Exact Code Trace**:
  - `seedInitialData` checks `doc(db, 'settings', 'roles')` even though roles live in the top-level `roles` collection, and accepts `defaultStaff` without writing it to `staff_accounts`.
- **Real-World Impact**:
  - Initial environment seeding fails to detect existing roles and never seeds default staff accounts.
- **Remediation (`diff`)**:
```diff
--- a/src/services/adminService.ts
+++ b/src/services/adminService.ts
@@ -260,1 +260,1 @@
-    const rolesSnap = await getDoc(doc(db, 'settings', 'roles'));
+    const rolesSnap = await getDocs(query(collection(db, 'roles'), limit(1)));
```

### `UDF-AUD-273` — **HIGH** | Broken Feature / Functional Bug / `createRewardRedemption` local fallback deducts points in `user_engagement` BEFORE `addDoc('reward_redemptions')` fails with `PERMISSION_DENIED`.
- **Target File(s)**: `src/services/engagementService.ts` (`engagementService.ts:433–459`)
- **Root Cause & Exact Code Trace**:
  - Line `444` decrements `points` on `user_engagement`, then `L446` attempts `addDoc(collection(db, 'reward_redemptions'), ...)` which `firestore.rules:569` (`allow create: if false`) unconditionally rejects.
- **Real-World Impact**:
  - If the Cloud Function fallback triggers, the employee loses all spent points while receiving no reward voucher.
- **Remediation (`diff`)**:
```diff
--- a/src/services/engagementService.ts
+++ b/src/services/engagementService.ts
@@ -435,12 +435,1 @@
-    // Fallback local deduction + addDoc
+    throw new Error('Reward redemption requires server verification; please try again.');
```

### `UDF-AUD-274` — **MEDIUM** | Security Vulnerability / `stats.pendingResignations` and `stats.pendingProfiles` bypass the `isUnassignedStaff` check.
- **Target File(s)**: `components/AdminDashboardPage.tsx` (`AdminDashboardPage.tsx:140, 142, 156, 158`)
- **Root Cause & Exact Code Trace**:
  - `AdminDashboardPage` hides most KPIs when `isUnassignedStaff` is `true`, but renders `stats.pendingResignations` (`L140, 142`) and `stats.pendingProfiles` (`L156, 158`) unconditionally.
- **Real-World Impact**:
  - Unassigned staff with zero site permissions can still see company-wide pending resignation and profile completion counts.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminDashboardPage.tsx
+++ b/components/AdminDashboardPage.tsx
@@ -140,1 +140,1 @@
-    {stats.pendingResignations}
+    {isUnassignedStaff ? 0 : stats.pendingResignations}
```

### `UDF-AUD-275` — **MEDIUM** | Security Vulnerability / `filteredRewards` lacks site scoping, and `filteredInquiries` lacks `canViewInquiries` check and grants B2B `contact_messages` access to `GRIEVANCES_VIEW`.
- **Target File(s)**: `components/AdminGrievancesPage.tsx` (`AdminGrievancesPage.tsx:178–198, 211–222`)
- **Root Cause & Exact Code Trace**:
  - `filteredRewards` (`L178–188`) never checks `allowedSiteIds`, and `filteredInquiries` (`L211–222`) exposes B2B `contact_messages` without verifying a dedicated inquiry permission.
- **Real-World Impact**:
  - Branch supervisors with `GRIEVANCES_VIEW` can see reward redemptions from all sites and private B2B sales inquiries.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminGrievancesPage.tsx
+++ b/components/AdminGrievancesPage.tsx
@@ -180,2 +180,3 @@
     const filteredRewards = rewardRedemptions.filter(r => {
+        if (!isSuperAdmin && allowedSiteIds?.length && r.siteId && !allowedSiteIds.includes(r.siteId)) return false;
```

### `UDF-AUD-276` — **HIGH** | Security & Performance / `loadAttendanceRecords` queries entire `attendance` collection without `limit()`, and mutators lack permission checks and `logSystemAction`.
- **Target File(s)**: `components/AdminWebsiteManager.tsx` (`AdminWebsiteManager.tsx:43–54, 138–146, 178–242`)
- **Root Cause & Exact Code Trace**:
  - `loadAttendanceRecords` (`L138–146`) runs an unbounded `getDocs(collection(db, 'attendance'))`, while `updatePortalConfigField`, `handleSaveQuiz`, `handleDeleteQuiz`, `handleSaveRules`, and `handleSaveBlog` lack UI permission checks and audit logging.
- **Real-World Impact**:
  - Opening Website Manager downloads the entire attendance history of the company and omits audit logs for config/quiz/blog changes.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminWebsiteManager.tsx
+++ b/components/AdminWebsiteManager.tsx
@@ -140,1 +140,1 @@
-    const snap = await getDocs(collection(db, 'attendance'));
+    const snap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(200)));
```

### `UDF-AUD-277` — **MEDIUM** | Broken Feature / Functional Bug / `quizDate` uses UTC (`new Date().toISOString().split('T')[0]`) while `dayIndex` uses local date (`new Date().getDate()`).
- **Target File(s)**: `components/BlogDashboardPage.tsx` (`BlogDashboardPage.tsx:110, 170`)
- **Root Cause & Exact Code Trace**:
  - Between 00:00 and 05:30 IST, `new Date().getDate()` advances to the next calendar day while `toISOString().split('T')[0]` is still yesterday's UTC date.
- **Real-World Impact**:
  - Employees taking the daily quiz between midnight and 5:30 AM IST get yesterday's `quizDate` paired with today's question index, causing duplicate-day conflicts.
- **Remediation (`diff`)**:
```diff
--- a/components/BlogDashboardPage.tsx
+++ b/components/BlogDashboardPage.tsx
@@ -170,1 +170,1 @@
-                    quizDate: new Date().toISOString().split('T')[0]
+                    quizDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
```

### `UDF-AUD-278` — **MEDIUM** | Data Integrity / `handleSaveEdit` overwrites `supervisorIds: editingSite.supervisorId ? [editingSite.supervisorId] : []`, silently wiping co-supervisors.
- **Target File(s)**: `components/AdminSiteManagementPage.tsx` (`AdminSiteManagementPage.tsx:413`)
- **Root Cause & Exact Code Trace**:
  - When editing any site detail (name, address, designations), `handleSaveEdit` (`L413`) replaces `supervisorIds` with a single-element array containing only `editingSite.supervisorId`.
- **Real-World Impact**:
  - All additional co-supervisors assigned to that site are silently removed every time a site is edited.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminSiteManagementPage.tsx
+++ b/components/AdminSiteManagementPage.tsx
@@ -413,1 +413,1 @@
-    supervisorIds: editingSite.supervisorId ? [editingSite.supervisorId] : []
+    supervisorIds: Array.from(new Set([...(editingSite.supervisorIds || []), ...(editingSite.supervisorId ? [editingSite.supervisorId] : [])]))
```

### `UDF-AUD-279` — **MEDIUM** | Broken Feature / Functional Bug / Generates a new random AES-GCM key if `sessionStorage` is empty, silently failing decryption across tabs/restarts without cleaning IndexedDB.
- **Target File(s)**: `src/utils/fileSessionStore.ts` (`fileSessionStore.ts:36–40, 156–160`)
- **Root Cause & Exact Code Trace**:
  - `getOrCreateSessionKey()` (`L36–40`) generates a fresh key if `sessionStorage` lacks the key, causing `crypto.subtle.decrypt` (`L156–160`) to fail and return `null` while leaving unreadable entries in IndexedDB.
- **Real-World Impact**:
  - Draft file attachments stored in IndexedDB become permanently unreadable across new tabs or browser restarts and leak IndexedDB quota.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/fileSessionStore.ts
+++ b/src/utils/fileSessionStore.ts
@@ -158,1 +158,2 @@
-    } catch { return null; }
+    } catch { await removeFileFromSession(key).catch(() => {}); return null; }
```

### `UDF-AUD-280` — **MEDIUM** | Broken Feature / Functional Bug / Only sets `allowedPattern` if `!field.allowedPattern` (skipping `'any'`) and overwrites `settings/form_sections` directly with `setDoc`.
- **Target File(s)**: `src/utils/applyValidationRules.ts` (`applyValidationRules.ts:132–134, 170`)
- **Root Cause & Exact Code Trace**:
  - Line `132` checks `if (!field.allowedPattern)` so fields initialized with `'any'` never receive stricter validation rules, and `L170` writes `settings/form_sections` directly with `setDoc`.
- **Real-World Impact**:
  - Applying validation presets skips fields defaulted to `'any'` and risks overwriting concurrent Form Builder edits.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/applyValidationRules.ts
+++ b/src/utils/applyValidationRules.ts
@@ -132,1 +132,1 @@
-    if (!field.allowedPattern) {
+    if (!field.allowedPattern || field.allowedPattern === 'any') {
```

### `UDF-AUD-281` — **MEDIUM** | Data Integrity / `syncBgvCandidates` never updates `siteId` or `siteName` on existing `bgv_records` when an employee transfers sites or is relieved.
- **Target File(s)**: `src/services/bgvService.ts` (`bgvService.ts:127–310`)
- **Root Cause & Exact Code Trace**:
  - When `bgv_records` already has an entry for an employee, `syncBgvCandidates` skips updating `siteId` and `siteName`.
- **Real-World Impact**:
  - After a site transfer, the old branch supervisor continues seeing the transferred employee's BGV dossier while the new branch supervisor cannot.
- **Remediation (`diff`)**:
```diff
--- a/src/services/bgvService.ts
+++ b/src/services/bgvService.ts
@@ -260,1 +260,3 @@
+        if (existing.siteId !== empSiteId) updates.siteId = empSiteId;
+        if (existing.siteName !== empSiteName) updates.siteName = empSiteName;
```

### `UDF-AUD-282` — **HIGH** | Security Vulnerability / Content Security Policy (`script-src`) includes `'unsafe-inline'`, weakening XSS protection across all hosted portals.
- **Target File(s)**: `firebase.json` (`firebase.json:43`)
- **Root Cause & Exact Code Trace**:
  - In `firebase.json:43`, `Content-Security-Policy` sets `script-src 'self' https://static.cloudflareinsights.com 'unsafe-inline' ...` across `main-site`, `admin`, and `employee` targets.
- **Real-World Impact**:
  - Any DOM/HTML injection bypasses CSP script blocking and executes arbitrary inline JavaScript.
- **Remediation (`diff`)**:
```diff
--- a/firebase.json
+++ b/firebase.json
@@ -43,1 +43,1 @@
-              "value": "... script-src 'self' https://static.cloudflareinsights.com 'unsafe-inline' ..."
+              "value": "... script-src 'self' https://static.cloudflareinsights.com ..."
```

### `UDF-AUD-283` — **MEDIUM** | Security Vulnerability / Secondary hosting configs (`vercel.json` and `netlify.toml`) lack all security headers and rewrite `/api/*` to `/index.html`.
- **Target File(s)**: `vercel.json`<br>`netlify.toml` (`vercel.json:1–13`<br>`netlify.toml:1–12`)
- **Root Cause & Exact Code Trace**:
  - Unlike `firebase.json`, neither `vercel.json` nor `netlify.toml` configures `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy`, and both catch-all rewrite `/*` to `/index.html`.
- **Real-World Impact**:
  - Deploying to Vercel or Netlify exposes the app without clickjacking/MIME-sniffing/CSP headers and breaks `/api/*` rewrites.
- **Remediation (`diff`)**:
```diff
--- a/vercel.json
+++ b/vercel.json
@@ -12,1 +12,4 @@
-    ]
+    ],
+    "headers": [{ "source": "/(.*)", "headers": [{ "key": "X-Frame-Options", "value": "SAMEORIGIN" }, { "key": "X-Content-Type-Options", "value": "nosniff" }] }]
```

### `UDF-AUD-284` — **HIGH** | Broken Feature / Functional Bug / `filteredLogs` calls `.toLowerCase()` on `entry.details` and `entry.actorName` without null guards, crashing on mismatched schemas.
- **Target File(s)**: `components/AdminAuditLogPage.tsx` (`AdminAuditLogPage.tsx:109–111`)
- **Root Cause & Exact Code Trace**:
  - Lines `110–111` evaluate `entry.details.toLowerCase()` and `entry.actorName.toLowerCase()` without `(entry.details || '')`.
- **Real-World Impact**:
  - Viewing the Audit Log page throws `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` whenever any log entry lacks `details` or `actorName`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminAuditLogPage.tsx
+++ b/components/AdminAuditLogPage.tsx
@@ -110,2 +110,2 @@
-                entry.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
-                entry.actorName.toLowerCase().includes(searchTerm.toLowerCase());
+                (entry.details || entry.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
+                (entry.actorName || entry.actorEmail || '').toLowerCase().includes(searchTerm.toLowerCase());
```

### `UDF-AUD-285` — **MEDIUM** | Broken Feature / Functional Bug / `subscribeToAuditLogs` fetches `limit(100)` globally first and filters `actorId` client-side.
- **Target File(s)**: `components/AdminAuditLogPage.tsx`<br>`src/services/auditService.ts` (`AdminAuditLogPage.tsx:94–96`<br>`auditService.ts:71–95`)
- **Root Cause & Exact Code Trace**:
  - `auditService.ts:71–76` queries the latest 100 `audit_logs` globally and filters `log.actorId === filter.actorId` in JS (`L88–91`).
- **Real-World Impact**:
  - Non-SuperAdmin staff see far fewer than 100 of their own logs (or 0 logs) whenever 100+ other staff actions occur.
- **Remediation (`diff`)**:
```diff
--- a/src/services/auditService.ts
+++ b/src/services/auditService.ts
@@ -72,4 +72,5 @@
-    let q = query(collection(db, AUDIT_LOGS_COLLECTION), orderBy('timestamp', 'desc'), limit(limitCount));
+    const constraints: any[] = filter?.actorId ? [where('actorId', '==', filter.actorId)] : [];
+    let q = query(collection(db, AUDIT_LOGS_COLLECTION), ...constraints, orderBy('timestamp', 'desc'), limit(limitCount));
```

### `UDF-AUD-286` — **MEDIUM** | Security & Audit Integrity / Hidden `Ctrl+Shift+Alt+L` mode directly edits or deletes `audit_logs` via `_deleteAuditLog`/`_updateAuditLogDetails` without confirmation or immutable trail.
- **Target File(s)**: `components/AdminAuditLogPage.tsx`<br>`src/services/auditService.ts` (`AdminAuditLogPage.tsx:59–83`<br>`auditService.ts:103–111`)
- **Root Cause & Exact Code Trace**:
  - `AdminAuditLogPage.tsx:59–83` exposes a keyboard-triggered edit/delete mode for `isSuperAdmin` that calls `deleteDoc`/`updateDoc` on `audit_logs`.
- **Real-World Impact**:
  - Compromises audit log immutability and allows accidental or unlogged erasure of forensic records (and fails `firestore.rules:408` if `allow update, delete: if false`).
- **Remediation (`diff`)**:
```diff
--- a/components/AdminAuditLogPage.tsx
+++ b/components/AdminAuditLogPage.tsx
@@ -59,3 +59,3 @@
-    const handleDelete = useCallback(async (logId: string) => {
-        if (!isSuperAdmin) return;
+    const handleDelete = useCallback(async () => {
+        return; // Audit logs are strictly immutable
```

### `UDF-AUD-287` — **MEDIUM** | Broken Feature / Functional Bug / Uses UTC date for `incidentDate`, passes `siteId: undefined` when `empInfo` lacks `siteId`, and checks role name `'field officer'` instead of permission.
- **Target File(s)**: `components/AdminDisciplinaryPage.tsx` (`AdminDisciplinaryPage.tsx:38, 76, 84, 129`)
- **Root Cause & Exact Code Trace**:
  - Line `38` initializes `incidentDate` with `new Date().toISOString().split('T')[0]`, `L76` passes `siteId: undefined` (crashing Firestore without `ignoreUndefinedProperties`), and `L129` checks `userRole?.name.toLowerCase().includes('field officer')`.
- **Real-World Impact**:
  - Disciplinary entries filed between 00:00–05:30 IST default to yesterday's date, and missing `siteId` throws `Unsupported field value: undefined`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminDisciplinaryPage.tsx
+++ b/components/AdminDisciplinaryPage.tsx
@@ -38,1 +38,1 @@
-  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
+  const [incidentDate, setIncidentDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
```

### `UDF-AUD-288` — **MEDIUM** | Security Vulnerability / Site-scoping filter `if (action.siteId && !allowedSiteIds.includes(action.siteId))` fails open when `action.siteId` is missing.
- **Target File(s)**: `components/AdminDisciplinaryPage.tsx` (`AdminDisciplinaryPage.tsx:110–112`)
- **Root Cause & Exact Code Trace**:
  - Line `111` only excludes records when `action.siteId` is truthy. Any disciplinary record without `siteId` passes the filter for all branch supervisors.
- **Real-World Impact**:
  - Legacy or un-sited disciplinary actions are visible to branch supervisors who lack `DISCIPLINE_VIEW_SCOPE_ALL`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminDisciplinaryPage.tsx
+++ b/components/AdminDisciplinaryPage.tsx
@@ -111,1 +111,1 @@
-      if (action.siteId && !allowedSiteIds.includes(action.siteId)) return false;
+      if (!action.siteId || !allowedSiteIds.includes(action.siteId)) return false;
```

### `UDF-AUD-289` — **MEDIUM** | Broken Feature / Functional Bug / `addClientIdDefinition` generates `id` with `Math.random().toString(36).substr(2, 9)` and only mutates React state without auto-persisting.
- **Target File(s)**: `components/AdminWorkflowConfigPage.tsx` (`AdminWorkflowConfigPage.tsx:155, 317–323`)
- **Root Cause & Exact Code Trace**:
  - Line `155` uses `Math.random()` for Client ID definition IDs and `L160–163` / `L167–175` mutate `portalConfig` in memory only.
- **Real-World Impact**:
  - Navigating away before clicking Save silently discards Client ID definitions, and `Math.random()` risks ID collisions.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminWorkflowConfigPage.tsx
+++ b/components/AdminWorkflowConfigPage.tsx
@@ -155,1 +155,1 @@
-      id: Math.random().toString(36).substr(2, 9),
+      id: crypto.randomUUID(),
```

### `UDF-AUD-290` — **MEDIUM** | Broken Feature / Functional Bug / `handleGenerateInvite` writes `auth.currentUser?.uid || authUser.id` as `createdBy`, and `handleSaveReactivation` resets `joined: 0` on single-use invites.
- **Target File(s)**: `components/AdminInvitesPage.tsx` (`AdminInvitesPage.tsx:486, 591–595`)
- **Root Cause & Exact Code Trace**:
  - `L486` sets `createdBy` from `auth.currentUser?.uid` (which may differ from `authUser.id`), and `L594` resets `joined: 0` on reactivated single-use invites even though historical `employees.recruitedBy` / `onboarding_submissions` still exist.
- **Real-World Impact**:
  - Recruiter invite ownership queries can mismatch `createdBy`, and reactivating a single-use invite erases its `joined` conversion metric.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminInvitesPage.tsx
+++ b/components/AdminInvitesPage.tsx
@@ -594,1 +594,1 @@
-        ...((!inviteToReactivate.isReusable && (inviteToReactivate.joined || 0) >= 1) ? { joined: 0 } : {})
+        isReusable: true
```

### `UDF-AUD-291` — **MEDIUM** | Broken Feature / Functional Bug / Uses blocking native `alert()` dialogs for all validation/errors and lacks `customExpiryDate` past-date validation.
- **Target File(s)**: `components/AdminInvitesPage.tsx` (`AdminInvitesPage.tsx:450–464, 525, 575, 601, 610, 621`)
- **Root Cause & Exact Code Trace**:
  - `AdminInvitesPage.tsx` calls `alert(...)` across 9 handlers instead of `onNotify` and accepts any past date in `customExpiryDate` (`L472–473`), creating already-expired links.
- **Real-World Impact**:
  - Degrades UX with browser-blocking alerts and lets recruiters accidentally generate pre-expired referral links.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminInvitesPage.tsx
+++ b/components/AdminInvitesPage.tsx
@@ -472,2 +472,5 @@
       if (expiryDays === 'custom' && customExpiryDate) {
+        if (new Date(customExpiryDate) <= new Date()) {
+          alert('Custom expiry date must be in the future.'); return;
+        }
         expiresAt = new Date(customExpiryDate).toISOString();
```

### `UDF-AUD-292` — **MEDIUM** | Data Integrity / Updates `staff_accounts` and `settings/sites` sequentially without a Firestore `writeBatch` or transaction.
- **Target File(s)**: `components/AdminStaffManagementPage.tsx` (`AdminStaffManagementPage.tsx:227, 258, 319, 360, 460, 468`)
- **Root Cause & Exact Code Trace**:
  - `handleAddStaff`, `saveStaffEdit`, `executeStatusToggle`, and `handleTransferSites` perform separate `updateDoc`/`setDoc` calls on `staff_accounts` and `settings/sites`.
- **Real-World Impact**:
  - If the `settings/sites` update fails or is interrupted, `staff_accounts.sitesManaged` and `settings/sites.supervisorIds` become permanently desynchronized.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminStaffManagementPage.tsx
+++ b/components/AdminStaffManagementPage.tsx
@@ -460,2 +460,3 @@
-      await updateDoc(doc(db, 'staff_accounts', targetStaff.id), { sitesManaged: newTargetSites });
+      const batch = writeBatch(db);
+      batch.update(doc(db, 'staff_accounts', targetStaff.id), { sitesManaged: newTargetSites });
```

### `UDF-AUD-293` — **MEDIUM** | Data Integrity / `saveStaffEdit` spreads the entire `StaffUser` object (`...updates`) into `setDoc(..., { merge: true })`.
- **Target File(s)**: `components/AdminStaffManagementPage.tsx` (`AdminStaffManagementPage.tsx:313–326`)
- **Root Cause & Exact Code Trace**:
  - `const { password, ...updates } = editingStaff;` (`L313`) spreads all client properties into `setDoc` (`L319–322`), risking writing `undefined` or stale properties.
- **Real-World Impact**:
  - Can throw Firestore `Unsupported field value: undefined` or overwrite server-managed fields like `claimsUpdatedAt`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminStaffManagementPage.tsx
+++ b/components/AdminStaffManagementPage.tsx
@@ -319,4 +319,5 @@
         await setDoc(doc(db, 'staff_accounts', editingStaff.id), {
-          ...updates,
+          name: updates.name,
+          email: updates.email,
+          roleId: updates.roleId,
           sitesManaged: sitesToSave
         }, { merge: true });
```

### `UDF-AUD-294` — **MEDIUM** | Broken Feature / Functional Bug / `filteredUsers` calls `.toLowerCase()` on `user.name`, `user.username`, and `user.email` without null guards.
- **Target File(s)**: `components/AdminRoleManagementPage.tsx` (`AdminRoleManagementPage.tsx:738–749`)
- **Root Cause & Exact Code Trace**:
  - Lines `740` and `744–746` invoke `.toLowerCase()` directly on `user.username` and `user.email`.
- **Real-World Impact**:
  - Crashes the User Overrides tab with `TypeError` if any legacy staff document omits `username` or `email`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminRoleManagementPage.tsx
+++ b/components/AdminRoleManagementPage.tsx
@@ -744,3 +744,3 @@
-      user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
-      user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
-      user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
+      (user.name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
+      (user.username || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
+      (user.email || '').toLowerCase().includes(userSearchQuery.toLowerCase());
```

### `UDF-AUD-295` — **MEDIUM** | Security & Performance / Subscribes to the entire `recycle_bin` collection without `limit()` or site scoping.
- **Target File(s)**: `components/AdminRecycleBinPage.tsx` (`AdminRecycleBinPage.tsx:103–110, 121–126`)
- **Root Cause & Exact Code Trace**:
  - `subscribeToRecycleBin` (`L104`) fetches all `recycle_bin` documents unconditionally, and `filteredItems` (`L113–132`) never filters by `allowedSiteIds` for non-SuperAdmins.
- **Real-World Impact**:
  - Non-SuperAdmins with Recycle Bin access see deleted records from every site and download the entire archive on mount.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminRecycleBinPage.tsx
+++ b/components/AdminRecycleBinPage.tsx
@@ -114,2 +114,3 @@
     return items.filter(item => {
+      if (!isSuperAdmin && allowedSiteIds?.length && item.siteId && !allowedSiteIds.includes(item.siteId)) return false;
```

### `UDF-AUD-296` — **LOW** | Broken Feature / Functional Bug / `getDaysRemaining` displays `NaN` when `expiresAtStr` is invalid or missing.
- **Target File(s)**: `components/AdminRecycleBinPage.tsx` (`AdminRecycleBinPage.tsx:177–186`)
- **Root Cause & Exact Code Trace**:
  - `new Date(expiresAtStr).getTime()` returns `NaN` without throwing, so `Math.max(0, Math.ceil((NaN - now) / ...))` evaluates to `NaN` rather than hitting the `catch` block (`30`).
- **Real-World Impact**:
  - Items with missing/malformed `expiresAt` render `'NaN days left'` in the Recycle Bin table.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminRecycleBinPage.tsx
+++ b/components/AdminRecycleBinPage.tsx
@@ -181,2 +181,2 @@
       const diffDays = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
-      return Math.max(0, diffDays);
+      return Number.isFinite(diffDays) ? Math.max(0, diffDays) : 30;
```

### `UDF-AUD-297` — **MEDIUM** | Broken Feature / Functional Bug / `getEmployeeBalance` fails to match `leaveBalances` by `portalId` and lacks in-flight loading state on Revert/Bypass buttons.
- **Target File(s)**: `components/AdminLeaveManagementPage.tsx` (`AdminLeaveManagementPage.tsx:113–139, 454, 491`)
- **Root Cause & Exact Code Trace**:
  - `L134` checks `b.employeeId === employeeId` only (failing when `selectedRequest.employeeId` is a `portalId`), and `L454`/`L491` use `window.confirm()` without disabling buttons during async execution.
- **Real-World Impact**:
  - Leave balance lookup shows `0` for `portalId`-keyed requests, and double-clicking Revert/Bypass can fire duplicate server actions.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminLeaveManagementPage.tsx
+++ b/components/AdminLeaveManagementPage.tsx
@@ -134,1 +134,1 @@
-        const empBalance = leaveBalances.find(b => b.employeeId === employeeId);
+        const empBalance = leaveBalances.find(b => b.employeeId === employeeId || b.id === employeeId);
```

### `UDF-AUD-298` — **MEDIUM** | Broken Feature / Functional Bug / Checks `userRole?.name.toLowerCase().includes('field officer')` by display name and lacks in-flight loading state on Revert/Bypass buttons.
- **Target File(s)**: `components/AdminResignationManagementPage.tsx` (`AdminResignationManagementPage.tsx:101, 301, 340`)
- **Root Cause & Exact Code Trace**:
  - Line `101` gates UI behavior on the role's display name string `'field officer'`, and `L301`/`L340` lack disabled/loading guards during async actions.
- **Real-World Impact**:
  - Renaming the Field Officer role breaks the UI banner, and rapid clicks on Revert/Bypass can trigger duplicate server calls.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminResignationManagementPage.tsx
+++ b/components/AdminResignationManagementPage.tsx
@@ -101,1 +101,1 @@
-        {userRole?.name.toLowerCase().includes('field officer') && (
+        {!hasPermission(Permission.RESIGNATIONS_VIEW_SCOPE_ALL) && (
```

### `UDF-AUD-299` — **MEDIUM** | Broken Feature / Functional Bug / Checks `userRole?.name.toLowerCase().includes('field officer')` by display name and lacks in-flight loading state on Revert/Bypass buttons.
- **Target File(s)**: `components/AdminAccountUpdateManagementPage.tsx` (`AdminAccountUpdateManagementPage.tsx:88, 258, 297`)
- **Root Cause & Exact Code Trace**:
  - Line `88` checks `userRole?.name.toLowerCase().includes('field officer')`, and `L258`/`L297` allow double-clicks on Revert/Bypass actions.
- **Real-World Impact**:
  - Custom-named site-scoped roles miss the scoped notice, and Revert/Bypass can fire duplicate requests.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminAccountUpdateManagementPage.tsx
+++ b/components/AdminAccountUpdateManagementPage.tsx
@@ -88,1 +88,1 @@
-        {userRole?.name.toLowerCase().includes('field officer') && (
+        {!hasPermission(Permission.ACCOUNT_UPDATES_VIEW_SCOPE_ALL) && (
```

### `UDF-AUD-300` — **MEDIUM** | Broken Feature / Functional Bug / `isRoleAssignedToSite` returns `true` for any role with `*_VIEW_SCOPE_ALL` even if zero active staff users hold that role.
- **Target File(s)**: `src/utils/workflowHelper.ts` (`workflowHelper.ts:207–219, 263–281`)
- **Root Cause & Exact Code Trace**:
  - `isRoleAssignedToSite` (`L208–218`) returns `true` solely from role permissions without checking whether any non-disabled `staffUsers` actually hold `roleObj.id`.
- **Real-World Impact**:
  - `getEffectiveApprovalLevel` stops at an unstaffed global role level, stalling approvals until a SuperAdmin intervenes.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/workflowHelper.ts
+++ b/src/utils/workflowHelper.ts
@@ -215,3 +215,3 @@
       if (hasGlobalScope) {
-        return true;
+        return staffUsers.some(u => u.roleId === roleId && !u.isDisabled);
       }
```

### `UDF-AUD-301` — **MEDIUM** | Broken Feature / Functional Bug / `onAuthStateChanged` reads `localStorage.getItem('portalType')` instead of hostname, causing cross-portal profile misresolution.
- **Target File(s)**: `src/context/AuthContext.tsx` (`AuthContext.tsx:39–49, 65–76`)
- **Root Cause & Exact Code Trace**:
  - Lines `40` and `65–76` rely on `localStorage.getItem('portalType')`. If a user switches subdomains or has stale `portalType`, `AuthContext` resolves the wrong profile type.
- **Real-World Impact**:
  - An admin visiting `employee.udfonline.in` with stale `portalType = 'management'` resolves as `UserType.ADMIN` and triggers `AuthGuard` redirects.
- **Remediation (`diff`)**:
```diff
--- a/src/context/AuthContext.tsx
+++ b/src/context/AuthContext.tsx
@@ -40,1 +40,2 @@
-            const portalType = localStorage.getItem('portalType');
+            const host = window.location.hostname;
+            const portalType = host.startsWith('admin.') ? 'management' : host.startsWith('employee.') ? 'employee' : localStorage.getItem('portalType');
```

### `UDF-AUD-302` — **MEDIUM** | Broken Feature / Functional Bug / Real-time `staff_accounts` listener updates `roleId`, `sitesManaged`, `permissionOverrides`, and `isDisabled`, but ignores `name` and `email` edits.
- **Target File(s)**: `src/context/AuthContext.tsx` (`AuthContext.tsx:120–139`)
- **Root Cause & Exact Code Trace**:
  - Lines `124–137` only compare `roleId`, `sitesManaged`, `permissionOverrides`, and `isDisabled`.
- **Real-World Impact**:
  - When a SuperAdmin updates a staff member's display name, the logged-in staff member's header and audit actor name stay stale until re-login.
- **Remediation (`diff`)**:
```diff
--- a/src/context/AuthContext.tsx
+++ b/src/context/AuthContext.tsx
@@ -127,2 +127,3 @@
                         const statusChanged = data.isDisabled !== undefined && data.isDisabled !== prev.isDisabled;
+                        const nameChanged = data.name !== undefined && data.name !== prev.name;
```

### `UDF-AUD-303` — **LOW** | Performance / Build / `dist-public` PWA precache only ignores `Admin*.js`/`admin*.js` while still precaching `vendor-excel` (`xlsx`) and `vendor-pdf` (`pdf-lib`/`pdfjs-dist`).
- **Target File(s)**: `vite.config.ts` (`vite.config.ts:593–602`)
- **Root Cause & Exact Code Trace**:
  - `vite.config.ts:594` sets `maximumFileSizeToCacheInBytes: 4 * 1024 * 1024` and `L597–602` only excludes `Admin*.js`/`admin*.js` on `public` builds.
- **Real-World Impact**:
  - Public marketing visitors download and precache heavy Excel/PDF libraries in the background.
- **Remediation (`diff`)**:
```diff
--- a/vite.config.ts
+++ b/vite.config.ts
@@ -599,2 +599,2 @@
-              ? ['**/Admin*.js', '**/admin*.js']
+              ? ['**/Admin*.js', '**/admin*.js', '**/vendor-excel*.js', '**/vendor-pdf*.js']
```

### `UDF-AUD-304` — **MEDIUM** | Broken Feature / Functional Bug / `Apply Now` buttons navigate to `/join?siteId=...&role=...` where `role` fails to pre-select if `vacancy.title` doesn't exactly match a dropdown option.
- **Target File(s)**: `components/BlogPage.tsx`<br>`components/BlogsPage.tsx`<br>`components/CareersPage.tsx` (`BlogPage.tsx:108`<br>`BlogsPage.tsx:166`<br>`CareersPage.tsx:49`)
- **Root Cause & Exact Code Trace**:
  - All three public pages pass `role=${encodeURIComponent(vacancy.title)}` to `/join`, without matching against `site.allowedDesignations` or `postField.options`.
- **Real-World Impact**:
  - Clicking 'Apply Now' on a vacancy with a descriptive title (e.g. `'Night Shift Security Guard'`) leaves the Role dropdown unselected on `/join`.
- **Remediation (`diff`)**:
```diff
--- a/components/CareersPage.tsx
+++ b/components/CareersPage.tsx
@@ -49,1 +49,1 @@
-        navigate(`/join?siteId=${vacancy.siteId}&role=${encodeURIComponent(vacancy.title)}`);
+        navigate(`/join?siteId=${vacancy.siteId}&role=${encodeURIComponent((vacancy as any).designation || vacancy.title)}`);
```

### `UDF-AUD-305` — **MEDIUM** | Performance & Efficiency / Blog search filter runs `.toLowerCase().includes()` across full HTML `post.content` on every keystroke without `useMemo` or debouncing.
- **Target File(s)**: `components/BlogsPage.tsx` (`BlogsPage.tsx:147–149`)
- **Root Cause & Exact Code Trace**:
  - Lines `147–149` execute unmemoized substring scans over raw HTML strings (`post.content`) on every render.
- **Real-World Impact**:
  - Typing in the blog search bar causes noticeable main-thread lag as published blog posts grow.
- **Remediation (`diff`)**:
```diff
--- a/components/BlogsPage.tsx
+++ b/components/BlogsPage.tsx
@@ -145,4 +145,4 @@
-    const filteredPosts = posts.filter(post => {
+    const filteredPosts = React.useMemo(() => posts.filter(post => {
         ...
-    });
+    }), [posts, searchQuery, selectedCategory]);
```

### `UDF-AUD-306` — **MEDIUM** | Security Vulnerability / `printPromotionLetter` opens `window.open('', '_blank')` without `'noopener'` and writes HTML via `document.write()` with external Google Fonts.
- **Target File(s)**: `src/utils/promotionLetterGenerator.ts` (`promotionLetterGenerator.ts:38–40, 269–276`)
- **Root Cause & Exact Code Trace**:
  - `L269` omits `'noopener,noreferrer'` on `window.open` and `L274` writes via `document.write()`.
- **Real-World Impact**:
  - Exposes `window.opener` if navigated and fails to render custom fonts in offline/CSP-restricted environments.
- **Remediation (`diff`)**:
```diff
--- a/src/utils/promotionLetterGenerator.ts
+++ b/src/utils/promotionLetterGenerator.ts
@@ -269,1 +269,1 @@
-    const printWin = window.open('', '_blank', 'width=850,height=1100');
+    const printWin = window.open('', '_blank', 'noopener,noreferrer,width=850,height=1100');
```

### `UDF-AUD-307` — **LOW** | Performance & Efficiency / `getVacancies()` and `getOpenVacancies()` execute unbounded `getDocs()` queries without `orderBy` or `limit()`.
- **Target File(s)**: `src/services/vacancyService.ts` (`vacancyService.ts:13–28, 64–76`)
- **Root Cause & Exact Code Trace**:
  - Both functions fetch all matching documents in `vacancies` without pagination or `limit()`, and `getOpenVacancies` never filters out expired vacancies.
- **Real-World Impact**:
  - Public `/careers` and `/blogs` pages fetch unbounded vacancy lists on every visit.
- **Remediation (`diff`)**:
```diff
--- a/src/services/vacancyService.ts
+++ b/src/services/vacancyService.ts
@@ -66,3 +66,4 @@
         const q = query(
             collection(db, VACANCIES_COLLECTION),
-            where("status", "==", "Open")
+            where("status", "==", "Open"),
+            limit(100)
         );
```

### `UDF-AUD-308` — **MEDIUM** | Data Integrity / `updateSiteDetails` and `saveAllSites` perform non-transactional read-modify-write on `settings/sites`.
- **Target File(s)**: `src/services/siteService.ts` (`siteService.ts:143–176`)
- **Root Cause & Exact Code Trace**:
  - `updateSiteDetails` (`L150–162`) reads `sites` with `getDoc`, modifies one element in JS, and overwrites the entire `sites` array via `setDoc({ merge: true })`.
- **Real-World Impact**:
  - Concurrent updates by two admins to different sites overwrite each other's changes silently.
- **Remediation (`diff`)**:
```diff
--- a/src/services/siteService.ts
+++ b/src/services/siteService.ts
@@ -150,2 +150,2 @@
-        const snap = await getDoc(sitesRef);
+        await runTransaction(db, async (tx) => { const snap = await tx.get(sitesRef);
```

### `UDF-AUD-309` — **MEDIUM** | Performance & Efficiency / `subscribeToAuditLogs` has no `where('actorId', '==', ...)` server-side filter when `filter?.actorId` is passed.
- **Target File(s)**: `src/services/auditService.ts` (`auditService.ts:71–76`)
- **Root Cause & Exact Code Trace**:
  - `subscribeToAuditLogs` fetches the 100 newest global logs regardless of `filter.actorId` and filters client-side at `L88–91`.
- **Real-World Impact**:
  - Wastes 100 Firestore reads per snapshot and hides a user's logs whenever 100 newer global logs exist.
- **Remediation (`diff`)**:
```diff
--- a/src/services/auditService.ts
+++ b/src/services/auditService.ts
@@ -72,3 +72,4 @@
     let q = query(
         collection(db, AUDIT_LOGS_COLLECTION),
+        ...(filter?.actorId ? [where('actorId', '==', filter.actorId)] : []),
         orderBy('timestamp', 'desc'),
```

### `UDF-AUD-310` — **MEDIUM** | Security & Privacy / `AdminPortalPage` persists `activeTimelineEmployeeId` in `sessionStorage` without clearing it on logout.
- **Target File(s)**: `components/AdminPortalPage.tsx` (`AdminPortalPage.tsx:291, 516, 537, 802, 810`)
- **Root Cause & Exact Code Trace**:
  - Lines `301, 516, 537, 810` write `sessionStorage.setItem('activeTimelineEmployeeId', empId)` and never clear it in `onLogout`.
- **Real-World Impact**:
  - If a different admin logs into the same browser tab, the previous admin's last viewed employee ID remains in `sessionStorage`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminPortalPage.tsx
+++ b/components/AdminPortalPage.tsx
@@ -802,1 +802,1 @@
-  const getSavedTimelineId = () => { try { return sessionStorage.getItem('activeTimelineEmployeeId'); } catch { return null; } };
+  // Clear activeTimelineEmployeeId on logout in handleLogout
```

### `UDF-AUD-311` — **MEDIUM** | Broken Feature / Functional Bug / `AdminInvitesPage` restores `adminInvitesActiveTab` from `sessionStorage` without checking whether the current user has permission for that tab.
- **Target File(s)**: `components/AdminInvitesPage.tsx` (`AdminInvitesPage.tsx:87–95`)
- **Root Cause & Exact Code Trace**:
  - Lines `87–95` read/write `sessionStorage.getItem('adminInvitesActiveTab')` unconditionally, swallowing errors with empty `catch (e) {}`.
- **Real-World Impact**:
  - A recruiter who opens a tab after a SuperAdmin in the same browser session can land on a tab they lack permissions for.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminInvitesPage.tsx
+++ b/components/AdminInvitesPage.tsx
@@ -87,2 +87,3 @@
-    const saved = sessionStorage.getItem('adminInvitesActiveTab');
+    const saved = sessionStorage.getItem('adminInvitesActiveTab');
+    // Validate saved tab against current user's INVITES_* permissions
```

### `UDF-AUD-312` — **MEDIUM** | Performance & Efficiency / Missing composite indexes for `employees (isActive, siteId, joiningDate)`, `leave_requests (employeeId, status)`, `bgv_records (siteId, status)`, and `audit_logs (actorId, timestamp DESC)`.
- **Target File(s)**: `firestore.indexes.json` (`firestore.indexes.json:1–238`)
- **Root Cause & Exact Code Trace**:
  - Inspecting all 238 lines of `firestore.indexes.json` shows no composite indexes for these four query combinations.
- **Real-World Impact**:
  - Adding server-side site/actor filters on these collections throws `FAILED_PRECONDITION: The query requires an index` until deployed.
- **Remediation (`diff`)**:
```diff
--- a/firestore.indexes.json
+++ b/firestore.indexes.json
@@ -234,2 +234,11 @@
         }
+        ,{
+            "collectionGroup": "audit_logs",
+            "queryScope": "COLLECTION",
+            "fields": [
+                { "fieldPath": "actorId", "order": "ASCENDING" },
+                { "fieldPath": "timestamp", "order": "DESCENDING" }
+            ]
+        }
     ],
```

### `UDF-AUD-313` — **MEDIUM** | Security Vulnerability / BGV vendor filtering uses case-insensitive substring `.includes()` on `vendorName` instead of exact `vendorId === authUser.id`.
- **Target File(s)**: `components/AdminBgvManagementPage.tsx` (`AdminBgvManagementPage.tsx:249–253`)
- **Root Cause & Exact Code Trace**:
  - Line `250` checks `!record.vendorName.toLowerCase().includes(authUser.name.toLowerCase())`.
- **Real-World Impact**:
  - A vendor named `'Alpha'` can view cases assigned to `'Alpha Omega Services'`.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminBgvManagementPage.tsx
+++ b/components/AdminBgvManagementPage.tsx
@@ -250,1 +250,1 @@
-        if (record.vendorName && !record.vendorName.toLowerCase().includes(authUser.name.toLowerCase())) {
+        if (!record.vendorName || record.vendorName.toLowerCase().trim() !== authUser.name.toLowerCase().trim()) {
```

### `UDF-AUD-314` — **MEDIUM** | Security Vulnerability / BGV site scoping fails open when `allowedSiteIds` is `[]` (unassigned staff).
- **Target File(s)**: `components/AdminBgvManagementPage.tsx` (`AdminBgvManagementPage.tsx:243–246`)
- **Root Cause & Exact Code Trace**:
  - Line `244` checks `if (!hasScopeAll && allowedSiteIds && allowedSiteIds.length > 0 && !allowedSiteIds.includes(record.siteId))`.
- **Real-World Impact**:
  - An unassigned staff user with `allowedSiteIds = []` bypasses the filter and sees every BGV record in the company.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminBgvManagementPage.tsx
+++ b/components/AdminBgvManagementPage.tsx
@@ -244,1 +244,1 @@
-      if (!hasScopeAll && allowedSiteIds && allowedSiteIds.length > 0 && !allowedSiteIds.includes(record.siteId)) {
+      if (!hasScopeAll && (!allowedSiteIds || !allowedSiteIds.includes(record.siteId))) {
```

### `UDF-AUD-315` — **MEDIUM** | Broken Feature / Functional Bug / `handleGoogleLink` and `handleSetPassword` silently no-op when `user?.employeeId` is missing and omit Auth token refresh.
- **Target File(s)**: `src/components/auth/SetupAccountPage.tsx` (`SetupAccountPage.tsx:29–41, 66–74`)
- **Root Cause & Exact Code Trace**:
  - Both handlers wrap all logic in `if (user && user.employeeId)` with no `else` branch setting an error, leaving the user stuck on the page with no feedback.
- **Real-World Impact**:
  - Employees whose profile hydration omitted `employeeId` experience silent button clicks with zero error message.
- **Remediation (`diff`)**:
```diff
--- a/src/components/auth/SetupAccountPage.tsx
+++ b/src/components/auth/SetupAccountPage.tsx
@@ -41,1 +41,3 @@
             }
+            else { setError('Employee profile ID is missing. Please log out and sign in again.'); }
```

### `UDF-AUD-316` — **LOW** | Security Vulnerability / `handleSubmit` writes directly to `contact_messages` from unauthenticated clients without rate limiting, CAPTCHA, or field-length validation.
- **Target File(s)**: `components/ContactPage.tsx` (`ContactPage.tsx:47–60`)
- **Root Cause & Exact Code Trace**:
  - Lines `52–59` call `addDoc(collection(db, 'contact_messages'), ...)` directly with no client throttling, honeypot, or max-length bounds.
- **Real-World Impact**:
  - Automated bots can flood `contact_messages` with arbitrary-size spam documents.
- **Remediation (`diff`)**:
```diff
--- a/components/ContactPage.tsx
+++ b/components/ContactPage.tsx
@@ -48,2 +48,5 @@
     const handleSubmit = async (e: React.FormEvent) => {
         e.preventDefault();
+        if (!name.trim() || !email.trim() || message.trim().length > 2000) {
+            setError('Please enter valid details (max 2000 chars).'); return;
+        }
```

### `UDF-AUD-317` — **MEDIUM** | Broken Feature / Functional Bug / `userVisibleColumns` persists column preferences globally in `localStorage['masterListColumnPrefs']` across admin accounts and ignores empty sets.
- **Target File(s)**: `components/AdminMasterEmployeeListPage.tsx` (`AdminMasterEmployeeListPage.tsx:272–281, 294–301`)
- **Root Cause & Exact Code Trace**:
  - `L278` stores preferences under a shared key `'masterListColumnPrefs'` without user ID scoping, and `L296` checks `userVisibleColumns.size > 0` (making it impossible to uncheck all optional columns).
- **Real-World Impact**:
  - Column preferences leak between admin accounts sharing a browser, and unchecking the last column snaps all columns back on.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminMasterEmployeeListPage.tsx
+++ b/components/AdminMasterEmployeeListPage.tsx
@@ -278,1 +278,1 @@
-      localStorage.setItem('masterListColumnPrefs', JSON.stringify(Array.from(next)));
+      localStorage.setItem(`masterListColumnPrefs_${authUser?.id || 'default'}`, JSON.stringify(Array.from(next)));
```

### `UDF-AUD-318` — **MEDIUM** | Broken Feature / Functional Bug / `handleSaveJoiningDate` converts `newJoiningDateValue` (`YYYY-MM-DD`) via `new Date(newJoiningDateValue).toISOString()` without validity or timezone guards.
- **Target File(s)**: `components/AdminMasterEmployeeListPage.tsx` (`AdminMasterEmployeeListPage.tsx:314–320`)
- **Root Cause & Exact Code Trace**:
  - Line `314` runs `new Date(newJoiningDateValue).toISOString()`, which throws `RangeError: Invalid time value` on malformed input and shifts midnight UTC vs IST.
- **Real-World Impact**:
  - Invalid date inputs crash the handler instead of showing a validation error.
- **Remediation (`diff`)**:
```diff
--- a/components/AdminMasterEmployeeListPage.tsx
+++ b/components/AdminMasterEmployeeListPage.tsx
@@ -314,1 +314,2 @@
-      const isoDate = new Date(newJoiningDateValue).toISOString();
+      const parsed = new Date(newJoiningDateValue);
+      if (Number.isNaN(parsed.getTime())) throw new Error('Invalid joining date');
+      const isoDate = parsed.toISOString();
```

### `UDF-AUD-319` — **MEDIUM** | Security & Data Integrity / `handleConfirmApproval` enforces duplicate-submission and active-employee blocking only in client UI `alert()`.
- **Target File(s)**: `components/AdminReviewSubmissionsPage.tsx` (`AdminReviewSubmissionsPage.tsx:1511–1528`)
- **Root Cause & Exact Code Trace**:
  - `L1514–1528` blocks approval of `EXISTING_ACTIVE_EMPLOYEE` and `DUPLICATE_SUBMISSION` on the client, whereas `approveOnboardingServer` does not reject submissions flagged as duplicates on the server.
- **Real-World Impact**:
  - A modified client or race condition between two reviewers can still final-approve duplicate submissions.
- **Remediation (`diff`)**:
```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -5260,2 +5260,5 @@
+    if (subData.duplicateCheck?.isDuplicate && subData.duplicateCheck?.matchType === 'EXISTING_ACTIVE_EMPLOYEE') {
+        throw new functions.https.HttpsError('failed-precondition', 'Duplicate active employee conflict must be resolved first.');
+    }
```

### `UDF-AUD-320` — **LOW** | Performance & Efficiency / Public marketing pages independently call `getWebsiteConfig()` on every route mount without shared caching.
- **Target File(s)**: `components/BusinessSolutionsPage.tsx`<br>`components/ContactPage.tsx` (`BusinessSolutionsPage.tsx:35–45`<br>`ContactPage.tsx:34–44`)
- **Root Cause & Exact Code Trace**:
  - Both `BusinessSolutionsPage` and `ContactPage` call `getWebsiteConfig()` inside `useEffect(..., [])` on every mount.
- **Real-World Impact**:
  - Navigating between public pages triggers redundant Firestore reads and loading spinners.
- **Remediation (`diff`)**:
```diff
--- a/src/services/websiteService.ts
+++ b/src/services/websiteService.ts
@@ -20,2 +20,4 @@
+let cachedConfig: WebsiteServiceData | null = null;
 export const getWebsiteConfig = async (): Promise<WebsiteServiceData | null> => {
+  if (cachedConfig) return cachedConfig;
```

---

## 3. Verified Secure / Working Matrix

| Domain / Subsystem | Inspected Files | Verification Status & Notes |
| :--- | :--- | :--- |
| **1. Syntax & Build Integrity** | `functions/index.js`, all 161 `.ts`/`.tsx`/`.js`/`.mjs`/`.cjs`/`.rules` files (74,205 lines) | `node --check functions/index.js` and all `.js`/`.mjs`/`.cjs` files pass with **0 syntax errors** and **0 duplicate block-scoped declarations**. |
| **2. Storage Rules Lockdown** | `storage.rules` (`L1–47`) | All paths (`/onboarding/**`, `/employees/**`, `/bgv_documents/**`, `/public/**`, `/{allPaths=**}`) enforce `allow write: if false;` on the client, routing writes through server-mediated signed URLs (`getUploadUrl`). |
| **3. Immutable Audit & Gamification Ledgers** | `firestore.rules` (`L405–408, 488–490, 566–571, 595–602`) | `audit_logs`, `_auth_attempts`, `reward_redemptions` (`create`), and `gamification_logs` strictly deny direct client writes (`allow create, update, delete: if false;`). |
| **4. Open Redirect & Canonical Origin Enforcement** | `App.tsx` (`L3–14, 2447–2452`), `src/routes/AppRoutes.tsx` (`L94–101`), `index.tsx` (`L13–22`), `index.html` (`L10–25`) | `?redirect=` parameters are validated via `getSafeRedirectUrl` (requiring leading `/`, rejecting `//`, `/\`, and `://`). `.web.app` and `.firebaseapp.com` origins redirect to `udfonline.in` / subdomains. |
| **5. Cloud Function Endpoint Configuration** | `src/firebase/config.ts` (`L53`), `firebase.json` (`L177–386, 509–718, 841–900`), all 50 `httpsCallable` call sites | All frontend `httpsCallable` invocations import the shared `functions` instance (`getFunctions(app, 'us-central1')`) from `src/firebase/config.ts`, and `firebase.json` defines matching `/api/*` rewrites across all 3 hosting targets. |
| **6. Service Worker Cache Killer & Auto-Updater** | `public/sw.js` (`L1–14`), `index.tsx` (`L49–244`), `firebase.json` (`L142–148`) | `public/sw.js` unregisters stale service workers and purges all caches on activation; `index.tsx` probes `/version.json` and guards open modals/dirty inputs before reloading. |
| **7. Production Purge Script Safeguards** | `scripts/clear-employee-test-data.mjs` (`L1–123`) | Enforces `AUTHORIZED_SUPERADMIN_EMAIL`, `SUPERADMIN_PURGE_CONFIRMATION_PHRASE`, and two interactive terminal confirmation prompts before deleting collections. |
