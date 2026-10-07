import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { NgStyle, SlicePipe } from '@angular/common';

import { FileItem } from '../resolution-form.models';

/**
 * پنل مدیریت فایل‌های فرم مصوبه: ناحیه آپلود، فایل‌های دستور جلسه (فقط مشاهده)،
 * فایل‌های مصوبه و فایل‌های علامت‌خورده برای حذف (با امکان بازگردانی).
 * کاملاً نمایشی است؛ همه عملیات از طریق output به والد سپرده می‌شود.
 */
@Component({
  selector: 'app-resolution-files-panel',
  standalone: true,
  imports: [NgStyle, SlicePipe],
  templateUrl: './resolution-files-panel.html',
  styleUrl: './resolution-files-panel.css',
})
export class ResolutionFilesPanelComponent {
  // ═══════════════════════════════════════════════════════════
  // Inputs
  // ═══════════════════════════════════════════════════════════
  readonly fileCount = input<number>(0);
  readonly uploadProgress = input<number>(0);
  readonly agendaFiles = input<FileItem[]>([]);
  readonly hasAgendaFiles = input<boolean>(false);
  readonly resolutionFiles = input<FileItem[]>([]);
  /** لیست خام فایل‌های مصوبه (شامل فایل‌های علامت‌خورده برای حذف) */
  readonly allResolutionFiles = input<FileItem[]>([]);
  readonly hasRemovedFiles = input<boolean>(false);
  readonly selectedFileId = input<number | null>(null);
  readonly loadingAgendaFiles = input<boolean>(false);

  // ═══════════════════════════════════════════════════════════
  // Outputs
  // ═══════════════════════════════════════════════════════════
  readonly filesPicked = output<File[]>();
  readonly fileSelected = output<number>();
  readonly fileDeleted = output<number>();
  readonly fileRestored = output<number>();

  // ViewChildren
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  // ═══════════════════════════════════════════════════════════
  // Upload zone
  // ═══════════════════════════════════════════════════════════
  triggerFileInput(): void {
    this.fileInput()?.nativeElement?.click();
  }

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement)?.classList.add('dragover');
  }

  handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement)?.classList.remove('dragover');
  }

  handleDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement)?.classList.remove('dragover');
    const files = Array.from(event.dataTransfer?.files || []);
    this.filesPicked.emit(files);
  }

  handleFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.filesPicked.emit(files);
    input.value = '';
  }
}
