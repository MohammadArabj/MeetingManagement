/** حالت نمایش لیست فایل‌ها */
export type ViewMode = 'grid' | 'list';

/** نوع فایل برای انتخاب نحوه نمایش/پیش‌نمایش */
export type FileKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'other';

/** وضعیت بزرگ‌نمایی و جابجایی تصویر در پیش‌نمایش */
export interface ZoomState {
  scale: number;
  translateX: number;
  translateY: number;
  isDragging: boolean;
  startX: number;
  startY: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.25;

export const INITIAL_ZOOM_STATE: Readonly<ZoomState> = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
};
