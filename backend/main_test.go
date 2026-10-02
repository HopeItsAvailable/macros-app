package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"macros-backend/database"
)

// TestHealthCheck verifies GET /api/health returns HTTP 200 and healthy DB status.
func TestHealthCheck(t *testing.T) {
	testDB := "test_kitchen.db"
	defer os.Remove(testDB)

	// Create temporary SQLite DB for test isolation.
	db, err := database.InitDB(testDB)
	if err != nil {
		t.Fatalf("failed test db: %v", err)
	}
	defer db.Close()

	router := setupRouter(db)

	// Simulate GET /api/health request in memory.
	req := httptest.NewRequest("GET", "/api/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Assert HTTP 200 OK.
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var res map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("invalid json: %v", err)
	}

	// Assert returned health state.
	if res["status"] != "healthy" || res["database"] != "connected" {
		t.Fatalf("unexpected health payload: %v", res)
	}
}

// TestStaticServing verifies the router serves index.html at root path.
func TestStaticServing(t *testing.T) {
	testDB := "test_static.db"
	defer os.Remove(testDB)

	db, err := database.InitDB(testDB)
	if err != nil {
		t.Fatalf("failed test db: %v", err)
	}
	defer db.Close()

	router := setupRouter(db)

	// Request root path to test static frontend serving.
	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
