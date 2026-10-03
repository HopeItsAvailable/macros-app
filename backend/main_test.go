package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"macros-backend/config"
	"macros-backend/database"
	"macros-backend/handlers"
	"macros-backend/models"
)

func setupTestEnvironment(t *testing.T) (http.Handler, func()) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_kitchen.db")

	db, err := database.InitDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init test db: %v", err)
	}

	cfg := config.DefaultConfig()
	dataDir := filepath.Join("..", "data")
	if _, err := os.Stat(dataDir); err != nil {
		dataDir = "data"
	}

	router := setupRouter(db, cfg, dataDir)
	cleanup := func() {
		db.Close()
	}
	return router, cleanup
}

func TestHealthCheck(t *testing.T) {
	router, cleanup := setupTestEnvironment(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/api/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var res map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if res["status"] != "healthy" || res["database"] != "connected" {
		t.Fatalf("unexpected health payload: %v", res)
	}
}

func TestConfigEndpoint(t *testing.T) {
	router, cleanup := setupTestEnvironment(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/api/config", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var cfg config.Config
	if err := json.NewDecoder(rec.Body).Decode(&cfg); err != nil {
		t.Fatalf("failed to decode config: %v", err)
	}
	if cfg.User.DailyGoals.Calories <= 0 {
		t.Errorf("expected positive calorie goal, got %f", cfg.User.DailyGoals.Calories)
	}
}

func TestBarcodeResolutionAndCaching(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_barcode.db")
	db, err := database.InitDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init test db: %v", err)
	}
	defer db.Close()

	// Mock Open Food Facts server
	mockOFFServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/737628064502.json" {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{
				"status": 1,
				"status_verbose": "product found",
				"product": {
					"product_name": "Thai Peanut Noodle Kit",
					"brands": "Simply Asia",
					"categories": "Pantry, Noodles",
					"serving_size": "85g",
					"nutriments": {
						"energy-kcal_serving": 310,
						"proteins_serving": 9,
						"carbohydrates_serving": 55,
						"fat_serving": 6
					}
				}
			}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer mockOFFServer.Close()

	barcodeH := handlers.NewBarcodeHandler(db)
	barcodeH.BaseURL = mockOFFServer.URL

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/barcode/{code}", barcodeH.ResolveBarcode)

	// First query: hits upstream mock and caches in SQLite
	req1 := httptest.NewRequest("GET", "/api/barcode/737628064502", nil)
	rec1 := httptest.NewRecorder()
	mux.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusOK {
		t.Fatalf("expected 200 on initial lookup, got %d: %s", rec1.Code, rec1.Body.String())
	}

	var item1 models.Item
	if err := json.NewDecoder(rec1.Body).Decode(&item1); err != nil {
		t.Fatalf("failed to decode item: %v", err)
	}
	if item1.Name != "Thai Peanut Noodle Kit" {
		t.Errorf("expected product name 'Thai Peanut Noodle Kit', got '%s'", item1.Name)
	}
	if item1.Calories != 310 || item1.ProteinG != 9 {
		t.Errorf("expected 310 kcal and 9g protein, got %f kcal and %f pro", item1.Calories, item1.ProteinG)
	}

	// Close mock server to prove second query returns from SQLite cache without network calls
	mockOFFServer.Close()

	req2 := httptest.NewRequest("GET", "/api/barcode/737628064502", nil)
	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 on cached lookup, got %d", rec2.Code)
	}
	var item2 models.Item
	if err := json.NewDecoder(rec2.Body).Decode(&item2); err != nil {
		t.Fatalf("failed to decode cached item: %v", err)
	}
	if item2.ID != item1.ID {
		t.Errorf("expected cached item ID %s, got %s", item1.ID, item2.ID)
	}

	// Query unlisted barcode
	req3 := httptest.NewRequest("GET", "/api/barcode/999999999999", nil)
	rec3 := httptest.NewRecorder()
	mux.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unlisted barcode, got %d", rec3.Code)
	}
}

func TestInventoryCRUD(t *testing.T) {
	router, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// 1. Add Custom Food
	addBody := []byte(`{
		"name": "Chicken Breast",
		"category": "Meat",
		"serving_size_g": 100,
		"calories": 165,
		"protein_g": 31,
		"carbs_g": 0,
		"fat_g": 3.6,
		"quantity": 2,
		"unit": "lbs"
	}`)
	req1 := httptest.NewRequest("POST", "/api/inventory", bytes.NewReader(addBody))
	rec1 := httptest.NewRecorder()
	router.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec1.Code, rec1.Body.String())
	}

	var created models.FridgeItem
	if err := json.NewDecoder(rec1.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode created item: %v", err)
	}
	if created.Item.Name != "Chicken Breast" || created.Quantity != 2 {
		t.Fatalf("unexpected created item: %+v", created)
	}

	// 2. List Inventory
	req2 := httptest.NewRequest("GET", "/api/inventory", nil)
	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec2.Code)
	}

	var list []models.FridgeItem
	if err := json.NewDecoder(rec2.Body).Decode(&list); err != nil {
		t.Fatalf("failed to decode inventory list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 inventory item, got %d", len(list))
	}

	// 3. Update Inventory Quantity & Unit
	updateBody := []byte(`{"quantity": 3.5, "unit": "kg"}`)
	req3 := httptest.NewRequest("PATCH", "/api/inventory/"+created.ID, bytes.NewReader(updateBody))
	rec3 := httptest.NewRecorder()
	router.ServeHTTP(rec3, req3)

	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update, got %d", rec3.Code)
	}

	var updated models.FridgeItem
	if err := json.NewDecoder(rec3.Body).Decode(&updated); err != nil {
		t.Fatalf("failed to decode updated item: %v", err)
	}
	if updated.Quantity != 3.5 || updated.Unit != "kg" {
		t.Fatalf("expected updated quantity 3.5 kg, got %f %s", updated.Quantity, updated.Unit)
	}

	// 4. Delete Inventory Item
	req4 := httptest.NewRequest("DELETE", "/api/inventory/"+created.ID, nil)
	rec4 := httptest.NewRecorder()
	router.ServeHTTP(rec4, req4)

	if rec4.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete, got %d", rec4.Code)
	}

	// Verify inventory is empty
	req5 := httptest.NewRequest("GET", "/api/inventory", nil)
	rec5 := httptest.NewRecorder()
	router.ServeHTTP(rec5, req5)
	var emptyList []models.FridgeItem
	json.NewDecoder(rec5.Body).Decode(&emptyList)
	if len(emptyList) != 0 {
		t.Fatalf("expected empty inventory after deletion, got %d", len(emptyList))
	}
}

func TestDiaryLoggingAndTotals(t *testing.T) {
	router, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// Log Meal 1
	body1 := []byte(`{
		"date": "2026-10-02",
		"meal_type": "Lunch",
		"name": "Turkey Wrap",
		"servings": 1,
		"calories": 450,
		"protein_g": 40,
		"carbs_g": 35,
		"fat_g": 12,
		"items_json": "[{\"name\":\"Turkey\",\"grams\":150}]"
	}`)
	req1 := httptest.NewRequest("POST", "/api/diary", bytes.NewReader(body1))
	rec1 := httptest.NewRecorder()
	router.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on diary log, got %d", rec1.Code)
	}

	// Log Meal 2
	body2 := []byte(`{
		"date": "2026-10-02",
		"meal_type": "Dinner",
		"name": "Steak & Veggies",
		"servings": 1,
		"calories": 600,
		"protein_g": 55,
		"carbs_g": 15,
		"fat_g": 25,
		"items_json": "[]"
	}`)
	req2 := httptest.NewRequest("POST", "/api/diary", bytes.NewReader(body2))
	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on diary log 2, got %d", rec2.Code)
	}

	// Query Diary
	req3 := httptest.NewRequest("GET", "/api/diary?date=2026-10-02", nil)
	rec3 := httptest.NewRecorder()
	router.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on diary query, got %d", rec3.Code)
	}

	var diaryResp handlers.DiarySummaryResponse
	if err := json.NewDecoder(rec3.Body).Decode(&diaryResp); err != nil {
		t.Fatalf("failed to decode diary response: %v", err)
	}

	if len(diaryResp.Meals) != 2 {
		t.Fatalf("expected 2 logged meals, got %d", len(diaryResp.Meals))
	}
	if diaryResp.Totals.Calories != 1050 {
		t.Errorf("expected 1050 total calories, got %f", diaryResp.Totals.Calories)
	}
	if diaryResp.Totals.ProteinG != 95 {
		t.Errorf("expected 95g total protein, got %f", diaryResp.Totals.ProteinG)
	}
}

func TestRestaurantPresetCuttingAndBulking(t *testing.T) {
	router, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// Cutting Preset
	reqCut := httptest.NewRequest("GET", "/api/restaurant/preset?restaurant=subway&goal=cutting&max_cal=400", nil)
	recCut := httptest.NewRecorder()
	router.ServeHTTP(recCut, reqCut)

	if recCut.Code != http.StatusOK {
		t.Fatalf("expected 200 for cutting preset, got %d: %s", recCut.Code, recCut.Body.String())
	}

	var cutItems []models.RestaurantItem
	if err := json.NewDecoder(recCut.Body).Decode(&cutItems); err != nil {
		t.Fatalf("failed to decode cutting items: %v", err)
	}
	if len(cutItems) == 0 {
		t.Fatal("expected at least one cutting item recommendation")
	}
	for _, itm := range cutItems {
		if itm.Calories > 400 {
			t.Errorf("item %s exceeded max_cal 400 with %f cals", itm.ItemName, itm.Calories)
		}
	}
	// Assert sorted by ProPer100Kcals descending
	for i := 1; i < len(cutItems); i++ {
		if cutItems[i].ProPer100Kcals > cutItems[i-1].ProPer100Kcals {
			t.Errorf("cutting items not sorted by protein efficiency: %f > %f", cutItems[i].ProPer100Kcals, cutItems[i-1].ProPer100Kcals)
		}
	}

	// Bulking Preset
	reqBulk := httptest.NewRequest("GET", "/api/restaurant/preset?restaurant=subway&goal=bulking&min_cal=500&min_pro=30", nil)
	recBulk := httptest.NewRecorder()
	router.ServeHTTP(recBulk, reqBulk)

	if recBulk.Code != http.StatusOK {
		t.Fatalf("expected 200 for bulking preset, got %d", recBulk.Code)
	}
	var bulkItems []models.RestaurantItem
	if err := json.NewDecoder(recBulk.Body).Decode(&bulkItems); err != nil {
		t.Fatalf("failed to decode bulking items: %v", err)
	}
	if len(bulkItems) == 0 {
		t.Fatal("expected at least one bulking item recommendation")
	}
	for _, itm := range bulkItems {
		if itm.Calories < 500 || itm.ProteinG < 30 {
			t.Errorf("item %s did not meet bulking floor: %f cals, %f pro", itm.ItemName, itm.Calories, itm.ProteinG)
		}
	}
}

func TestRestaurantCustomBuild(t *testing.T) {
	router, cleanup := setupTestEnvironment(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/api/restaurant/custom?restaurant=subway&goal=cutting", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for custom build, got %d: %s", rec.Code, rec.Body.String())
	}

	var custom models.CustomMealBuild
	if err := json.NewDecoder(rec.Body).Decode(&custom); err != nil {
		t.Fatalf("failed to decode custom meal build: %v", err)
	}
	if len(custom.BaseMeal) == 0 {
		t.Fatal("expected non-empty base meal")
	}
	if custom.TotalMacros.Calories <= 0 || custom.TotalMacros.ProteinG <= 0 {
		t.Errorf("expected positive macros in custom build: %+v", custom.TotalMacros)
	}
	if len(custom.Alternatives["breads"]) == 0 {
		t.Error("expected alternative bread options in custom build")
	}
	if len(custom.AddOns) == 0 {
		t.Error("expected add-on recommendations in custom build")
	}
}

func TestRecipeAndTechniques(t *testing.T) {
	router, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// Recipe Generation
	body := []byte(`{
		"title": "Protein Power Skillet",
		"servings": 2,
		"ingredients": [
			{"name": "Chicken Breast", "quantity": 300, "unit": "g", "calories": 495, "protein_g": 93, "carbs_g": 0, "fat_g": 10.8},
			{"name": "Broccoli", "quantity": 200, "unit": "g", "calories": 68, "protein_g": 5.6, "carbs_g": 13.2, "fat_g": 0.8}
		]
	}`)
	req1 := httptest.NewRequest("POST", "/api/cook/recipe", bytes.NewReader(body))
	rec1 := httptest.NewRecorder()
	router.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusOK {
		t.Fatalf("expected 200 for recipe generation, got %d", rec1.Code)
	}

	var recipe models.Recipe
	if err := json.NewDecoder(rec1.Body).Decode(&recipe); err != nil {
		t.Fatalf("failed to decode recipe: %v", err)
	}
	if len(recipe.Steps) == 0 {
		t.Fatal("expected recipe steps")
	}
	if recipe.TotalMacros.ProteinG != 98.6 {
		t.Errorf("expected 98.6g protein, got %f", recipe.TotalMacros.ProteinG)
	}

	// Techniques Query
	req2 := httptest.NewRequest("GET", "/api/techniques", nil)
	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 for techniques, got %d", rec2.Code)
	}

	var techniques []handlers.CulinaryTechnique
	if err := json.NewDecoder(rec2.Body).Decode(&techniques); err != nil {
		t.Fatalf("failed to decode techniques: %v", err)
	}
	if len(techniques) < 5 {
		t.Errorf("expected at least 5 foundational techniques, got %d", len(techniques))
	}
}

func TestAPINotFound(t *testing.T) {
	router, cleanup := setupTestEnvironment(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/api/nonexistent-endpoint", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown api endpoint, got %d", rec.Code)
	}

	contentType := rec.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected application/json for 404 error, got %s", contentType)
	}

	var errResp map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil {
		t.Fatalf("expected valid json error response: %v", err)
	}
	if errResp["error"] == "" {
		t.Error("expected non-empty error message")
	}
}

func TestParseServingGrams(t *testing.T) {
	cases := []struct {
		input    string
		expected float64
	}{
		{"85g", 85.0},
		{"100 g", 100.0},
		{"1 packet (55g)", 55.0},
		{"2 scoops (60 g)", 60.0},
		{"1 bar (45 g / 1.6 oz)", 45.0},
		{"serving size 30g", 30.0},
		{"240 ml", 240.0},
		{"", 100.0},
	}

	for _, c := range cases {
		actual := handlers.ParseServingGrams(c.input)
		if actual != c.expected {
			t.Errorf("ParseServingGrams(%q) = %f; expected %f", c.input, actual, c.expected)
		}
	}
}

func TestRestaurantChipotleAndAlternatives(t *testing.T) {
	router, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// Chipotle Preset
	reqPreset := httptest.NewRequest("GET", "/api/restaurant/preset?restaurant=chipotle&goal=cutting&max_cal=700", nil)
	recPreset := httptest.NewRecorder()
	router.ServeHTTP(recPreset, reqPreset)

	if recPreset.Code != http.StatusOK {
		t.Fatalf("expected 200 for chipotle preset, got %d: %s", recPreset.Code, recPreset.Body.String())
	}
	var chipotlePresets []models.RestaurantItem
	if err := json.NewDecoder(recPreset.Body).Decode(&chipotlePresets); err != nil {
		t.Fatalf("failed to decode chipotle presets: %v", err)
	}
	if len(chipotlePresets) == 0 {
		t.Fatal("expected at least one chipotle preset recommendation")
	}

	// Chipotle Custom Build with Alternatives
	reqCustom := httptest.NewRequest("GET", "/api/restaurant/custom?restaurant=chipotle&goal=cutting", nil)
	recCustom := httptest.NewRecorder()
	router.ServeHTTP(recCustom, reqCustom)

	if recCustom.Code != http.StatusOK {
		t.Fatalf("expected 200 for chipotle custom build, got %d: %s", recCustom.Code, recCustom.Body.String())
	}
	var chipotleCustom models.CustomMealBuild
	if err := json.NewDecoder(recCustom.Body).Decode(&chipotleCustom); err != nil {
		t.Fatalf("failed to decode chipotle custom build: %v", err)
	}
	if len(chipotleCustom.BaseMeal) == 0 {
		t.Fatal("expected non-empty base meal for chipotle")
	}

	// Verify all swap alternatives: breads, proteins, sauces
	if len(chipotleCustom.Alternatives["breads"]) == 0 {
		t.Error("expected bread/base alternatives in chipotle custom build")
	}
	if len(chipotleCustom.Alternatives["proteins"]) == 0 {
		t.Error("expected protein swap alternatives in chipotle custom build")
	}
	if len(chipotleCustom.Alternatives["sauces"]) == 0 {
		t.Error("expected sauce swap alternatives in chipotle custom build")
	}
}
