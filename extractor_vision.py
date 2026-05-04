import pdfplumber
import pandas as pd
from google import genai
import json
import os
from dotenv import load_dotenv

load_dotenv()
AIClient = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

def clean_data_with_vision(image_object):
    print("Sending page image to AI...")
    with open("prompt.txt", "r") as f:
        extractPrompt = f.read()
        
    # pass the prompt AND the image object directly to the AI
    response = AIClient.models.generate_content(
        model='gemini-2.5-flash',     
        contents=[extractPrompt, image_object],
        config = {"response_mime_type": "application/json"}
    )
    return json.loads(response.text)

def process_pdf_with_vision(pdf_path):
    all_clean_data = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            print(f"Extracting Page {i+1}...")
            
            # 1. convert to a high-quality image
            # .original extracts the raw PIL Image object for gemini
            pil_image = page.to_image(resolution=200).original 
            
            try:
                # 2. Send toGemini
                page_clean_data = clean_data_with_vision(pil_image)
                all_clean_data.extend(page_clean_data)
            except Exception as e:
                #to format. common error is model having high demand. TODO: add retries
                error_response = {
                    "status": "error",
                    "page": i + 1,
                    "message": str(e)
                }
                print(json.dumps(error_response, indent=2))
                continue 
            
    final_df = pd.DataFrame(all_clean_data)
    final_df.to_csv("vision_cleaned_output.csv", index=False)
    print(f"Done! Extracted {len(final_df)} items. Output saved to vision_cleaned_output.csv.")

if __name__ == "__main__":
    process_pdf_with_vision("sample_menu.pdf")