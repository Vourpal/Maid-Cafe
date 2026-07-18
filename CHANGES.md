# CHANGES.md

A record of every meaningful change made to this codebase, what was changed, how it was done, and why.

---

## 1. Full UI Redesign

### What
Replaced the original top navbar layout with a modern sidebar-based design system applied consistently across all pages.

### How
- Created `client/app/sidebar.tsx` — a fixed left sidebar (w-64) with the 🎀 Maid Café logo, navigation links with lucide-react icons, a collapsible Links dropdown, auth/admin visibility guards, and a user info + logout section at the bottom. On mobile it collapses to a hamburger menu with a slide-in drawer and backdrop overlay.
- Updated `client/app/layout.tsx` to use `<Sidebar />` instead of `<NavBar />`. Main content uses `md:ml-64 pt-14 md:pt-0` to offset correctly on both desktop and mobile.
- Removed `navBar.tsx` from the import chain (file left in place but unused).
- Updated `client/app/globals.css` to set `bg-gray-50` on the body as the base background.

### Why
The original top navbar was functional but cramped. A sidebar gives persistent navigation that doesn't compete with page content, scales better as more sections are added, and is the standard pattern for staff/admin portals.

---

## 2. Home Page — Dashboard

### What
Replaced the static hero + nav card layout with a live dashboard that shows the next upcoming event and next practice session.

### How
- `client/app/page.tsx` rewritten as a client component.
- On mount, fetches `GET /events?page=1&quantity=5` to find the soonest upcoming non-cancelled event, and `GET /practice-sessions` (with auth) to find the next practice session.
- Two clickable cards display the results with date, time, and location. Cards link to `/events` and `/practice` respectively.
- For logged-out users, shows the original hero + CTA section instead.

### Why
The old page duplicated links already in the sidebar. For a staff portal, surfacing actionable info (what's coming up next) is far more useful than another set of navigation buttons.

---

## 3. Events Page Redesign

### What
Redesigned event cards and filters for better visual hierarchy and UX.

### How
- `client/app/events/EventCards.tsx`: Each card now has a colored left border (green = published, amber = draft, red = cancelled), a date badge showing month + day, and metadata icons (MapPin, Users, CalendarDays) from lucide-react. Action buttons use compact rounded-full pill style.
- `client/app/events/EventFilters.tsx`: Replaced the plain checkbox with toggle switches. Added an "Upcoming only" toggle and a "My events" toggle. The search input has a Search icon prefix.

### Why
Plain stacked text cards with no visual differentiation make it hard to scan. Color-coded borders and prominent date badges let users find relevant events at a glance.

---

## 4. Upcoming Events Filter — Server-Side

### What
The "Upcoming only" toggle previously filtered client-side on the current page's data, so events on page 2+ were invisible when the filter was on.

### How
**Backend:**
- `server/queries/event_queries.py`: Added `future_only` parameter to both `get_events_paginated` and `get_total_events`. When true, appends `AND end_date >= CURRENT_DATE` to the SQL query. Also changed `ORDER BY id` to `ORDER BY end_date ASC` so events sort soonest-first.
- `server/routes/event_routes.py`: Reads `future_only` from query params (defaults `false`), passes it to both query functions.

**Frontend:**
- `client/app/events/page.tsx` (server component): Reads `future_only` from `searchParams` (defaults `"true"`), passes it to the API and down to `EventCards` as `initialFutureOnly`.
- `client/app/events/EventCards.tsx`: Removed client-side date filtering. Initializes `showFutureOnly` from the `initialFutureOnly` prop.
- `client/app/events/EventFilters.tsx`: Added `useSearchParams`. `handleFutureToggle` navigates to a new URL with `future_only=true/false` and always resets to `page=1`. This triggers a full server-component re-fetch with the correct filtered count, making pagination work correctly.
- Wrapped `EventCards` and `EventPagination` in `<Suspense>` in `page.tsx` since both now use `useSearchParams`.

### Why
Client-side filtering on paginated data is fundamentally broken — you can only filter what's already on the current page. Moving the filter to the database means the total count and pagination are always correct for the filtered result set.

---

## 5. Shared Modal Component

### What
All event-related modals (`AddEvent`, `EditEvent`, `SignUpModal`, `EditAttendance`) were copy-pasting the same backdrop + wrapper + card structure.

### How
- Created `client/app/components/Modal.tsx`: a reusable modal shell with backdrop (with `backdrop-blur`), centered white card, header with title and X close button, scrollable body, and Escape key to close.
- Refactored all four event modals to use `<Modal open={...} onClose={...} title={...}>`.
- Updated all `<select>` elements inside modals to use consistent `rounded-lg border-gray-200` styling matching the rest of the redesign.
- `AddEvent` and `EditEvent` reorganized date fields and Max Attendees/Status into `grid-cols-2` rows, cutting modal height roughly in half.
- `EditEvent` delete confirmation changed from a permanent red button to a subtle "Delete this event…" text link that expands inline — less alarming, still accessible.

### Why
Four copies of the same modal shell is a maintenance burden. One component means one place to fix bugs, change animations, or adjust accessibility. The grid layout for form fields reduces unnecessary scrolling.

---

## 6. Practice Page Redesign

### What
Improved the calendar page layout and the session detail modal.

### How
- `client/app/practice/page.tsx`: Two-column layout on large screens — calendar on the left, "Upcoming Sessions" panel on the right. Each upcoming session card shows a date badge, location, and time. Clicking a card opens the ViewPractice modal for that session. The calendar is wrapped in `div.rbc-rose-theme` which applies custom CSS overrides.
- `client/app/globals.css`: Added `.rbc-rose-theme` CSS block overriding react-big-calendar's default blue styles with the rose color system (toolbar buttons, event chips, header cells, today highlight, grid lines).

### Why
The default react-big-calendar styles (blue/gray) clashed with the rose design system. The upcoming sessions panel gives quick access without having to navigate the calendar. The override approach keeps the calendar library unchanged.

---

## 7. ViewPractice Modal Overhaul

### What
The practice session modal had layout bugs, debug logs left in production code, and the attendance/routine action buttons were misaligned.

### How
- `client/app/practice/ViewPractice.tsx`: Removed all `console.log` debug statements. Changed two sequential try/catch fetches to `Promise.all` for parallelism. Fixed the two-column grid to `sm:grid-cols-2` so it stacks on mobile. Moved session metadata (location, date, notes) into the modal header with lucide icons. Added Escape key to close.
- Action buttons (Add/Edit for attendance and routines) moved from a separate row below the section header into the section header itself, right-aligned alongside the title.
- Attendance and routine lists capped at `max-h-72` with their own scroll so a long list doesn't blow out the modal.
- `AddAttendance`, `EditAttendance`, `AddRoutine`, `EditRoutine`: Changed trigger buttons from `w-full bg-rose-500` to `size="sm" variant="outline" rounded-full h-7 text-xs`. Removed `w-full` which was causing overflow when placed in a flex row.

### Why
`w-full` on buttons inside a `flex gap-2` row forces each button to fight for full width. Small outline pill buttons in the section header are cleaner and don't waste vertical space. Parallel fetches are faster. Debug logs shouldn't ship.

---

## 8. Admin Page Redesign

### What
Replaced stacked cards with a tabbed layout.

### How
- `client/app/admin/page.tsx`: Tab switcher (Staff | Invite Codes) using a pill-style tab bar. Staff tab shows member cards with initials avatar, name, @username, role badge, and a 7-day availability grid where enabled days are filled rose-500. Invite Codes tab is a two-column layout: generator on the left, active invites list on the right with icon-only Copy and Revoke buttons (lucide Copy and Trash2 icons).

### Why
All content was stacked vertically requiring heavy scrolling. Tabs separate the two unrelated concerns (managing people vs. managing invites) and keep each view focused.

---

## 9. Account Page Redesign

### What
Replaced plain form fields with a profile-style layout.

### How
- `client/app/account/page.tsx`: Rose gradient profile header showing initials avatar, full name, @username, type badge, and admin badge. Content grouped into `Section` wrapper cards (Profile Information, Password, Availability). Edit fields use inline pencil icon buttons that expand a form inline below the list instead of replacing the whole view. Password and availability sections unchanged functionally.

### Why
The original layout had no visual hierarchy — everything was the same weight. The gradient header makes the page feel like a profile. Inline edit forms are less disruptive than full-page replacements.

---

## 10. Links Page Redesign

### What
The links page used a monospace/black aesthetic completely inconsistent with the rest of the app.

### How
- `client/app/links/page.tsx`: Rewritten to match the rose card design. White card with `border-rose-100`, rose-50 header row, hover highlights in `rose-50/50`. Edit (pencil) button appears on hover only (`opacity-0 group-hover:opacity-100`). Uses lucide `ExternalLink` and `Pencil` icons. "Add Link" button uses the same rose-500 rounded-full style as the rest of the app. Empty states are consistent with other pages.

### Why
The original page looked like it belonged to a different product. Consistency reduces cognitive load — users shouldn't have to re-orient when navigating between pages.

---

## 11. Login & Register Pages Redesign

### What
Login and register pages were plain centered cards with no visual personality.

### How
- `client/app/login/page.tsx` and `client/app/login/newUser/page.tsx`: Each gets a rose gradient banner header at the top of the card (matching the Account page header style), with the 🎀 emoji, title, and subtitle. Form fields use `rounded-lg border-gray-200`. Remember me checkbox replaced with a toggle switch. Error messages show in a styled red box rather than plain red text. Register page puts First/Last name in a `grid-cols-2` row to reduce form height.

### Why
Login is the first thing a new user sees. A consistent gradient header ties it into the rest of the design. The two-column name row is a small UX improvement that makes the form feel shorter.

---

## 12. Passenger Seat Availability Enforcement

### What
There was no enforcement preventing more passengers from signing up than there are driver seats available. Two people could simultaneously claim the last seat (race condition).

### How
**Backend:**
- `server/queries/attendance_queries.py`: Added `get_carpool_snapshot(db, event_id)` which runs a single aggregation query with `FOR UPDATE` — this locks all attendance rows for the event inside the current transaction, preventing concurrent reads from seeing stale data.
- `server/routes/attendance_routes.py`:
  - `POST /attendances/me`: When `role == "Passenger"`, calls `get_carpool_snapshot` before inserting. If `passengers >= total_seats`, returns `409 NO_SEATS_AVAILABLE`.
  - `PATCH /attendances/:id`: Two additional checks — (1) switching to Passenger triggers the same seat check; (2) a Driver reducing their `seats_available` is rejected if the new total would be below the current passenger count, preventing stranded passengers.
  - New `GET /attendances/carpool/:event_id`: Returns `{ total_seats, passengers, seats_left }` for the frontend to display before the user commits.

**Frontend:**
- `client/app/events/SignUpModal.tsx`: Fetches carpool status when the modal opens. Shows a color-coded banner: gray if no drivers, red if full, green with seat count if available. The Passenger option in the dropdown shows `"Passenger (full)"` and is `disabled` when no seats remain. The submit button is also disabled in that state. Backend error messages are read from `data.error.message` and shown via toast rather than a generic fallback.

### Why
Without a DB-level lock, two simultaneous POST requests can both pass the seat check (reading `passengers=4, total=5`) and both insert, resulting in 6 passengers for 5 seats. `FOR UPDATE` serializes these — the second request blocks until the first commits, then reads the updated count. No external locking infrastructure needed; this is the standard PostgreSQL approach for this pattern.
