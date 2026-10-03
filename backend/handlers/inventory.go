package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"macros-backend/models"
)

// InventoryHandler manages virtual fridge stock, custom items, and quantity adjustments.
type InventoryHandler struct {
	DB             *sql.DB
	BarcodeHandler *BarcodeHandler
}

// NewInventoryHandler creates a new inventory handler instance.
func NewInventoryHandler(db *sql.DB, barcodeHandler *BarcodeHandler) *InventoryHandler {
	return &InventoryHandler{
		DB:             db,
		BarcodeHandler: barcodeHandler,
	}
}

// AddInventoryRequest represents payload to add stock or create custom foods.
type AddInventoryRequest struct {
	ItemID       string   `json:"item_id,omitempty"`
	Barcode      string   `json:"barcode,omitempty"`
	Name         string   `json:"name,omitempty"`
	Brand        string   `json:"brand,omitempty"`
	Category     string   `json:"category,omitempty"`
	ServingSizeG *float64 `json:"serving_size_g,omitempty"`
	Calories     *float64 `json:"calories,omitempty"`
	ProteinG     *float64 `json:"protein_g,omitempty"`
	CarbsG       *float64 `json:"carbs_g,omitempty"`
	FatG         *float64 `json:"fat_g,omitempty"`
	Quantity     float64  `json:"quantity"`
	Unit         string   `json:"unit"`
	ExpiresAt    *string  `json:"expires_at,omitempty"`
}

// UpdateInventoryRequest represents payload to edit stocked quantity or unit.
type UpdateInventoryRequest struct {
	Quantity  *float64 `json:"quantity,omitempty"`
	Unit      *string  `json:"unit,omitempty"`
	ExpiresAt *string  `json:"expires_at,omitempty"`
}

// ListInventory handles GET /api/inventory.
func (h *InventoryHandler) ListInventory(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT 
			f.id, f.item_id, f.quantity, f.unit, f.date_added, f.expires_at,
			i.id, i.barcode, i.name, i.brand, i.category, i.serving_size_g, 
			i.calories, i.protein_g, i.carbs_g, i.fat_g, i.is_custom, i.created_at
		FROM fridge_inventory f
		JOIN items i ON f.item_id = i.id
		ORDER BY f.date_added DESC
	`)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch inventory"})
		return
	}
	defer rows.Close()

	items := make([]models.FridgeItem, 0)
	for rows.Next() {
		var fi models.FridgeItem
		var itm models.Item
		var barcode, brand sql.NullString
		var expiresAt sql.NullTime

		err := rows.Scan(
			&fi.ID, &fi.ItemID, &fi.Quantity, &fi.Unit, &fi.DateAdded, &expiresAt,
			&itm.ID, &barcode, &itm.Name, &brand, &itm.Category, &itm.ServingSizeG,
			&itm.Calories, &itm.ProteinG, &itm.CarbsG, &itm.FatG, &itm.IsCustom, &itm.CreatedAt,
		)
		if err != nil {
			continue
		}
		if barcode.Valid {
			itm.Barcode = &barcode.String
		}
		if brand.Valid {
			itm.Brand = &brand.String
		}
		if expiresAt.Valid {
			fi.ExpiresAt = &expiresAt.Time
		}
		fi.Item = itm
		items = append(items, fi)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// AddInventory handles POST /api/inventory.
func (h *InventoryHandler) AddInventory(w http.ResponseWriter, r *http.Request) {
	var req AddInventoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Quantity <= 0 {
		req.Quantity = 1.0
	}
	if strings.TrimSpace(req.Unit) == "" {
		req.Unit = "count"
	}

	targetItemID := strings.TrimSpace(req.ItemID)

	// 1. If ItemID not provided, check if Barcode provided
	if targetItemID == "" && strings.TrimSpace(req.Barcode) != "" {
		code := strings.TrimSpace(req.Barcode)
		var existingID string
		err := h.DB.QueryRow("SELECT id FROM items WHERE barcode = ? LIMIT 1", code).Scan(&existingID)
		if err == nil {
			targetItemID = existingID
		} else {
			// Try to resolve barcode via BarcodeHandler logic or insert fallback
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "Barcode not resolved yet. Call /api/barcode/" + code + " first"})
			return
		}
	}

	// 2. If still no targetItemID, this is a custom / fresh food item
	if targetItemID == "" {
		name := strings.TrimSpace(req.Name)
		if name == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Food item name is required"})
			return
		}

		category := strings.TrimSpace(req.Category)
		if category == "" {
			category = "Produce"
		}

		servingSize := 100.0
		if req.ServingSizeG != nil && *req.ServingSizeG > 0 {
			servingSize = *req.ServingSizeG
		}

		calories := 0.0
		if req.Calories != nil {
			calories = *req.Calories
		}
		protein := 0.0
		if req.ProteinG != nil {
			protein = *req.ProteinG
		}
		carbs := 0.0
		if req.CarbsG != nil {
			carbs = *req.CarbsG
		}
		fat := 0.0
		if req.FatG != nil {
			fat = *req.FatG
		}

		targetItemID = uuid.New().String()
		now := time.Now().UTC()
		_, err := h.DB.Exec(`
			INSERT INTO items (id, barcode, name, brand, category, serving_size_g, calories, protein_g, carbs_g, fat_g, is_custom, created_at)
			VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
		`, targetItemID, name, strings.TrimSpace(req.Brand), category, servingSize, calories, protein, carbs, fat, now)

		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Failed to create custom food item"})
			return
		}
	}

	// 3. Insert into fridge_inventory
	fridgeID := uuid.New().String()
	now := time.Now().UTC()
	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		if t, err := time.Parse(time.RFC3339, *req.ExpiresAt); err == nil {
			expiresAt = &t
		} else if t, err := time.Parse("2006-01-02", *req.ExpiresAt); err == nil {
			expiresAt = &t
		}
	}

	_, err := h.DB.Exec(`
		INSERT INTO fridge_inventory (id, item_id, quantity, unit, date_added, expires_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, fridgeID, targetItemID, req.Quantity, req.Unit, now, expiresAt)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to add item to fridge inventory"})
		return
	}

	// Retrieve full fridge record
	var fi models.FridgeItem
	var itm models.Item
	var barcode, brand sql.NullString
	var expTime sql.NullTime
	err = h.DB.QueryRow(`
		SELECT 
			f.id, f.item_id, f.quantity, f.unit, f.date_added, f.expires_at,
			i.id, i.barcode, i.name, i.brand, i.category, i.serving_size_g, 
			i.calories, i.protein_g, i.carbs_g, i.fat_g, i.is_custom, i.created_at
		FROM fridge_inventory f
		JOIN items i ON f.item_id = i.id
		WHERE f.id = ?
	`, fridgeID).Scan(
		&fi.ID, &fi.ItemID, &fi.Quantity, &fi.Unit, &fi.DateAdded, &expTime,
		&itm.ID, &barcode, &itm.Name, &brand, &itm.Category, &itm.ServingSizeG,
		&itm.Calories, &itm.ProteinG, &itm.CarbsG, &itm.FatG, &itm.IsCustom, &itm.CreatedAt,
	)

	if err == nil {
		if barcode.Valid {
			itm.Barcode = &barcode.String
		}
		if brand.Valid {
			itm.Brand = &brand.String
		}
		if expTime.Valid {
			fi.ExpiresAt = &expTime.Time
		}
		fi.Item = itm
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(fi)
}

// UpdateInventory handles PATCH /api/inventory/{id}.
func (h *InventoryHandler) UpdateInventory(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Missing inventory ID"})
		return
	}

	var req UpdateInventoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body"})
		return
	}

	var currentQty float64
	var currentUnit string
	err := h.DB.QueryRow("SELECT quantity, unit FROM fridge_inventory WHERE id = ?", id).Scan(&currentQty, &currentUnit)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Inventory record not found"})
		return
	}

	newQty := currentQty
	if req.Quantity != nil {
		newQty = *req.Quantity
	}
	newUnit := currentUnit
	if req.Unit != nil && strings.TrimSpace(*req.Unit) != "" {
		newUnit = strings.TrimSpace(*req.Unit)
	}

	_, err = h.DB.Exec("UPDATE fridge_inventory SET quantity = ?, unit = ? WHERE id = ?", newQty, newUnit, id)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to update inventory record"})
		return
	}

	// Fetch updated record
	var fi models.FridgeItem
	var itm models.Item
	var barcode, brand sql.NullString
	var expTime sql.NullTime
	_ = h.DB.QueryRow(`
		SELECT 
			f.id, f.item_id, f.quantity, f.unit, f.date_added, f.expires_at,
			i.id, i.barcode, i.name, i.brand, i.category, i.serving_size_g, 
			i.calories, i.protein_g, i.carbs_g, i.fat_g, i.is_custom, i.created_at
		FROM fridge_inventory f
		JOIN items i ON f.item_id = i.id
		WHERE f.id = ?
	`, id).Scan(
		&fi.ID, &fi.ItemID, &fi.Quantity, &fi.Unit, &fi.DateAdded, &expTime,
		&itm.ID, &barcode, &itm.Name, &brand, &itm.Category, &itm.ServingSizeG,
		&itm.Calories, &itm.ProteinG, &itm.CarbsG, &itm.FatG, &itm.IsCustom, &itm.CreatedAt,
	)

	if barcode.Valid {
		itm.Barcode = &barcode.String
	}
	if brand.Valid {
		itm.Brand = &brand.String
	}
	if expTime.Valid {
		fi.ExpiresAt = &expTime.Time
	}
	fi.Item = itm

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(fi)
}

// DeleteInventory handles DELETE /api/inventory/{id}.
func (h *InventoryHandler) DeleteInventory(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Missing inventory ID"})
		return
	}

	res, err := h.DB.Exec("DELETE FROM fridge_inventory WHERE id = ?", id)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to delete inventory record"})
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Item not found in inventory"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"success": true, "deleted_id": id})
}
