import os
import pandas as pd

# FOR PRESET ITEMS, NO INDIVIDUAL INGREDIENTS (eg subway sandwiches but not individual ingredients like bread, cheese, condiments, etc)
def recommend_preset(df, goal="cutting", max_cal=500, min_cal=700, min_pro=30, top_n=3):
    print(f"\n--- Top {top_n} PRESET Options for {goal.upper()} ---")
    
    # Filter out categories that are just individual ingredients
    ignore_words = ['individual', 'bread', 'cheese', 'condiment', 'sauce', 'veggie', 'topping', 'side', 'extras']
    mask = ~df['category'].str.contains('|'.join(ignore_words), case=False, na=False) 
    meals_only_df = df[mask].copy()

    if goal == "cutting":
        options = meals_only_df[meals_only_df['calories'] <= max_cal].copy()
        if options.empty:
            print("No items found under that calorie limit.")
            return []
            
        options['pro_per_100_kcals'] = (options['protein_g'] / options['calories']) * 100
        options = options.sort_values(by='pro_per_100_kcals', ascending=False)

    elif goal == "bulking":
        options = meals_only_df[(meals_only_df['calories'] >= min_cal) & (meals_only_df['protein_g'] >= min_pro) & (meals_only_df['calories'] <= max_cal)].copy()
        if options.empty:
            print("No items found meeting those bulking minimums.")
            return []
            
        options['pro_per_100_kcals'] = (options['protein_g'] / options['calories']) * 100
        options = options.sort_values(by=['calories', 'protein_g'], ascending=[False, False])

    results = []
    for _, row in options.head(top_n).iterrows():
        ratio = round((row['protein_g'] / row['calories']) * 100, 1)
        print(f"   {row['item_name']} ({row['category']})")
        print(f"   Macros: {row['calories']} kcals | {row['protein_g']}g Protein | {row['carbs_g']}g Carbs | {row['fat_g']}g Fat")
        print(f"   Ratio: {ratio}g protein per 100 kcals\n")
        results.append(row.to_dict())
    return results

# FOR BUILDER ITEMS, eg making your own sandwich
def build_custom_meal(df, goal="cutting"):
    print(f"\n--- ASSEMBLED CUSTOM BUILD FOR: {goal.upper()} ---")
    plate = []
    
    # get categories
    breads = df[df['category'].str.contains('Bread|Base', case=False, na=False)].copy()
    meats = df[df['category'].str.contains('Individual Proteins', case=False, na=False)].copy()
    cheeses = df[df['category'].str.contains(r'\bcheese\b', case=False, na=False)].copy()
    veggies = df[df['category'].str.contains('Veg|Produce|Vegetables', case=False, na=False)].copy()
    sauces = df[df['category'].str.contains('Condiment|Sauce|Dressing', case=False, na=False)].copy()
    
    base_bread = None
    base_meat = None
    base_sauce = None
    # 1. BUILD THE BASE PLATE
    if goal == "cutting":
        if not breads.empty: 
            adult_breads = breads[~breads['item_name'].str.contains('Mini|Kid', case=False, na=False)]
            if adult_breads.empty:
                adult_breads = breads
            
            base_bread = adult_breads.sort_values(by='calories').iloc[0]
            plate.append(base_bread.to_dict())
        if not meats.empty: 
            meats['pro_ratio'] = meats['protein_g'] / meats['calories']
            base_meat = meats.sort_values(by='pro_ratio', ascending=False).iloc[0]
            plate.append(base_meat.to_dict())
        if not veggies.empty: plate.extend(veggies[veggies['calories'] <= 15].to_dict('records'))
        if not sauces.empty:
            base_sauce = sauces.sort_values(by='calories').iloc[0]
            plate.append(base_sauce.to_dict())

    elif goal == "bulking":
        if not breads.empty: 
            base_bread = breads.sort_values(by=['calories', 'carbs_g'], ascending=[False, False]).iloc[0]
            plate.append(base_bread.to_dict())
        if not meats.empty: 
            base_meat = meats.sort_values(by=['protein_g', 'calories'], ascending=[False, False]).iloc[0]
            plate.append(base_meat.to_dict())
        if not cheeses.empty: plate.append(cheeses.sort_values(by='protein_g', ascending=False).iloc[0].to_dict())
        if not veggies.empty: plate.extend(veggies.head(2).to_dict('records'))
        if not sauces.empty:
            base_sauce = sauces.sort_values(by='calories', ascending=False).iloc[0]
            plate.append(base_sauce.to_dict())

    # 2. CALCULATE ALTERNATIVES and ADD-ONS
    alternatives = {}
    add_ons = []
    if base_bread is not None and not breads.empty:
        alt_breads = breads[breads['item_name'] != base_bread['item_name']]
        alt_breads = alt_breads.sort_values(by='calories')
        alternatives['breads'] = alt_breads.to_dict('records')

    if base_meat is not None and not meats.empty:
        alt_meats = meats[meats['item_name'] != base_meat['item_name']]
        if goal == "cutting":
            if 'pro_ratio' not in alt_meats.columns:
                alt_meats['pro_ratio'] = alt_meats['protein_g'] / alt_meats['calories']
            alt_meats = alt_meats.sort_values(by='pro_ratio', ascending=False)
        else:
            alt_meats = alt_meats.sort_values(by=['protein_g', 'calories'], ascending=[False, False])
        alternatives['proteins'] = alt_meats.to_dict('records')

    if base_sauce is not None and not sauces.empty:
        alt_sauces = sauces[sauces['item_name'] != base_sauce['item_name']]
        alt_sauces = alt_sauces.sort_values(by='calories')
        alternatives['sauces'] = alt_sauces.to_dict('records')
            
    if not meats.empty:
        if goal == "cutting":
            if 'pro_ratio' not in meats.columns:
                meats['pro_ratio'] = meats['protein_g'] / meats['calories']
            top_adds = meats.sort_values(by='pro_ratio', ascending=False).head(5)
        elif goal == "bulking":
            top_adds = meats.sort_values(by=['calories', 'protein_g'], ascending=[False, False]).head(3)
            
        add_ons = top_adds.to_dict('records')

    # 3. OUTPUT THE DATA 
    total_plate = pd.DataFrame(plate)
    if not total_plate.empty:
        cals = total_plate['calories'].sum() if 'calories' in total_plate.columns else 0
        pro = total_plate['protein_g'].sum() if 'protein_g' in total_plate.columns else 0
        print(f"TOTAL BASE MACROS: {cals} kcals | {pro}g Pro")
        
        print("\n BASE BUILD:")
        for _, row in total_plate.iterrows():
            print(f" - {row.get('item_name')} ({row.get('calories')} cals, {row.get('protein_g')}g pro)")
            
    if 'breads' in alternatives:
        print("\n🔄 ALTERNATIVE BREADS (For UI Swap feature):")
        for row in alternatives['breads'][:5]:
            print(f" ~ Swap for: {row.get('item_name')} ({row.get('calories')} cals)")
            
    print("\n RECOMMENDED ADD-ONS (Click to add in UI):")
    for row in add_ons:
        c = row.get('calories', 0)
        p = row.get('protein_g', 1)
        ratio = round((c / p), 1) if p else 0
        print(f" + Add {row.get('item_name')} (+{c} cals, +{p}g pro), {ratio}kcal per 1g protein")

    return {
        "base_meal": plate,
        "alternatives": alternatives,
        "add_ons": add_ons 
    }

def find_data_file(filename="ai_cleaned_output.csv"):
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "data", filename),
        os.path.join(os.path.dirname(__file__), "data", filename),
        os.path.join(os.getcwd(), "data", filename),
        filename
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return filename

if __name__ == "__main__":
    data_path = find_data_file("ai_cleaned_output.csv")
    if os.path.exists(data_path):
        df = pd.read_csv(data_path)
        recommend_preset(df, goal="cutting", max_cal=500, min_pro=35, top_n=3)
        recommend_preset(df, goal="bulking", max_cal=700, min_cal=500, min_pro=35, top_n=3)
        build_custom_meal(df, goal="cutting")
        build_custom_meal(df, goal="bulking")
    else:
        print(f"Dataset not found at {data_path}")
