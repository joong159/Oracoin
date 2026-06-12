export async function onRequestPost(context) {
  try {
    const geminiApiKey = context.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ 
        error: "GEMINI_API_KEY is not configured on Cloudflare Pages. Please set it in Settings -> Environment variables." 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const requestBody = await context.request.json();
    const { lang, coins, userContext } = requestBody;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert crypto analyst AI. Analyze the following coins: ${coins.join(', ')}.
            Language: ${lang === 'ko' ? 'Korean' : 'English'}.
            User Context:
            - Watchlist: ${userContext.watchlist.join(', ')}
            - Favorites: ${userContext.favorites.join(', ')}
            - Initial Capital: ${userContext.backtestCapital}
            - Custom Trading Strategy: Buy Rules (${JSON.stringify(userContext.customStrategy.buyRules)}), Sell Rules (${JSON.stringify(userContext.customStrategy.sellRules)})

            Please evaluate each coin based on its current market context, user watchlist, and custom rules.
            Return your response strictly as a raw JSON array matching this format (no markdown code blocks, just raw JSON text without \`\`\`json wrappers):
            [
              {
                "coinName": "Coin Name",
                "analysis": {
                  "recommendation": "투자 판단 (e.g. 매수 고려 / 주의 필요 / 관망)",
                  "priceTarget": "단기 목표가 (e.g. ₩ 105,000,000)",
                  "opinion": "Detailed technical analysis opinion citing the user's custom rules and current market conditions..."
                },
                "relatedNews": [
                  { "title": "Related news title or analysis topic", "url": "https://coingecko.com" }
                ]
              }
            ]`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `Gemini API error: ${errText}` }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const resJson = await response.json();
    const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    return new Response(responseText, {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
