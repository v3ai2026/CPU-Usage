
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { BackendMode } from "../types";

/**
 * Utility to strip markdown code blocks more robustly during streaming.
 */
const sanitizeCode = (raw: string): string => {
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
  // Always use process.env.API_KEY directly for initialization as per the @google/genai coding guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
      systemInstruction: `You are a World-Class Senior UI Architect. 
      Output ONLY pure HTML and Tailwind CSS code. 
      
      IMPORTANT RULES FOR IMAGES:
      1. DO NOT use local paths like 'logo.png' or 'hero.jpg'.
      2. ALWAYS use high-quality, relevant image URLs from Unsplash (https://images.unsplash.com/photo-...).
      3. For any graphic elements, use descriptive Unsplash keywords.
      4. Ensure images have 'object-cover' and appropriate aspect ratios.
      
      General Rules:
      - Use Lucide-like FontAwesome icons for UI elements.
      - Ensure mobile responsiveness.
      - Never include markdown backticks.`,
      tools: useSearch ? [{ googleSearch: {} }] : undefined,
    },
  });

  let fullText = '';
  let finalSources: any[] = [];

  for await (const chunk of responseStream) {
    // Accessing the .text property directly instead of calling a method.
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
  // Initialize with the environment variable directly.
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
  // Use the .text property for extraction.
  return response.text || "No text detected.";
};

/**
 * Image Variation with specific model
 */
export const generateImageVariation = async (
  base64Image: string,
  stylePrompt: string
): Promise<string> => {
  // Initialize with the environment variable directly.
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

  // Iterating through all parts to find the image part correctly.
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  throw new Error("Visual variation failed.");
};
