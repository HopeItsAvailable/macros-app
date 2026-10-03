package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"macros-backend/models"
)

// RestaurantHandler manages restaurant datasets and cutting/bulking optimizations.
type RestaurantHandler struct {
	DataDir string
}

// NewRestaurantHandler creates a new restaurant handler with data directory path.
func NewRestaurantHandler(dataDir string) *RestaurantHandler {
	return &RestaurantHandler{
		DataDir: dataDir,
	}
}

// loadCSV reads restaurant items from a CSV file.
func (h *RestaurantHandler) loadCSV(filename string) ([]models.RestaurantItem, error) {
	searchPaths := []string{
		filepath.Join(h.DataDir, filename),
		filepath.Join("..", "data", filename),
		filepath.Join("data", filename),
		filename,
	}

	var filePath string
	for _, p := range searchPaths {
		if _, err := os.Stat(p); err == nil {
			filePath = p
			break
		}
	}
	if filePath == "" {
		return nil, fmt.Errorf("dataset file %s not found in data directories", filename)
	}

	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file %s: %w", filePath, err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read csv header: %w", err)
	}

	colMap := make(map[string]int)
	for i, col := range header {
		colMap[strings.ToLower(strings.TrimSpace(col))] = i
	}

	var items []models.RestaurantItem
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil || len(record) < len(header) {
			continue
		}

		getFloat := func(colName string) float64 {
			idx, ok := colMap[colName]
			if !ok || idx >= len(record) {
				return 0
			}
			val, _ := strconv.ParseFloat(strings.TrimSpace(record[idx]), 64)
			return val
		}

		getString := func(colName string) string {
			idx, ok := colMap[colName]
			if !ok || idx >= len(record) {
				return ""
			}
			return strings.TrimSpace(record[idx])
		}

		item := models.RestaurantItem{
			ItemName: getString("item_name"),
			Category: getString("category"),
			Calories: getFloat("calories"),
			ProteinG: getFloat("protein_g"),
			CarbsG:   getFloat("carbs_g"),
			FatG:     getFloat("fat_g"),
			SodiumMG: getFloat("sodium_mg"),
			FiberG:   getFloat("fiber_g"),
			SugarG:   getFloat("sugar_g"),
		}
		if item.ItemName != "" {
			items = append(items, item)
		}
	}

	return items, nil
}

func resolveDatasetFilename(restaurant string) string {
	res := strings.ToLower(strings.TrimSpace(restaurant))
	if res == "chipotle" {
		return "vision_cleaned_output.csv"
	}
	return "ai_cleaned_output.csv" // default Subway
}

// GetPresets handles GET /api/restaurant/preset.
func (h *RestaurantHandler) GetPresets(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	restaurant := q.Get("restaurant")
	goal := strings.ToLower(strings.TrimSpace(q.Get("goal")))
	if goal == "" {
		goal = "cutting"
	}

	maxCal, _ := strconv.ParseFloat(q.Get("max_cal"), 64)
	if maxCal <= 0 {
		if goal == "cutting" {
			maxCal = 500
		} else {
			maxCal = 1200
		}
	}

	minCal, _ := strconv.ParseFloat(q.Get("min_cal"), 64)
	if minCal <= 0 && goal == "bulking" {
		minCal = 500
	}

	minPro, _ := strconv.ParseFloat(q.Get("min_pro"), 64)
	if minPro <= 0 && goal == "bulking" {
		minPro = 30
	}

	topN, _ := strconv.Atoi(q.Get("top_n"))
	if topN <= 0 {
		topN = 10
	}

	filename := resolveDatasetFilename(restaurant)
	items, err := h.loadCSV(filename)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	ignoreWords := []string{"individual", "bread", "base", "cheese", "condiment", "sauce", "dressing", "veggie", "veg", "topping", "side", "extras"}
	isMealOnly := func(cat string) bool {
		catLower := strings.ToLower(cat)
		for _, w := range ignoreWords {
			if strings.Contains(catLower, w) {
				return false
			}
		}
		return true
	}

	var candidates []models.RestaurantItem
	for _, itm := range items {
		if !isMealOnly(itm.Category) {
			continue
		}

		if itm.Calories > 0 {
			itm.ProPer100Kcals = (itm.ProteinG / itm.Calories) * 100
		}

		if goal == "cutting" {
			if itm.Calories <= maxCal {
				candidates = append(candidates, itm)
			}
		} else if goal == "bulking" {
			if itm.Calories >= minCal && itm.ProteinG >= minPro && itm.Calories <= maxCal {
				candidates = append(candidates, itm)
			}
		}
	}

	if goal == "cutting" {
		sort.Slice(candidates, func(i, j int) bool {
			return candidates[i].ProPer100Kcals > candidates[j].ProPer100Kcals
		})
	} else {
		sort.Slice(candidates, func(i, j int) bool {
			if candidates[i].Calories == candidates[j].Calories {
				return candidates[i].ProteinG > candidates[j].ProteinG
			}
			return candidates[i].Calories > candidates[j].Calories
		})
	}

	if len(candidates) > topN {
		candidates = candidates[:topN]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(candidates)
}

// GetCustom handles GET /api/restaurant/custom.
func (h *RestaurantHandler) GetCustom(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	restaurant := q.Get("restaurant")
	goal := strings.ToLower(strings.TrimSpace(q.Get("goal")))
	if goal == "" {
		goal = "cutting"
	}

	filename := resolveDatasetFilename(restaurant)
	items, err := h.loadCSV(filename)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	var breads, meats, cheeses, veggies, sauces []models.RestaurantItem
	for _, itm := range items {
		catLower := strings.ToLower(itm.Category)
		if itm.Calories > 0 {
			itm.ProRatio = itm.ProteinG / itm.Calories
			if itm.ProteinG > 0 {
				itm.KcalPerGPro = itm.Calories / itm.ProteinG
			}
		}

		if strings.Contains(catLower, "bread") || strings.Contains(catLower, "base") {
			breads = append(breads, itm)
		} else if strings.Contains(catLower, "individual protein") || strings.Contains(catLower, "protein") {
			meats = append(meats, itm)
		} else if strings.Contains(catLower, "cheese") {
			cheeses = append(cheeses, itm)
		} else if strings.Contains(catLower, "veg") || strings.Contains(catLower, "produce") {
			veggies = append(veggies, itm)
		} else if strings.Contains(catLower, "condiment") || strings.Contains(catLower, "sauce") || strings.Contains(catLower, "dressing") {
			sauces = append(sauces, itm)
		}
	}

	var basePlate []models.RestaurantItem
	var baseBread *models.RestaurantItem
	var baseMeat *models.RestaurantItem
	var baseSauce *models.RestaurantItem

	// 1. Build Base Plate
	if goal == "cutting" {
		if len(breads) > 0 {
			var adultBreads []models.RestaurantItem
			for _, b := range breads {
				nameLower := strings.ToLower(b.ItemName)
				if !strings.Contains(nameLower, "mini") && !strings.Contains(nameLower, "kid") {
					adultBreads = append(adultBreads, b)
				}
			}
			if len(adultBreads) == 0 {
				adultBreads = breads
			}
			sort.Slice(adultBreads, func(i, j int) bool {
				return adultBreads[i].Calories < adultBreads[j].Calories
			})
			b := adultBreads[0]
			baseBread = &b
			basePlate = append(basePlate, b)
		}

		if len(meats) > 0 {
			sort.Slice(meats, func(i, j int) bool {
				return meats[i].ProRatio > meats[j].ProRatio
			})
			m := meats[0]
			baseMeat = &m
			basePlate = append(basePlate, m)
		}

		for _, v := range veggies {
			if v.Calories <= 15 {
				basePlate = append(basePlate, v)
			}
		}

		if len(sauces) > 0 {
			sort.Slice(sauces, func(i, j int) bool {
				return sauces[i].Calories < sauces[j].Calories
			})
			s := sauces[0]
			baseSauce = &s
			basePlate = append(basePlate, s)
		}

	} else { // Bulking
		if len(breads) > 0 {
			sort.Slice(breads, func(i, j int) bool {
				if breads[i].Calories == breads[j].Calories {
					return breads[i].CarbsG > breads[j].CarbsG
				}
				return breads[i].Calories > breads[j].Calories
			})
			b := breads[0]
			baseBread = &b
			basePlate = append(basePlate, b)
		}

		if len(meats) > 0 {
			sort.Slice(meats, func(i, j int) bool {
				if meats[i].ProteinG == meats[j].ProteinG {
					return meats[i].Calories > meats[j].Calories
				}
				return meats[i].ProteinG > meats[j].ProteinG
			})
			m := meats[0]
			baseMeat = &m
			basePlate = append(basePlate, m)
		}

		if len(cheeses) > 0 {
			sort.Slice(cheeses, func(i, j int) bool {
				return cheeses[i].ProteinG > cheeses[j].ProteinG
			})
			basePlate = append(basePlate, cheeses[0])
		}

		vegCount := len(veggies)
		if vegCount > 2 {
			vegCount = 2
		}
		for i := 0; i < vegCount; i++ {
			basePlate = append(basePlate, veggies[i])
		}

		if len(sauces) > 0 {
			sort.Slice(sauces, func(i, j int) bool {
				return sauces[i].Calories > sauces[j].Calories
			})
			s := sauces[0]
			baseSauce = &s
			basePlate = append(basePlate, s)
		}
	}

	// 2. Alternatives
	alternatives := make(map[string][]models.RestaurantItem)
	if baseBread != nil && len(breads) > 0 {
		var altBreads []models.RestaurantItem
		for _, b := range breads {
			if b.ItemName != baseBread.ItemName {
				altBreads = append(altBreads, b)
			}
		}
		sort.Slice(altBreads, func(i, j int) bool {
			return altBreads[i].Calories < altBreads[j].Calories
		})
		alternatives["breads"] = altBreads
	}

	if baseMeat != nil && len(meats) > 1 {
		var altMeats []models.RestaurantItem
		for _, m := range meats {
			if m.ItemName != baseMeat.ItemName {
				altMeats = append(altMeats, m)
			}
		}
		if goal == "cutting" {
			sort.Slice(altMeats, func(i, j int) bool {
				return altMeats[i].ProRatio > altMeats[j].ProRatio
			})
		} else {
			sort.Slice(altMeats, func(i, j int) bool {
				return altMeats[i].ProteinG > altMeats[j].ProteinG
			})
		}
		alternatives["proteins"] = altMeats
	}

	if baseSauce != nil && len(sauces) > 1 {
		var altSauces []models.RestaurantItem
		for _, s := range sauces {
			if s.ItemName != baseSauce.ItemName {
				altSauces = append(altSauces, s)
			}
		}
		sort.Slice(altSauces, func(i, j int) bool {
			return altSauces[i].Calories < altSauces[j].Calories
		})
		alternatives["sauces"] = altSauces
	}

	// 3. Recommended Add-ons
	var addOns []models.RestaurantItem
	if len(meats) > 0 {
		meatPool := make([]models.RestaurantItem, len(meats))
		copy(meatPool, meats)
		if goal == "cutting" {
			sort.Slice(meatPool, func(i, j int) bool {
				return meatPool[i].ProRatio > meatPool[j].ProRatio
			})
			limit := 5
			if len(meatPool) < limit {
				limit = len(meatPool)
			}
			addOns = meatPool[:limit]
		} else {
			sort.Slice(meatPool, func(i, j int) bool {
				if meatPool[i].Calories == meatPool[j].Calories {
					return meatPool[i].ProteinG > meatPool[j].ProteinG
				}
				return meatPool[i].Calories > meatPool[j].Calories
			})
			limit := 3
			if len(meatPool) < limit {
				limit = len(meatPool)
			}
			addOns = meatPool[:limit]
		}
	}

	result := models.CustomMealBuild{
		Goal:         goal,
		BaseMeal:     basePlate,
		Alternatives: alternatives,
		AddOns:       addOns,
	}

	for _, item := range basePlate {
		result.TotalMacros.Calories += item.Calories
		result.TotalMacros.ProteinG += item.ProteinG
		result.TotalMacros.CarbsG += item.CarbsG
		result.TotalMacros.FatG += item.FatG
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
