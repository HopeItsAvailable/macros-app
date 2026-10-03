package models

import "time"

// Item represents a nutritional food item in the system.
type Item struct {
	ID           string    `json:"id"`
	Barcode      *string   `json:"barcode,omitempty"`
	Name         string    `json:"name"`
	Brand        *string   `json:"brand,omitempty"`
	Category     string    `json:"category"`
	ServingSizeG float64   `json:"serving_size_g"`
	Calories     float64   `json:"calories"`
	ProteinG     float64   `json:"protein_g"`
	CarbsG       float64   `json:"carbs_g"`
	FatG         float64   `json:"fat_g"`
	IsCustom     bool      `json:"is_custom"`
	CreatedAt    time.Time `json:"created_at"`
}

// FridgeItem represents an item currently in the user's fridge inventory.
type FridgeItem struct {
	ID        string     `json:"id"`
	ItemID    string     `json:"item_id"`
	Quantity  float64    `json:"quantity"`
	Unit      string     `json:"unit"`
	DateAdded time.Time  `json:"date_added"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Item      Item       `json:"item"`
}

// DailyLog represents an aggregate meal logged in the user's macro diary.
type DailyLog struct {
	ID        string    `json:"id"`
	Date      string    `json:"date"`
	MealType  string    `json:"meal_type"`
	Name      string    `json:"name"`
	Servings  float64   `json:"servings"`
	Calories  float64   `json:"calories"`
	ProteinG  float64   `json:"protein_g"`
	CarbsG    float64   `json:"carbs_g"`
	FatG      float64   `json:"fat_g"`
	ItemsJSON string    `json:"items_json"`
	CreatedAt time.Time `json:"created_at"`
}

// RestaurantItem represents an item on a restaurant menu.
type RestaurantItem struct {
	ItemName       string  `json:"item_name"`
	Category       string  `json:"category"`
	Calories       float64 `json:"calories"`
	ProteinG       float64 `json:"protein_g"`
	CarbsG         float64 `json:"carbs_g"`
	FatG           float64 `json:"fat_g"`
	SodiumMG       float64 `json:"sodium_mg"`
	FiberG         float64 `json:"fiber_g"`
	SugarG         float64 `json:"sugar_g"`
	ProPer100Kcals float64 `json:"pro_per_100_kcals,omitempty"`
	ProRatio       float64 `json:"pro_ratio,omitempty"`
	KcalPerGPro    float64 `json:"kcal_per_g_pro,omitempty"`
}

// CustomMealBuild represents an assembled meal with alternatives and add-ons.
type CustomMealBuild struct {
	Goal         string                   `json:"goal"`
	BaseMeal     []RestaurantItem         `json:"base_meal"`
	Alternatives map[string][]RestaurantItem `json:"alternatives"`
	AddOns       []RestaurantItem         `json:"add_ons"`
	TotalMacros  struct {
		Calories float64 `json:"calories"`
		ProteinG float64 `json:"protein_g"`
		CarbsG   float64 `json:"carbs_g"`
		FatG     float64 `json:"fat_g"`
	} `json:"total_macros"`
}

// RecipeStep represents a single step in a recipe.
type RecipeStep struct {
	StepNumber  int      `json:"step_number"`
	Title       string   `json:"title"`
	Instruction string   `json:"instruction"`
	Stage       string   `json:"stage"` // "prep" or "heat"
	TimerSecs   int      `json:"timer_secs"`
	Techniques  []string `json:"techniques,omitempty"`
}

// Recipe represents an interactive recipe with steps, ingredients, and utensils.
type Recipe struct {
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Yield       int          `json:"yield"`
	Ingredients []string     `json:"ingredients"`
	Utensils    []string     `json:"utensils"`
	Steps       []RecipeStep `json:"steps"`
	TotalMacros struct {
		Calories float64 `json:"calories"`
		ProteinG float64 `json:"protein_g"`
		CarbsG   float64 `json:"carbs_g"`
		FatG     float64 `json:"fat_g"`
	} `json:"total_macros"`
}
