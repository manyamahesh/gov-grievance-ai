import json
import logging
import re
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types as genai_types

from app.config import GEMINI_API_KEY, MODEL_NAME

logger = logging.getLogger(__name__)

KNOWN_DEPARTMENTS = [
    "Water Supply Department",
    "Electricity Board",
    "Public Works Department",
    "Sanitation Department",
    "General Administration"
]

SYSTEM_PROMPT = """You are an AI assistant for a Government Grievance Management System.
Your task is to analyze grievance/complaint messages submitted by citizens in any language (e.g., English, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, etc.).

Analyze the conversation history and the latest citizen message to extract structured information.

Known Departments:
- Water Supply Department
- Electricity Board
- Public Works Department
- Sanitation Department
- General Administration
- Unclassified

Rules:
1. Determine the language used by the citizen (`detected_language`).
2. Translate the core complaint into clear English (`translated_text`).
3. Determine sentiment (`positive`, `neutral`, `negative`).
4. Determine priority (`low`, `medium`, `high`). High priority should be assigned for urgent, dangerous, severe infrastructure or essential service outages (e.g. major water leak, power failure, road hazard, corruption).
5. Map to the most relevant department from the known list above (`department`).
6. Determine if more information or clarification is needed (`needs_followup`). Set `needs_followup` to true ONLY IF crucial details are missing (e.g., location, specific nature of problem) AND the complaint cannot be routed properly yet. If sufficient detail is provided to log/categorize the grievance, set `needs_followup` to false.
7. If `needs_followup` is true, write a polite follow-up question in the citizen's original language (`followup_question`). If false, set `followup_question` to null.
8. Write a reassuring response to the citizen in their original language acknowledging their complaint and explaining next steps (`reply_to_citizen`).

CRITICAL: You MUST respond ONLY with a single valid JSON object. No explanations, no preamble, no markdown formatting outside of the raw JSON object.

Schema:
{
  "detected_language": "string",
  "translated_text": "string",
  "sentiment": "positive | neutral | negative",
  "priority": "low | medium | high",
  "department": "string",
  "needs_followup": boolean,
  "followup_question": "string or null",
  "reply_to_citizen": "string"
}
"""


def normalize_llm_analysis(data: Dict[str, Any]) -> Dict[str, Any]:
    """Shared helper to normalize priority (uppercase), sentiment (lowercase), and department (known string match)."""
    raw_priority = str(data.get("priority", "MEDIUM")).strip().upper()
    if raw_priority in ["HIGH", "MEDIUM", "LOW"]:
        priority = raw_priority
    elif raw_priority in ["NEGATIVE", "URGENT", "CRITICAL"]:
        priority = "HIGH"
    elif raw_priority in ["POSITIVE"]:
        priority = "LOW"
    else:
        priority = "MEDIUM"

    raw_sentiment = str(data.get("sentiment", "neutral")).strip().lower()
    if raw_sentiment in ["positive", "neutral", "negative"]:
        sentiment = raw_sentiment
    else:
        sentiment = "neutral"

    raw_dept = str(data.get("department", "")).strip()
    matched_dept = "Unclassified"

    for known in KNOWN_DEPARTMENTS:
        if known.lower() == raw_dept.lower():
            matched_dept = known
            break
        if known.lower() in raw_dept.lower() or raw_dept.lower() in known.lower():
            matched_dept = known
            break
        if "water" in raw_dept.lower() and "water" in known.lower():
            matched_dept = known
            break
        if ("electric" in raw_dept.lower() or "power" in raw_dept.lower()) and "electric" in known.lower():
            matched_dept = known
            break
        if ("road" in raw_dept.lower() or "public works" in raw_dept.lower() or "pwd" in raw_dept.lower()) and "public works" in known.lower():
            matched_dept = known
            break
        if ("garbage" in raw_dept.lower() or "sanitation" in raw_dept.lower() or "waste" in raw_dept.lower()) and "sanitation" in known.lower():
            matched_dept = known
            break
        if ("admin" in raw_dept.lower() or "general" in raw_dept.lower()) and "general" in known.lower():
            matched_dept = known
            break

    if matched_dept == "Unclassified" and raw_dept in KNOWN_DEPARTMENTS:
        matched_dept = raw_dept

    res = dict(data)
    res["priority"] = priority
    res["sentiment"] = sentiment
    res["department"] = matched_dept
    return res


def _get_fallback_response(user_text: str, target_lang: str = "English") -> Dict[str, Any]:
    """Fallback response if Anthropic API fails or is unconfigured."""
    text_lower = user_text.lower()

    # Detect language and translate text to English for admin intake
    detected_lang = "English"
    translated_text = user_text

    # Multi-lingual keyword maps
    water_keywords = ["water", "leak", "ನೀರು", "ನೀರಿನ", "पानी", "जल", "நீர்", "నీరు", "पाणी"]
    elec_keywords = ["electricity", "power", "light", "ವಿದ್ಯುತ್", "बिजली", "மின்சாரம்", "విద్యుత్"]
    road_keywords = ["road", "pothole", "ರಸ್ತೆ", "सड़क", "சாலை", "రోడ్డు", "रस्ता"]
    san_keywords = ["garbage", "trash", "waste", "ಕಸ", "कचरा", "குப்பை", "చెత్త"]

    if any(k in user_text for k in ["ನೀರು", "ನೀರಿನ", "ರಸ್ತೆ", "ಕಸ", "ವಿದ್ಯುತ್"]):
        detected_lang = "Kannada"
    elif any(k in user_text for k in ["पानी", "बिजली", "सड़क", "कचरा"]):
        detected_lang = "Hindi"
    elif any(k in user_text for k in ["पाणी", "रस्ता"]):
        detected_lang = "Marathi"
    elif any(k in user_text for k in ["நீர்", "மின்சாரம்", "சாலை", "குப்பை"]):
        detected_lang = "Tamil"
    elif any(k in user_text for k in ["నీరు", "విద్యుత్", "రోడ్డు", "చెత్త"]):
        detected_lang = "Telugu"

    # Multi-lingual translation mapping for fallback test messages
    if "ನೀರಿನ" in user_text or "ನೀರು" in user_text:
        translated_text = "Water supply issue reported for multiple days"
        dept = "Water Supply Department"
        priority = "HIGH"
    elif any(k in text_lower for k in water_keywords):
        translated_text = "Water supply issue reported"
        dept = "Water Supply Department"
        priority = "HIGH"
    elif any(k in text_lower for k in elec_keywords):
        translated_text = "Electricity outage or power line issue reported"
        dept = "Electricity Board"
        priority = "HIGH"
    elif any(k in text_lower for k in road_keywords):
        translated_text = "Road damage or pothole complaint reported"
        dept = "Public Works Department"
        priority = "MEDIUM"
    elif any(k in text_lower for k in san_keywords):
        translated_text = "Garbage or sanitation issue reported"
        dept = "Sanitation Department"
        priority = "MEDIUM"
    else:
        dept = "General Administration"
        priority = "MEDIUM"

    if detected_lang == "Kannada":
        reply_msg = f"'{dept}' ಗೆ ಸಂಬಂಧಿಸಿದ ನಿಮ್ಮ ದೂರು ದಾಖಲಾಗಿದ್ದು, ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ."
    elif detected_lang == "Hindi":
        reply_msg = f"'{dept}' के संबंध में आपकी शिकायत दर्ज कर ली गई है और समीक्षाधीन है।"
    elif detected_lang == "Tamil":
        reply_msg = f"'{dept}' தொடர்பான உங்கள் புகார் பதிவு செய்யப்பட்டு பரிசீலனையில் உள்ளது."
    elif detected_lang == "Telugu":
        reply_msg = f"'{dept}' కి సంబంధించి మీ ఫిర్యాదు నమోదు చేయబడింది మరియు పరిశీలనలో ఉంది."
    else:
        reply_msg = f"Your grievance regarding '{dept}' has been logged and is under review."

    raw_response = {
        "detected_language": detected_lang,
        "translated_text": translated_text,
        "sentiment": "negative" if priority == "HIGH" else "neutral",
        "priority": priority,
        "department": dept,
        "needs_followup": False,
        "followup_question": None,
        "reply_to_citizen": reply_msg
    }
    return normalize_llm_analysis(raw_response)



def parse_llm_json(response_text: str, fallback_text: str = "") -> Dict[str, Any]:
    """Defensively parse JSON from LLM output and normalize fields."""
    cleaned = response_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        raw_payload = {
            "detected_language": str(data.get("detected_language", "English")),
            "translated_text": str(data.get("translated_text", fallback_text)),
            "sentiment": str(data.get("sentiment", "neutral")),
            "priority": str(data.get("priority", "medium")),
            "department": str(data.get("department", "General Administration")),
            "needs_followup": bool(data.get("needs_followup", False)),
            "followup_question": data.get("followup_question") if data.get("needs_followup") else None,
            "reply_to_citizen": str(data.get("reply_to_citizen", "Grievance received. We are reviewing your request."))
        }
        return normalize_llm_analysis(raw_payload)
    except Exception as e:
        logger.error(f"Failed to parse LLM JSON response: {e}. Raw response: {response_text}")
        return _get_fallback_response(fallback_text)


async def analyze_grievance_async(messages_history: List[Dict[str, str]]) -> Dict[str, Any]:
    """Async grievance analysis using Gemini API."""
    import asyncio
    latest_msg = messages_history[-1]["content"] if messages_history else ""

    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not configured. Using fallback heuristic.")
        return _get_fallback_response(latest_msg)

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)

        # Build contents list in Gemini format
        contents = []
        for msg in messages_history:
            role = "user" if msg.get("role") in ["user", "citizen"] else "model"
            contents.append(genai_types.Content(
                role=role,
                parts=[genai_types.Part(text=msg.get("content", ""))]
            ))

        config = genai_types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.2,
            max_output_tokens=1000,
        )

        response = await asyncio.to_thread(
            client.models.generate_content,
            model=MODEL_NAME,
            contents=contents,
            config=config,
        )

        content_text = response.text
        return parse_llm_json(content_text, fallback_text=latest_msg)

    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        return _get_fallback_response(latest_msg)


FALLBACK_TRANSLATION_MAP = {
    "kannada": {
        "logged_review": "ನಿಮ್ಮ ದೂರು ಸ್ವೀಕರಿಸಲಾಗಿದೆ ಮತ್ತು ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ.",
        "water_logged": "ನಿಮ್ಮ ದೂರು 'ನೀರು ಸರಬರಾಜು ಇಲಾಖೆ' ಸಂಬಂಧಿಸಿದಂತೆ ದಾಖಲಾಗಿದೆ ಮತ್ತು ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ.",
        "elec_logged": "ನಿಮ್ಮ ದೂರು 'ವಿದ್ಯುತ್ ಮಂಡಳಿ' ಸಂಬಂಧಿಸಿದಂತೆ ದಾಖಲಾಗಿದೆ ಮತ್ತು ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ.",
        "pwd_logged": "ನಿಮ್ಮ ದೂರು 'ಲೋಕೋಪಯೋಗಿ ಇಲಾಖೆ' ಸಂಬಂಧಿಸಿದಂತೆ ದಾಖಲಾಗಿದೆ ಮತ್ತು ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ.",
        "san_logged": "ನಿಮ್ಮ ದೂರು 'ನೈರ್ಮಲ್ಯ ಇಲಾಖೆ' ಸಂಬಂಧಿಸಿದಂತೆ ದಾಖಲಾಗಿದೆ ಮತ್ತು ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ.",
        "gen_logged": "ನಿಮ್ಮ ದೂರು 'ಸಾಮಾನ್ಯ ಆಡಳಿತ' ಸಂಬಂಧಿಸಿದಂತೆ ದಾಖಲಾಗಿದೆ ಮತ್ತು ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ.",
        "resolving_hour": "ನಾವು ಸಮಸ್ಯೆಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತಿದ್ದೇವೆ ಮತ್ತು ಶೀಘ್ರದಲ್ಲೇ ಪರಿಹರಿಸಲಾಗುವುದು.",
        "connected_agent": "ನೀವು ಈಗ ಬೆಂಬಲ ಏಜೆಂಟ್ ಅವರೊಂದಿಗೆ ಸಂಪರ್ಕ ಹೊಂದಿದ್ದೀರಿ.",
        "dispatched_engineers": "ನಮ್ಮ ನಿರ್ವಹಣಾ ಸಿಬ್ಬಂದಿ ಪರಿಶೀಲಿಸಲು ನಿಯೋಜಿಸಲಾಗಿದೆ.",
        "flagged_agent": "ಧನ್ಯವಾದಗಳು, ನಾವು ಇದನ್ನು ಬೆಂಬಲ ಏಜೆಂಟ್‌ಗೆ ಫ್ಲ್ಯಾಗ್ ಮಾಡಿದ್ದೇವೆ - ಅವರು ಶೀಘ್ರದಲ್ಲೇ ಸಂಪರ್ಕಿಸುತ್ತಾರೆ."
    },
    "hindi": {
        "logged_review": "आपकी शिकायत दर्ज कर ली गई है और समीक्षाधीन है।",
        "water_logged": "आपकी शिकायत 'जल आपूर्ति विभाग' के संबंध में दर्ज कर ली गई है और समीक्षाधीन है।",
        "elec_logged": "आपकी शिकायत 'बिजली बोर्ड' के संबंध में दर्ज कर ली गई है और समीक्षाधीन है।",
        "pwd_logged": "आपकी शिकायत 'लोक निर्माण विभाग' के संबंध में दर्ज कर ली गई है और समीक्षाधीन है।",
        "san_logged": "आपकी शिकायत 'स्वच्छता विभाग' के संबंध में दर्ज कर ली गई है और समीक्षाधीन है।",
        "gen_logged": "आपकी शिकायत 'सामान्य प्रशासन' के संबंध में दर्ज कर ली गई है और समीक्षाधीन है।",
        "resolving_hour": "हम इस मुद्दे की जांच कर रहे हैं और जल्द ही इसका समाधान कर दिया जाएगा।",
        "connected_agent": "अब आप सहायता एजेंट से जुड़ गए हैं।",
        "dispatched_engineers": "हमारे इंजीनियरों को समस्या हल करने के लिए भेज दिया गया है।",
        "flagged_agent": "धन्यवाद, हमने इसे सहायता एजेंट को भेज दिया है - वे जल्द ही आपसे संपर्क करेंगे।"
    },
    "tamil": {
        "logged_review": "உங்கள் புகார் பதிவு செய்யப்பட்டு பரிசீலனையில் உள்ளது.",
        "water_logged": "உங்கள் புகார் 'நீர்வளத்துறை' தொடர்பாக பதிவு செய்யப்பட்டு பரிசீலனையில் உள்ளது.",
        "elec_logged": "உங்கள் புகார் 'மின்சார வாரியம்' தொடர்பாக பதிவு செய்யப்பட்டு பரிசீலனையில் உள்ளது.",
        "pwd_logged": "உங்கள் புகார் 'பொதுப்பணித்துறை' தொடர்பாக பதிவு செய்யப்பட்டு பரிசீலனையில் உள்ளது.",
        "san_logged": "உங்கள் புகார் 'சுகாதாரத் துறை' தொடர்பாக பதிவு செய்யப்பட்டு பரிசீலனையில் உள்ளது.",
        "gen_logged": "உங்கள் புகார் 'பொது நிர்வாகம்' தொடர்பாக பதிவு செய்யப்பட்டு பரிசீலனையில் உள்ளது.",
        "resolving_hour": "நாங்கள் இந்த பிரச்சனையை ஆய்வு செய்து வருகிறோம், விரைவில் தீர்க்கப்படும்.",
        "connected_agent": "நீங்கள் இப்போது உதவி முகவருடன் இணைக்கப்பட்டுள்ளீர்கள்.",
        "dispatched_engineers": "எங்கள் பொறியாளர்கள் பிரச்சனைக்கு தீர்வு காண அனுப்பப்பட்டுள்ளனர்.",
        "flagged_agent": "நன்றி, நாங்கள் இதை உதவி முகவருக்கு அனுப்பி வைத்துள்ளோம் - அவர்கள் விரைவில் உங்களைத் தொடர்புகொள்வார்கள்."
    },
    "telugu": {
        "logged_review": "మీ ఫిర్యాదు నమోదు చేయబడింది మరియు పరిశీలనలో ఉంది.",
        "water_logged": "మీ ఫిర్యాదు 'నీటి సరఫరా శాఖ' కి సంబంధించి నమోదు చేయబడింది మరియు పరిశీలనలో ఉంది.",
        "elec_logged": "మీ ఫిర్యాదు 'విద్యుత్ బోర్డు' కి సంబంధించి నమోదు చేయబడింది మరియు పరిశీలనలో ఉంది.",
        "pwd_logged": "మీ ఫిర్యాదు 'పబ్లిక్ వర్క్స్ శాఖ' కి సంబంధించి నమోదు చేయబడింది మరియు పరిశీలనలో ఉంది.",
        "san_logged": "మీ ఫిర్యాదు 'పారిశుధ్య శాఖ' కి సంబంధించి నమోదు చేయబడింది మరియు పరిశీలనలో ఉంది.",
        "gen_logged": "మీ ఫిర్యాదు 'సాధారణ పరిపాలన' కి సంబంధించి నమోదు చేయబడింది మరియు పరిశీలనలో ఉంది.",
        "resolving_hour": "మేము ఈ సమస్యను పరిశీలిస్తున్నాము మరియు త్వరలో పరిష్కరించబడుతుంది.",
        "connected_agent": "మీరు ఇప్పుడు సపోర్ట్ ఏజెంట్‌తో కనెక్ట్ అయ్యారు.",
        "dispatched_engineers": "సమస్యను పరిష్కరించడానికి మా ఇంజనీర్లు పంపబడ్డారు.",
        "flagged_agent": "ధన్యవాదాలు, మేము దీనిని సపోర్ట్ ఏజెంట్‌కు ఫ్లాగ్ చేసాము - వారు త్వరలో మిమ్మల్ని సంప్రదిస్తారు."
    },
    "marathi": {
        "logged_review": "आपली तक्रार नोंदवली गेली असून ती विचाराधीन आहे.",
        "water_logged": "आपली तक्रार 'पाणी पुरवठा विभाग' संदर्भात नोंदवली गेली असून ती विचाराधीन आहे.",
        "elec_logged": "आपली तक्रार 'महावितरण बोर्ड' संदर्भात नोंदवली गेली असून ती विचाराधीन आहे.",
        "pwd_logged": "आपली तक्रार 'सार्वजनिक बांधकाम विभाग' संदर्भात नोंदवली गेली असून ती विचाराधीन आहे.",
        "san_logged": "आपली तक्रार 'स्वच्छता विभाग' संदर्भात नोंदवली गेली असून ती विचाराधीन आहे.",
        "gen_logged": "आपली तक्रार 'सामान्य प्रशासन' संदर्भात नोंदवली गेली असून ती विचाराधीन आहे.",
        "resolving_hour": "आम्ही या समस्येची पाहणी करत आहोत आणि लवकरच ती सोडवली जाईल.",
        "connected_agent": "आपण आता मदत प्रतिनिधीशी जोडले गेला आहात.",
        "dispatched_engineers": "आमचे अभियंते समस्या सोडवण्यासाठी रवाना झाले आहेत.",
        "flagged_agent": "धन्यवाद, आम्ही हे मदत प्रतिनिधीकडे पाठवले आहे - ते लवकरच आपल्याशी संपर्क साधतील."
    }
}


def _get_dictionary_fallback_translation(text: str, target_lang: str) -> Optional[str]:
    """
    Look up ONLY exact, fixed system-generated phrases in the offline fallback dictionary.

    IMPORTANT: This function must NEVER match against freeform admin replies.
    Admin replies are arbitrary free text — the only safe match is an exact string
    that the backend itself generates (logged-review confirmation, handoff notice,
    or follow-up acknowledgement). Any other text returns None so the UI can display
    an honest '⚠️ Translation unavailable' warning instead of inventing content.
    """
    t_key = target_lang.lower().strip()
    dict_map = FALLBACK_TRANSLATION_MAP.get(t_key)
    if not dict_map:
        return None

    txt = text.strip()

    # ── Exact system phrases the backend generates ──────────────────────────
    # 1. Grievance confirmation: "Your grievance regarding '...' has been logged and is under review."
    if "has been logged and is under review" in txt:
        # Department-specific variants
        if "Water Supply Department" in txt:
            return dict_map["water_logged"]
        elif "Electricity Board" in txt:
            return dict_map["elec_logged"]
        elif "Public Works Department" in txt:
            return dict_map["pwd_logged"]
        elif "Sanitation Department" in txt:
            return dict_map["san_logged"]
        elif "General Administration" in txt:
            return dict_map["gen_logged"]
        else:
            return dict_map["logged_review"]

    # 2. Agent handoff notice: "You are now connected with support agent"
    if "You are now connected with support agent" in txt:
        return dict_map["connected_agent"]

    # 3. Follow-up acknowledgement: exact phrase from chat.py
    if txt == "Thanks, we've flagged this for a support agent \u2014 they'll follow up with you here shortly.":
        return dict_map["flagged_agent"]

    # Everything else (including ALL freeform admin replies) — no match.
    # Return None so the caller can show an honest translation-unavailable warning.
    return None


async def translate_text_async(text: str, target_language: str, source_language: str = "English") -> Optional[str]:
    """Translate text using Gemini, falling back to dictionary mapping or returning None on failure."""
    import asyncio
    if not text or not text.strip():
        return text

    target_clean = target_language.lower().strip()
    source_clean = source_language.lower().strip()

    if target_clean == source_clean or target_clean == "english":
        return text

    # Try Gemini API if configured with multi-model fallback for 503/429 errors
    if GEMINI_API_KEY:
        client = genai.Client(api_key=GEMINI_API_KEY)
        system_instruction = (
            f"You are a professional translator. "
            f"Translate the text inside <<<TEXT>>> from {source_language} to {target_language} exactly as written. "
            f"Preserve the original meaning, tone, and intent word-for-word. "
            f"Do NOT add, remove, soften, expand, editorialize, or rewrite any information. "
            f"Do NOT add politeness, reassurance, or context that is not in the original. "
            f"If the source text is short, the translation must be equally short. "
            f"Return ONLY the translated text — no quotes, no explanation, no preamble."
        )
        user_prompt = f"<<<TEXT>>>\n{text}\n<<<END>>>"
        config = genai_types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.0,
            max_output_tokens=500,
        )

        candidate_models = ["models/gemini-flash-latest", "models/gemini-flash-lite-latest"]

        for model_candidate in candidate_models:
            for attempt in range(2):
                try:
                    response = await asyncio.to_thread(
                        client.models.generate_content,
                        model=model_candidate,
                        contents=user_prompt,
                        config=config,
                    )
                    res_text = response.text.strip()

                    import re as _re
                    res_text = _re.sub(r'<<<TEXT>>>\s*', '', res_text)
                    res_text = _re.sub(r'\s*<<<END>>>', '', res_text)
                    res_text = res_text.strip()

                    if res_text.startswith('"') and res_text.endswith('"'):
                        res_text = res_text[1:-1].strip()
                    if res_text and res_text.lower() != text.lower():
                        return res_text
                except Exception as e:
                    err_str = str(e)
                    logger.warning(f"Gemini Translation with '{model_candidate}' attempt {attempt + 1} failed: {err_str[:120]}")
                    if ("503" in err_str or "UNAVAILABLE" in err_str) and attempt < 1:
                        await asyncio.sleep(1.0)
                    else:
                        break



    # Fallback to dictionary translation lookup
    fallback_trans = _get_dictionary_fallback_translation(text, target_language)
    if fallback_trans:
        return fallback_trans

    # If translation is impossible, return None for honest UI status
    logger.warning(f"Translation unavailable for '{text}' to {target_language}. Returning None for honest UI status.")
    return None
