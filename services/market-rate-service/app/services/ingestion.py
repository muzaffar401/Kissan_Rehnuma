"""Ingestion layer — the SINGLE place raw source data is standardized.

Adding a new source later means adding its fetcher plus, at most, new
synonym/unit entries here. Nothing else in the codebase changes.
"""
from dataclasses import dataclass
from datetime import date
from typing import List, Optional

from app.services.sources.base import RawPrice

# ─── Crop Synonyms ────────────────────────────────────────────────────────────
# Maps raw AMIS commodity names (lowercase) → standardized display names.
# Covers all 136 commodities from AMIS Punjab.
CROP_SYNONYMS = {
    # ── Grains & Pulses ──
    "wheat": "Wheat",
    "gandum": "Wheat",
    "rice basmati super (new)": "Rice Basmati Super (New)",
    "rice basmati super (old)": "Rice Basmati Super (Old)",
    "rice basmati (385)": "Rice Basmati (385)",
    "rice (irri)": "Rice (IRRI)",
    "rice kainat (new)": "Rice Kainat (New)",
    "rice kainat old": "Rice Kainat Old",
    "paddy basmati": "Paddy Basmati",
    "paddy (irri)": "Paddy (IRRI)",
    "paddy kainat": "Paddy Kainat",
    "maize": "Maize",
    "millet": "Millet",
    "bajra": "Millet",
    "sorghum": "Sorghum",
    "jowar": "Sorghum",
    "barley(جو)": "Barley",
    "barley": "Barley",
    "sugar": "Sugar",
    "brown sugar(شکر)": "Brown Sugar",
    "brown sugar": "Brown Sugar",
    "jaggery (گڑ)": "Jaggery",
    "jaggery": "Jaggery",
    "sugarcane(گنڈ یری)": "Sugarcane",
    "sugarcane": "Sugarcane",
    "seed cotton(phutti)": "Seed Cotton",
    "seed cotton": "Seed Cotton",
    "cotton": "Seed Cotton",
    "gram white  bareek": "Gram White Bareek",
    "gram white bareek": "Gram White Bareek",
    "gram white(imported) mota": "Gram White (Imported) Mota",
    "gram black bareek": "Gram Black Bareek",
    "gram black mota": "Gram Black Mota",
    "gram pulse(bareek)": "Gram Pulse (Bareek)",
    "gram pulse(moti)": "Gram Pulse (Moti)",
    "gram flour (بیسن)": "Gram Flour",
    "gram flour": "Gram Flour",
    "moong": "Moong",
    "moong pulse kori": "Moong Pulse Kori",
    "mash": "Mash",
    "mash pulse(imported) washed": "Mash Pulse (Imported) Washed",
    "mash pulse(imported) unwashed": "Mash Pulse (Imported) Unwashed",
    "mash pulse(local)": "Mash Pulse (Local)",
    "masoor whole(local)": "Masoor Whole (Local)",
    "masoor whole (imported)": "Masoor Whole (Imported)",
    "masoor pulse(local) bareek": "Masoor Pulse (Local) Bareek",
    "masoor pulse (imported) moti": "Masoor Pulse (Imported) Moti",
    "rapeseed (torya)": "Rapeseed",
    "rapeseed": "Rapeseed",
    "canola": "Canola",
    "sunflower": "Sunflower",
    "sesame(تِل)": "Sesame",
    "sesame": "Sesame",
    "mustard seed": "Mustard Seed",
    "groundnut": "Groundnut",
    "red chilli whole (dry)": "Red Chilli (Dry)",
    "banola": "Banola",
    "banola cake": "Banola Cake",
    "green fodder": "Green Fodder",
    "wheat straw": "Wheat Straw",

    # ── Vegetables ──
    "potato fresh": "Potato Fresh",
    "potato store": "Potato Store",
    "potato sugar free": "Potato Sugar Free",
    "potato": "Potato Fresh",
    "aloo": "Potato Fresh",
    "onion": "Onion",
    "pyaz": "Onion",
    "green onion": "Green Onion",
    "tomato": "Tomato",
    "tamatar": "Tomato",
    "spinach": "Spinach",
    "palak": "Spinach",
    "brinjal": "Brinjal",
    "bengan": "Brinjal",
    "lady finger/okra (بھنڈی توری)": "Lady Finger (Okra)",
    "lady finger": "Lady Finger (Okra)",
    "okra": "Lady Finger (Okra)",
    "bhindi": "Lady Finger (Okra)",
    "bitter gourd (کریلا)": "Bitter Gourd",
    "bitter gourd": "Bitter Gourd",
    "karela": "Bitter Gourd",
    "tinda desi": "Tinda Desi",
    "tindian": "Tindian",
    "pumpkin": "Pumpkin",
    "kaddu": "Bottle Gourd",
    "loki": "Bottle Gourd",
    "cauliflower": "Cauliflower",
    "phool gobhi": "Cauliflower",
    "cabbage": "Cabbage",
    "bandh gobhi": "Cabbage",
    "peas": "Peas",
    "matar": "Peas",
    "mater": "Peas",
    "turnip": "Turnip",
    "shalgam": "Turnip",
    "shaljam": "Turnip",
    "radish": "Radish",
    "mooli": "Radish",
    "carrot": "Carrot",
    "gajar": "Carrot",
    "carrot china": "Carrot China",
    "cucumber (kheera)": "Cucumber",
    "cucumber": "Cucumber",
    "kheera": "Cucumber",
    "green chilli": "Green Chilli",
    "capsicum (شملہ مرچ)": "Capsicum",
    "capsicum": "Capsicum",
    "shimla mirch": "Capsicum",
    "bottle gourd (کدو)": "Bottle Gourd",
    "bottle gourd": "Bottle Gourd",
    "kaddu": "Bottle Gourd",
    "zucchini (گھیا توری)": "Zucchini",
    "zucchini": "Zucchini",
    "fenugreek(میتھی)": "Fenugreek",
    "fenugreek": "Fenugreek",
    "methi": "Fenugreek",
    "mongray": "Mongray",
    "cocoyam(اروی)": "Cocoyam",
    "cocoyam": "Cocoyam",
    "mustard greens(ساگ سرسوں)": "Mustard Greens",
    "mustard greens": "Mustard Greens",
    "coriander (دھنیا)": "Coriander",
    "coriander": "Coriander",
    "dhania": "Coriander",
    "mint(پودینہ)": "Mint",
    "mint": "Mint",
    "pudina": "Mint",
    "turmeric whole(ثابت ہلدی)": "Turmeric",
    "turmeric": "Turmeric",
    "garlic (china)": "Garlic (China)",
    "garlic (local)": "Garlic (Local)",
    "garlic": "Garlic (Local)",
    "lahsun": "Garlic (Local)",
    "ginger(china)": "Ginger (China)",
    "ginger (thai)": "Ginger (Thai)",
    "ginger": "Ginger (China)",
    "adrak": "Ginger (China)",
    "batho": "Batho",
    "suger beet(چقندر)": "Sugar Beet",
    "suger beet": "Sugar Beet",
    "water chestnut(سنگھاڑا)": "Water Chestnut",
    "water chestnut": "Water Chestnut",
    "green chickpeas(چھولیا)": "Green Chickpeas",
    "green chickpeas": "Green Chickpeas",

    # ── Fruits ──
    "apple kala kullu (pahari)": "Apple Kala Kullu (Pahari)",
    "apple kala kullu (madani)": "Apple Kala Kullu (Madani)",
    "apple (golden)": "Apple (Golden)",
    "apple (gatcha)": "Apple (Gatcha)",
    "apple (ammre)": "Apple (Ammre)",
    "apple": "Apple (Gatcha)",
    "sebh": "Apple",
    "banana(dozen)": "Banana (Dozen)",
    "banana": "Banana (Dozen)",
    "kela": "Banana (Dozen)",
    "guava": "Guava",
    "amrood": "Guava",
    "orange(100pcs)": "Orange",
    "orange": "Orange",
    "kinnow (100pcs)": "Kinnow",
    "kinnow": "Kinnow",
    "pomegranate(kandhari)": "Pomegranate (Kandhari)",
    "pomegranate(badana)": "Pomegranate (Badana)",
    "pomegranate desi": "Pomegranate Desi",
    "pomegranate": "Pomegranate Desi",
    "anar": "Pomegranate Desi",
    "anaar": "Pomegranate Desi",
    "grapes (other)": "Grapes (Other)",
    "grapes gola": "Grapes Gola",
    "grapes sundekhani": "Grapes Sundekhani",
    "grapes": "Grapes Gola",
    "angoor": "Grapes Gola",
    "mango(chounsa)": "Mango (Chounsa)",
    "mango(desahri)": "Mango (Desahri)",
    "mango(sindhri)": "Mango (Sindhri)",
    "mango(anwer ratol)": "Mango (Anwer Ratol)",
    "mango saherni": "Mango Saharni",
    "mango desi": "Mango Desi",
    "mango (malda)": "Mango (Malda)",
    "mango": "Mango (Chounsa)",
    "aam": "Mango (Chounsa)",
    "melon": "Melon",
    "kharboza": "Melon",
    "watermelon": "Watermelon",
    "tarbooz": "Watermelon",
    "lychee": "Lychee",
    "strawberry": "Strawberry",
    "dates (aseel)": "Dates (Aseel)",
    "dates(irani)": "Dates (Irani)",
    "dates": "Dates (Aseel)",
    "khajoor": "Dates (Aseel)",
    "lemon (desi)": "Lemon (Desi)",
    "lemon (china)": "Lemon (China)",
    "lemon (other)": "Lemon (Other)",
    "lemon": "Lemon (Desi)",
    "nimbu": "Lemon (Desi)",
    "peach": "Peach",
    "peach special": "Peach Special",
    "plum": "Plum",
    "aloo bukhara": "Plum",
    "pear": "Pear",
    "musambi(100pcs)": "Musambi",
    "musambi": "Musambi",
    "grapefruit(100pcs)": "Grapefruit",
    "grapefruit": "Grapefruit",
    "mausami": "Musambi",
    "apricot yellow": "Apricot Yellow",
    "apricot white": "Apricot White",
    "apricot": "Apricot Yellow",
    "sweet musk melon": "Sweet Musk Melon",
    "sweet musk melon (shireen)": "Sweet Musk Melon (Shireen)",
    "sweet potato(شکر قندی)": "Sweet Potato",
    "sweet potato": "Sweet Potato",
    "shakarqandi": "Sweet Potato",
    "jujube(بیر)": "Jujube",
    "jujube": "Jujube",
    "ber": "Jujube",
    "cocunut": "Coconut",
    "papaya(پپیتا)": "Papaya",
    "papaya": "Papaya",
    "loquat": "Loquat",
    "jali": "Loquat",
    "persimmon(جاپانی پھل)": "Persimmon",
    "persimmon": "Persimmon",
    "jaman": "Jaman",
    "feutral early(100 pcs) فروٹر": "Feutral Early",
    "feutral early": "Feutral Early",

    # ── Urdu Script Synonyms ──────────────────────────────────────────────────
    # Urdu script names that farmers/LLM might pass — mapped to standardized names.
    # Vegetables
    "آلو": "Potato Fresh",
    "پیاز": "Onion",
    "ٹماٹر": "Tomato",
    "ٹماٹر": "Tomato",
    "گاجر": "Carrot",
    "کھیرا": "Cucumber",
    "پالک": "Spinach",
    "بینگن": "Brinjal",
    "بھنڈی": "Lady Finger (Okra)",
    "کریلا": "Bitter Gourd",
    "گوبھی": "Cauliflower",
    "پھول گوبھی": "Cauliflower",
    "بند گوبھی": "Cabbage",
    "مولی": "Radish",
    "کدو": "Bottle Gourd",
    "لوکی": "Bottle Gourd",
    "مرچ": "Green Chilli",
    "شملہ مرچ": "Capsicum",
    "مٹر": "Peas",
    "اروی": "Cocoyam",
    "میتھی": "Fenugreek",
    "دھنیا": "Coriander",
    "ادرک": "Ginger (China)",
    "لہسن": "Garlic (Local)",
    "پودینہ": "Mint",
    "ہلدی": "Turmeric",
    "شکر قندی": "Sweet Potato",
    "چقندر": "Sugar Beet",
    "سنگھاڑا": "Water Chestnut",
    "چھولیا": "Green Chickpeas",
    # Fruits
    "آم": "Mango (Chounsa)",
    "سیب": "Apple (Gatcha)",
    "انگور": "Grapes Gola",
    "کیلا": "Banana (Dozen)",
    "امرود": "Guava",
    "آڑھو": "Peach",
    "ناشپاتی": "Pear",
    "چکوترا": "Grapefruit",
    "خربوزہ": "Melon",
    "تربز": "Watermelon",
    "انار": "Pomegranate Desi",
    "کھجور": "Dates (Aseel)",
    "لیموں": "Lemon (Desi)",
    "بیر": "Jujube",
    "پپیتا": "Papaya",
    "جاپانی پھل": "Persimmon",
    # Grains & Pulses
    "گندم": "Wheat",
    "چاول": "Rice Basmati Super (New)",
    "مکئی": "Maize",
    "جوار": "Sorghum",
    "باجرا": "Millet",
    "چنے": "Gram White Bareek",
    "مسور": "Masoor Whole (Local)",
    "مونگ": "Moong",
    "ماش": "Mash",
    # Cash crops
    "گنا": "Sugarcane",
    "کپاس": "Seed Cotton",
    "روئی": "Seed Cotton",
    "سر سوں": "Rapeseed",
    "تل": "Sesame",
}

# ─── Unit Divisors ────────────────────────────────────────────────────────────
# Converts raw unit → PKR per kg
# AMIS reports in Rs/100Kg (quintal), so divide by 100
UNIT_DIVISORS = {
    "100kg": 100.0, "quintal": 100.0,
    "kg": 1.0, "1kg": 1.0,
    "40kg": 40.0, "40 kg": 40.0, "maund": 40.0,
    "dozen": 1.0,  # IRFarm reports Banana per dozen as-is
}


@dataclass
class StandardPrice:
    crop_name: str
    mandi_name: str
    city: str
    price_per_kg: float
    min_price_per_kg: Optional[float]
    max_price_per_kg: Optional[float]
    fqp_price_per_kg: Optional[float]
    recorded_date: date
    source: str


def standardize_crop(raw: str) -> Optional[str]:
    """Map a raw crop name to the standardized one; None if unknown.

    Resolution order:
    1. Exact match in CROP_SYNONYMS (fast path)
    2. Fuzzy match using rapidfuzz (handles typos, partial names, script variations)
    3. Return None if no match found
    """
    raw_clean = raw.strip().lower()
    # Fast path: exact match
    exact = CROP_SYNONYMS.get(raw_clean)
    if exact is not None:
        return exact

    # Fuzzy fallback: find closest match with score >= 80
    try:
        from rapidfuzz import process
        match, score, _ = process.extractOne(raw_clean, CROP_SYNONYMS.keys())
        if score >= 80:
            return CROP_SYNONYMS[match]
    except ImportError:
        pass  # rapidfuzz not installed — skip fuzzy matching

    return None


def standardize(raw_records: List[RawPrice]) -> List[StandardPrice]:
    """Normalize crop names + units; unknown variants are skipped, not guessed."""
    out: List[StandardPrice] = []
    for record in raw_records:
        crop = standardize_crop(record.raw_crop)
        if crop is None:
            continue
        divisor = UNIT_DIVISORS.get(record.raw_unit.strip().lower(), 100.0)
        price_per_kg = round(record.raw_price / divisor, 2)
        min_per_kg = round(record.raw_min_price / divisor, 2) if record.raw_min_price is not None else None
        max_per_kg = round(record.raw_max_price / divisor, 2) if record.raw_max_price is not None else None
        fqp_per_kg = round(record.raw_fqp_price / divisor, 2) if record.raw_fqp_price is not None else None
        out.append(
            StandardPrice(
                crop_name=crop,
                mandi_name=record.mandi,
                city=record.city,
                price_per_kg=price_per_kg,
                min_price_per_kg=min_per_kg,
                max_price_per_kg=max_per_kg,
                fqp_price_per_kg=fqp_per_kg,
                recorded_date=record.recorded_date or date.today(),
                source=record.source,
            )
        )
    return out
