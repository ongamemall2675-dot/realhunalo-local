
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

def debug_types():
    print("Listing attributes in google.genai.types:")
    attrs = dir(types)
    for a in attrs:
        if "Audio" in a or "Config" in a:
            print(a)

if __name__ == "__main__":
    debug_types()
