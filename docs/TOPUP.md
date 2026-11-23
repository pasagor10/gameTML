# Manual PromptPay top-up

Live customer page: https://tilmo.pikad.online/topup
Private review page: https://tilmo.pikad.online/topup/admin

Package: 35 THB -> 35,000 diamonds. Paid coins are separate from locally saved earned gold, shared by the browser wallet, and stored in SQLite on the server. Diamonds can be exchanged for gold inside the game at 1 diamond = 10 gold. No EasyDonate integration is used for this direct PromptPay workflow.

PromptPay QR is generated locally for 0944555163 with the fixed amount 35, using promptpay-qr and qrcode. Customers must check the actual recipient name shown by their bank app. No bank credentials are collected by the game.

Customer flow: open page -> attach slip -> pending review -> owner verifies money in bank -> approve with a unique bank transaction reference or reject with a note. Submitted slips alone never mark a payment successful. Approved entries are credited exactly once in one SQLite transaction. Duplicate file hashes and bank references are blocked. Customer histories and slips are private to their wallet/admin respectively. Admin authentication expires after eight hours, with login limits and origin checks. Slips accept PNG/JPEG/WebP up to 4 MB.

Wallet identity uses a random secret in an HttpOnly SameSite=Strict Secure cookie. A downloadable private recovery code allows restoring the same wallet after changing browsers. Keep that code private. Characters are only metadata for the order; the paid balance belongs to the wallet, not to the character name.

Admin password is stored locally in `.env.topup-admin` (ignored by Git; mode 0600), and on the server as `/etc/tilmo-topup.env` (0600). Never publish that file or place it in the release. The password is entered into the admin login form; there is no username. It is not the public statistics dashboard.

Production database: /var/lib/tilmo/topup.sqlite; state directory 0700, service UMask=0077. Service: tilmo-social.service, Node with --experimental-sqlite. Backup service/timer: tilmo-topup-backup, daily SQLite online backup verified by quick_check, root-only files under /var/backups/tilmo. Restore requires stopping the service and preserving the existing DB/WAL before replacing it with a verified backup.

Release: /opt/tilmo/releases/20261123-topup, stamp topup2. Nginx forwards /api/topup to the loopback backend, with a 5 MB request cap. Payment data and uploads are never under the static release root. Tests: 85 pass, covering unauthorized access, origin rejection, wrong-owner upload, file bounds, duplicate slip/reference, retry idempotency and persistence. Browser exercised submit/review/approve/balance on LOCAL test data only. Production checked page, login and logout, without submitting or approving real orders.

## Diamonds and in-game gold packs

Paid coins are now displayed as **diamonds (เพชร)** everywhere; existing balances are retained without multiplying or resetting them. Fixed gold packs: 100/500/1,000/5,000/10,000/35,000 diamonds buy 1,000/5,000/10,000/50,000/100,000/350,000 gold (1 diamond = 10 gold).

The **แพ็กทอง** HUD button opens the game's own overlay; it does not navigate away. It shows wallet diamonds, current hero gold, package choices and an inline confirmation. Gold is delivered to the currently playing hero. The payment page links back into the game rather than offering an external exchange form.

Server debit and exchange creation are one SQLite transaction. Client-generated request IDs make retries idempotent, with balance checks performed on the server. Gold delivery is journaled locally and recorded in the same saved snapshot/stash as the gold amount; repeats do not add gold again. Pending deliveries can resume after a failed network response or storage write. In-memory heroes reconcile the local journal before saving, including another tab's delivery. Paid diamonds remain server-owned; the game's earned/converted gold and heroes remain browser-local, so clearing those saves still loses character progression.

Validation: 88 tests pass, including 1:10 pricing, insufficient balance, duplicate requests, receipt persistence and isolated character grants. Browser tested a LOCAL wallet spending 100 diamonds for 1,000 gold without leaving the game; reload retained both balances with no console errors. No production exchange was executed during testing. Release `/opt/tilmo/releases/20261123-ingame-gold-packs`, stamp `ingamepacks1`.


## Embedded payment window

Both the HUD and lobby use an in-game top-up button. It opens `/topup?embedded=1` inside the existing game overlay, preserving the root game URL. QR, slip upload, wallet balance, recovery and history remain available in that window. Embedded links switch directly to the gold-pack overlay using same-origin postMessage; the parent checks both origin and frame identity. Closing returns to the current hero/lobby. No changes to approval rules or existing balances. Current release: `/opt/tilmo/releases/20261123-embedded-topup`, stamp `embedded2`. Verified on live root URL and locally toggling between both panels with no console errors; all 88 tests pass.
