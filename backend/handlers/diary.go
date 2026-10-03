package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"macros-backend/config"
	"macros-backend/models"
)

// DiaryHandler manages daily macro meal logging and progress summaries.
type DiaryHandler struct {
	DB  *sql.DB
	Cfg *config.Config
}

// NewDiaryHandler creates a new diary handler instance.
func NewDiaryHandler(db *sql.DB, cfg *config.Config) *DiaryHandler {
	if cfg == nil {
		cfg = config.DefaultConfig()
	}
	return &DiaryHandler{
		DB:  db,
		Cfg: cfg,
	}
}

// LogMealRequest represents payload to log a meal into daily diary.
type LogMealRequest struct {
	Date      string  `json:"date"`
	MealType  string  `json:"meal_type"`
	Name      string  `json:"name"`
	Servings  float64 `json:"servings"`
	Calories  float64 `json:"calories"`
	ProteinG  float64 `json:"protein_g"`
	CarbsG    float64 `json:"carbs_g"`
	FatG      float64 `json:"fat_g"`
	ItemsJSON string  `json:"items_json"`
}

// DiarySummaryResponse combines logged meals, cumulative totals, and user goals.
type DiarySummaryResponse struct {
	Date   string            `json:"date"`
	Meals  []models.DailyLog `json:"meals"`
	Totals struct {
		Calories float64 `json:"calories"`
		ProteinG float64 `json:"protein_g"`
		CarbsG   float64 `json:"carbs_g"`
		FatG     float64 `json:"fat_g"`
	} `json:"totals"`
	Goals config.DailyGoals `json:"goals"`
}

// GetDiary handles GET /api/diary?date=YYYY-MM-DD.
func (h *DiaryHandler) GetDiary(w http.ResponseWriter, r *http.Request) {
	dateStr := strings.TrimSpace(r.URL.Query().Get("date"))
	if dateStr == "" {
		dateStr = time.Now().UTC().Format("2006-01-02")
	}

	rows, err := h.DB.Query(`
		SELECT id, date, meal_type, name, servings, calories, protein_g, carbs_g, fat_g, items_json, created_at
		FROM daily_logs
		WHERE date = ?
		ORDER BY created_at ASC
	`, dateStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to query diary"})
		return
	}
	defer rows.Close()

	resp := DiarySummaryResponse{
		Date:  dateStr,
		Meals: make([]models.DailyLog, 0),
		Goals: h.Cfg.User.DailyGoals,
	}

	for rows.Next() {
		var l models.DailyLog
		var itemsJSON sql.NullString
		if err := rows.Scan(&l.ID, &l.Date, &l.MealType, &l.Name, &l.Servings, &l.Calories, &l.ProteinG, &l.CarbsG, &l.FatG, &itemsJSON, &l.CreatedAt); err == nil {
			if itemsJSON.Valid {
				l.ItemsJSON = itemsJSON.String
			}
			resp.Totals.Calories += l.Calories
			resp.Totals.ProteinG += l.ProteinG
			resp.Totals.CarbsG += l.CarbsG
			resp.Totals.FatG += l.FatG
			resp.Meals = append(resp.Meals, l)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// LogMeal handles POST /api/diary.
func (h *DiaryHandler) LogMeal(w http.ResponseWriter, r *http.Request) {
	var req LogMealRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body"})
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		req.Name = "Meal"
	}
	if strings.TrimSpace(req.MealType) == "" {
		req.MealType = "Lunch"
	}
	if strings.TrimSpace(req.Date) == "" {
		req.Date = time.Now().UTC().Format("2006-01-02")
	}
	if req.Servings <= 0 {
		req.Servings = 1.0
	}

	logID := uuid.New().String()
	now := time.Now().UTC()

	_, err := h.DB.Exec(`
		INSERT INTO daily_logs (id, date, meal_type, name, servings, calories, protein_g, carbs_g, fat_g, items_json, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, logID, req.Date, req.MealType, req.Name, req.Servings, req.Calories, req.ProteinG, req.CarbsG, req.FatG, req.ItemsJSON, now)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to log meal to diary"})
		return
	}

	logged := models.DailyLog{
		ID:        logID,
		Date:      req.Date,
		MealType:  req.MealType,
		Name:      req.Name,
		Servings:  req.Servings,
		Calories:  req.Calories,
		ProteinG:  req.ProteinG,
		CarbsG:    req.CarbsG,
		FatG:      req.FatG,
		ItemsJSON: req.ItemsJSON,
		CreatedAt: now,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(logged)
}
