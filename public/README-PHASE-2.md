# Phase 2, step 1: design foundation + new sign-in screens

New files (copy into your repo's `public/` folder):
- `public/css/ui.css`: the design system (Geist font, pill buttons, rounded cards, violet theme, follows the device's light/dark setting)
- `public/js/auth-ui.js`: the new sign-in modal (Google, email + password, sign-up with emailed code, forgot password)

Two lines to add to `public/index.html` (nothing else changes):
1. Just before `</head>`:   `<link rel="stylesheet" href="/css/ui.css">`
2. Just before `</body>`:   `<script src="/js/auth-ui.js"></script>`

It rebuilds the inside of the existing `#signin-modal` when the page loads, so the app's own open/close code keeps working. After a successful email sign-in the page reloads and the app picks up the session as it does for Google.
Needs the Phase 1 backend patch (the `/api/auth/email/...` routes).

## Step 2: app shell (header, profile menu, footer)
New files: `public/css/shell.css` and `public/js/shell.js`.
Add to `public/index.html`: `<link rel="stylesheet" href="/css/shell.css">` after the ui.css link, and `<script src="/js/shell.js"></script>` after auth-ui.js.
- Header, profile menu and footer restyled (pill navigation, flat violet, Geist). Visual changes only, so layout and behaviour are unchanged.
- The header "Sign in" button now opens the new sign-in modal (it used to jump straight to Google).
- "Audience & Content Manager" in the profile menu is hidden unless the server says the person is an admin.

## Step 3: Dashboard
New file: `public/css/dashboard.css`. Add `<link rel="stylesheet" href="/css/dashboard.css">` after the shell.css link.
Greeting banner, main call-to-action card, quick-launch cards, practice-course cards and the notice banners are restyled (flat, large radii, pill buttons, Geist). Visual only: the markup and the code that fills the Dashboard are unchanged.
