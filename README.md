# Bus Yatra

## Portal setup

Before a production migration, check the remote migration history and confirm the live schema matches the existing migrations. Back up the production database first; do not apply migrations blindly to an existing deployment:

```powershell
npx wrangler d1 migrations list busyatra-db --remote
npx wrangler d1 migrations apply busyatra-db --remote
```

Set a one-time admin setup secret in the Cloudflare Pages project environment. Use a randomly generated value with at least 32 characters; do not commit it:

```powershell
npx wrangler pages secret put ADMIN_SETUP_KEY --project-name busyatra
```

Open `/admin` to set the initial 4-digit admin PIN and recovery question. The admin can assign or reset an owner's initial PIN from the Operators panel. On first sign-in, the owner must replace that PIN and set a personal recovery question and answer before the owner portal can be used. Later sign-ins require only the owner PIN; a forgotten PIN can be reset by answering the recovery question. After signing in, an owner can assign the captain's mobile number and PIN in the owner bus settings.

Portal sessions expire after 12 hours. Five failed PIN attempts lock that account for 15 minutes. Captain GPS sharing requires the captain to sign in, grant browser location permission, and keep the portal open while the bus is operating. Customers can print or save the PDF ticket after the owner approves the booking.

### Owner registration and captain access

Owners can request an account from `owner.html` by submitting company, owner, bus, route, departure, fare, licence, PIN, and recovery details. A licence upload is limited to 1 MiB and supported PDF/JPEG/PNG files. Licence files are stored in D1 for administrator review and are intentionally excluded from the Firebase replica. An administrator reviews the request in Operators → Bus Owner Registration Requests; approval creates the bus and activates the owner PIN, while rejection leaves the request unapproved. Owners can recover their PIN with their registration security answer. Captains are assigned a phone and PIN by their owner; the owner can disable access, which also revokes active captain sessions.

The admin, owner, and captain API routes require a valid portal session. Customer cancellation also requires the authenticated customer session and is restricted to that customer's booking.

### Customer registration

Customers can register with their name, mobile number, 4-digit PIN, and recovery question and answer. Registration activates the account and signs the customer in immediately; no administrator approval is required. New customer records appear in Admin → Customers, where administrators can view registration details and reset a PIN. Migration `0007_customer_registration_no_approval.sql` activates existing pending customer registrations.

## Finance ledger

The admin Finance tab records payment, refund, per-operator commission, and settlement statuses for bookings. It is a manual accounting ledger only: it does not initiate UPI/card payments, transfer settlement funds, or send refunds. Mark a booking as received before settling it; refunds can only be recorded after a payment/refund request exists. Review the ledger and commission values against your actual payment records before treating the reports as financial statements.

## Firebase backup replica

Cloudflare D1 remains the sole booking authority. Migration `0005_firebase_replica_outbox.sql` adds transactional change capture for persistent business records. After a successful API mutation, the Pages Function asynchronously sends queued records to Firestore using an idempotent document path; failures remain in D1 and retry with backoff. The admin Finance tab shows the replication queue and last error.

This is **not automatic database failover**. If D1 is unavailable, booking writes stop rather than switching to Firestore, because independent databases cannot safely guarantee seat uniqueness or booking consistency. Firebase and Cloudflare quotas, storage, request limits, billing, and network availability are finite; this setup cannot provide unlimited traffic or zero downtime. Monitor both providers and load-test against a realistic booking rate before launch.

### Configure Firebase

1. Sign in to the Firebase CLI with the Google account that owns the project, then confirm the project is accessible:

   ```powershell
   firebase login --reauth
   firebase projects:list
   ```

   The project ID is `bus-yatra-a8f8a`. Do not continue if it is not listed.
2. In Google Cloud Console, enable the Firestore API for the project. In Firebase Console, create the `(default)` Firestore database in `asia-south1` (Mumbai) if it does not already exist. Database location cannot be changed later.
3. Create a dedicated service account with the `Cloud Datastore User` role for that project. Do not use a personal account key.
4. Deploy the restrictive rules in [`firestore.rules`](./firestore.rules):

   ```powershell
   firebase deploy --only firestore:rules --project bus-yatra-a8f8a
   ```

   The replica stores passenger details and PIN/recovery **hashes**; never allow browser clients to read or write this collection. The server service account accesses Firestore through the Google API.
5. Configure the `FIREBASE_PROJECT_ID` non-secret Pages environment variable for the same deployment environment as the function.
6. Add the service-account email and private key as Cloudflare Pages secrets. Run these commands locally and paste values only into the hidden prompts; do not put credentials in chat, source files, command-line arguments, or committed configuration:

   ```powershell
   npx wrangler pages secret put FIREBASE_SERVICE_ACCOUNT_EMAIL --project-name busyatra
   npx wrangler pages secret put FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY --project-name busyatra
   ```

7. Confirm the deployment environment has all three settings, back up D1, compare remote migration history with the live schema, then apply migrations `0002` through `0005` only if they are genuinely pending. Do not reapply migrations already recorded remotely.
8. Deploy, open Admin → Finance, and repeatedly use **Queue next initial backup batch** until the initial snapshot is complete. Each batch snapshots at most 50 existing records; D1 update triggers make the snapshot consistent with changes made while it runs. Wait for the pending queue to drain, then make a small test change and verify it appears in the replica before opening the service to customers.

The replica is change-driven: a quiet app or an unavailable deployment will not run a background scheduler. Failed writes are retried on later mutation requests; the D1 outbox remains the recovery source. The replica is not a substitute for scheduled, independently tested D1 exports and restore drills.
