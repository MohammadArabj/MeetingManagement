// ===============================================================
// File: shared/ai-chat-widget/ai-chat-widget.component.ts
// ===============================================================

import {
  Component, signal, computed,
  inject, OnDestroy, AfterViewChecked,
  ViewChild, ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { OllamaService, ChatMessage } from '../../services/framework-services/ai-assistant.service';

interface WidgetChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

@Component({
  selector: 'app-ai-chat-widget',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ai-chat-widget.html',
  styleUrl: './ai-chat-widget.css',
})
export class AiChatWidgetComponent implements OnDestroy, AfterViewChecked {

  readonly ollamaService = inject(OllamaService);  // فقط این متد رو اضافه کن به کلاس موجود
  onModelChange(modelId: string): void {
    this.ollamaService.setModel(modelId);
  }
  @ViewChild('messagesEnd') private messagesEnd?: ElementRef<HTMLDivElement>;

  // ── Widget open/close ──────────────────────────────────────────────────────
  readonly isOpen = signal<boolean>(false);
  readonly isMinimized = signal<boolean>(false);

  // ── Chat state ─────────────────────────────────────────────────────────────
  readonly entries = signal<WidgetChatEntry[]>([]);
  readonly inputText = signal<string>('');
  readonly isStreaming = signal<boolean>(false);

  private _sub: Subscription | null = null;
  private _idCounter = 0;
  private _shouldScroll = false;

  readonly hasEntries = computed(() => this.entries().length > 0);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnDestroy(): void {
    this._sub?.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this._shouldScroll) {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      this._shouldScroll = false;
    }
  }

  // ── Widget controls ────────────────────────────────────────────────────────
  toggle(): void {
    if (this.isOpen()) {
      this.isMinimized.set(false);
      this.isOpen.set(false);
    } else {
      this.isOpen.set(true);
    }
  }

  minimize(): void {
    this.isMinimized.update(v => !v);
  }

  close(): void {
    this.isOpen.set(false);
    this.isMinimized.set(false);
  }

  // ── Chat actions ───────────────────────────────────────────────────────────
  onInputChange(value: string): void {
    this.inputText.set(value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const text = this.inputText().trim();
    if (!text || this.isStreaming()) return;

    const userEntry: WidgetChatEntry = {
      id: `w-${++this._idCounter}`,
      role: 'user',
      content: text,
    };
    this.entries.update(list => [...list, userEntry]);
    this.inputText.set('');
    this._shouldScroll = true;

    const assistantEntry: WidgetChatEntry = {
      id: `w-${++this._idCounter}`,
      role: 'assistant',
      content: '',
      streaming: true,
    };
    this.entries.update(list => [...list, assistantEntry]);
    this.isStreaming.set(true);

    // Build messages for /api/chat (no persistent system prompt needed for general chat)
    const history: ChatMessage[] = [
      {
        role: 'system',
        content: 'شما یک دستیار هوشمند فارسی‌زبان هستید. پاسخ‌های کوتاه، دقیق و مفید بدهید.',
      },
      ...this.entries()
        .filter(e => !e.streaming)
        .map(e => ({ role: e.role as 'user' | 'assistant', content: e.content })),
      { role: 'user', content: text },
    ];

    this._sub = this.ollamaService.chat(history).subscribe({
      next: (token) => {
        this.entries.update(list =>
          list.map(e =>
            e.id === assistantEntry.id
              ? { ...e, content: e.content + token }
              : e
          )
        );
        this._shouldScroll = true;
      },
      error: (err) => {
        console.error('Widget chat error:', err);
        this.isStreaming.set(false);
        this.entries.update(list =>
          list.map(e =>
            e.id === assistantEntry.id
              ? { ...e, content: 'خطا در دریافت پاسخ.', streaming: false }
              : e
          )
        );
      },
      complete: () => {
        this.isStreaming.set(false);
        this.entries.update(list =>
          list.map(e => e.id === assistantEntry.id ? { ...e, streaming: false } : e)
        );
        this._shouldScroll = true;
      },
    });
  }

  stopStream(): void {
    this._sub?.unsubscribe();
    this._sub = null;
    this.isStreaming.set(false);
    this.entries.update(list =>
      list.map(e => e.streaming ? { ...e, streaming: false } : e)
    );
  }

  clearHistory(): void {
    if (this.isStreaming()) return;
    this.entries.set([]);
  }
}