from flask import Flask, render_template, request, jsonify
import os
import json
import re
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
import requests
from functools import lru_cache

app = Flask(__name__)

# Set your Google API key
os.environ["GOOGLE_API_KEY"] = "AIzaSyDyK5yzznIGmCBQyB6dvedBTOFvAN-b8FI"

# Initialize the Gemini model
llm = ChatGoogleGenerativeAI(model="gemini-pro")

# Create a prompt template for comprehensive geospatial analysis
prompt = ChatPromptTemplate.from_template(
    """You are an advanced Geospatial Natural Language Understanding system. Given a query, perform the following tasks:

    1. Named Entity Recognition (NER): Identify and extract any explicit locations mentioned. 
       Categorize each location as either CITY, COUNTRY, LANDMARK, or POI (Point of Interest).

    2. Implicit Location Inference: Infer any implicit locations based on context, events, or cultural references.

    3. Intent Classification: Determine the primary geospatial intent of the query. 

    4. Geospatial Context: Provide a brief explanation of the overall geospatial context of the query.

    5. Coordinates: For each explicit and implicit location, provide latitude and longitude coordinates.

    6. Query Response: Provide a clear, concise answer to the query.

    7. Additional Information: Include any relevant additional information that might be helpful.

    Query: {query}
    
    Respond with a JSON object in the following format:
    {{
        "explicit_locations": [
            {{
                "name": "location name",
                "type": "CITY/COUNTRY/LANDMARK/POI",
                "coordinates": [latitude, longitude]
            }},
            ...
        ],
        "implicit_locations": [
            {{
                "name": "inferred location",
                "type": "CITY/COUNTRY/LANDMARK/POI",
                "coordinates": [latitude, longitude],
                "confidence": "HIGH/MEDIUM/LOW",
                "reason": "brief explanation"
            }},
            ...
        ],
        "intent": "classified intent",
        "geospatial_context": "brief explanation of the overall geospatial context of the query",
        "query_response": "clear and concise answer to the query",
        "additional_info": "any relevant additional information"
    }}
    
    If no locations are found (explicit or implicit), return empty lists for those fields.
    Only respond with the JSON object, do not include any additional text or explanation.
    """
)

# Create the chain
chain = prompt | llm

def extract_json(text):
    match = re.search(r'\{.*\}', text, re.DOTALL)
    return match.group() if match else None

@lru_cache(maxsize=100)
def process_query(query):
    try:
        result = chain.invoke({"query": query})
        content = result.content
        return json.loads(content)
    except json.JSONDecodeError:
        json_str = extract_json(content)
        if json_str:
            return json.loads(json_str)
        raise ValueError("Could not extract valid JSON from the response")

@lru_cache(maxsize=100)
def get_boundary(location_name):
    base_url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": location_name,
        "format": "json",
        "polygon_geojson": 1,
        "limit": 1
    }
    response = requests.get(base_url, params=params)
    data = response.json()
    
    return data[0]['geojson'] if data and 'geojson' in data[0] else None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process_query', methods=['POST'])
def handle_query():
    query = request.json['query']
    try:
        result = process_query(query)
        
        map_data = {
            "center": [0, 0],
            "zoom": 2,
            "markers": [],
            "boundaries": []
        }
        
        all_locations = result['explicit_locations'] + result['implicit_locations']
        if all_locations:
            map_data["center"] = all_locations[0]['coordinates']
            map_data["zoom"] = 10
            
            for loc in all_locations:
                map_data["markers"].append({
                    "coordinates": loc['coordinates'],
                    "name": loc['name'],
                    "type": loc['type']
                })
                
                boundary = get_boundary(loc['name'])
                if boundary:
                    map_data["boundaries"].append({
                        "name": loc['name'],
                        "geojson": boundary
                    })
        
        result['map_data'] = map_data
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
