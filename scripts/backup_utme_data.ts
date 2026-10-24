import { prisma } from "../src/database/prisma";
import fs from "fs";
import path from "path";

async function backup() {
  console.log("Backing up UtmeQuestion table...");
  const questions = await prisma.utmeQuestion.findMany();
  const backupDir = path.resolve(__dirname, "..", "data", "backups");
  os_mkdir(backupDir);
  const backupFile = path.join(backupDir, `utme_questions_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(questions, null, 2), "utf-8");
  console.log(`Backup written: ${backupFile} (${questions.length} questions, ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB)`);
}

function os_mkdir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

backup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backup failed:", err);
    process.exit(1);
  });
