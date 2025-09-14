// This file acts as a secure API gateway on serverless platforms
// like Cloudflare Pages, Vercel, or Netlify.

export async function onRequest(context) {
  // 1. Allow only POST requests.
  if (context.request.method !== 'POST') {
    return new Response('Invalid request method.', { status: 405 });
  }

  try {
    // 2. Get the request data sent from the client (browser).
    const clientPayload = await context.request.json();

    // 3. Get the Gemini API key securely from the server's 'secret vault' (Environment Variables).
    // This key is NOT written here. It's configured on your hosting platform's settings.
    const geminiApiKey = context.env.GEMINI_API_KEY;

    // Check if the key exists in the secret vault.
    if (!geminiApiKey) {
      console.error("CRITICAL: GEMINI_API_KEY is not set in environment variables.");
      return new Response('API key is not configured on the server. Please contact the administrator.', { status: 500 });
    }

    // 4. Send the request to the official Google Gemini API server using the secure key.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientPayload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Error from Gemini API:", errorBody);
        return new Response(errorBody, { status: response.status });
    }

    // 5. Forward the response from the Google API directly back to the client.
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error processing request in gateway:", error);
    return new Response(`Error processing request: ${error.message}`, { status: 500 });
  }
}

