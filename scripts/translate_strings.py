#!/usr/bin/env python3
"""
translate_strings.py — Azure Translator batch script for Kissan Rehnuma.

Reads the English source strings from src/i18n/en.json and generates
Urdu (ur.json) and Sindhi (sd.json) translation files using the
Azure Cognitive Services Translator API.

IMPORTANT:
- Google Translate does NOT support Sindhi. Azure Translator does (code: "sd").
- This script preserves i18next interpolation placeholders like {{name}}.
- Keys with value "_SKIP_" are kept as-is (brand names, etc.).

Usage:
    export AZURE_TRANSLATOR_KEY="your-key-here"
    export AZURE_TRANSLATOR_REGION="eastus"   # or your region
    python scripts/translate_strings.py

Or with .env file in the project root:
    AZURE_TRANSLATOR_KEY=xxx
    AZURE_TRANSLATOR_REGION=eastus
"""

import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package not installed. Run: pip install requests")
    sys.exit(1)

# ─── Configuration ──────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
I18N_DIR = PROJECT_ROOT / "mobile-web-app" / "src" / "i18n"
EN_FILE = I18N_DIR / "en.json"

# Target languages (Azure Translator language codes)
TARGET_LANGUAGES = {
    "ur": "ur",       # Urdu
    "sd": "sd",       # Sindhi (Azure supports this, Google does NOT)
}

# Azure API endpoint
TRANSLATE_URL = "https://api.cognitive.microsofttranslator.com/translate"
API_VERSION = "3.0"

# Keys that should NOT be translated (brand names, proper nouns)
SKIP_KEYS = {
    "common.appName",
    "splash.appName",
    "splash.appNameUrdu",
    "voiceCall.agentName",
}

# Rate limiting: Azure free tier allows 2M chars/month, ~50 chars/req max
BATCH_SIZE = 15  # number of texts per API call
REQUEST_DELAY = 0.5  # seconds between batches


# ─── Helpers ────────────────────────────────────────────────────────────────

def flatten_json(data: dict, prefix: str = "") -> list[tuple[str, str]]:
    """Flatten a nested JSON dict into a list of (dotted_key, value) pairs."""
    items = []
    for key, value in data.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            items.extend(flatten_json(value, full_key))
        elif isinstance(value, str):
            items.append((full_key, value))
    return items


def unflatten_json(flat: list[tuple[str, str]]) -> dict:
    """Rebuild nested dict from a list of (dotted_key, value) pairs."""
    result: dict = {}
    for key, value in flat:
        parts = key.split(".")
        current = result
        for part in parts[:-1]:
            current = current.setdefault(part, {})
        current[parts[-1]] = value
    return result


def translate_batch(
    texts: list[str],
    target_lang: str,
    api_key: str,
    region: str,
) -> list[str]:
    """
    Translate a batch of texts using Azure Translator API.

    Preserves i18next interpolation tokens like {{name}} by replacing them
    with a placeholder before translation and restoring them after.
    """
    import re

    # Protect interpolation tokens: {{name}} → __I18N_NAME__
    placeholder_map = {}
    processed_texts = []
    for text in texts:
        counter = [0]
        def replace_token(match):
            token = match.group(0)
            placeholder = f"__I18N{counter[0]}__"
            placeholder_map.setdefault(text, {})[placeholder] = token
            counter[0] += 1
            return placeholder
        processed = re.sub(r'\{\{[^}]+\}\}', replace_token, text)
        processed_texts.append(processed)

    headers = {
        "Ocp-Apim-Subscription-Key": api_key,
        "Ocp-Apim-Subscription-Region": region,
        "Content-Type": "application/json",
    }
    params = {
        "api-version": API_VERSION,
        "to": target_lang,
    }
    body = [{"text": t} for t in processed_texts]

    response = requests.post(
        TRANSLATE_URL,
        headers=headers,
        params=params,
        json=body,
        timeout=30,
    )

    if response.status_code != 200:
        print(f"  API Error {response.status_code}: {response.text}")
        raise RuntimeError(f"Translation API failed with status {response.status_code}")

    results = response.json()
    translated = [r["translations"][0]["text"] for r in results]

    # Restore interpolation tokens
    final = []
    for i, (trans, original) in enumerate(zip(translated, texts)):
        if original in placeholder_map:
            for placeholder, token in placeholder_map[original].items():
                trans = trans.replace(placeholder, token)
                # Also handle cases where Azure added spaces around placeholders
                trans = trans.replace(placeholder.replace("__", " ").strip(), token)
        final.append(trans)

    return final


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    # Load API key from environment or .env file
    api_key = os.environ.get("AZURE_TRANSLATOR_KEY")
    region = os.environ.get("AZURE_TRANSLATOR_REGION", "eastus")

    if not api_key:
        # Try loading from .env file
        env_file = PROJECT_ROOT / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("AZURE_TRANSLATOR_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                elif line.startswith("AZURE_TRANSLATOR_REGION="):
                    region = line.split("=", 1)[1].strip().strip('"').strip("'")

    if not api_key:
        print("=" * 60)
        print("ERROR: Azure Translator API key not found.")
        print()
        print("Set it as an environment variable:")
        print("  export AZURE_TRANSLATOR_KEY='your-key-here'")
        print()
        print("Or add to the project .env file:")
        print("  AZURE_TRANSLATOR_KEY=your-key-here")
        print()
        print("Get a free key at:")
        print("  https://portal.azure.com/#create/Microsoft.CognitiveServicesTextTranslation")
        print("=" * 60)
        sys.exit(1)

    # Load English source
    if not EN_FILE.exists():
        print(f"ERROR: English source file not found: {EN_FILE}")
        sys.exit(1)

    with open(EN_FILE, "r", encoding="utf-8") as f:
        en_data = json.load(f)

    flat_items = flatten_json(en_data)
    print(f"Loaded {len(flat_items)} strings from en.json")

    for lang_name, lang_code in TARGET_LANGUAGES.items():
        print(f"\n{'='*50}")
        print(f"Translating to {lang_name} ({lang_code})...")
        print(f"{'='*50}")

        # Filter items: skip brand names
        to_translate = []
        for key, value in flat_items:
            if key in SKIP_KEYS:
                to_translate.append((key, value))  # keep as-is
            else:
                to_translate.append((key, value))

        translated_pairs = []
        total_batches = (len(to_translate) + BATCH_SIZE - 1) // BATCH_SIZE

        for batch_idx in range(total_batches):
            start = batch_idx * BATCH_SIZE
            end = min(start + BATCH_SIZE, len(to_translate))
            batch = to_translate[start:end]

            keys = [k for k, _ in batch]
            texts = [v for _, v in batch]

            # Skip keys that are in SKIP_KEYS — just copy original
            translate_mask = [k not in SKIP_KEYS for k in keys]
            texts_to_send = [t for t, do_translate in zip(texts, translate_mask) if do_translate]

            if texts_to_send:
                print(f"  Batch {batch_idx + 1}/{total_batches} ({len(texts_to_send)} strings)...", end=" ")
                try:
                    translated_texts = translate_batch(texts_to_send, lang_code, api_key, region)
                except Exception as e:
                    print(f"FAILED: {e}")
                    print("  Falling back to English for this batch.")
                    translated_texts = texts_to_send

                # Merge translated texts back with skipped ones
                translated_iter = iter(translated_texts)
                for key, original, do_translate in zip(keys, texts, translate_mask):
                    if do_translate:
                        translated_pairs.append((key, next(translated_iter)))
                    else:
                        translated_pairs.append((key, original))

                print("OK")
                time.sleep(REQUEST_DELAY)
            else:
                # All items in this batch are skipped
                for key, original in batch:
                    translated_pairs.append((key, original))

        # Build output JSON
        output_data = unflatten_json(translated_pairs)
        output_file = I18N_DIR / f"{lang_name}.json"

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        print(f"\n  Written {len(translated_pairs)} strings to {output_file.name}")

    print(f"\n{'='*50}")
    print("Translation complete!")
    print(f"  Urdu:   {I18N_DIR / 'ur.json'}")
    print(f"  Sindhi: {I18N_DIR / 'sd.json'}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
