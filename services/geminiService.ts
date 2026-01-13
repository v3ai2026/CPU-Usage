
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { BackendMode } from "../types";

/**
 * Utility to strip markdown code blocks more robustly during streaming.
 */
const sanitizeCode = (raw: string): string => {
  // Removes opening and closing triple backticks even if partial
  let cleaned = raw.replace(/```(html|css|javascript|typescript|json)?/gi, '');
  cleaned = cleaned.replace(/```/g, '');
  return cleaned.trim();
};

/**
 * Stream component generation with optional Google Search grounding
 */
export const generateWebComponentStream = async (
  description: string, 
  mode: BackendMode, 
  onChunk: (text: string, sources?: any[]) => void,
  base64Image?: string,
  useSearch: boolean = false
): Promise<{ code: string, sources?: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Coding tasks perform best on Pro models
  const modelName = 'gemini-3-pro-preview';
  
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
      systemInstruction: `You are a World-Class UI Architect and Frontend Developer. 
      Output ONLY pure HTML and Tailwind CSS code. 
      DO NOT include markdown backticks like \`\`\`html. 
      Ensure mobile responsiveness and high-end aesthetics.
      If you use the search tool, incorporate the latest data into the content.`,
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

  return { 
    code: sanitizeCode(fullText), 
    sources: finalSources 
  };
};

/**
 * Perform Vision OCR extraction
 */
export const performOCR = async (base64Image: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType: 'image/png' } },
        { text: "Extract all text from this UI design faithfully. Output only raw text content." }
      ]
    }
  });
  return response.text || "No text detected.";
};

/**
 * Image Variation with specific model
 */
export const generateImageVariation = async (
  base64Image: string,
  stylePrompt: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType: 'image/png' } },
        { text: `Re-style this image: ${stylePrompt}. Maintain composition but change aesthetic.` }
      ]
    },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  throw new Error("Visual variation failed.");
};
