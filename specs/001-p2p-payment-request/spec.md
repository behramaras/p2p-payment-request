# Feature Specification: P2P Payment Request

**Feature Branch**: `001-p2p-payment-request`  
**Created**: 2026-04-24  
**Status**: Draft  
**Input**: User description: "P2P Payment Request (like Venmo's Request feature)—email-based requests, dashboard, pay/decline/cancel, simulated payment, expiration, statuses Pending/Paid/Declined/Expired/Cancelled; mock email auth; amounts in whole cents; no self-requests; expiration on read/write; idempotent concurrency-safe payment."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and share a payment request (Priority: P1)

A signed-in user creates a request for money from another person by entering the recipient’s email, a positive amount (expressed in whole cents—no fractional cents), and an optional short note. The system rejects requests to their own email. On success, the user receives a unique identifier for the request and a shareable link they can send to the recipient.

**Why this priority**: Without creation and a stable link, no other flows exist; this is the minimum valuable slice.

**Independent Test**: From a clean session, create a valid request and confirm the system returns a unique id and a link; confirm self-requests and invalid amounts are rejected with clear feedback.

**Acceptance Scenarios**:

1. **Given** a user signed in as A@example.com, **When** they create a request to B@example.com for a valid positive whole-cent amount with an optional note, **Then** the request is stored as Pending, a unique id exists, and a shareable link is available.
2. **Given** a user signed in as A@example.com, **When** they attempt a request where the recipient email is the same as their own, **Then** the system rejects the request and does not create it.
3. **Given** a user creating a request, **When** the amount is not a positive whole number of cents, **Then** the system rejects the request before creation.

---

### User Story 2 - View and organize requests on a dashboard (Priority: P2)

A signed-in user opens a dashboard with two tabs: **Sent** (outgoing requests they created) and **Received** (incoming requests where they are the recipient). Each tab lists relevant requests with status. The user can filter the list by status and search by email address to narrow results.

**Why this priority**: Users need to discover and prioritize requests at a glance without opening each item.

**Independent Test**: With several requests in mixed statuses and roles, confirm tab contents, filters, and search results match expectations without opening the detail view.

**Acceptance Scenarios**:

1. **Given** a user with both sent and received requests, **When** they open the Sent tab, **Then** they see only their outgoing requests with correct statuses.
2. **Given** the same user, **When** they open the Received tab, **Then** they see only incoming requests addressed to them with correct statuses.
3. **Given** a populated tab, **When** the user applies a status filter, **Then** only requests in that status appear.
4. **Given** a populated tab, **When** the user searches by a partial or full recipient or sender email (as applicable to the tab), **Then** matching requests appear and non-matching rows are hidden.

---

### User Story 3 - Open a request, act on it, and complete payment (Priority: P2)

A user opens a single request’s detail page and sees amount, note, who sent and who receives, relevant timestamps, and a clear remaining time until expiration when still active. For an incoming Pending request, they can Pay or Decline. For an outgoing Pending request, they can Cancel. When they choose Pay, the system shows an explicit loading state lasting a few seconds, then the request becomes Paid and both parties see Paid on their dashboards. Paying must be safe if the user retries, refreshes, or two attempts overlap: at most one successful paid outcome.

**Why this priority**: Settlement and trust depend on clear detail, actions, and predictable payment outcomes.

**Independent Test**: Walk through Pay, Decline, and Cancel on appropriate roles; verify loading then Paid for pay; verify duplicate or overlapping pay attempts do not double-settle.

**Acceptance Scenarios**:

1. **Given** an incoming Pending request before expiration, **When** the recipient opens the detail page, **Then** they see amount, note, parties, timestamps, expiration remaining, and enabled Pay and Decline actions.
2. **Given** an outgoing Pending request, **When** the sender opens the detail page, **Then** they see the same factual fields and an enabled Cancel action instead of Pay/Decline.
3. **Given** an incoming Pending request, **When** the recipient confirms Pay, **Then** they see a loading state for a few seconds, after which the status is Paid for both sender and recipient views.
4. **Given** a Pending request, **When** the recipient confirms Decline, **Then** the status becomes Declined and Pay is no longer available.
5. **Given** an outgoing Pending request, **When** the sender cancels it, **Then** the status becomes Cancelled and further settlement actions are not offered.
6. **Given** a request already Paid, **When** anyone attempts to pay again (including repeat submit or overlapping attempts), **Then** the system does not create a second successful payment outcome.

---

### User Story 4 - Expiration blocks settlement (Priority: P3)

Each request expires at a fixed duration after creation (seven days). The product shows expiration consistently on read and blocks settlement writes once expired.

**Why this priority**: Prevents stale obligations and disputes; secondary to creating and paying but required for fairness.

**Independent Test**: Using a request that is already past its seven-day window, confirm the experience shows it as expired, Pay is not offered, and any attempt to settle as paid is rejected.

**Acceptance Scenarios**:

1. **Given** a request created at time T, **When** a user views it before T + 7 days, **Then** expiration is computed as seven days after creation and shown consistently (e.g., countdown where appropriate).
2. **Given** current time is after expiration, **When** a user views the request, **Then** status is Expired (or shown as expired per product rules) and Pay is not offered.
3. **Given** an attempt to Pay after expiration, **When** the recipient tries to pay, **Then** the system rejects the action and the status does not become Paid.

---

### Edge Cases

- Two recipients or senders with the same display email string differing only by case or spacing—system applies a single, documented normalization rule for comparison and search.
- User submits Pay twice quickly or retries after a network error—only one successful transition to Paid; other attempts get a clear, non-destructive outcome.
- Sender cancels at the same moment recipient pays—exactly one terminal outcome is allowed per documented precedence; the other party sees a consistent final status.
- Search or filter with no matches—empty state with guidance, not an error page.
- Optional note at maximum allowed length (if capped)—accepted; beyond cap—rejected with message.
- Request list is long—filter and search remain usable (scroll or paging as product chooses, documented in plan).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a signed-in user to create a payment request with recipient email, a positive amount in whole cents only, and an optional note.
- **FR-002**: The system MUST reject creation when the recipient email identifies the same user as the sender (no self-requests).
- **FR-003**: The system MUST assign each created request a unique identifier and provide a shareable link that resolves to that request for authorized users.
- **FR-004**: The system MUST persist request amounts as whole cent counts only (no fractional currency storage for the request amount).
- **FR-005**: New requests MUST start in status **Pending** with an expiration moment equal to creation time plus seven days.
- **FR-006**: The system MUST support statuses **Pending**, **Paid**, **Declined**, **Expired**, and **Cancelled**, and MUST only allow transitions defined by this spec: from Pending to Paid, Declined, Expired, or Cancelled; no other transitions.
- **FR-007**: On every read and write that depends on timeliness, the system MUST evaluate expiration against the seven-day rule; once expired, the request MUST NOT be payable.
- **FR-008**: The dashboard MUST provide **Sent** and **Received** tabs listing the correct requests for the signed-in user, each showing status.
- **FR-009**: Users MUST be able to filter dashboard lists by status and search lists by email in a manner consistent with each tab (sender/recipient context).
- **FR-010**: The detail view MUST show amount, note, sender and recipient identities (as stored), timestamps, and remaining time until expiration for non-terminal Pending views where applicable.
- **FR-011**: For incoming **Pending** requests that are not expired, the recipient MUST be able to **Pay** or **Decline** from the detail view (or equivalent primary entry point).
- **FR-012**: For outgoing **Pending** requests, the sender MUST be able to **Cancel** from the detail view (or equivalent).
- **FR-013**: **Pay** MUST present a loading state lasting approximately two to three seconds before the status becomes **Paid** for both parties’ views.
- **FR-014**: **Pay** MUST be idempotent: duplicate submissions, retries, or overlapping attempts MUST NOT result in more than one successful paid settlement for the same request.
- **FR-015**: Users MUST be signed in using email-based identification without password entry (simulated trust appropriate for this product).
- **FR-016**: Users MUST only see and act on requests they own as sender or recipient; no cross-user access to another person’s requests.

### Key Entities

- **User (session identity)**: Represented by an email (or equivalent string) used to sign in; no password in scope.
- **Payment request**: Unique id; sender; recipient email (opaque string); amount in whole cents; optional note; status; creation time; expiration moment derived as creation plus seven days; audit-friendly timestamps for key actions as required by the experience.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can create their first valid payment request and obtain a shareable link within **3 minutes** of signing in, without assistance documentation.
- **SC-002**: In usability testing or scripted acceptance, **100%** of explicit attempts to pay an expired or non-pending request result in no Paid outcome and a clear user-visible result.
- **SC-003**: For a Pending incoming request, **95%** of test users complete Pay or Decline on first try from the detail view; when users retry Pay several times in a row, observers record at most **one** successful paid outcome per request.
- **SC-004**: After a successful Pay flow, both sender and recipient see **Paid** within the same browsing session without requiring manual data entry again.

## Assumptions

- Currency is implied as a single primary currency (e.g., USD); only whole cents are in scope—no multi-currency conversion.
- “Shareable link” is sufficient for MVP; deep integrations (SMS, push) are out of scope unless added later.
- Simulated payment means no real money movement or external processor; the product only updates status after the stated delay.
- Email format validation follows common patterns; deliverability of email is not simulated beyond sign-in identity.
- Decline and Cancel are terminal like Paid for settlement purposes; only Expired is time-driven from creation + seven days.
