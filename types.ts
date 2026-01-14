
export enum AppView {
    CANVAS = 'CANVAS',
    COMPONENTS = 'COMPONENTS',
    ASSETS = 'ASSETS',
    SETTINGS = 'SETTINGS'
}

export type AIProvider = 'gemini' | 'openai';

// Define BackendMode for service configuration
export type BackendMode = 'cloud-api' | 'local-proxy';

export interface AssetElement {
    id: string;
    url: string;
    prompt: string;
    timestamp: Date;
    type: 'model' | 'reference' | 'texture';
}

export interface UIElement {
    id: string;
    name: string;
    type: 'layout' | 'button' | 'card' | 'form' | 'custom';
    code: string;
    prompt: string;
    timestamp: Date;
    selected: boolean;
    visible: boolean;
    imageData?: string;
    position?: { x: number; y: number };
}

export interface TranscriptionMessage {
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
}
