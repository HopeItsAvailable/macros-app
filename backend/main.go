package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"macros-backend/database"
)

// setupRouter registers API routes and wraps them in CORS middleware.
func setupRouter(db *sql.DB) http.Handler {
	mux := http.NewServeMux()

	// GET /api/health checks server and SQLite connectivity.
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "connected"
		if err := db.Ping(); err != nil {
			dbStatus = "error: " + err.Error()
		}

		w.Header().Set("Content-Type", "application/json")
		// Send JSON response with current system status.
		json.NewEncoder(w).Encode(map[string]any{
			"status":    "healthy",
			"database":  dbStatus,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// Serve compiled React frontend files from frontend/dist.
	mux.Handle("/", http.FileServer(http.Dir("../frontend/dist")))

	return enableCORS(mux)
}

// enableCORS allows the browser frontend on port 3000 to call this API.
func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set headers allowing cross-origin browser requests.
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		// Return immediately for preflight browser checks.
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// main initializes the SQLite database and starts the HTTP server.
func main() {
	// Initialize local SQLite database and baseline tables.
	db, err := database.InitDB("kitchen.db")
	if err != nil {
		log.Fatalf("db failed: %v", err)
	}
	defer db.Close()

	router := setupRouter(db)

	log.Println("Server running on :8080")
	// Listen on TCP port 8080.
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatal(err)
	}
}
