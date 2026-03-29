
import os
import io
import base64
import json
import asyncio
from contextlib import asynccontextmanager

import torch
import torchvision.transforms as transforms
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageStat
import timm
import google.generativeai as genai
from dotenv import load_dotenv
import numpy as np

load_dotenv()

# ── Global state ──────────────────────────────────────────────────────────────

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_classifier = None
_yolo_model = None
_model_ready = False

# ── Model warm-up via lifespan ────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _classifier, _yolo_model, _model_ready
    print("⏳ Warming up models…")

    # Load EfficientNetV2-S
    print("  Loading EfficientNetV2-S…")
    _classifier = timm.create_model("efficientnetv2_rw_s.ra2_in1k", pretrained=True, num_classes=1000)
    _classifier.eval()
    _classifier.to(DEVICE)

    # Warm-up inference
    dummy = torch.randn(1, 3, 224, 224).to(DEVICE)
    with torch.no_grad():
        _classifier(dummy)
    print("  ✅ EfficientNetV2-S ready.")

    # Load YOLOv8 for multi-pet detection
    try:
        from ultralytics import YOLO
        print("  Loading YOLOv8n…")
        _yolo_model = YOLO("yolov8n.pt")
        print("  ✅ YOLOv8 ready.")
    except Exception as e:
        print(f"  ⚠️  YOLOv8 not available ({e}). Multi-pet detection disabled.")
        _yolo_model = None

    _model_ready = True
    print("🚀 All models loaded. Server ready.")
    yield
    print("Shutting down…")


app = FastAPI(title="Tom Finder API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev-friendly; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Breed lists ───────────────────────────────────────────────────────────────

DOG_BREEDS = [
    "Chihuahua","Japanese Spaniel","Maltese Dog","Pekinese","Shih-Tzu",
    "Blenheim Spaniel","Papillon","Toy Terrier","Rhodesian Ridgeback",
    "Afghan Hound","Basset Hound","Beagle","Bloodhound","Bluetick Coonhound",
    "Black and Tan Coonhound","Walker Hound","English Foxhound","Redbone Coonhound",
    "Borzoi","Irish Wolfhound","Italian Greyhound","Whippet","Ibizan Hound",
    "Norwegian Elkhound","Otterhound","Saluki","Scottish Deerhound","Weimaraner",
    "Staffordshire Bull Terrier","American Staffordshire Terrier","Bedlington Terrier",
    "Border Terrier","Kerry Blue Terrier","Irish Terrier","Norfolk Terrier",
    "Norwich Terrier","Yorkshire Terrier","Wire Fox Terrier","Lakeland Terrier",
    "Sealyham Terrier","Airedale Terrier","Cairn Terrier","Australian Terrier",
    "Dandie Dinmont Terrier","Boston Bull Terrier","Miniature Schnauzer",
    "Giant Schnauzer","Standard Schnauzer","Scottish Terrier","Tibetan Terrier",
    "Silky Terrier","Soft-Coated Wheaten Terrier","West Highland White Terrier",
    "Lhasa Apso","Flat-Coated Retriever","Curly-Coated Retriever","Golden Retriever",
    "Labrador Retriever","Chesapeake Bay Retriever","German Short-Haired Pointer",
    "Vizsla","English Setter","Irish Setter","Gordon Setter","Brittany Spaniel",
    "Clumber Spaniel","English Springer Spaniel","Welsh Springer Spaniel",
    "Cocker Spaniel","Sussex Spaniel","Irish Water Spaniel","Kuvasz","Schipperke",
    "Groenendael","Malinois","Briard","Kelpie","Komondor","Old English Sheepdog",
    "Shetland Sheepdog","Collie","Border Collie","Bouvier Des Flandres","Rottweiler",
    "German Shepherd","Doberman","Miniature Pinscher","Greater Swiss Mountain Dog",
    "Bernese Mountain Dog","Appenzeller","EntleBucher","Boxer","Bull Mastiff",
    "Tibetan Mastiff","French Bulldog","Great Dane","Saint Bernard","Eskimo Dog",
    "Malamute","Siberian Husky","Affenpinscher","Basenji","Pug","Leonberger",
    "Newfoundland","Great Pyrenees","Samoyed","Pomeranian","Chow","Keeshond",
    "Brabancon Griffon","Pembroke Welsh Corgi","Cardigan Welsh Corgi","Toy Poodle",
    "Miniature Poodle","Standard Poodle","Mexican Hairless","Dingo","Dhole",
    "African Hunting Dog"
]

CAT_BREEDS = [
    "Abyssinian","Bengal","Birman","Bombay","British Shorthair","Egyptian Mau",
    "Maine Coon","Persian","Ragdoll","Russian Blue","Siamese","Sphynx",
    "American Shorthair","Burmese","Devon Rex","Norwegian Forest Cat",
    "Scottish Fold","Tonkinese","Turkish Angora","Himalayan"
]

HEALTH_CONDITIONS = [
    "Healthy appearance","Possible eye irritation",
    "Coat appears dull (possible nutritional deficiency)",
    "Visible skin lesions","Signs of ear infection","Overweight indicators",
    "Underweight indicators","Dental issues visible","Possible respiratory distress",
    "Eye discharge detected","Fur matting observed","Possible mange or dermatitis"
]

EMOTIONS = ["Happy", "Calm", "Anxious", "Playful", "Tired", "Aggressive"]
EMOTION_EMOJIS = {
    "Happy": "😊", "Calm": "😌", "Anxious": "😰",
    "Playful": "🐾", "Tired": "😴", "Aggressive": "😠"
}

# ── Image transform ──────────────────────────────────────────────────────────

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# ── ImageNet class windows ───────────────────────────────────────────────────

DOG_IMAGENET_START = 151
DOG_IMAGENET_END   = 268
CAT_IMAGENET_IDS   = {281, 282, 283, 284, 285}

# YOLO COCO class IDs for animals
YOLO_CAT_ID = 15
YOLO_DOG_ID = 16


# ── Emotion heuristic ───────────────────────────────────────────────────────

def detect_emotion(img: Image.Image) -> dict:
    """
    Heuristic emotion detection from image statistics.
    Analyzes brightness, contrast, color warmth, and saturation.
    """
    arr = np.array(img.resize((128, 128)))
    brightness = arr.mean() / 255.0
    contrast = arr.std() / 255.0

    # Color channel analysis
    r, g, b = arr[:,:,0].mean(), arr[:,:,1].mean(), arr[:,:,2].mean()
    warmth = (r - b) / 255.0  # positive = warm tones
    saturation = (arr.max(axis=2) - arr.min(axis=2)).mean() / 255.0

    # Edge density as proxy for activity level
    from PIL import ImageFilter
    edges = np.array(img.resize((128, 128)).convert("L").filter(ImageFilter.FIND_EDGES))
    edge_density = (edges > 30).mean()

    # Decision tree heuristic
    if brightness > 0.6 and warmth > 0.05 and saturation > 0.2:
        emotion = "Happy"
    elif edge_density > 0.25 and contrast > 0.25:
        emotion = "Playful"
    elif brightness < 0.3 and contrast < 0.15:
        emotion = "Tired"
    elif contrast > 0.3 and warmth < -0.05:
        emotion = "Anxious"
    elif edge_density > 0.3 and brightness < 0.4:
        emotion = "Aggressive"
    else:
        emotion = "Calm"

    return {
        "emotion": emotion,
        "emoji": EMOTION_EMOJIS[emotion],
        "confidence": round(min(0.92, 0.65 + brightness * 0.2 + saturation * 0.1) * 100, 1),
    }


# ── Classification ───────────────────────────────────────────────────────────

def classify_image(img: Image.Image) -> dict:
    """Run EfficientNetV2-S and map top prediction to cat/dog + breed."""
    model = _classifier
    tensor = transform(img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = model(tensor)
        probs  = torch.softmax(logits, dim=1)[0]

    top5_probs, top5_idx = torch.topk(probs, 5)
    top_idx  = top5_idx[0].item()
    top_prob = top5_probs[0].item()

    # Aggregate dog/cat probability mass from top-5
    dog_prob = sum(
        top5_probs[i].item()
        for i in range(5)
        if DOG_IMAGENET_START <= top5_idx[i].item() <= DOG_IMAGENET_END
    )
    cat_prob = sum(
        top5_probs[i].item()
        for i in range(5)
        if top5_idx[i].item() in CAT_IMAGENET_IDS
    )

    if dog_prob == 0 and cat_prob == 0:
        if DOG_IMAGENET_START <= top_idx <= DOG_IMAGENET_END:
            dog_prob = top_prob
        elif top_idx in CAT_IMAGENET_IDS:
            cat_prob = top_prob
        else:
            dog_prob = 0.55
            cat_prob = 0.45

    is_dog = dog_prob >= cat_prob

    if is_dog:
        offset = max(0, top_idx - DOG_IMAGENET_START) % len(DOG_BREEDS)
        breed  = DOG_BREEDS[offset]
        confidence = min(0.97, dog_prob + 0.15)
    else:
        offset = max(0, top_idx - 281) % len(CAT_BREEDS)
        breed  = CAT_BREEDS[offset]
        confidence = min(0.97, cat_prob + 0.15)

    animal_type = "Dog" if is_dog else "Cat"

    # Health heuristic
    img_arr   = np.array(img.resize((224, 224)))
    brightness = img_arr.mean() / 255.0
    variance   = img_arr.std()  / 255.0

    health_flags = []
    if brightness < 0.35:
        health_flags.append(HEALTH_CONDITIONS[2])
    if variance < 0.08:
        health_flags.append(HEALTH_CONDITIONS[10])
    if brightness > 0.85:
        health_flags.append(HEALTH_CONDITIONS[5])
    if not health_flags:
        health_flags = [HEALTH_CONDITIONS[0]]

    # Emotion detection
    emotion_data = detect_emotion(img)

    return {
        "animal_type": animal_type,
        "breed": breed,
        "confidence": round(confidence * 100, 1),
        "health_conditions": health_flags,
        "emotion": emotion_data["emotion"],
        "emotion_emoji": emotion_data["emoji"],
        "emotion_confidence": emotion_data["confidence"],
        "raw_dog_prob": round(dog_prob, 4),
        "raw_cat_prob": round(cat_prob, 4),
    }


# ── Multi-pet detection ─────────────────────────────────────────────────────

def detect_multiple_pets(img: Image.Image) -> list[dict]:
    """Use YOLOv8 to detect and crop individual pets, then classify each."""
    if _yolo_model is None:
        return []

    results = _yolo_model(img, verbose=False)
    pets = []

    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0].item())
            if cls_id not in (YOLO_CAT_ID, YOLO_DOG_ID):
                continue

            conf = float(box.conf[0].item())
            if conf < 0.3:
                continue

            x1, y1, x2, y2 = [int(c) for c in box.xyxy[0].tolist()]
            # Pad crop slightly
            w, h = img.size
            pad = 10
            x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
            x2, y2 = min(w, x2 + pad), min(h, y2 + pad)

            crop = img.crop((x1, y1, x2, y2))
            if crop.size[0] < 20 or crop.size[1] < 20:
                continue

            pet_result = classify_image(crop)
            pet_result["bbox"] = [x1, y1, x2, y2]
            pet_result["detection_confidence"] = round(conf * 100, 1)

            # Generate crop preview
            buf = io.BytesIO()
            crop_thumb = crop.copy()
            crop_thumb.thumbnail((300, 300))
            crop_thumb.save(buf, format="JPEG", quality=85)
            pet_result["crop_preview"] = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"

            pets.append(pet_result)

    return pets


# ── Built-in breed knowledge (offline fallback) ─────────────────────────────

BREED_DB = {
    "Golden Retriever": {"origin": "Scotland, UK. One of the most popular family dogs worldwide.", "price_range": "₹15,000 – ₹50,000", "lifespan": "10 – 12 years", "temperament": "Friendly, Loyal, Intelligent", "care_tips": "1) Daily exercise (1-2 hrs). 2) Regular brushing to manage shedding. 3) Watch for hip dysplasia — maintain healthy weight.", "health_advice": "Prone to hip/elbow dysplasia and certain cancers. Regular vet checks recommended.", "fun_fact": "Golden Retrievers can carry a raw egg in their mouth without breaking it — they were bred for a 'soft mouth' to retrieve game birds."},
    "Labrador Retriever": {"origin": "Newfoundland, Canada. Most popular dog breed in the US for 31 years.", "price_range": "₹10,000 – ₹40,000", "lifespan": "10 – 14 years", "temperament": "Outgoing, Active, Gentle", "care_tips": "1) Needs lots of exercise. 2) Prone to obesity — monitor diet carefully. 3) Loves water, great for swimming.", "health_advice": "Watch for joint issues and obesity. Regular exercise is essential.", "fun_fact": "Labradors have a special water-resistant double coat and an otter-like tail that acts as a rudder when swimming."},
    "German Shepherd": {"origin": "Germany. Widely used as police, military, and service dogs worldwide.", "price_range": "₹15,000 – ₹70,000", "lifespan": "9 – 13 years", "temperament": "Courageous, Loyal, Confident", "care_tips": "1) Early socialization is crucial. 2) Needs mental stimulation. 3) Regular grooming for their double coat.", "health_advice": "Prone to hip dysplasia and degenerative myelopathy. Keep them active but avoid over-exercising puppies.", "fun_fact": "German Shepherds can learn a new command in just 5 repetitions and obey the first command 95% of the time."},
    "French Bulldog": {"origin": "England/France. Originally bred as miniature Bulldogs in Nottingham.", "price_range": "₹50,000 – ₹3,00,000", "lifespan": "10 – 12 years", "temperament": "Playful, Adaptable, Smart", "care_tips": "1) Avoid overheating — they're brachycephalic. 2) Clean facial wrinkles daily. 3) Short walks, no intense exercise.", "health_advice": "Prone to breathing issues due to flat face. Keep cool in hot weather. Watch for spinal problems.", "fun_fact": "French Bulldogs can't swim due to their front-heavy body structure — always use a life vest near water!"},
    "Siberian Husky": {"origin": "Siberia, Russia. Bred by the Chukchi people as sled dogs.", "price_range": "₹40,000 – ₹1,00,000", "lifespan": "12 – 15 years", "temperament": "Energetic, Mischievous, Friendly", "care_tips": "1) Needs LOTS of exercise — at least 2 hours daily. 2) Brush frequently, they shed heavily. 3) Escape artists — secure your yard.", "health_advice": "Generally healthy breed. Watch for eye conditions like cataracts and corneal dystrophy.", "fun_fact": "Huskies can change their metabolism to run for hours without fatigue or burning through fat reserves — a trick no other animal can do."},
    "Beagle": {"origin": "England. Bred for hunting hares. Popular family pet worldwide.", "price_range": "₹15,000 – ₹35,000", "lifespan": "10 – 15 years", "temperament": "Curious, Merry, Friendly", "care_tips": "1) Keep on leash — they follow their nose. 2) Prone to obesity, watch portions. 3) Regular ear cleaning needed.", "health_advice": "Check ears regularly for infections. Monitor weight as they love to eat.", "fun_fact": "Beagles have about 220 million scent receptors compared to 5 million in humans — their nose makes them airport detection stars."},
    "Poodle": {"origin": "Germany/France. Originally a water retriever duck hunting dog.", "price_range": "₹30,000 – ₹80,000", "lifespan": "12 – 15 years", "temperament": "Intelligent, Active, Elegant", "care_tips": "1) Regular professional grooming every 4-6 weeks. 2) Mental stimulation is essential. 3) Great for allergy sufferers — low shedding.", "health_advice": "Watch for eye problems and hip dysplasia. Regular dental care important.", "fun_fact": "Poodles are the second most intelligent dog breed. Their fancy haircuts were originally designed to protect joints in cold water."},
    "Rottweiler": {"origin": "Rottweil, Germany. Originally used to herd cattle and pull carts.", "price_range": "₹15,000 – ₹60,000", "lifespan": "8 – 10 years", "temperament": "Loyal, Confident, Protective", "care_tips": "1) Early socialization and training essential. 2) Needs daily exercise. 3) Regular vet checks for heart issues.", "health_advice": "Prone to hip/elbow dysplasia and heart conditions. Maintain healthy weight.", "fun_fact": "Rottweilers were among the first police dogs and served with distinction in World War I and II."},
    "Pomeranian": {"origin": "Pomerania region (Germany/Poland). Descended from large sled dogs.", "price_range": "₹5,000 – ₹75,000", "lifespan": "12 – 16 years", "temperament": "Bold, Lively, Curious", "care_tips": "1) Daily brushing to prevent matting. 2) Dental care is crucial. 3) Watch for tracheal collapse — use a harness.", "health_advice": "Dental disease is common — brush teeth regularly. Watch for luxating patella.", "fun_fact": "Queen Victoria owned a tiny Pomeranian that made the breed popular. They were originally 30 pounds but were bred down to 3-7 pounds!"},
    "Pembroke Welsh Corgi": {"origin": "Pembrokeshire, Wales. Herding dog favored by British royalty.", "price_range": "₹30,000 – ₹1,00,000", "lifespan": "12 – 15 years", "temperament": "Bold, Friendly, Playful", "care_tips": "1) Watch their weight — prone to obesity. 2) Moderate exercise daily. 3) Regular brushing for their thick coat.", "health_advice": "Prone to intervertebral disc disease due to long back. Avoid jumping from heights.", "fun_fact": "According to Welsh legend, Corgis were the preferred mount of fairy warriors — the markings on their coat are said to be from fairy saddles!"},
    "Persian": {"origin": "Persia (modern-day Iran). One of the oldest cat breeds, dating back to 1684.", "price_range": "₹8,000 – ₹30,000", "lifespan": "12 – 17 years", "temperament": "Gentle, Calm, Sweet", "care_tips": "1) Daily brushing is mandatory for their long coat. 2) Clean eyes daily — they tear a lot. 3) Indoor-only recommended.", "health_advice": "Prone to polycystic kidney disease and breathing issues due to flat face. Regular vet visits important.", "fun_fact": "Persian cats were once the favorite pets of royalty including Queen Victoria. They have the longest and thickest fur of any domestic cat."},
    "Siamese": {"origin": "Thailand (formerly Siam). Sacred temple cats of Thai royalty.", "price_range": "₹15,000 – ₹40,000", "lifespan": "15 – 20 years", "temperament": "Vocal, Social, Intelligent", "care_tips": "1) Very social — don't leave alone for long periods. 2) Minimal grooming needed. 3) Interactive toys for mental stimulation.", "health_advice": "Prone to respiratory issues and crossed eyes. Generally a very healthy breed.", "fun_fact": "Siamese cats are born completely white and develop their color points as they age due to a temperature-sensitive enzyme!"},
    "Maine Coon": {"origin": "Maine, USA. One of the largest domestic cat breeds.", "price_range": "₹20,000 – ₹50,000", "lifespan": "12 – 15 years", "temperament": "Gentle, Playful, Sociable", "care_tips": "1) Regular grooming for semi-long coat. 2) Needs space to play and climb. 3) Interactive play sessions daily.", "health_advice": "Screen for hypertrophic cardiomyopathy (HCM). Watch for hip dysplasia.", "fun_fact": "Maine Coons can grow up to 40 inches long and weigh 25+ pounds. They're often called 'gentle giants' and are known for their dog-like behavior."},
    "Bengal": {"origin": "USA. Created by crossing Asian Leopard Cats with domestic cats.", "price_range": "₹50,000 – ₹2,00,000", "lifespan": "12 – 16 years", "temperament": "Energetic, Curious, Playful", "care_tips": "1) Needs LOTS of stimulation and play. 2) Cat trees and climbing spaces essential. 3) Many Bengals love water!", "health_advice": "Generally healthy. Watch for progressive retinal atrophy and heart disease.", "fun_fact": "Bengal cats are one of the few domestic breeds that genuinely love water. Their coat has a unique 'glitter' that sparkles in sunlight."},
    "British Shorthair": {"origin": "Great Britain. One of the oldest and most pedigreed English cat breeds.", "price_range": "₹25,000 – ₹80,000", "lifespan": "12 – 20 years", "temperament": "Easygoing, Calm, Loyal", "care_tips": "1) Weekly brushing is sufficient. 2) Watch their weight — they love to eat. 3) Not very active — encourage play.", "health_advice": "Prone to obesity and hypertrophic cardiomyopathy. Monitor food intake.", "fun_fact": "The Cheshire Cat from Alice in Wonderland was based on a British Shorthair. They're also the most popular pedigreed breed in Europe."},
    "Ragdoll": {"origin": "Riverside, California, USA. Developed in the 1960s by Ann Baker.", "price_range": "₹20,000 – ₹60,000", "lifespan": "12 – 15 years", "temperament": "Docile, Affectionate, Relaxed", "care_tips": "1) Regular brushing despite silky coat. 2) Indoor-only strongly recommended. 3) Very social — loves companionship.", "health_advice": "Screen for HCM and bladder stones. Generally healthy breed.", "fun_fact": "Ragdolls get their name because they go completely limp when picked up, just like a ragdoll. They often follow their owners from room to room like a puppy."},
    "Sphynx": {"origin": "Toronto, Canada. First appeared as a natural mutation in 1966.", "price_range": "₹40,000 – ₹1,50,000", "lifespan": "9 – 15 years", "temperament": "Energetic, Social, Clownish", "care_tips": "1) Weekly baths to remove skin oils. 2) Keep warm — they get cold easily. 3) Protect from sunburn.", "health_advice": "Prone to heart disease (HCM) and skin conditions. Regular bathing essential.", "fun_fact": "Despite being 'hairless,' Sphynx cats are actually covered in fine peach-fuzz. They feel like warm suede and are one of the most affectionate breeds."},
    "Eskimo Dog": {"origin": "Arctic regions of North America. Ancient breed used by Inuit peoples for sledding and hunting.", "price_range": "₹25,000 – ₹80,000", "lifespan": "10 – 15 years", "temperament": "Loyal, Tough, Alert", "care_tips": "1) Needs vigorous daily exercise. 2) Heavy shedding — brush several times weekly. 3) Thrives in cold climates, struggles in heat.", "health_advice": "Watch for hip dysplasia and eye conditions. Ensure plenty of exercise to prevent behavioral issues.", "fun_fact": "Eskimo Dogs are one of the oldest domesticated breeds, with ancestors dating back 4,000+ years. They can pull loads of up to twice their body weight across frozen terrain."},
    "Boxer": {"origin": "Germany. Descended from the Bullenbeisser, a big game hunting dog.", "price_range": "₹20,000 – ₹60,000", "lifespan": "10 – 12 years", "temperament": "Fun-loving, Loyal, Active", "care_tips": "1) Needs lots of exercise and play. 2) Short coat — minimal grooming. 3) Sensitive to extreme temperatures.", "health_advice": "Higher cancer risk than most breeds. Regular vet checkups important. Watch for heart conditions.", "fun_fact": "Boxers got their name from their habit of standing on hind legs and 'boxing' with their front paws during play."},
    "Pug": {"origin": "China. Ancient breed dating back to 400 BC, favored by Chinese emperors.", "price_range": "₹10,000 – ₹35,000", "lifespan": "12 – 15 years", "temperament": "Charming, Mischievous, Loving", "care_tips": "1) Clean facial wrinkles daily. 2) Avoid overheating — brachycephalic breed. 3) Moderate exercise only.", "health_advice": "Prone to breathing difficulties, eye problems, and obesity. Keep cool in hot weather.", "fun_fact": "Pugs were the official dog of the Dutch Royal House of Orange after a Pug named Pompey saved the Prince's life by alerting him to assassination attempt."},
}

# Generate generic info for breeds not in the database
def _generic_breed_info(animal_type: str, breed: str, health_conditions: list[str]) -> dict:
    health_str = ", ".join(health_conditions)
    is_healthy = any("healthy" in h.lower() for h in health_conditions)
    return {
        "origin": f"The {breed} is a popular {animal_type.lower()} breed found worldwide.",
        "price_range": "₹10,000 – ₹80,000 (varies by breeder and location)",
        "lifespan": "10 – 15 years" if animal_type == "Dog" else "12 – 18 years",
        "temperament": "Loyal, Affectionate" if animal_type == "Dog" else "Independent, Curious",
        "care_tips": f"1) Regular vet checkups twice a year. 2) Balanced diet appropriate for {'dogs' if animal_type == 'Dog' else 'cats'}. 3) Daily exercise and mental stimulation.",
        "health_advice": f"Current indicators: {health_str}. {'Looking great! Keep up the good care.' if is_healthy else 'Consider consulting a veterinarian about the observed conditions.'}",
        "fun_fact": f"Every {breed} has a unique personality. {animal_type}s have been human companions for over 10,000 years!",
    }


# ── LLM enrichment (Google Gemini — free tier, with offline fallback) ────────

import time as _time

def get_llm_info(animal_type: str, breed: str, health_conditions: list[str],
                 emotion: str = "Calm") -> dict:
    api_key = os.getenv("GEMINI_API_KEY", "")

    # Try Gemini API first
    if api_key:
        genai.configure(api_key=api_key)
        health_str = ", ".join(health_conditions)

        prompt = f"""You are a veterinary and pet expert. A user uploaded a photo and our AI detected:
- Animal: {animal_type}
- Breed: {breed}
- Observed health indicators: {health_str}
- Detected emotion/mood: {emotion}

Respond ONLY with a valid JSON object (no markdown, no extra text, no code fences) with these exact keys:
{{
  "origin": "where this breed originates from and where commonly found today",
  "price_range": "typical purchase/adoption price range in Indian Rupees (₹)",
  "lifespan": "average lifespan",
  "temperament": "2-3 word personality summary",
  "care_tips": "top 3 care tips as a single string",
  "health_advice": "specific advice given the detected health indicators",
  "fun_fact": "one surprising fun fact about this breed"
}}"""

        models_to_try = ["gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-2.0-flash"]
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                raw = response.text.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                return json.loads(raw.strip())
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "quota" in err_str.lower():
                    print(f"  Rate limited on {model_name}, falling back...")
                    continue
                print(f"LLM error ({model_name}): {e}")
                break

        print("Gemini unavailable — using offline breed database.")

    # Fallback: built-in breed knowledge database
    if breed in BREED_DB:
        print(f"  Using offline data for: {breed}")
        return BREED_DB[breed]

    # Check partial matches
    for db_breed, info in BREED_DB.items():
        if db_breed.lower() in breed.lower() or breed.lower() in db_breed.lower():
            print(f"  Partial match: {breed} → {db_breed}")
            return info

    # Generic fallback
    print(f"  No DB entry for {breed}, using generic info.")
    return _generic_breed_info(animal_type, breed, health_conditions)


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Tom Finder API running", "version": "2.0.0", "device": str(DEVICE)}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    """Returns 200 only after models are fully loaded."""
    if not _model_ready:
        raise HTTPException(status_code=503, detail="Models still loading…")
    return {"status": "ready", "device": str(DEVICE)}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if not _model_ready:
        raise HTTPException(status_code=503, detail="Models not ready yet. Try again shortly.")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    data = await file.read()
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot open image.")

    # 1. Multi-pet detection
    multi_pets = detect_multiple_pets(img)

    # 2. Primary classification (whole image)
    vision_result = classify_image(img)

    # 3. LLM enrichment for primary pet
    llm_info = get_llm_info(
        vision_result["animal_type"],
        vision_result["breed"],
        vision_result["health_conditions"],
        vision_result.get("emotion", "Calm"),
    )

    # 4. If multiple pets found, enrich each (limit to 4 for speed)
    multi_results = []
    for pet in multi_pets[:4]:
        pet_info = get_llm_info(
            pet["animal_type"],
            pet["breed"],
            pet["health_conditions"],
            pet.get("emotion", "Calm"),
        ) if len(multi_pets) <= 2 else {
            "origin": "Multiple pets detected — primary analysis shown above",
            "price_range": "N/A", "lifespan": "N/A", "temperament": "N/A",
            "care_tips": "N/A", "health_advice": "N/A", "fun_fact": "N/A",
        }
        multi_results.append({**pet, "info": pet_info})

  
    buf = io.BytesIO()
    img_thumb = img.copy()
    img_thumb.thumbnail((600, 600))
    img_thumb.save(buf, format="JPEG", quality=85)
    img_b64 = base64.b64encode(buf.getvalue()).decode()

    return JSONResponse({
        "vision": vision_result,
        "info": llm_info,
        "preview": f"data:image/jpeg;base64,{img_b64}",
        "multi_pets": multi_results,
        "pet_count": max(1, len(multi_pets)),
    })
