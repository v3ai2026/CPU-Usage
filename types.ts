
export enum AppView {
    CANVAS = 'CANVAS',
    COMPONENTS = 'COMPONENTS',
    ASSETS = 'ASSETS',
    SETTINGS = 'SETTINGS'
}

export type AIProvider = 'gemini' | 'openai';
export type ViewportSize = 'mobile' | 'tablet' | 'desktop';
export type BackendMode = 'local-vlm' | 'cloud-api';
export type CanvasMode = 'stack' | 'freeform';

export interface VariationRecord {
    url: string;
    prompt: string;
}

export interface CodeVariationRecord {
    code: string;
    style: string;
    timestamp: Date;
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
    variations?: VariationRecord[];
    codeVariations?: CodeVariationRecord[];
    analysis?: string;
    position?: { x: number; y: number };
}

export interface LogEntry {
    id: string;
    timestamp: Date;
    type: 'request' | 'success' | 'error' | 'info';
    message: string;
}
