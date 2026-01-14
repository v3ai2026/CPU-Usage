
import { GoogleGenAI } from "@google/genai";
import { BackendMode, AIProvider } from "../types";

/**
 * Strips markdown code blocks.
 */
const sanitizeCode = (raw: string): string => {
  let cleaned = raw.replace(/```(html|css|javascript|typescript|json)?/gi, '');
  cleaned = cleaned.replace(/```/g, '');
  return cleaned.trim();
};

/**
 * Universal Image Generator using Gemini-2.5-Flash-Image
 */
export const generateImage = async (
  prompt: string,
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" = "1:1"
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio,
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data returned from model");
};

/**
 * Universal Stream Generator supporting both Gemini and OpenAI
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

  // Gemini Implementation
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
      systemInstruction: `You are a Senior Silicon Valley UI Engineer. 
      Generate a SINGLE high-quality, fully responsive UI component using HTML and Tailwind CSS.
      Theme: Hyper-modern, minimalist, industrial-dark (zinc-900/950).
      Use FontAwesome 6 icons.
      DO NOT use markdown, return raw code only.
      If a reference image is provided, replicate its layout and style exactly using Tailwind.`,
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
 * OpenAI (OpenAPI) Fetch-based Streaming Implementation
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
      content: 'You are a Senior UI Engineer. Generate ONLY the raw HTML/Tailwind code for the requested component. Dark industrial theme. No markdown.' 
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
    body: JSON.stringify({
      model: model === 'gemini-3-flash-preview' ? 'gpt-4o-mini' : 'gpt-4o',
      messages,
      stream: true
    })
  });

  if (!response.ok) throw new Error(`OpenAI API Error: ${response.statusText}`);

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
