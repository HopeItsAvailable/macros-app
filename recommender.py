import pandas as pd

def recommend_for_cutting(df, max_calories=500, top_n=3):
    # under calorie, and good calorie to protein ratio
    pass

def recommend_for_bulking(df, min_calories=600, min_protein=30, top_n=3):
    # same as cutting but higher calorie threshold and also a minimum protein threshold
    pass

if __name__ == "__main__":
    # load cleaned data
    df = pd.read_csv("ai_cleaned_output.csv")
    
    # get both cutting and bulking recommendations for now, buttons later
    # TODO: add ability to change calorie/protein thresholds and top_n from UI
    recommend_for_cutting(df, max_calories=400, top_n=3)
    recommend_for_bulking(df, min_calories=700, min_protein=35, top_n=3)