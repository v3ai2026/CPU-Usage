
export enum AppView {
    CANVAS = 'CANVAS',
    COMPONENTS = 'COMPONENTS',
    ASSETS = 'ASSETS',
    SETTINGS = 'SETTINGS'
}

export type ViewportSize = 'mobile' | 'tablet' | 'desktop';
export type BackendMode = 'local-vlm' | 'cloud-api';
export type CanvasMode = 'stack' | 'freeform';

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
    variations?: string[];
    analysis?: string;
    position?: { x: number; y: number };
}

export interface LogEntry {
    id: string;
    timestamp: Date;
    type: 'request' | 'success' | 'error' | 'info';
    message: string;
}
