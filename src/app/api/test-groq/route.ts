import Groq from 'groq-sdk';

export async function GET() {
  console.log('[Test Groq] Starting test...');
  
  try {
    // Check environment variable
    if (!process.env.GROQ_API_KEY) {
      return Response.json({
        success: false,
        error: 'GROQ_API_KEY not found in environment',
        envKeys: Object.keys(process.env).filter(k => k.includes('GROQ') || k.includes('API'))
      });
    }
    
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'user', content: 'Say hello in one word' }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 10,
    });
    
    const response = completion.choices[0]?.message?.content;
    
    return Response.json({
      success: true,
      response: response,
      keyLength: process.env.GROQ_API_KEY.length
    });
    
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message,
      errorType: error.constructor.name
    });
  }
}
