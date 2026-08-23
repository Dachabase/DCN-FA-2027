import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function getConnectionString(): string {
  const rawUrl = process.env.DATABASE_URL || "postgresql://postgres:Wackywas1@fa27.ct2ua4mes3jl.eu-north-1.rds.amazonaws.com:5432/ui_freshers";
  if (!rawUrl.includes("sslmode=")) {
    // In production or AWS RDS environments, default to require
    return process.env.NODE_ENV === "production" ? `${rawUrl}?sslmode=require` : `${rawUrl}?sslmode=no-verify`;
  }
  return rawUrl;
}

const connectionString = getConnectionString();

// Connection pool configuration for scaling & RDS connection limits
const pool = new Pool({
  connectionString,
  max: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL_STRICT === "true"
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });