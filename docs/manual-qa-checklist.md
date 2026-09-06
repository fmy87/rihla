# Manual QA Checklist

Run through this before each release, and after any change touching auth,
routes, pickup/drop-off, or GPS. Check both English and Arabic where noted.

## Authentication & roles
- [ ] Admin (super_admin) can sign in with email/password
- [ ] Admin (transport_admin) can sign in; Users/Settings nav items are hidden
- [ ] Driver can sign in with Employee ID + PIN on the iPad app
- [ ] Driver Face ID/Touch ID unlock works after a first successful PIN login
- [ ] Deactivating a user (Users screen) immediately blocks their next sign-in
- [ ] A driver's admin-web session is impossible (drivers only get the iPad app)
- [ ] Language switcher works on both apps; Arabic flips to RTL correctly
      (sidebar, forms, tables, driver screens)

## Buses / Drivers / Students
- [ ] Create/edit a bus; capacity and driver assignment save correctly
- [ ] Create a driver account — confirm the Employee ID + PIN actually work
      on the driver app afterward, not just that the admin form succeeded
- [ ] Create/edit a student with bilingual name; special notes never appear
      anywhere in the driver app
- [ ] Deactivate/reactivate each entity type; confirm it disappears from
      relevant pickers (e.g. deactivated driver no longer selectable as a
      route's default driver)

## Route Builder
- [ ] Create a route, add stops via map click and via address search
- [ ] Drag a stop marker; confirm the saved lat/lng updates
- [ ] Reorder stops with ↑/↓; confirm sequence numbers and the route line
      on the map both update
- [ ] Assign a student to a stop; assign the SAME student to a stop on a
      DIFFERENT route — confirm the duplicate-assignment warning appears
      and reassignment works
- [ ] Delete a stop with assigned students; confirm the confirmation prompt
      and that remaining stops renumber correctly
- [ ] "Generate Today's Route" — confirm it's idempotent (click twice,
      no duplicate stops/assignments — or just trust `002_generate_daily_
      route_idempotent.sql`, but worth a spot check via Daily Operations)

## Driver app — full route flow
- [ ] Today screen shows the correct route/bus for the signed-in driver
- [ ] START ROUTE prompts for location permission; denying foreground blocks
      starting; denying only background shows the warning but still starts
- [ ] Route screen shows stops in completed/current/upcoming order with a
      road-based line and updates live as stops resolve
- [ ] Students screen shows only the current stop's students
- [ ] PICKED UP / DROPPED OFF confirms and immediately reflects on the
      admin Daily Operations screen (use a second device/browser)
- [ ] Tapping an already-confirmed student shows "already confirmed at
      HH:MM" and does NOT create a second event
- [ ] NOT CONFIRMED reason picker records the reason; status reflects on
      admin Attendance dashboard
- [ ] Skip Stop requires confirmation and shows on admin as skipped
- [ ] COMPLETE ROUTE is blocked with an accurate pending count if any
      student is unresolved; succeeds and shows the picked-up/dropped-off
      tally once everything is resolved

## Live GPS Tracking
- [ ] On a real device/dev build (not Expo Go), start a route and confirm
      the admin Live Map shows a moving marker within ~30s
- [ ] Lock the iPad screen during an active route; confirm tracking resumes
      after unlocking (background permission granted case)
- [ ] Put the device in Airplane Mode mid-route; confirm the driver app
      shows "Offline" and pending count grows; disable Airplane Mode and
      confirm it flushes and the admin map catches up
- [ ] Force-quit and relaunch the driver app mid-route; confirm it resumes
      showing the correct route/stops (from cache if offline, from network
      if online) and tracking restarts automatically

## Alerts + Route Deviation
- [ ] Manually drive/walk a device off the planned route beyond the
      configured threshold; confirm a route_deviation alert appears within
      a few minutes and doesn't spam duplicates
- [ ] Skip a stop; confirm a stop_skipped alert appears
- [ ] Let a scheduled pickup time + grace period pass unconfirmed; confirm
      a student_not_picked_up alert appears within a minute of
      `run_periodic_alert_checks()` running
- [ ] Resolve an alert from the Alerts Center; confirm it moves out of the
      unresolved badge count in real time (no manual refresh)

## Reports
- [ ] Each of the 4 report tabs returns data for a date range with activity
      and an honest "no data" state for a range with none
- [ ] CSV export opens correctly in Excel with Arabic student names intact
      (tests the UTF-8 BOM)

## Cross-cutting
- [ ] Every screen that should be RTL-mirrored in Arabic actually is
      (nav on the correct side, icons/arrows flipped where directional)
- [ ] No raw database error text is ever shown to an admin or driver
- [ ] Multi-school isolation: create a second school with its own admin
      account; confirm it sees zero rows belonging to the first school
      anywhere in the app
