"""
Test script for OpenAI integration.

This script tests:
1. OpenAI API key configuration
2. GPT-3.5-turbo model selection
3. Translation functionality
4. Error handling
"""
import asyncio
import os
from dotenv import load_dotenv
from openai import AsyncOpenAI

# Load environment variables
load_dotenv()

async def test_openai_config():
    """Test OpenAI configuration."""
    print("="*60)
    print("🧪 TESTING OPENAI CONFIGURATION")
    print("="*60)
    print()
    
    # Check API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ OPENAI_API_KEY not found in .env")
        print("   Please add it to backend/.env")
        return False
    
    print(f"✅ API Key found: {api_key[:10]}...{api_key[-4:]}")
    
    # Check model selection
    model = os.getenv("OPENAI_MODEL", "gpt-4")
    print(f"✅ Model configured: {model}")
    
    if model == "gpt-3.5-turbo":
        print("   💰 Using cheaper model (good choice!)")
    elif model == "gpt-4":
        print("   🎯 Using most accurate model")
    
    print()
    return True

async def test_openai_connection():
    """Test connection to OpenAI API."""
    print("="*60)
    print("🔌 TESTING OPENAI CONNECTION")
    print("="*60)
    print()
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ Cannot test without API key")
        return False
    
    try:
        client = AsyncOpenAI(api_key=api_key)
        
        # Simple test request
        print("📡 Sending test request to OpenAI...")
        response = await client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4"),
            messages=[
                {"role": "user", "content": "Say 'Connection successful' in Spanish"}
            ],
            max_tokens=20
        )
        
        result = response.choices[0].message.content
        print(f"✅ Response received: {result}")
        print(f"✅ Model used: {response.model}")
        print(f"✅ Tokens used: {response.usage.total_tokens}")
        print()
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print()
        return False

async def test_translation():
    """Test actual translation."""
    print("="*60)
    print("🌍 TESTING TRANSLATION")
    print("="*60)
    print()
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ Cannot test without API key")
        return False
    
    try:
        client = AsyncOpenAI(api_key=api_key)
        model = os.getenv("OPENAI_MODEL", "gpt-4")
        
        # Test translation
        spanish_text = "Bienvenidos a la conferencia de hoy. Hablaremos sobre inteligencia artificial."
        target_lang = "German"
        
        print(f"📝 Spanish text: {spanish_text}")
        print(f"🎯 Translating to: {target_lang}")
        print(f"🤖 Using model: {model}")
        print()
        
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": f"You are a professional translator. Translate the following Spanish text to {target_lang}. Provide ONLY the translation, no explanations."
                },
                {
                    "role": "user",
                    "content": spanish_text
                }
            ],
            temperature=0.3,
            max_tokens=500
        )
        
        translated = response.choices[0].message.content.strip()
        
        print(f"✅ Translation: {translated}")
        print(f"📊 Tokens used: {response.usage.total_tokens}")
        print(f"💰 Estimated cost: ${response.usage.total_tokens * 0.000002:.6f}")
        print()
        
        return True
        
    except Exception as e:
        print(f"❌ Translation failed: {e}")
        print()
        return False

async def test_multiple_languages():
    """Test translation to multiple languages."""
    print("="*60)
    print("🌐 TESTING MULTIPLE LANGUAGES")
    print("="*60)
    print()
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ Cannot test without API key")
        return False
    
    client = AsyncOpenAI(api_key=api_key)
    model = os.getenv("OPENAI_MODEL", "gpt-4")
    
    spanish_text = "Hola, ¿cómo estás?"
    languages = {
        "de": "German",
        "fr": "French",
        "en": "English",
        "it": "Italian"
    }
    
    print(f"📝 Original: {spanish_text}")
    print(f"🤖 Model: {model}")
    print()
    
    total_tokens = 0
    
    for code, name in languages.items():
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": f"You are a professional translator. Translate the following Spanish text to {name}. Provide ONLY the translation, no explanations."
                    },
                    {
                        "role": "user",
                        "content": spanish_text
                    }
                ],
                temperature=0.3,
                max_tokens=100
            )
            
            translated = response.choices[0].message.content.strip()
            tokens = response.usage.total_tokens
            total_tokens += tokens
            
            print(f"  {code.upper()} ({name:8}): {translated} ({tokens} tokens)")
            
        except Exception as e:
            print(f"  {code.upper()} ({name:8}): ❌ Error: {e}")
    
    print()
    print(f"📊 Total tokens: {total_tokens}")
    print(f"💰 Total cost: ${total_tokens * 0.000002:.6f}")
    print()
    
    return True

async def main():
    """Run all tests."""
    print()
    print("🚀 OPENAI INTEGRATION TEST SUITE")
    print()
    
    # Test 1: Configuration
    config_ok = await test_openai_config()
    if not config_ok:
        print("⚠️  Fix configuration before continuing")
        return
    
    # Test 2: Connection
    connection_ok = await test_openai_connection()
    if not connection_ok:
        print("⚠️  Fix connection before continuing")
        return
    
    # Test 3: Translation
    translation_ok = await test_translation()
    
    # Test 4: Multiple languages
    multi_ok = await test_multiple_languages()
    
    # Summary
    print("="*60)
    print("📋 TEST SUMMARY")
    print("="*60)
    print(f"Configuration:  {'✅ PASS' if config_ok else '❌ FAIL'}")
    print(f"Connection:     {'✅ PASS' if connection_ok else '❌ FAIL'}")
    print(f"Translation:    {'✅ PASS' if translation_ok else '❌ FAIL'}")
    print(f"Multi-language: {'✅ PASS' if multi_ok else '❌ FAIL'}")
    print()
    
    if all([config_ok, connection_ok, translation_ok, multi_ok]):
        print("🎉 ALL TESTS PASSED!")
        print()
        print("✅ Your OpenAI integration is working correctly")
        print("✅ Ready to use live translation")
        print()
        print("Next steps:")
        print("1. Restart the backend to load the new configuration")
        print("2. Open http://localhost:3000/broadcaster")
        print("3. Start broadcasting and test live translation")
    else:
        print("⚠️  SOME TESTS FAILED")
        print()
        print("Please fix the issues above before using live translation")
    
    print()

if __name__ == "__main__":
    asyncio.run(main())
