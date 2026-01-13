
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { BackendMode } from "../types";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * 流式生成 UI 组件代码 - 支持双引擎
 */
export const generateWebComponentStream = async (
  description: string, 
  mode: BackendMode, 
  onChunk: (text: string) => void,
  base64Image?: string
): Promise<string> => {
  const ai = getAIClient();
  
  // Local VLM 使用 Flash (快/轻), Cloud API 使用 Pro (强/稳)
  const model = mode === 'local-vlm' ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview';
  
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
    model,
    contents: { parts },
    config: {
      systemInstruction: mode === 'local-vlm' 
        ? "You are a fast local VLM. Generate clean, minimal HTML/Tailwind. Be concise."
        : "You are a professional Enterprise-grade Cloud UI Engineer. Generate high-quality, accessible, and responsive HTML/Tailwind code with modern design patterns.",
    },
  });

  let fullText = '';
  for await (const chunk of responseStream) {
    // Access .text property as it is a getter, not a method call
    const chunkText = chunk.text || '';
    fullText += chunkText;
    onChunk(fullText);
  }
  return fullText;
};

/**
 * Generate a new image from a text prompt
 */
export const generateImage = async (
  prompt: string, 
  aspectRatio: "1:1" | "4:3" | "3:4" | "16:9" | "9:16" = "1:1"
): Promise<string> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: { aspectRatio }
    }
  });

  // Find the image part as per guidelines (do not assume first part)
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData) {
    return `data:image/png;base64,${part.inlineData.data}`;
  }
  
  throw new Error("Failed to generate image. Please try a different prompt.");
};

/**
 * Generate variations of an existing image
 */
export const generateImageVariation = async (
  base64Image: string,
  stylePrompt: string,
  resolution: '1K' | '2K' = '1K'
): Promise<string> => {
  const ai = getAIClient();
  // Use gemini-3-pro-image-preview for 2K requests, otherwise gemini-2.5-flash-image
  const modelName = resolution === '2K' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image.split(',')[1] || base64Image,
            mimeType: 'image/png'
          }
        },
        {
          text: `Create a professional visual variation of this image with the following style: ${stylePrompt}. Maintain the core objects and composition but transform the artistic direction and aesthetic details.`
        }
      ]
    },
    config: {
      imageConfig: resolution === '2K' ? { imageSize: '2K', aspectRatio: "1:1" } : { aspectRatio: "1:1" }
    }
  });

  // Find the image part in the response
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData) {
    return `data:image/png;base64,${part.inlineData.data}`;
  }
  
  throw new Error("The model did not return an image variation. Try a different style prompt.");
};

export const checkQuotaStatus = async (): Promise<{ status: string; details: string }> => {
    try {
        const ai = getAIClient();
        await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'ping',
            config: { 
              maxOutputTokens: 1,
              thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return { status: "Healthy", details: "Flux Core Online." };
    } catch (error: any) {
        return { status: "Error", details: error.message };
    }
};
