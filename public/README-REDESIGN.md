# BlastExams redesign layer

Drop-in replacement for `public/`. Original JS, IDs, API calls and engines (utme.js, academic100l.js) are untouched.

New: `css/redesign.css` (design system + every screen), `js/redesign.js` (dashboard layout, progress card, popular guides, "/" search shortcut, page titles, skip link).
Changed in `index.html`: removed the shell.css/dashboard.css links (superseded), added redesign.css before </head> and redesign.js after academic100l.js, nav labels shortened (CBT Practice, Guides, tab bar Home/Courses/Practice/Guides), theme-color set to white.
Behaviour change: signed-out visitors now load the public guides/FAQ/opportunities data (previously only loaded after sign-in).
Not restyled yet: in-exam runner, results/review, flashcards, course-hub overlay, onboarding wizard steps, admin table (they inherit tokens and modal styling only).

## Round 2: no emoji, no dashes
`js/icons.js` (loaded first in <body>) renders `:ic-name:` tokens as inline SVG icons, maps any stray emoji and text arrows to icons (or removes them), and replaces em/en dashes on screen, including text from the database (guides, FAQs). Source files (index.html, utme.js, academic100l.js, academic100l.css) were cleaned too. To add an icon, add a path to the `P` map in icons.js and use `:ic-yourname:`.

## Round 3
- Dark theme: header toggle, saved in localStorage (`be_theme`), follows the system setting until the user picks one. Set before first paint by a small script in <head>.
- Dashboard hero: glass greeting box over the Freshers Awakening photo (/images/freshers-awakening/218A7798-web.jpg, gradient fallback). Signed out: daily nudge + live stats. Signed in: greeting + track + nudge + live stats. Needs the backend-patch endpoint for the numbers; without it the stats row simply does not appear.
- New footer (brand, social, link columns, copyright, back-to-top), setup wizard and department hub contrast fixed in both themes.

## Round 4: identity-driven labels, track in settings, search suggestions
- The "UI 100-Level" chip is gone from the header. The track now lives in the profile menu ("Track: UI 100-Level, Change"). Signed-out visitors get a "Change track" link on the dashboard.
- No more invented values. The pill beside the name shows the saved level (for example 300L) or the UTME year, and is hidden if nothing is saved. The profile menu, the dashboard subtitle and the department hub all read the saved academic identity (department, faculty, level). Missing parts are left out instead of replaced by "Computing", "Computer Science & AI" or "100L".
- "Your progress" button fixed for dark mode (it used a fixed white background with theme text colour).
- Static "Popular searches" removed. Typing in the search box now suggests the person's own earlier searches (kept on this device, separate for each account, with a "Clear search history" link; arrow keys and Enter work).

## Round 5
- Header: solid white at the top; frosted white glass (dark glass in dark theme) after scrolling. The original dark scrolled style was overriding it with !important.
- Hero photos rotate (5 photos, crossfade every 6 seconds, pause button and dots, still for reduced-motion users, paused when the tab is hidden). Photos come from /images/freshers-awakening/.
- "Take a drill" button styled everywhere; progress card text is left-aligned.
- Audience switcher modal: readable in light and dark, neutral icon tiles, clear selected state.
- Footer: left-aligned on one grid at every width (4 columns, then 3, then 2, then 1).

## Round 6
- Department hub card removed from the dashboard (the saved faculty, department and level show in the profile pill, the profile menu and the greeting subtitle; "Edit profile" is in the profile menu).
- "Verified Guide" text replaced by a purple seal with a tick (guide cards and the guide page), with an accessible label and tooltip.
- Dark mode: the stark light divider lines (inline light borders such as the line above the course buttons) and the line under the header now follow the theme.

## Round 7
- Signed-out visitors see only the landing page (floating preview cards, a student reaching for them, a folder that pops out a guide every 10 seconds, a text list of what unlocks). Signing in reloads into the app and returns to the page they asked for. An expired session sends the person back to the landing page with a short message.
- The server now refuses `/api` data to signed-out requests (see backend-round7/README.md). The landing page is the front door; the server is the lock.
- Feedback toast on guides no longer prints the icon's code.
- JAMB UTME track restyled with the same tokens (first pass: cards, chips, search, option buttons, tabs, tables, dashboard subject cards).
