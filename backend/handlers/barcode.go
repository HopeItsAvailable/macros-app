package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"macros-backend/models"
)

// BarcodeHandler manages barcode lookup, caching, and external resolution.
type BarcodeHandler struct {
	DB         *sql.DB
	HTTPClient *http.Client
	BaseURL    string
}

// NewBarcodeHandler creates a handler instance with defaults.
func NewBarcodeHandler(db *sql.DB) *BarcodeHandler {
	return &BarcodeHandler{
		DB:         db,
		HTTPClient: &http.Client{Timeout: 8 * time.Second},
		BaseURL:    "https://world.openfoodfacts.org/api/v2/product",
	}
}

// openFoodFactsResponse defines the relevant fields from Open Food Facts API v2.
type openFoodFactsResponse struct {
	Status        int    `json:"status"`
	StatusVerbose string `json:"status_verbose"`
	Product       struct {
		ProductName   string `json:"product_name"`
		ProductNameEn string `json:"product_name_en"`
		Brands        string `json:"brands"`
		Categories    string `json:"categories"`
		ServingSize   string `json:"serving_size"`
		Nutriments    struct {
			EnergyKcal100g   *float64 `json:"energy-kcal_100g"`
			EnergyKcalServing *float64 `json:"energy-kcal_serving"`
			Proteins100g     *float64 `json:"proteins_100g"`
			ProteinsServing   *float64 `json:"proteins_serving"`
			Carbs100g        *float64 `json:"carbohydrates_100g"`
			CarbsServing      *float64 `json:"carbohydrates_serving"`
			Fat100g          *float64 `json:"fat_100g"`
			FatServing        *float64 `json:"fat_serving"`
		} `json:"nutriments"`
	} `json:"product"`
}

var gramRegex = regexp.MustCompile(`(?i)(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(?:g|grams?)\b`)

// ParseServingGrams extracts numeric gram weight from strings like "50 g", "100g", "1 packet (55g)", or "2 scoops (60 g)".
func ParseServingGrams(s string) float64 {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return 100.0
	}

	// 1. Look for explicit gram notations like "55g", "55 g", "(55g)"
	matches := gramRegex.FindStringSubmatch(trimmed)
	if len(matches) > 1 {
		if val, err := strconv.ParseFloat(matches[1], 64); err == nil && val > 0 {
			return val
		}
	}

	// 2. Fall back to leading number if available
	cleaned := strings.ToLower(trimmed)
	cleaned = strings.TrimSuffix(cleaned, "g")
	cleaned = strings.TrimSuffix(cleaned, " g")
	parts := strings.Fields(cleaned)
	if len(parts) > 0 {
		if val, err := strconv.ParseFloat(parts[0], 64); err == nil && val > 0 {
			return val
		}
	}

	return 100.0 // Default reference serving
}

func parseServingGrams(s string) float64 {
	return ParseServingGrams(s)
}

// ResolveBarcode handles GET /api/barcode/{code}.
func (h *BarcodeHandler) ResolveBarcode(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		code = strings.TrimSpace(r.URL.Query().Get("code"))
	}
	if code == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Barcode is required"})
		return
	}

	// 1. Check local SQLite cache first
	var item models.Item
	var barcode sql.NullString
	var brand sql.NullString
	row := h.DB.QueryRow(`
		SELECT id, barcode, name, brand, category, serving_size_g, calories, protein_g, carbs_g, fat_g, is_custom, created_at
		FROM items
		WHERE barcode = ?
		LIMIT 1
	`, code)

	err := row.Scan(
		&item.ID, &barcode, &item.Name, &brand, &item.Category,
		&item.ServingSizeG, &item.Calories, &item.ProteinG, &item.CarbsG, &item.FatG,
		&item.IsCustom, &item.CreatedAt,
	)
	if err == nil {
		if barcode.Valid {
			item.Barcode = &barcode.String
		}
		if brand.Valid {
			item.Brand = &brand.String
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(item)
		return
	}

	// 2. Fall back to Open Food Facts API
	reqURL := fmt.Sprintf("%s/%s.json", strings.TrimRight(h.BaseURL, "/"), code)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, reqURL, nil)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to create upstream request"})
		return
	}
	req.Header.Set("User-Agent", "MacrosApp/1.0 (kitchen-assistant)")

	resp, err := h.HTTPClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("Barcode %s not found in Open Food Facts", code)})
		return
	}
	defer resp.Body.Close()

	var offResp openFoodFactsResponse
	if err := json.NewDecoder(resp.Body).Decode(&offResp); err != nil || offResp.Status == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("Barcode %s not found or malformed", code)})
		return
	}

	// Extract product name
	name := strings.TrimSpace(offResp.Product.ProductName)
	if name == "" {
		name = strings.TrimSpace(offResp.Product.ProductNameEn)
	}
	if name == "" {
		name = "Unknown Product (" + code + ")"
	}

	// Extract category
	category := "Pantry"
	if cats := strings.Split(offResp.Product.Categories, ","); len(cats) > 0 && strings.TrimSpace(cats[0]) != "" {
		category = strings.TrimSpace(cats[0])
	}

	// Extract brand
	productBrand := strings.TrimSpace(offResp.Product.Brands)

	// Determine serving size and macros
	servingSize := parseServingGrams(offResp.Product.ServingSize)
	var calories, protein, carbs, fat float64

	n := offResp.Product.Nutriments
	if n.EnergyKcalServing != nil {
		calories = *n.EnergyKcalServing
	} else if n.EnergyKcal100g != nil {
		calories = (*n.EnergyKcal100g * servingSize) / 100.0
	}

	if n.ProteinsServing != nil {
		protein = *n.ProteinsServing
	} else if n.Proteins100g != nil {
		protein = (*n.Proteins100g * servingSize) / 100.0
	}

	if n.CarbsServing != nil {
		carbs = *n.CarbsServing
	} else if n.Carbs100g != nil {
		carbs = (*n.Carbs100g * servingSize) / 100.0
	}

	if n.FatServing != nil {
		fat = *n.FatServing
	} else if n.Fat100g != nil {
		fat = (*n.Fat100g * servingSize) / 100.0
	}

	// 3. Cache into SQLite
	newItemID := uuid.New().String()
	now := time.Now().UTC()
	_, err = h.DB.Exec(`
		INSERT INTO items (id, barcode, name, brand, category, serving_size_g, calories, protein_g, carbs_g, fat_g, is_custom, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
	`, newItemID, code, name, productBrand, category, servingSize, calories, protein, carbs, fat, now)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to cache product in database"})
		return
	}

	item = models.Item{
		ID:           newItemID,
		Barcode:      &code,
		Name:         name,
		Category:     category,
		ServingSizeG: servingSize,
		Calories:     calories,
		ProteinG:     protein,
		CarbsG:       carbs,
		FatG:         fat,
		IsCustom:     false,
		CreatedAt:    now,
	}
	if productBrand != "" {
		item.Brand = &productBrand
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(item)
}
