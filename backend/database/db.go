package database

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

// InitDB initializes SQLite connection and creates initial tables.
func InitDB(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping sqlite database: %w", err)
	}

	schema := `
	PRAGMA foreign_keys = ON;

	CREATE TABLE IF NOT EXISTS items (
		id TEXT PRIMARY KEY,
		barcode TEXT,
		name TEXT NOT NULL,
		brand TEXT,
		category TEXT,
		serving_size_g REAL DEFAULT 0,
		calories REAL DEFAULT 0,
		protein_g REAL DEFAULT 0,
		carbs_g REAL DEFAULT 0,
		fat_g REAL DEFAULT 0,
		is_custom INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);

	CREATE TABLE IF NOT EXISTS fridge_inventory (
		id TEXT PRIMARY KEY,
		item_id TEXT NOT NULL,
		quantity REAL NOT NULL DEFAULT 1,
		unit TEXT NOT NULL DEFAULT 'count',
		date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME,
		FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS daily_logs (
		id TEXT PRIMARY KEY,
		date TEXT NOT NULL,
		meal_type TEXT NOT NULL,
		name TEXT NOT NULL,
		servings REAL DEFAULT 1,
		calories REAL DEFAULT 0,
		protein_g REAL DEFAULT 0,
		carbs_g REAL DEFAULT 0,
		fat_g REAL DEFAULT 0,
		items_json TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
	`

	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("failed to execute baseline migration: %w", err)
	}

	return db, nil
}
