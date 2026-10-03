package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// DailyGoals represents the user's macronutrient targets.
type DailyGoals struct {
	Calories float64 `yaml:"calories" json:"calories"`
	ProteinG float64 `yaml:"protein_g" json:"protein_g"`
	CarbsG   float64 `yaml:"carbs_g" json:"carbs_g"`
	FatG     float64 `yaml:"fat_g" json:"fat_g"`
}

// UserConfig holds user profile information and targets.
type UserConfig struct {
	Name       string     `yaml:"name" json:"name"`
	DailyGoals DailyGoals `yaml:"daily_goals" json:"daily_goals"`
}

// Config represents the application's configuration file schema.
type Config struct {
	User              UserConfig `yaml:"user" json:"user"`
	PantryStaples     []string   `yaml:"pantry_staples" json:"pantry_staples"`
	DefaultAppliances []string   `yaml:"default_appliances" json:"default_appliances"`
}

// DefaultConfig provides fallback settings if config file is not found.
func DefaultConfig() *Config {
	return &Config{
		User: UserConfig{
			Name: "Chef",
			DailyGoals: DailyGoals{
				Calories: 2200,
				ProteinG: 180,
				CarbsG:   220,
				FatG:     70,
			},
		},
		PantryStaples: []string{
			"Olive Oil", "Salt", "Black Pepper", "Garlic Powder", "Soy Sauce",
		},
		DefaultAppliances: []string{
			"Stove", "Oven", "Air Fryer", "Microwave", "Blender",
		},
	}
}

// LoadConfig reads and decodes the configuration from YAML file at path.
// If the file cannot be opened, it tries common fallbacks before returning DefaultConfig or error.
func LoadConfig(paths ...string) (*Config, error) {
	searchPaths := append(paths, "config.yaml", "../config.yaml", "../../config.yaml")
	for _, p := range searchPaths {
		if p == "" {
			continue
		}
		data, err := os.ReadFile(p)
		if err == nil {
			var cfg Config
			if err := yaml.Unmarshal(data, &cfg); err != nil {
				return nil, fmt.Errorf("failed to parse yaml config at %s: %w", p, err)
			}
			return &cfg, nil
		}
	}
	// Return default config if no file found
	return DefaultConfig(), nil
}
