export async function GET() {
  try {
    // Test 1: Try Groq
    const Groq = (await import('groq-sdk')).default;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const result = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Say "Hello World"' }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 50
    });
    
    return Response.json({
      success: true,
      provider: 'groq',
      response: result.choices[0]?.message?.content
    });
    
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message,
      envCheck: {
        hasGroqKey: !!process.env.GROQ_API_KEY,
        groqKeyLength: process.env.GROQ_API_KEY?.length || 0
      }
    });
  }
}
