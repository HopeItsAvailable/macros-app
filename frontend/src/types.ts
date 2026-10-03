export interface Item {
  id: string
  barcode?: string
  name: string
  brand?: string
  category: string
  serving_size_g: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  is_custom: boolean
  created_at?: string
}

export interface FridgeItem {
  id: string
  item_id: string
  quantity: number
  unit: string
  date_added: string
  expires_at?: string
  item: Item
}

export interface MealIngredient {
  item: Item
  portion_g: number
  portion_count: number
  unit: 'g' | 'oz' | 'count'
}

export interface DailyLog {
  id: string
  date: string
  meal_type: string
  name: string
  servings: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  items_json: string
  created_at: string
}

export interface DailyDiaryData {
  date: string
  meals: DailyLog[]
  totals: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  goals: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

export interface RestaurantItem {
  item_name: string
  category: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sodium_mg: number
  fiber_g: number
  sugar_g: number
  pro_per_100_kcals?: number
  pro_ratio?: number
  kcal_per_g_pro?: number
}

export interface CustomMealBuild {
  goal: string
  base_meal: RestaurantItem[]
  alternatives: Record<string, RestaurantItem[]>
  add_ons: RestaurantItem[]
  total_macros: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

export interface CulinaryTechnique {
  id: string
  name: string
  category: string
  summary: string
  safety_tips: string
  video_url: string
  timestamp: string
}

export interface RecipeStep {
  step_number: number
  title: string
  instruction: string
  stage: 'prep' | 'heat'
  timer_secs: number
  techniques?: string[]
}

export interface Recipe {
  title: string
  description: string
  yield: number
  ingredients: string[]
  utensils: string[]
  steps: RecipeStep[]
  total_macros: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

export interface AppConfig {
  user: {
    name: string
    daily_goals: {
      calories: number
      protein_g: number
      carbs_g: number
      fat_g: number
    }
  }
  pantry_staples: string[]
  default_appliances: string[]
}
