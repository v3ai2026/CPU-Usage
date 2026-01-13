
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * 流式生成 UI 组件代码
 */
export const generateWebComponentStream = async (
  description: string, 
  isPro: boolean, 
  onChunk: (text: string) => void,
  base64Image?: string
): Promise<string> => {
  const ai = getAIClient();
  const model = isPro ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  
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
      systemInstruction: "You are a world-class UI designer and frontend engineer. Generate a single HTML block using Tailwind CSS (CDN version). If an image is provided, use it as a visual reference. Only return the raw HTML/Tailwind code, NO markdown code blocks, NO explanations. Ensure the UI is centered and has its own container if needed.",
    },
  });

  let fullText = '';
  for await (const chunk of responseStream) {
    const chunkText = chunk.text || '';
    fullText += chunkText;
    onChunk(fullText);
  }
  return fullText;
};

/**
 * 基于现有图像生成变体
 */
export const generateImageVariation = async (
  base64Image: string,
  stylePrompt: string,
  isPro: boolean,
  resolution: "1K" | "2K" | "4K" = "1K"
): Promise<string> => {
  const ai = getAIClient();
  // Using Pro for variations if requested, otherwise Flash
  const model = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageData,
          },
        },
        {
          text: `Generate a variation of this image in the following style: ${stylePrompt}. Maintain the core composition but transform the aesthetic.`,
        },
      ],
    },
    config: isPro ? {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: resolution
      }
    } : undefined
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image data returned from model variation request.");
};

export const analyzeImageOCR = async (base64Image: string): Promise<string> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { text: "Act as an OCR specialist. Extract text and structural layout." },
        { inlineData: { mimeType: 'image/png', data: base64Image.split(',')[1] || base64Image } }
      ]
    }
  });
  return response.text || "No text extracted.";
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
        return { status: "Healthy", details: "Connected." };
    } catch (error: any) {
        return { status: "Error", details: error.message };
    }
};
