export interface Stamp {
  id: string;
  name: string;
  thumbnail: string; // base64 dataURL
  fabricJSON: object;
  createdAt: string;
}

export type Tool =
  | 'select' | 'line' | 'rect' | 'circle' | 'triangle'
  | 'right-triangle' | 'polygon'
  | 'h-diamond'
  | 'trapezoid' | 'arc' | 'dot'
  | 'text';

export type ArrangementType = 'grid' | 'circular' | 'random' | 'border';

export type BackgroundType = 'solid' | 'gradient';

export type GradientDirection = 'vertical' | 'horizontal' | 'diagonal';
