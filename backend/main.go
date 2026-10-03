package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"macros-backend/config"
	"macros-backend/database"
	"macros-backend/handlers"
)

// setupRouter registers all API routes and static asset serving wrapped in CORS.
func setupRouter(db *sql.DB, cfg *config.Config, dataDir string) http.Handler {
	mux := http.NewServeMux()

	// 1. Health check
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "connected"
		if err := db.Ping(); err != nil {
			dbStatus = "error: " + err.Error()
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status":    "healthy",
			"database":  dbStatus,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// 2. Configuration endpoint (goals, pantry staples, appliances)
	mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cfg)
	})

	// 3. Handlers
	barcodeH := handlers.NewBarcodeHandler(db)
	inventoryH := handlers.NewInventoryHandler(db, barcodeH)
	diaryH := handlers.NewDiaryHandler(db, cfg)
	restaurantH := handlers.NewRestaurantHandler(dataDir)
	recipeH := handlers.NewRecipeHandler()

	// Barcode routes
	mux.HandleFunc("GET /api/barcode/{code}", barcodeH.ResolveBarcode)
	mux.HandleFunc("GET /api/barcode", barcodeH.ResolveBarcode)

	// Inventory routes
	mux.HandleFunc("GET /api/inventory", inventoryH.ListInventory)
	mux.HandleFunc("POST /api/inventory", inventoryH.AddInventory)
	mux.HandleFunc("PATCH /api/inventory/{id}", inventoryH.UpdateInventory)
	mux.HandleFunc("DELETE /api/inventory/{id}", inventoryH.DeleteInventory)

	// Macro Diary routes
	mux.HandleFunc("GET /api/diary", diaryH.GetDiary)
	mux.HandleFunc("POST /api/diary", diaryH.LogMeal)

	// Restaurant Macro Optimizer routes
	mux.HandleFunc("GET /api/restaurant/preset", restaurantH.GetPresets)
	mux.HandleFunc("GET /api/restaurant/custom", restaurantH.GetCustom)

	// Culinary Recipe & Technique routes
	mux.HandleFunc("POST /api/cook/recipe", recipeH.GenerateRecipe)
	mux.HandleFunc("GET /api/techniques", recipeH.GetTechniques)

	// Static frontend assets serving
	distPath := "../frontend/dist"
	if _, err := os.Stat(distPath); err != nil {
		distPath = "frontend/dist"
	}
	fileServer := http.FileServer(http.Dir(distPath))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Return 404 JSON for unmatched /api/ endpoints instead of serving HTML
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "Endpoint not found"})
			return
		}

		// If path has a file extension or exists, serve it; otherwise serve index.html for SPA
		p := filepath.Join(distPath, filepath.Clean(r.URL.Path))
		info, err := os.Stat(p)
		if err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}
		// SPA fallback
		http.ServeFile(w, r, filepath.Join(distPath, "index.html"))
	})

	return enableCORS(mux)
}

// enableCORS allows cross-origin requests from development servers.
func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	// 1. Load application config
	cfg, err := config.LoadConfig("../config.yaml", "config.yaml")
	if err != nil {
		log.Printf("Warning: failed to load config file: %v. Using defaults.", err)
		cfg = config.DefaultConfig()
	}

	// 2. Initialize local SQLite database
	db, err := database.InitDB("kitchen.db")
	if err != nil {
		log.Fatalf("database initialization failed: %v", err)
	}
	defer db.Close()

	// 3. Setup data directory for restaurant datasets
	dataDir := "../data"
	if _, err := os.Stat(dataDir); err != nil {
		dataDir = "data"
	}

	router := setupRouter(db, cfg, dataDir)

	log.Println("Server running on :8080")
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatal(err)
	}
}
