from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import base64
import os
import time
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="AI Image Generator API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HF_API_KEY = os.getenv("HF_API_KEY")

HF_MODEL_URL = (
    "https://router.huggingface.co/hf-inference/models/"
    "black-forest-labs/FLUX.1-schnell"
)

STYLE_DESCRIPTORS = {

    "realistic":
        "ultra realistic, photographic, 8k resolution, cinematic lighting, highly detailed",

    "anime":
        "anime style, vibrant colors, detailed illustration, artistic",

    "cartoon":
        "cartoon style, bold outlines, colorful, playful design",

    "painting":
        "oil painting style, brush strokes, fine art, museum quality"
}

SIZE_MAP = {
    "512x512": (512,512),
    "768x512": (768,512),
    "512x768": (512,768)
}
class GenerateRequest(BaseModel):
    prompt: str
    style: str = "realistic"
    size: str = "512x512"

class GenerateResponse(BaseModel):
    image_base64: str
    original_prompt: str
    enhanced_prompt: str
    style: str
    size: str
    generation_time: float

def enhance_prompt(prompt: str, style: str):

    style_text = STYLE_DESCRIPTORS.get(style,"")
    return (
        f"{prompt}, "
        f"{style_text}, "
        "professional quality, "
        "high detail, "
        "beautiful composition, "
        "good lighting"
    )

def generate_image_from_hf(prompt: str, size: str):

    if not HF_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="HF_API_KEY not set in .env"
        )

    width,height = SIZE_MAP.get(
        size,
        (512,512)
    )

    headers = {

        "Authorization": f"Bearer {HF_API_KEY}"

    }
    payload = {
    "inputs": prompt,
    "parameters": {
        "num_inference_steps": 4
    }
}

    for attempt in range(3):

        try:
            response = requests.post(
                HF_MODEL_URL,
                headers=headers,
                json=payload,
                timeout=120
            )

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=str(e)
            )

        if response.status_code == 200:

            return response.content

        print(
            "HUGGING FACE ERROR:",
            response.status_code,
            response.text
        )

        if response.status_code == 503:
            wait_time = response.json().get( "estimated_time",20)
            
            time.sleep(
                min(wait_time,30)
            )

            continue

        raise HTTPException(
            status_code=502,
            detail=response.text

        )

    raise HTTPException(
        status_code=504,
        detail="Model loading timeout"

    )

@app.get("/")
def root():

    return {
        "status":"running",
        "message":"AI Image Generator API is live"
    }

@app.get("/health")
def health():
    return {
        "hf_key_set": bool(HF_API_KEY)
    }

@app.post(
    "/generate",
    response_model=GenerateResponse
)
def generate(req: GenerateRequest):

    if not req.prompt.strip():

        raise HTTPException( status_code=400,detail="Prompt cannot be empty" )

    if req.style not in STYLE_DESCRIPTORS:
        raise HTTPException(
            status_code=400,
            detail="Invalid style"
        )
        
    start=time.time()
    
    enhanced_prompt = enhance_prompt( req.prompt,req.style )
    
    image_bytes = generate_image_from_hf( enhanced_prompt,req.size)
    image_base64 = base64.b64encode( image_bytes ).decode("utf-8")
    elapsed = round(time.time()-start, 2)

    return GenerateResponse(
        image_base64=image_base64,
        original_prompt=req.prompt,
        enhanced_prompt=enhanced_prompt,
        style=req.style,
        size=req.size,
        generation_time=elapsed

    )