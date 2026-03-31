## Pulse core logic (for interviews)

This doc explains the main flows in this app: streaming, upload, background processing with progress updates, Redux/RTK Query state management, and RBAC (role-based access control). It also notes what changed in the video player implementation.

---

## 1) Video player streaming logic

### Before (slow path)
- The old `frontend/src/features/videos/components/VideoPlayer.tsx` fetched the stream with `fetch(..., { headers: { Authorization: Bearer } })`.
- It then read the entire response into memory via `res.blob()` and created a `blob:` URL with `URL.createObjectURL(blob)`.
- Because the browser could not start playback until the whole blob was created, “Loading player…” could be slow for large videos.

### Now (range-friendly native playback)
- The new `VideoPlayer` sets the `<video>` element `src` to:
  - `/api/videos/:id/stream?access_token=<JWT>`
- `<video>` cannot attach custom `Authorization` headers, so the backend accepts auth either as:
  - `Authorization: Bearer <token>` (normal API calls), or
  - `access_token` query param for the stream route.
- Backend route wiring:
  - `backend/src/modules/videos/video.routes.ts` registers `GET /videos/:id/stream` using `authenticateJWTBearerOrQuery`, then `requireRole('viewer')`.

### Backend stream mechanics (why it plays with Range)
- `backend/src/modules/videos/video.service.ts#getStreamPayload` uses the `Range` header to read only the requested byte span from storage (`parseByteRange`).
- `backend/src/modules/videos/video.controller.ts#stream` sets:
  - `Accept-Ranges: bytes`
  - `Content-Range` (when returning `206`)
  - and pipes the storage stream directly to the HTTP response.

---

## 2) RBAC (role-based access control)

### Frontend RBAC (UI gating)
- `frontend/src/lib/permissions.ts` defines permissions per role:
  - `viewer`: read
  - `editor`: read + upload + edit_own
  - `admin`: read + upload + edit + delete + manage_users
- `frontend/src/hooks/useRBAC.ts` converts the JWT role into booleans (e.g. `canUpload`, `canEdit`).
- UI components show/hide controls using these booleans.

### Backend RBAC (API enforcement)
- JWT is decoded in `backend/src/middleware/authenticate.ts` into `req.user`:
  - `userId`, `organizationId`, `role`
- `backend/src/middleware/requireRole.ts` enforces minimum role checks using `roleMeetsMinimum`.
- Endpoints in `backend/src/modules/.../*.routes.ts` are protected with `requireRole(...)`.

---

## 3) Upload and file validation logic

### Upload entry points
- `frontend/src/lib/api/pulseApi.ts` mutations call backend endpoints:
  - `POST /api/videos` (create a pending record)
  - `POST /api/videos/:id/upload` (multer upload)
  - also supports a local “presigned-style” flow

### Validation rules (organization settings)
- Organization settings live in MongoDB (`OrganizationModel.settings`) with defaults from:
  - `backend/src/infrastructure/db/models/organization.model.ts`
- During `finalizeAfterUpload`:
  - `backend/src/modules/videos/video.service.ts#finalizeAfterUpload`
    - enforces `maxVideoFileSizeMb`
    - enforces `allowedFormats` (by extension token and/or MIME token)

### Automatic vs manual processing
- If `settings.automaticProcessing === true`:
  - video becomes `processing`, progress starts at `0`
  - a BullMQ job is enqueued
- If `false`:
  - video stays `pending` with `processingStage: 'awaiting_manual'`

---

## 4) Background processing logic + progress tracking

### Enqueuing jobs
- `backend/src/modules/videos/video.service.ts#enqueueProcessing` adds a BullMQ job and updates MongoDB to:
  - `status: 'processing'`
  - `processingProgress: 0`
  - `processingStage: 'queued'`

### Worker logic
- `backend/src/workers/video.worker.ts`:
  1. Confirms the video exists and has a `storagePath`
  2. Uses `FfmpegService` to probe and sample
  3. Runs the sensitivity analyzer using org `settings.sensitivityLevel`
  4. Updates `VideoModel` with:
     - `status`, `metadata`, `safetyStatus`
     - `processingProgress`, `processingStage`
  5. Publishes socket events

### Progress stages
- Worker publishes:
  - `queued`, `probing`, `analyzing`, `finalizing`, `completed`, `failed`

---

## 5) Socket progress delivery (Redis pub/sub -> Socket.io rooms)

### Redis pub/sub
- `backend/src/infrastructure/socket/video-event-bus.ts` publishes events on `pulse:video-events`.

### Socket server forwarding
- `backend/src/infrastructure/socket/socket.server.ts`:
  - authenticates socket connections with JWT
  - `video:subscribe(videoId)` verifies:
    - video exists
    - viewers are assigned to the video
  - joins room `video:<videoId>`
  - forwards Redis messages to the room:
    - `processing_progress`
    - `processing_completed`
    - `processing_failed`

---

## 6) Redux / RTK Query state management

### RTK Query for server state
- `frontend/src/lib/api/pulseApi.ts` defines queries and mutations.
- `frontend/src/lib/api/baseQueryWithReauth.ts`:
  - attaches `Authorization: Bearer ...`
  - on 401, refreshes tokens and retries

### Socket-driven cache updates
- `frontend/src/hooks/useVideoRoomSocket.ts`:
  - subscribes to socket events for a `videoId`
  - on progress:
    - updates the cached `getVideo` result using `updateQueryData`
  - on completion/failure:
    - invalidates tags to force a refetch

### Local upload UI state
- `frontend/src/features/upload/uploadSlice.ts` stores UI-only upload status/progress.
- The binary upload is done through RTK Query mutations.

---


## 8) Auth + token lifecycle (important small details)

### Frontend auth state
- Stored in `frontend/src/features/auth/authSlice.ts` under `sessionStorage` key `pulse_auth`.
- `authSlice.setCredentials()` writes:
  - `accessToken`, `refreshToken`, `organizationId`, `role`

### Backend auth service: token contents
- Access JWT carries:
  - `sub` = user id
  - `org` = organization id (tenant)
  - `role` = membership role
  - `typ: 'access'`
- Refresh JWT carries:
  - `sub` = user id
  - `typ: 'refresh'`
- `backend/src/modules/auth/auth.service.ts#refresh()`:
  - validates refresh token signature
  - validates `typ === 'refresh'`
  - hashes refresh token with SHA-256 and checks Mongo for a non-revoked record (`revokedAt: null`)
  - then re-asserts membership for the given `organizationId` and issues new access/refresh tokens.

Files:
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/middleware/authenticate.ts`

### Backend request auth
- Normal API endpoints use `authenticateJWT(env)`:
  - requires `Authorization: Bearer <token>`
  - verifies JWT and `typ === 'access'`
  - sets `req.user = { userId, organizationId, role }`
- For the stream endpoint only, the router uses `authenticateJWTBearerOrQuery(env)`:
  - accepts either bearer header OR query param `?access_token=...`

---

## 9) Invite + join flow (end-to-end)

### Admin creates invite
- Admin UI calls `POST /api/orgs/:orgId/invites` (see `frontend/src/features/admin/pages/AdminMembersPage.tsx`).
- Backend:
  - `org.admin.controller.ts#createInvite` builds `inviteUrl` using `env.PUBLIC_WEB_URL`
  - the frontend then navigates to `/register?invite=<token>`

### Registration with invite token
- `frontend/src/features/auth/pages/RegisterPage.tsx` parses:
  - `invite` query param
- It switches to “invite mode” and calls:
  - `POST /api/auth/register-invite` with `{ email, password, inviteToken }`
- Backend:
  - `auth.controller.ts#registerInvite` calls `authService.registerWithInvite`
  - `org.service.ts#consumeOrgInvite`:
    - verifies token hash + expiration
    - enforces single-use via an atomic update (`usedAt: null -> new Date`)
    - creates the membership row with the invite’s role.

### Default role resolution for invites
- `org.service.ts#createOrgInvite` resolves `role` as:
  - provided invite role OR
  - `settings.defaultRoleForNewUsers` when omitted.

Files:
- `frontend/src/features/auth/pages/RegisterPage.tsx`
- `frontend/src/features/admin/pages/AdminMembersPage.tsx`
- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/orgs/org.admin.controller.ts`
- `backend/src/modules/orgs/org.service.ts`
- `backend/src/modules/orgs/org.admin.schemas.ts`

---

## 10) Tenant scoping + “viewer can only read assigned videos” (must-know core)

Even if a user has `role: 'viewer'`, they can only see assigned videos.

### HTTP enforcement (list/get/stream)
- In `backend/src/modules/videos/video.service.ts`:
  - `listForOrg()` filters for viewer role by joining `VideoAssignmentModel` and limiting `_id` to assigned videos.
  - `assertCanReadVideo()` throws if viewer is not assigned.

### Socket enforcement (subscribe)
- In `backend/src/infrastructure/socket/socket.server.ts`:
  - `video:subscribe(videoId)`:
    - validates video exists for the same `organizationId`
    - if role is viewer, verifies there is an assignment row for `(orgId, videoId, userId)`
    - only then does it `socket.join('video:<videoId>')`

Why this matters:
- It prevents leaking progress events / video state via sockets even if frontend tries to subscribe.

---

## 11) Upload, validation, and processing pipeline (full flow)

### UI upload flow (Dashboard)
- `frontend/src/features/videos/pages/DashboardPage.tsx#uploadFile`:
  1. `createVideo({ originalFilename })` -> gets a `videoId`
  2. registers an AbortController:
     - `frontend/src/lib/upload/abortRegistry.ts#registerAbort(videoId)`
  3. dispatches UI actions:
     - `uploadInitiated({ videoId, fileName })`
  4. uploads bytes:
     - `uploadMulter({ videoId, file, signal })`
  5. dispatches:
     - `uploadSucceeded({ videoId })` on success
     - `uploadFailed({ videoId, error: ... })` on failure

### Backend upload endpoints
- `POST /api/videos` (editor+only): creates pending video record with:
  - `status: 'pending'`
  - `processingStage: 'queued'`
  - `metadata: { originalFilename }`
- `POST /api/videos/:id/upload` (editor+only, multer):
  - uses `multer.memoryStorage()` (bytes in RAM)
  - `limits.fileSize` is a hard cap; org settings still enforce true limits in the service.

### “Finalize after upload” and org settings enforcement
- `backend/src/modules/videos/video.service.ts#finalizeAfterUpload` runs:
  - `assertUploadSizeBytes(sizeBytes, orgSettings.maxVideoFileSizeMb)`
  - `assertAllowedVideoFile(originalname, mimetype, orgSettings.allowedFormats)`
    - `allowedFormats` is parsed by splitting on `[,;]+`
    - each token is matched against file extension OR mime (token is checked via `mime.includes(token)`).

### Auto processing vs manual
- If `automaticProcessing` is true:
  - service sets `status: 'processing'`
  - enqueues BullMQ job
  - initializes `processingProgress: 0` + `processingStage: 'queued'`
- If false:
  - video is forced to `status: 'pending'`
  - `processingStage: 'awaiting_manual'`
  - no worker job enqueued until editor/admin hits Retry.

---

## 12) Background worker + progress stages (BullMQ)

### Queue mechanics
- Worker consumes `VIDEO_PROCESSING_QUEUE` with concurrency:
  - `{ concurrency: 2 }`
- `enqueueProcessing()` uses a dedupe key:
  - `organizationId:videoId`
  - stores BullMQ job id in `VideoModel.lastJobId`

### Worker stage updates
- Emits both:
  - Mongo updates (`processingProgress`, `processingStage`, `status`)
  - Redis socket events for realtime UI:
    - `processing_progress`
    - `processing_completed`
    - `processing_failed`

Stages used by code:
- `queued` -> `probing` -> `analyzing` -> `finalizing` -> `completed`
- If any step throws:
  - it sets:
    - `status: 'failed'`
    - `processingError: message`
    - `processingProgress: null`
    - `processingStage: 'failed'`

### Sensitivity analyzer (org-driven)
- `backend/src/workers/video.worker.ts` reads:
  - `OrganizationModel.settings.sensitivityLevel`
- Passes `sensitivityLevel` into the analyzer so thresholds change.

---

## 13) Streaming + Range details (small details)

### Range parsing
- `backend/src/shared/http-range.ts#parseByteRange`:
  - supports:
    - `bytes=START-END`
    - `bytes=START-` (end defaults to end of file)
    - `bytes=-SUFFIX_LENGTH` (suffix ranges)
  - returns:
    - `{ start, end }`
    - `'unsatisfiable'` or `null` (both become `RangeNotSatisfiableError` upstream)

### Controller headers
- `backend/src/modules/videos/video.controller.ts#stream` sets:
  - `Accept-Ranges: bytes`
  - `Content-Type: <mimeType>`
  - If partial (`206`):
    - `Content-Range: bytes start-end/total`
    - `Content-Length` = end-start+1
  - Else:
    - `Content-Length` = total

### Storage layer security
- For local storage, `LocalStorageProvider.resolveSafe()` uses path resolution to prevent path traversal.

---

## 14) Error handling shape (so the UI can show exact messages)

### Backend error JSON
- `backend/src/middleware/errorHandler.ts`:
  - for `AppError` returns:
    - `{ code, message, details? }`

### RTK Query unwrap behavior
- When `unwrap()` fails, RTK Query rejects with a fetch error object (not a plain `Error`).
- `frontend/src/lib/api/rtkErrorMessage.ts` extracts:
  - `FetchBaseQueryError.data.message`
  - falls back to a provided string.

---

