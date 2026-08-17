// Load the single root .env (one directory above backend/)
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// backend/src/env.js -> repo root
const rootEnv = path.resolve(__dirname, "../../.env");
dotenv.config({ path: rootEnv });
