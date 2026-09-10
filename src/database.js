import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { rollFarosat } from "./levels.js";
import { previousDate } from "./time.js";

export class FarosatDatabase {
  constructor(databasePath) {
    const resolvedPath = databasePath === ":memory:" ? databasePath : resolve(databasePath);
    if (resolvedPath !== ":memory:") mkdirSync(dirname(resolvedPath), { recursive: true });

    this.db = new DatabaseSync(resolvedPath);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        username TEXT,
        grams INTEGER NOT NULL DEFAULT 0 CHECK (grams >= 0),
        streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
        best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
        last_play_date TEXT,
        plays INTEGER NOT NULL DEFAULT 0 CHECK (plays >= 0),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chat_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS daily_rolls (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        play_date TEXT NOT NULL,
        delta INTEGER NOT NULL,
        grams_after INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chat_id, user_id, play_date)
      );

      CREATE INDEX IF NOT EXISTS idx_players_chat_score
      ON players(chat_id, grams DESC, updated_at ASC);
    `);
  }

  play({ chatId, userId, displayName, username, playDate, random = Math.random }) {
    const chat = String(chatId);
    const user = String(userId);
    this.db.exec("BEGIN IMMEDIATE");

    try {
      this.db.prepare(`
        INSERT INTO players (chat_id, user_id, display_name, username)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(chat_id, user_id) DO UPDATE SET
          display_name = excluded.display_name,
          username = excluded.username
      `).run(chat, user, displayName, username ?? null);

      const player = this.db.prepare(
        "SELECT * FROM players WHERE chat_id = ? AND user_id = ?"
      ).get(chat, user);

      const existing = this.db.prepare(`
        SELECT delta, grams_after FROM daily_rolls
        WHERE chat_id = ? AND user_id = ? AND play_date = ?
      `).get(chat, user, playDate);

      if (existing) {
        this.db.exec("COMMIT");
        return { alreadyPlayed: true, player, roll: existing };
      }

      const roll = rollFarosat(player.grams, random);
      const streak = player.last_play_date === previousDate(playDate) ? player.streak + 1 : 1;
      const bestStreak = Math.max(player.best_streak, streak);

      this.db.prepare(`
        UPDATE players SET
          display_name = ?, username = ?, grams = ?, streak = ?, best_streak = ?,
          last_play_date = ?, plays = plays + 1, updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ? AND user_id = ?
      `).run(displayName, username ?? null, roll.newGrams, streak, bestStreak, playDate, chat, user);

      this.db.prepare(`
        INSERT INTO daily_rolls (chat_id, user_id, play_date, delta, grams_after)
        VALUES (?, ?, ?, ?, ?)
      `).run(chat, user, playDate, roll.delta, roll.newGrams);

      this.db.exec("COMMIT");
      return {
        alreadyPlayed: false,
        player: { ...player, display_name: displayName, username, grams: roll.newGrams, streak, best_streak: bestStreak, last_play_date: playDate, plays: player.plays + 1 },
        roll
      };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getPlayer(chatId, userId) {
    return this.db.prepare(
      "SELECT * FROM players WHERE chat_id = ? AND user_id = ?"
    ).get(String(chatId), String(userId));
  }

  leaderboard(chatId, limit = 10) {
    return this.db.prepare(`
      SELECT *, RANK() OVER (ORDER BY grams DESC) AS rank
      FROM players
      WHERE chat_id = ?
      ORDER BY grams DESC, updated_at ASC
      LIMIT ?
    `).all(String(chatId), limit);
  }

  close() {
    this.db.close();
  }
}
