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

# GLOBAL PDF menu path
pdf_menu_path = "sample_menu.pdf"

# GLOBAL Table extraction settings
def get_table_settings():
    with pdfplumber.open(pdf_menu_path) as pdf:
        page_width = pdf.pages[0].width

    table_settings = {
        "vertical_strategy": "lines",
        "horizontal_strategy": "lines",
        # Cap the left edge (10) AND the right edge (page_width - 10)
        "explicit_vertical_lines": [10, page_width - 10], 
        "intersection_tolerance": 15,
        "snap_tolerance": 5,
    }
    return table_settings

def clean_data_with_ai(messy_csv_string, last_category=None):
    print("Sending messy data to AI for cleaning...")
        
    #read prompt.txt file
    with open("prompt.txt", "r") as f:
        extractPrompt = f.read()
        
    #add context hint since some menu items were cutoff from their respective category headers
    if last_category:
        context_hint = f"CONTEXT HINT: The category at the bottom of the previous page was '{last_category}'. If the first rows are food items with no category header, classify them as '{last_category}'.\n\n"
        messy_csv_string = context_hint + messy_csv_string
        
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

def show_debug_info_menu():
    
    # DEBUG - show detected table lines
    table_settings = get_table_settings()
    with pdfplumber.open(pdf_menu_path) as pdf:
        #go through each page and save the debug image with detected table lines
        for i, page in enumerate(pdf.pages):
            im = page.to_image(resolution=300)
            im.debug_tablefinder(table_settings = table_settings) 
            im.save(f"debug_cropped_page_{i+1}.png")

def process_pdf_with_ai(pdf_path):
    
    all_clean_data = [] #need to split page output to bypass token limit, so this will hold all json objects
    last_known_category = None # Track the category between pages!
    
    with pdfplumber.open(pdf_path) as pdf:

        for i, page in enumerate(pdf.pages):
            print(f"Extracting Page {i+1}...")
            
            table_settings = get_table_settings()
            table = page.extract_table(table_settings)
            
            if not table:
                continue
            
            # Load into pandas DataFrame
            df = pd.DataFrame(table)
            df.replace("", pd.NA, inplace=True)
            df.dropna(how='all', axis=1, inplace=True)
            
            # convert just this page to CSV
            page_csv = df.to_csv(index=False, header=False)
                
            #DEBUG - show detected table lines
            im = page.to_image(resolution=300)
            im.debug_tablefinder(table_settings = table_settings) 
            im.save(f"debug_cropped_page_{i+1}.png")
            
            try:
                # clean with AI - page by page
                page_clean_data = clean_data_with_ai(page_csv, last_known_category)
                # append to master list of data
                all_clean_data.extend(page_clean_data)
                
                if page_clean_data and isinstance(page_clean_data, list):
                    # grab the category of the very last item extracted
                    last_item = page_clean_data[-1]
                    last_known_category = last_item.get("category", last_known_category)
            except Exception as e:
                print(f"Failed to parse JSON on page {i+1}. Error: {e}")
                continue # skip the errored page and keep going
            
        #convert back to DataFrame and save
        final_df = pd.DataFrame(all_clean_data)
        final_df.to_csv("ai_cleaned_output.csv", index=False)
        print(f"Done! Extracted {len(final_df)} items. Check 'ai_cleaned_full_menu.csv'.")

if __name__ == "__main__":
    #process_pdf_with_ai("sample_menu.pdf")
    show_debug_info_menu()