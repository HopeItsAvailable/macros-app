package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"macros-backend/models"
)

// CulinaryTechnique defines an educational kitchen knife or cooking method guide.
type CulinaryTechnique struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"` // "knife_skills" or "cooking_method"
	Summary     string `json:"summary"`
	SafetyTips  string `json:"safety_tips"`
	VideoURL    string `json:"video_url"`
	Timestamp   string `json:"timestamp"`
}

// RecipeHandler manages recipe generation and technique library.
type RecipeHandler struct {
	Techniques map[string]CulinaryTechnique
}

// NewRecipeHandler creates a new recipe handler populated with curated techniques.
func NewRecipeHandler() *RecipeHandler {
	techs := map[string]CulinaryTechnique{
		"julienne": {
			ID:         "julienne",
			Name:       "Julienne (Matchstick Cut)",
			Category:   "knife_skills",
			Summary:    "Cut into uniform, thin matchsticks measuring approximately 1/8 inch × 1/8 inch × 2 inches. Square off round vegetables first for stability.",
			SafetyTips: "Always curl fingertips into a claw grip with the flat side of the knife blade resting against your knuckles.",
			VideoURL:   "https://www.youtube.com/watch?v=0kF3h_q2c4E",
			Timestamp:  "0:45",
		},
		"chiffonade": {
			ID:         "chiffonade",
			Name:       "Chiffonade (Ribbon Shred)",
			Category:   "knife_skills",
			Summary:    "Stack leafy herbs or greens, roll tightly into a cylinder like a cigar, and slice across thinly into delicate ribbons.",
			SafetyTips: "Use a sharp chef's knife to avoid bruising delicate herb cell walls, and do not saw back and forth.",
			VideoURL:   "https://www.youtube.com/watch?v=kYv_3j3u_xM",
			Timestamp:  "0:30",
		},
		"dice": {
			ID:         "dice",
			Name:       "Medium Dice",
			Category:   "knife_skills",
			Summary:    "Cut ingredients into uniform cubes measuring approximately 1/2 inch on each side for even, predictable cooking times.",
			SafetyTips: "Cut round produce in half first so flat sides stay anchored against the cutting board.",
			VideoURL:   "https://www.youtube.com/watch?v=Ydc_S2W39x4",
			Timestamp:  "1:15",
		},
		"sear": {
			ID:         "sear",
			Name:       "High-Heat Sear",
			Category:   "cooking_method",
			Summary:    "Cook proteins at high surface temperatures until a rich brown crust forms via the Maillard reaction. Pat proteins dry before searing.",
			SafetyTips: "Preheat heavy pan thoroughly before adding high-smoke-point oil; beware of hot oil splatter.",
			VideoURL:   "https://www.youtube.com/watch?v=W_iXoF2Rrvc",
			Timestamp:  "1:00",
		},
		"deglaze": {
			ID:         "deglaze",
			Name:       "Pan Deglazing",
			Category:   "cooking_method",
			Summary:    "Add cold liquid (broth, wine, or water) to a hot pan to dissolve browned food bits (fond) stuck to the bottom, forming the base of a sauce.",
			SafetyTips: "Remove pan briefly from open flames before pouring alcohol-based liquids to prevent flare-ups.",
			VideoURL:   "https://www.youtube.com/watch?v=XW9P4VfV7zU",
			Timestamp:  "0:50",
		},
		"saute": {
			ID:         "saute",
			Name:       "Sauté (Toss & Fry)",
			Category:   "cooking_method",
			Summary:    "Cook vegetables or cut proteins quickly in a small amount of fat over medium-high heat while tossing or stirring frequently.",
			SafetyTips: "Do not overcrowd the pan, which traps moisture and steams food instead of sautéing.",
			VideoURL:   "https://www.youtube.com/watch?v=Vd3YmK0vNqo",
			Timestamp:  "0:40",
		},
		"blanch": {
			ID:         "blanch",
			Name:       "Blanch & Shock",
			Category:   "cooking_method",
			Summary:    "Plunge vegetables into rapidly boiling salted water for 1-2 minutes, then immediately transfer into an ice water bath to halt cooking and set vibrant color.",
			SafetyTips: "Use a slotted spoon or spider strainer to gently lower produce into boiling water without splashing.",
			VideoURL:   "https://www.youtube.com/watch?v=r3k8mPzU7Qk",
			Timestamp:  "0:35",
		},
	}

	return &RecipeHandler{Techniques: techs}
}

// RecipeRequest payload for meal formulation into cooking steps.
type RecipeRequest struct {
	Title       string             `json:"title"`
	Servings    int                `json:"servings"`
	Ingredients []RecipeIngredient `json:"ingredients"`
	Appliances  []string           `json:"appliances,omitempty"`
}

// RecipeIngredient includes name and portion.
type RecipeIngredient struct {
	Name     string  `json:"name"`
	Quantity float64 `json:"quantity"`
	Unit     string  `json:"unit"`
	Calories float64 `json:"calories"`
	ProteinG float64 `json:"protein_g"`
	CarbsG   float64 `json:"carbs_g"`
	FatG     float64 `json:"fat_g"`
}

// GenerateRecipe handles POST /api/cook/recipe.
func (h *RecipeHandler) GenerateRecipe(w http.ResponseWriter, r *http.Request) {
	var req RecipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body"})
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Nutrient-Dense Skillet Bowl"
	}
	if req.Servings <= 0 {
		req.Servings = 1
	}

	recipe := models.Recipe{
		Title:       title,
		Description: fmt.Sprintf("High-protein culinary preparation tailored for %d serving(s).", req.Servings),
		Yield:       req.Servings,
		Ingredients: make([]string, 0),
		Utensils:    []string{"Chef's Knife", "Cutting Board", "Non-Stick or Cast Iron Skillet", "Spatula / Tongs", "Food Scale"},
		Steps:       make([]models.RecipeStep, 0),
	}

	for _, ing := range req.Ingredients {
		recipe.Ingredients = append(recipe.Ingredients, fmt.Sprintf("%.0f %s %s", ing.Quantity, ing.Unit, ing.Name))
		recipe.TotalMacros.Calories += ing.Calories
		recipe.TotalMacros.ProteinG += ing.ProteinG
		recipe.TotalMacros.CarbsG += ing.CarbsG
		recipe.TotalMacros.FatG += ing.FatG
	}

	// Generate structured prep and heat steps
	recipe.Steps = append(recipe.Steps, models.RecipeStep{
		StepNumber:  1,
		Title:       "Mise en Place & Knife Work",
		Instruction: "Wash and dry all produce. Dice vegetables into uniform bite-sized pieces and slice proteins evenly.",
		Stage:       "prep",
		TimerSecs:   180,
		Techniques:  []string{"dice", "julienne"},
	})

	recipe.Steps = append(recipe.Steps, models.RecipeStep{
		StepNumber:  2,
		Title:       "Preheat Pan & Sear Protein",
		Instruction: "Heat skillet over medium-high heat with 1 tsp oil. Sear protein for 4-5 minutes until golden brown and cooked through.",
		Stage:       "heat",
		TimerSecs:   270,
		Techniques:  []string{"sear"},
	})

	recipe.Steps = append(recipe.Steps, models.RecipeStep{
		StepNumber:  3,
		Title:       "Sauté Vegetables & Deglaze",
		Instruction: "Add prepared vegetables to the pan. Sauté for 3 minutes, then deglaze the pan with 2 tbsp water or broth to lift all flavorful browned fond.",
		Stage:       "heat",
		TimerSecs:   180,
		Techniques:  []string{"saute", "deglaze"},
	})

	recipe.Steps = append(recipe.Steps, models.RecipeStep{
		StepNumber:  4,
		Title:       "Plating & Macro Allocation",
		Instruction: "Portion evenly onto plates or meal prep containers. Garnish with fresh herbs sliced chiffonade style.",
		Stage:       "prep",
		TimerSecs:   60,
		Techniques:  []string{"chiffonade"},
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(recipe)
}

// GetTechniques handles GET /api/techniques.
func (h *RecipeHandler) GetTechniques(w http.ResponseWriter, r *http.Request) {
	list := make([]CulinaryTechnique, 0, len(h.Techniques))
	for _, tech := range h.Techniques {
		list = append(list, tech)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}
