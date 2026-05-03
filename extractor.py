import pdfplumber
import pandas as pd
from google import genai
import json
import os
from dotenv import load_dotenv

#env vars
load_dotenv()

#init ai client
AIClient = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

def clean_data_with_ai(messy_csv_string):
    print("Sending messy data to AI for cleaning...")
        
    #read prompt.txt file
    with open("prompt.txt", "r") as f:
        extractPrompt = f.read()
        
    #send to ai
    response = AIClient.models.generate_content(
        model='gemini-2.5-flash', #use cheap/fast model for this task    
        contents=[extractPrompt, messy_csv_string],
        config = {
            "response_mime_type": "application/json"
        }
    )
    
    #clean the response to ensure it's pure JSON (removes markdown backticks)
    #clean_json = response.text.replace("```json", "").replace("```", "").strip() #removes ```json` and ``` at beginning and end of response
    print(response.text) #DEBUG
    return json.loads(response.text)

def process_pdf_with_ai(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        first_page = pdf.pages[0]
    
        table_settings = {
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
            "explicit_vertical_lines": [10], 
            "intersection_tolerance": 15,
            "snap_tolerance": 5,
        }
        #DEBUG cropped image
        im = first_page.to_image(resolution=300)
        im.debug_tablefinder(table_settings = table_settings) #shows detected table lines
        im.save("debug_cropped.png")
        
        table = first_page.extract_table(table_settings)
        
        #Load into pandas DataFrame
        df = pd.DataFrame(table)
        df.replace("", pd.NA, inplace=True)
        df.dropna(how='all', axis=1, inplace=True)
        
        #convert the table to a raw CSV string
        messy_csv = df.to_csv(index=False, header=False)
        print(messy_csv) #DEBUG
        
        #clean with AI
        clean_data = clean_data_with_ai(messy_csv)
        
        #convert back to DataFrame and save
        final_df = pd.DataFrame(clean_data)
        final_df.to_csv("ai_cleaned_output.csv", index=False)
        
        print("Done! Check 'ai_cleaned_output.csv'.")

if __name__ == "__main__":
    process_pdf_with_ai("sample_menu.pdf")