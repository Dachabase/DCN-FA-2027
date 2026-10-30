# Live activity endpoint (for the dashboard hero)

1. Copy `src/stats/stats.controller.ts` into your `src/` folder.
2. In `src/server.ts` add:
   import { statsRouter } from "./stats/stats.controller";
   app.use("/api", statsRouter);   // after the other app.use("/api...") lines
Endpoints: POST /api/presence {vid} and GET /api/stats/live -> { online, students, examsToday }.
"online" is distinct browsers seen in the last 2 minutes (in memory, resets on restart). Counters that fail come back null and the hero hides them. No personal data is stored.
