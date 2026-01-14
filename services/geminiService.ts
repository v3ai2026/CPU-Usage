
import { GoogleGenAI } from "@google/genai";
import { BackendMode, AIProvider } from "../types";

/**
 * Strips markdown code blocks and cleans up output.
 */
const sanitizeCode = (raw: string): string => {
  let cleaned = raw.replace(/```(html|css|javascript|typescript|json)?/gi, '');
  cleaned = cleaned.replace(/```/g, '');
  return cleaned.trim();
};

/**
 * Image Generator for high-end fashion references.
 */
export const generateImage = async (
  prompt: string,
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" = "1:1"
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `High-end fashion editorial, cinematic lighting, luxury texture, minimalist aesthetic, avant-garde composition: ${prompt}` }],
    },
    config: {
      imageConfig: { aspectRatio },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Visual synthesis failed.");
};

/**
 * Web Component Streamer with a "Fashion Studio" Persona.
 */
export const generateWebComponentStream = async (
  description: string, 
  mode: BackendMode, 
  onChunk: (text: string, sources?: any[]) => void,
  base64Image?: string,
  useSearch: boolean = false,
  modelName: string = 'gemini-3-flash-preview',
  provider: AIProvider = 'gemini'
): Promise<{ code: string, sources?: any[] }> => {
  
  if (provider === 'openai') {
    return generateOpenAIStream(description, onChunk, base64Image, modelName);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [{ text: description }];
  if (base64Image) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Image.split(',')[1] || base64Image
      }
    });
  }

  const responseStream = await ai.models.generateContentStream({
    model: modelName,
    contents: { parts },
    config: {
      systemInstruction: `You are a visionary Creative Director for an elite fashion digital studio (like those behind Balenciaga, Saint Laurent, or Awwwards SOTD).

      STRICT DESIGN PHILOSOPHY:
      - ABSOLUTELY NO SIDEBARS, NO ADMIN DASHBOARDS, NO DATA TABLES. 
      - Think "DIGITAL EDITORIAL". Your outputs should look like interactive luxury magazine covers.
      - USE LARGE SCALE: Hero sections should use at least 80vh height. 
      - TYPOGRAPHY: Focus on elegant serif headers or ultra-modern thin sans-serif. Use letter-spacing liberally.
      - WHITE SPACE: Embrace the "void". Luxury is defined by the space you don't fill.
      - OVERLAPS: Elements should float, overlap, and create depth.
      - NARRATIVE FLOW: Design for scrolling experiences, not clicking navigation.
      - COLORS: Monochromatic, Noir, or sophisticated muted earth tones.

      TECHNOLOGY:
      - Use ONLY Tailwind CSS and standard HTML5.
      - Use FontAwesome 6 for very minimal, high-end iconography.
      - Ensure smooth transitions and hover effects using Tailwind utilities.

      Return ONLY the raw code for a single, complete web section or page. No explanation. No talk. Just pure aesthetic.`,
      tools: useSearch ? [{ googleSearch: {} }] : undefined,
    },
  });

  let fullText = '';
  let finalSources: any[] = [];

  for await (const chunk of responseStream) {
    const chunkText = chunk.text || '';
    fullText += chunkText;
    
    const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.groundingChunks) {
        finalSources = groundingMetadata.groundingChunks;
    }
    onChunk(sanitizeCode(fullText), finalSources);
  }

  return { code: sanitizeCode(fullText), sources: finalSources };
};

/**
 * OpenAI Implementation with strict fashion logic.
 */
async function generateOpenAIStream(
  prompt: string,
  onChunk: (text: string) => void,
  base64Image?: string,
  model: string = 'gpt-4o'
): Promise<{ code: string }> {
  const apiKey = (process.env as any).OPENAI_API_KEY || process.env.API_KEY; 
  const messages: any[] = [
    { 
      role: 'system', 
      content: 'You are a High-Fashion Creative Director. NEVER generate dashboards. Create high-end, artistic, minimalist editorial web layouts using Tailwind CSS. Think Vogue and Prada.' 
    }
  ];

  if (base64Image) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: base64Image.startsWith('data') ? base64Image : `data:image/png;base64,${base64Image}` } }
      ]
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model: 'gpt-4o', messages, stream: true })
  });

  if (!response.ok) throw new Error(`OpenAI Connection Error.`);

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim() !== '');
    for (const line of lines) {
      if (line.includes('[DONE]')) break;
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices[0]?.delta?.content || '';
          fullText += content;
          onChunk(sanitizeCode(fullText));
        } catch (e) { }
      }
    }
  }

  return { code: sanitizeCode(fullText) };
}
