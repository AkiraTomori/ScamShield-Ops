export { createDatabase, type Database } from "./client";
export { isUniqueViolation } from "./errors";
export {
  checkHealth,
  HEALTH_TIMEOUT_MS,
  type HealthCheckInput,
  type HealthCheckResult,
} from "./health";
