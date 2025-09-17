/**
 * Cloudflare Pages Function for a secure API gateway.
 * This function acts as a proxy to the Google Gemini API.
 * It now handles personalized analysis requests for specific coins.
 * It reads the API key from a secure environment variable.
 */

export async function onRequestPost(context) {
  // 1. Get the client's request body, which now includes language and a list of coins.
  const { lang, coins } = await context.request.json();

  // Validate if the coin list is provided and is an array.
  if (!coins || !Array.isArray(coins) || coins.length === 0) {
    return new Response(JSON.stringify({ error: 'Coin list is required for analysis.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Get the Gemini API Key securely from the environment variables.
  const geminiApiKey = context.env.GEMINI_API_KEY;

  // 3. If the API key is not set on the server, return an error.
  if (!geminiApiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on the server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. Construct a detailed, structured prompt for the AI.
  const coinListString = coins.join(', ');

  const prompt_ko = `당신은 'Oracoin' 서비스의 수석 금융 분석 AI입니다. 사용자가 선택한 다음 암호화폐에 대한 개인화된 뉴스레터 분석을 생성해야 합니다: ${coinListString}. 각 코인에 대해, 반드시 제공된 JSON 스키마 구조에 따라 응답을 생성해주세요. 분석 내용은 최신 뉴스와 시장 데이터를 기반으로 해야 하며, 구체적이고 데이터 중심적이어야 합니다. 일반적인 내용은 피해주세요. 'recommendation'은 '매수 고려', '중립/관망', '매도/주의' 중 하나여야 합니다. 'priceTarget'은 단기적인 관점에서 현실적인 목표 가격 또는 범위를 제시해야 합니다. 모든 분석의 'opinion' 필드 끝에는 "면책 조항: 본 분석은 정보 제공 목적으로만 제공되며, 투자 조언이 아닙니다. 모든 투자 결정에 대한 책임은 본인에게 있습니다." 라는 문구를 반드시 포함시켜 주세요.`;
  const prompt_en = `You are a senior financial analyst AI for a service called 'Oracoin'. You must generate a personalized newsletter analysis for the following cryptocurrencies selected by the user: ${coinListString}. For each coin, you MUST generate a response following the provided JSON schema. Your analysis must be based on the latest news and market data, be specific, and data-driven. Avoid generic statements. The 'recommendation' must be one of: 'Consider Buying', 'Neutral/Watch', or 'Sell/Caution'. The 'priceTarget' should provide a realistic short-term target price or range. At the end of the 'opinion' field for every analysis, you MUST include the disclaimer: "Disclaimer: This analysis is for informational purposes only and does not constitute financial advice. You are solely responsible for your own investment decisions."`;
  
  const prompt = lang === 'ko' ? prompt_ko : prompt_en;

  // Define the structured JSON schema for the AI's response.
  const responseSchema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        "coinName": { "type": "STRING", "description": "암호화폐의 이름 (예: Bitcoin)" },
        "analysis": {
          type: "OBJECT",
          properties: {
            "opinion": { "type": "STRING", "description": "뉴스 및 시장 데이터에 기반한 전문가 의견 및 면책 조항." },
            "recommendation": { "type": "STRING", "description": "'매수 고려', '중립/관망', '매도/주의' 중 하나." },
            "priceTarget": { "type": "STRING", "description": "단기 목표 가격 또는 가격 범위." }
          }
        },
        "relatedNews": {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              "title": { "type": "STRING", "description": "관련 뉴스 기사의 제목" },
              "url": { "type": "STRING", "description": "뉴스 원문 링크" }
            }
          }
        }
      },
      required: ["coinName", "analysis", "relatedNews"]
    }
  };

  // 5. Create the payload for the Gemini API call.
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ "google_search": {} }], // Use Google Search for real-time news and data.
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema
    }
  };

  // 6. Forward the request to the Gemini API and return the response.
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

  try {
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error(`Gemini API Error: ${errorBody}`);
      return new Response(JSON.stringify({ error: 'Failed to fetch from Gemini API.' }), {
        status: geminiResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiResponse.json();
    return new Response(JSON.stringify(geminiData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in API gateway:', error);
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

