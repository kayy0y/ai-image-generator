from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import base64
import os
import time
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Image Generator API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://ai-image-generator-nu-green.vercel.app",
        "https://ai-image-generator-66l5xfvut-kaushikii-s-projects.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],

    allow_headers=["*"],
)

HF_API_KEY  = os.getenv("HF_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")   # free at console.groq.com

HF_MODEL_URL = (
    "https://router.huggingface.co/hf-inference/models/"
    "black-forest-labs/FLUX.1-schnell"
)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

STYLE_DESCRIPTORS = {
    "realistic": "ultra realistic, photographic, 8k resolution, cinematic lighting, highly detailed",
    "anime":     "anime style, vibrant colors, detailed illustration, artistic",
    "cartoon":   "cartoon style, bold outlines, colorful, playful design",
    "painting":  "oil painting style, brush strokes, fine art, museum quality",
}

SIZE_MAP = {
    "512x512": (512, 512),
    "768x512": (768, 512),
    "512x768": (512, 768),
}


# ── Models ────────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str
    style: str = "realistic"
    size:  str = "512x512"

class GenerateResponse(BaseModel):
    image_base64:    str
    original_prompt: str
    enhanced_prompt: str
    style:           str
    size:            str
    generation_time: float


# ── Prompt enhancement (Groq — free) ─────────────────────────────────────────

def enhance_prompt_groq(prompt: str, style: str, image_description: str = "") -> str:
    """Use Groq's free LLaMA model to improve the prompt."""

    # Fallback: if no Groq key, just do simple string enhancement
    if not GROQ_API_KEY:
        style_text = STYLE_DESCRIPTORS.get(style, "")
        base = f"{image_description}, reimagined as: {prompt}" if image_description else prompt
        return f"{base}, {style_text}, professional quality, high detail, beautiful composition, good lighting"

    style_text = STYLE_DESCRIPTORS.get(style, "")

    if image_description:
        user_msg = (
            f"You are an expert AI image prompt engineer.\n"
            f"The user uploaded a photo. Here is what the photo contains: {image_description}\n"
            f"The user wants to completely reimagine it with this prompt: '{prompt}'\n"
            f"Style to apply: {style} ({style_text})\n"
            f"Write ONE improved image generation prompt that reimagines the photo's subject "
            f"with the user's prompt and style. Be vivid and specific about lighting, mood, "
            f"composition. Return ONLY the prompt, nothing else."
        )
    else:
        user_msg = (
            f"You are an expert AI image prompt engineer.\n"
            f"Rewrite this prompt to be more vivid and detailed for AI image generation.\n"
            f"Style: {style} ({style_text})\n"
            f"Original prompt: '{prompt}'\n"
            f"Return ONLY the improved prompt, nothing else."
        )

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "llama3-8b-8192",   # free on Groq
        "messages": [{"role": "user", "content": user_msg}],
        "max_tokens": 200,
        "temperature": 0.7,
    }

    try:
        res = requests.post(GROQ_URL, json=body, headers=headers, timeout=20)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"].strip()
        # If Groq fails for any reason, fall back silently
        print("GROQ ERROR:", res.status_code, res.text)
    except Exception as e:
        print("GROQ EXCEPTION:", e)

    # Fallback
    style_text = STYLE_DESCRIPTORS.get(style, "")
    return f"{prompt}, {style_text}, professional quality, high detail"


def describe_image_with_groq(image_base64: str) -> str:
    """Ask Groq's vision-capable model to describe the uploaded image."""

    if not GROQ_API_KEY:
        return "uploaded photo"

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",  # Groq vision model (free)
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                    {
                        "type": "text",
                        "text": (
                            "Describe this image in 1-2 sentences: "
                            "main subject, setting, colors, mood. "
                            "Be concise and factual. No opinion."
                        ),
                    },
                ],
            }
        ],
        "max_tokens": 150,
    }

    try:
        res = requests.post(GROQ_URL, json=body, headers=headers, timeout=20)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"].strip()
        print("GROQ VISION ERROR:", res.status_code, res.text)
    except Exception as e:
        print("GROQ VISION EXCEPTION:", e)

    return "uploaded photo"


# ── Image generation (Hugging Face) ──────────────────────────────────────────

def generate_image_from_hf(prompt: str, size: str) -> bytes:
    if not HF_API_KEY:
        raise HTTPException(status_code=500, detail="HF_API_KEY not set in .env")

    width, height = SIZE_MAP.get(size, (512, 512))
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload  = {"inputs": prompt, "parameters": {"num_inference_steps": 4}}

    for attempt in range(3):
        try:
            response = requests.post(HF_MODEL_URL, headers=headers, json=payload, timeout=120)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        if response.status_code == 200:
            return response.content

        print("HUGGING FACE ERROR:", response.status_code, response.text)

        if response.status_code == 503:
            wait_time = response.json().get("estimated_time", 20)
            time.sleep(min(wait_time, 30))
            continue

        raise HTTPException(status_code=502, detail=response.text)

    raise HTTPException(status_code=504, detail="Model loading timeout")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "running", "message": "AI Image Generator API v2 is live"}


@app.get("/health")
def health():
    return {
        "hf_key_set":   bool(HF_API_KEY),
        "groq_key_set": bool(GROQ_API_KEY),
    }


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    if req.style not in STYLE_DESCRIPTORS:
        raise HTTPException(status_code=400, detail="Invalid style")

    start = time.time()
    enhanced = enhance_prompt_groq(req.prompt, req.style)
    image_bytes  = generate_image_from_hf(enhanced, req.size)
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    return GenerateResponse(
        image_base64=image_base64,
        original_prompt=req.prompt,
        enhanced_prompt=enhanced,
        style=req.style,
        size=req.size,
        generation_time=round(time.time() - start, 2),
    )


@app.post("/reimagine", response_model=GenerateResponse)
async def reimagine(
    prompt: str       = Form(...),
    style:  str       = Form("realistic"),
    size:   str       = Form("512x512"),
    image:  UploadFile = File(...),
):
    """
    Upload a photo + provide a prompt.
    Groq vision describes the photo, then Groq LLM merges
    the description + user prompt into a rich generation prompt,
    then FLUX generates a completely new image.
    """
    if style not in STYLE_DESCRIPTORS:
        raise HTTPException(status_code=400, detail="Invalid style")
    if size not in SIZE_MAP:
        raise HTTPException(status_code=400, detail="Invalid size")
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # Read and encode uploaded image
    image_bytes_raw = await image.read()
    if len(image_bytes_raw) > 10 * 1024 * 1024:   # 10 MB limit
        raise HTTPException(status_code=400, detail="Image too large. Max 10MB.")

    image_b64_input = base64.b64encode(image_bytes_raw).decode("utf-8")

    start = time.time()

    # Step 1: describe the uploaded photo using Groq vision
    description = describe_image_with_groq(image_b64_input)

    # Step 2: merge description + user prompt into enhanced generation prompt
    enhanced = enhance_prompt_groq(prompt, style, image_description=description)

    # Step 3: generate new image with FLUX
    output_bytes = generate_image_from_hf(enhanced, size)
    output_b64   = base64.b64encode(output_bytes).decode("utf-8")

    return GenerateResponse(
        image_base64=output_b64,
        original_prompt=prompt,
        enhanced_prompt=enhanced,
        style=style,
        size=size,
        generation_time=round(time.time() - start, 2),
    )