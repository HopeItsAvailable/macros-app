import pandas as pd

#FOR PRESET ITEMS, NO INDIVIDUAL INGREDIENTS (eg subway sandwiches but not indivudal ingredients like bread, cheese, condiments, etc)
def recommend_preset(df, goal="cutting", max_cal=500, min_cal=700, min_pro=30, top_n=3):
    print(f"\n--- Top {top_n} PRESET Options for {goal.upper()} ---")
    
    # Filter out categories that are just individual ingredients, may look to use AI in the future
    ignore_words = ['individual', 'bread', 'cheese', 'condiment', 'sauce', 'veggie', 'topping', 'side', 'extras']
    mask = ~df['category'].str.contains('|'.join(ignore_words), case=False, na=False) 
    meals_only_df = df[mask].copy()

    if goal == "cutting":
        options = meals_only_df[meals_only_df['calories'] <= max_cal].copy()
        if options.empty:
            print("No items found under that calorie limit.")
            return
            
        options['pro_per_100_kcals'] = (options['protein_g'] / options['calories']) * 100
        options = options.sort_values(by='pro_per_100_kcals', ascending=False)

    elif goal == "bulking":
        options = meals_only_df[(meals_only_df['calories'] >= min_cal) & (meals_only_df['protein_g'] >= min_pro)].copy()
        if options.empty:
            print("No items found meeting those bulking minimums.")
            return
            
        options['pro_per_100_kcals'] = (options['protein_g'] / options['calories']) * 100
        options = options.sort_values(by=['calories', 'protein_g'], ascending=[False, False])

    # Print results
    for index, row in options.head(top_n).iterrows():
        ratio = round((row['protein_g'] / row['calories']) * 100, 1)
        print(f"   {row['item_name']} ({row['category']})")
        print(f"   Macros: {row['calories']} kcals | {row['protein_g']}g Protein | {row['carbs_g']}g Carbs | {row['fat_g']}g Fat")
        print(f"   Ratio: {ratio}g protein per 100 kcals\n")

#FOR BUILDER ITEMS, eg making your own sandwich
def build_custom_meal(df, goal="cutting"):
    print(f"\n--- ASSEMBLED CUSTOM BUILD FOR: {goal.upper()} ---")
    plate = []
    
    # get categories
    breads = df[df['category'].str.contains('Bread', case=False, na=False)].copy()
    meats = df[df['category'].str.contains('Meat|Protein|Chicken|Steak', case=False, na=False)].copy()
    cheeses = df[df['category'].str.contains('Cheese', case=False, na=False)].copy()
    veggies = df[df['category'].str.contains('Veg|Produce', case=False, na=False)].copy()
    sauces = df[df['category'].str.contains('Condiment|Sauce|Dressing', case=False, na=False)].copy()

    # 1. BUILD THE BASE PLATE
    if goal == "cutting":
        if not breads.empty: plate.append(breads.sort_values(by='calories').iloc[0].to_dict())
        if not meats.empty: 
            meats['pro_ratio'] = meats['protein_g'] / meats['calories']
            base_meat = meats.sort_values(by='pro_ratio', ascending=False).iloc[0]
            plate.append(base_meat.to_dict())
        if not veggies.empty: plate.extend(veggies[veggies['calories'] <= 15].to_dict('records'))
        if not sauces.empty: plate.append(sauces.sort_values(by='calories').iloc[0].to_dict())

    elif goal == "bulking":
        if not breads.empty: plate.append(breads.sort_values(by=['calories', 'carbs_g'], ascending=[False, False]).iloc[0].to_dict())
        if not meats.empty: 
            base_meat = meats.sort_values(by=['protein_g', 'calories'], ascending=[False, False]).iloc[0]
            plate.append(base_meat.to_dict())
        if not cheeses.empty: plate.append(cheeses.sort_values(by='protein_g', ascending=False).iloc[0].to_dict())
        if not veggies.empty: plate.extend(veggies.head(2).to_dict('records'))
        if not sauces.empty: plate.append(sauces.sort_values(by='calories', ascending=False).iloc[0].to_dict())

    # 2. CALCULATE SMART ADD-ONS
    add_ons = []
    if not meats.empty:
        if goal == "cutting":
            # get top 5 leanest meats as add-ons, allow user to choose which ones
            top_adds = meats.sort_values(by='pro_ratio', ascending=False).head(5)
        elif goal == "bulking":
            # get top 3 highest calorie/protein meats as add-ons
            top_adds = meats.sort_values(by=['calories', 'protein_g'], ascending=[False, False]).head(3)
            
        add_ons = top_adds.to_dict('records')

    # 3. OUTPUT THE DATA 
    total_plate = pd.DataFrame(plate)
    print(f"TOTAL BASE MACROS: {total_plate['calories'].sum()} kcals | {total_plate['protein_g'].sum()}g Pro")
    
    print("\n BASE BUILD:")
    for _, row in total_plate.iterrows():
        print(f" - {row.get('item_name')} ({row.get('calories')} cals, {row.get('protein_g')}g pro)")
        
    print("\n RECOMMENDED ADD-ONS (Click to add in UI):")
    for row in add_ons:
        #get calorie to protein ratio for add-on
        ratio = round((row.get('calories') / row.get('protein_g')), 1)
        print(f" + Add {row.get('item_name')} (+{row.get('calories')} cals, +{row.get('protein_g')}g pro), {ratio}kcal per 1g protein")

    # In your real app, you will return a dictionary like this to the frontend:
    return {
        "base_meal": plate,
        "add_ons": add_ons
    }
    

if __name__ == "__main__":
    # load cleaned data
    df = pd.read_csv("ai_cleaned_output.csv")
    
    # get both cutting and bulking recommendations for now, buttons later
    # TODO: add ability to change calorie/protein thresholds and top_n from UI
    recommend_preset(df, goal="cutting", max_cal=500, min_pro=35, top_n=3)
    recommend_preset(df, goal="bulking", min_cal=600, min_pro=35, top_n=3)
    build_custom_meal(df, goal="cutting")
    build_custom_meal(df, goal="bulking")