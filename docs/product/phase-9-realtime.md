# Phase 9 real-time and notifications

Clients connect to the API origin (not `/api/v1`) with Socket.IO handshake `auth: { token }`. Public session rooms work without a token. Authenticated sockets join `user:{id}`; staff admin-scope sockets also join `admin`. Discovery and session screens subscribe with `session:subscribe` (max 50 IDs).

Domain changes persist first. `notify()` writes `notifications`, then after commit the server emits `notification:new` / `unread_count` and attempts Expo push when `devices.push_token` is an Expo token and `notificationPrefs.push[type]` is not `false`. `REVIEW_RECEIVED` is never pushed. Ticket errors with `DeviceNotRegistered` delete the device.

`api-client` patches session queries only when `event.version` is greater than the cached version, then invalidates on reconnect.

Reminder job (5 min): session 24 h / 1 h, unpaid payment 24 h before start, price-consent, minimum-player decision, venue deadline.
