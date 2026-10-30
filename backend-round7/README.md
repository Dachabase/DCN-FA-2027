# Round 7 backend: lock the API behind sign-in

Easiest way (run from the project root, the folder that contains `src/server.ts`):

    node backend-round7/apply-gate.mjs
    npm run build

The script copies `apiGate.ts` and `landing.router.ts` into `src/`, saves `src/server.ts.bak`, adds two imports and two lines to `src/server.ts`, and can be run twice safely.
If it cannot find the expected lines it changes nothing and tells you what to add by hand:

    app.use("/api/public", publicRouter);
    app.use("/api", apiGate);

Both lines go right after `app.use("/auth", authRouter);` and above `app.use("/api", personalizationRouter);`.

Check: open a private window. You should see the landing page, and visiting `/api/guides` directly should answer 401.
