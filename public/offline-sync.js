/**
 * BlastExams Offline Answer Sync Buffer
 * Uses IndexedDB to buffer practice and CBT answer submissions when offline.
 */
const DB_NAME = "BlastExamsOfflineDB";
const STORE_NAME = "pending_answers";

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enqueues an answer submission locally when offline.
 */
async function queueOfflineAnswer(submission) {
  try {
    const db = await openOfflineDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.add({
      ...submission,
      timestamp: Date.now(),
    });
    console.log("💾 Answer queued locally in offline buffer.");
  } catch (err) {
    console.error("Failed to buffer offline answer:", err);
  }
}

/**
 * Flushes all pending answers to the backend when online.
 */
async function flushPendingAnswers() {
  if (!navigator.onLine) return;
  try {
    const db = await openOfflineDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = async () => {
      const pending = getAllRequest.result;
      if (!pending || pending.length === 0) return;

      console.log(`🔄 Flushing ${pending.length} buffered answers to server...`);

      for (const item of pending) {
        try {
          const res = await fetch(`/api/practice/${item.sessionId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questionId: item.questionId,
              userAnswer: item.userAnswer,
              confidenceRating: item.confidenceRating || "MEDIUM",
              timeSpentSeconds: item.timeSpentSeconds || 0,
            }),
          });

          if (res.ok) {
            // Remove from store
            const delTx = db.transaction(STORE_NAME, "readwrite");
            delTx.objectStore(STORE_NAME).delete(item.id);
          }
        } catch (postErr) {
          console.warn("Retrying sync on next connection cycle:", postErr);
          break;
        }
      }
    };
  } catch (err) {
    console.error("Error during offline answer flush:", err);
  }
}

// Automatically sync when connection is restored
window.addEventListener("online", () => {
  console.log("🌐 Network connection restored. Initiating sync...");
  flushPendingAnswers();
});

// Run check on startup if already online
if (typeof navigator !== "undefined" && navigator.onLine) {
  setTimeout(flushPendingAnswers, 2000);
}

