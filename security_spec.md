# Security Specification — CHARANJEET QUANTX Firestore Rules

## 1. Data Invariants
1. **Owner-Only Isolation**: Every user document (`/users/{userId}`) and subcollection (`/bridgeConfigs`, `/strategies`, `/alerts`, `/auditLogs`, `/workspaces`) is strictly readable and writable only by the verified owner (`request.auth.uid == userId` and `request.auth.token.email_verified == true`).
2. **No Self-Escalation**: `UserProfile.role` is strictly constrained to `'trader'` and cannot be modified by client updates.
3. **No Plaintext Secrets**: Bridge profiles store non-secret metadata (`bridgeUrl`, `mt5Server`, `mt5Login`, `accountType`) only. Master passwords and bridge API secrets are never stored in Firestore.
4. **Immutable Audit Trail**: `auditLogs` can be created and read by the verified owner, never updated or deleted.
5. **Bounded Arrays & Strings**: Every string enforces `.size()` bounds and every list (`symbols`, `favorites`, `indicators`) is strictly capped in element count and validated.
6. **Server Timestamps Only**: `createdAt` and `updatedAt` must equal `request.time`.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/{uid}/strategies/{id}` -> DENIED.
2. Cross-tenant read/write where `request.auth.uid != userId` -> DENIED.
3. Spoofed `ownerId` inside payload (`ownerId: "victim_uid"`) -> DENIED.
4. Role privilege escalation (`role: "admin"`) in `/users/{uid}` -> DENIED.
5. Shadow field injection (`isVerified: true` or `freeMarginOverride: 999999`) on create or update -> DENIED.
6. Oversized document ID (`> 128` chars or invalid characters like `../../admin`) -> DENIED.
7. Oversized `drawingsJson` (> 20000 chars) or `details` (> 1000 chars) -> DENIED.
8. Client-forged timestamp (`createdAt` or `updatedAt` != `request.time`) -> DENIED.
9. Modifying immutable fields (`ownerId` or `createdAt`) during an update -> DENIED.
10. Unbounded array injection (`symbols` with 25 items) -> DENIED.
11. Mutating or deleting an `auditLogs` entry -> DENIED.
12. Unverified email account (`email_verified == false`) attempting a write -> DENIED.
