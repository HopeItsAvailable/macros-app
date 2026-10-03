package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.yaml")

	content := `user:
  name: "Fitness Enthusiast"
  daily_goals:
    calories: 2500
    protein_g: 200
    carbs_g: 250
    fat_g: 75
pantry_staples:
  - "Salt"
  - "Olive Oil"
default_appliances:
  - "Stove"
  - "Air Fryer"
`
	if err := os.WriteFile(cfgPath, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write temp config: %v", err)
	}

	cfg, err := LoadConfig(cfgPath)
	if err != nil {
		t.Fatalf("LoadConfig returned error: %v", err)
	}

	if cfg.User.Name != "Fitness Enthusiast" {
		t.Errorf("expected user name Fitness Enthusiast, got %s", cfg.User.Name)
	}
	if cfg.User.DailyGoals.Calories != 2500 {
		t.Errorf("expected 2500 calories, got %f", cfg.User.DailyGoals.Calories)
	}
	if len(cfg.PantryStaples) != 2 {
		t.Errorf("expected 2 pantry staples, got %d", len(cfg.PantryStaples))
	}
}

func TestLoadConfigFallback(t *testing.T) {
	cfg, err := LoadConfig("non_existent_file_path_123.yaml")
	if err != nil {
		t.Fatalf("expected fallback without error, got %v", err)
	}
	if cfg.User.DailyGoals.Calories <= 0 {
		t.Errorf("expected positive calories in fallback config, got %f", cfg.User.DailyGoals.Calories)
	}
}
