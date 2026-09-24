import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("rooms", { id: text("id").primaryKey(), state: text("state").notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull() });
