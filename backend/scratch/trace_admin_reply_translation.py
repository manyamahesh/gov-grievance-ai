import sys
import os
import asyncio
import logging

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("translation_trace")

from app.config import ANTHROPIC_API_KEY
from app.services.llm_service import translate_text_async

async def trace_translation():
    text = "We are looking into the issue and will be resolved in an hour."
    target_lang = "Kannada"

    logger.info("=== TRANSLATION TRACE START ===")
    logger.info(f"ANTHROPIC_API_KEY configured: {bool(ANTHROPIC_API_KEY and ANTHROPIC_API_KEY != 'your_anthropic_api_key_here')}")
    logger.info(f"INPUT TEXT: {repr(text)}")
    logger.info(f"TARGET LANGUAGE: {target_lang}")

    result = await translate_text_async(text, target_language=target_lang, source_language="English")

    logger.info(f"RAW OUTPUT RETURNED: {repr(result)}")
    logger.info(f"WAS TRANSLATED SUCCESSFULLY (differs from input): {result != text}")
    logger.info("=== TRANSLATION TRACE END ===")

if __name__ == "__main__":
    asyncio.run(trace_translation())
