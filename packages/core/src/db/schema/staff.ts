import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** FraudOps accounts. Created only by the owner's seed command; there is no sign-up. */
export const staffUsers = pgTable(
  "staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    /** scrypt hash with salt and parameters in the string. The password itself is never stored. */
    passwordHash: text("password_hash").notNull(),
    /** Demo accounts judge1…judge5 (Q-07). */
    isDemo: boolean("is_demo").notNull(),
    /** Not null: the account can no longer sign in. */
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "staff_users_username_valid",
      sql`${t.username} = lower(${t.username}) AND ${t.username} ~ '^[a-z0-9_]{3,32}$'`,
    ),
  ],
).enableRLS();

/** DB-04. The cookie holds the raw token; only its SHA-256 is stored, so logout revokes at once. */
export const staffSessions = pgTable(
  "staff_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("staff_sessions_expires_at_idx").on(t.expiresAt)],
).enableRLS();
