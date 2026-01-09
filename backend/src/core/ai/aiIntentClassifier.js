/**
 * AI Intent Classifier Interface (Gemini)
 * 
 * This module implements the AI intent classification interface using Google Gemini.
 * It checks environment configuration before making any API calls.
 * AI is disabled by default and only enabled via environment variables.
 */

// Read environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AI_INTENT_ENABLED = process.env.AI_INTENT_ENABLED;

async function classifyIntent(item, contextWindow, conversationContext = []) {
  // Check if AI is enabled via runtime config first, then environment variable
  const runtimeAIEnabled = process.env.AI_INTENT_ENABLED === "true";
  if (!runtimeAIEnabled) {
    return {
      ok: false,
      error: "disabled",
      fallbackIntent: "EXPLANATION"
    };
  }
  
  // Check if API key is available
  if (!GEMINI_API_KEY) {
    return {
      ok: false,
      error: "missing_api_key",
      fallbackIntent: "EXPLANATION"
    };
  }
  
  // Prepare the prompt for Gemini
  const forbiddenItem = typeof item === 'object' ? item.pattern || '' : item || '';
  const contextText = Array.isArray(conversationContext) && conversationContext.length > 0 
    ? conversationContext.join('\n---\n')
    : contextWindow;
  
  const prompt = `
Classify the intent of the forbidden item in the provided text.

Forbidden item: "${forbiddenItem}"

Conversation context:\n${contextText}

Respond with ONLY valid JSON in this format:
{
 "intent": "EXPLANATION" | "SUGGESTION" | "INSTRUCTION",
 "confidence": number
}

Rules:
- No explanations
- No extra text
- No markdown
- If uncertain, choose EXPLANATION with confidence 0.5
  `;
  
  // Construct the API request
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.1,  // Low temperature for more consistent responses
      maxOutputTokens: 200,
      responseMimeType: "text/plain"  // We'll parse the JSON ourselves
    }
  };
  
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API call timed out')), 3000); // 3 second timeout
    });
    
    // Make the API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await Promise.race([
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }),
      timeoutPromise
    ]);
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('[VeriFire] Gemini API error:', response.status, await response.text());
      return {
        ok: false,
        error: `api_error_${response.status}`,
        fallbackIntent: "EXPLANATION"
      };
    }
    
    const data = await response.json();
    
    // Extract the response text from Gemini
    let responseText = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && 
        data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      responseText = data.candidates[0].content.parts[0].text || '';
    }
    
    // Try to parse the JSON response from Gemini
    let parsedResponse;
    try {
      // Clean up the response text to extract JSON if it contains extra content
      const jsonMatch = responseText.match(/\{[^{}]*(?:\{[^{}]*[^{}]*\}[^{}]*)*\}/s);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON object found, try to parse the whole response
        parsedResponse = JSON.parse(responseText.trim());
      }
    } catch (parseError) {
      console.error('[VeriFire] Failed to parse Gemini response:', parseError.message, 'Response:', responseText);
      return {
        ok: false,
        error: "invalid_ai_output",
        fallbackIntent: "EXPLANATION"
      };
    }
    
    // Validate the parsed response
    if (!parsedResponse || typeof parsedResponse !== 'object') {
      console.error('[VeriFire] Invalid Gemini response format:', parsedResponse);
      return {
        ok: false,
        error: "invalid_ai_output",
        fallbackIntent: "EXPLANATION"
      };
    }
    
    const { intent, confidence } = parsedResponse;
    
    // Validate intent enum
    const validIntents = ['EXPLANATION', 'SUGGESTION', 'INSTRUCTION'];
    if (!validIntents.includes(intent)) {
      console.error('[VeriFire] Invalid intent from Gemini:', intent);
      return {
        ok: false,
        error: "invalid_ai_output",
        fallbackIntent: "EXPLANATION"
      };
    }
    
    // Validate confidence is a number
    if (typeof confidence !== 'number' || isNaN(confidence) || confidence < 0 || confidence > 1) {
      console.error('[VeriFire] Invalid confidence from Gemini:', confidence);
      return {
        ok: false,
        error: "invalid_ai_output",
        fallbackIntent: "EXPLANATION"
      };
    }
    
    // Valid response received
    return {
      ok: true,
      intent,
      confidence
    };
    
  } catch (error) {
    if (error.message === 'Gemini API call timed out') {
      console.error('[VeriFire] Gemini API call timed out');
      return {
        ok: false,
        error: "timeout",
        fallbackIntent: "EXPLANATION"
      };
    }
    
    console.error('[VeriFire] Error calling Gemini API:', error);
    return {
      ok: false,
      error: "api_error",
      fallbackIntent: "EXPLANATION"
    };
  }
}

module.exports = {
  classifyIntent
};