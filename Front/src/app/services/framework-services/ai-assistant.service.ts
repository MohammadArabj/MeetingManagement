import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

export type AiAction = 'correct' | 'formalize' | 'summarize' | 'complete';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiModel {
  id: string;
  label: string;
}

export const AI_MODELS: AiModel[] = [
  { id: 'qwen2.5-coder:7b', label: 'Qwen 2.5 Coder' },
  { id: 'deepseek-r1:8b', label: 'DeepSeek R1' },
];

export const AI_ACTION_LABELS: Record<AiAction, string> = {
  correct: 'تصحیح و ویرایش',
  formalize: 'رسمی‌سازی',
  summarize: 'خلاصه‌سازی',
  complete: 'تکمیل متن',
};

export const AI_ACTION_ICONS: Record<AiAction, string> = {
  correct: '✏️',
  formalize: '📋',
  summarize: '📝',
  complete: '🔮',
};

@Injectable({ providedIn: 'root' })
export class OllamaService {
  private readonly baseUrl = 'http://172.18.10.27:11434';

  // ── Model switching ────────────────────────────────────────────────────────
  readonly availableModels = AI_MODELS;
  private _currentModel = signal<string>(AI_MODELS[0].id);
  readonly currentModel = this._currentModel.asReadonly();

  setModel(modelId: string): void {
    if (this.availableModels.some(m => m.id === modelId)) {
      this._currentModel.set(modelId);
    }
  }

  // ── Single-turn text transformation (stream) ───────────────────────────────
  stream(action: AiAction, text: string): Observable<string> {
    return this._streamGenerate(this._buildPrompt(action, text));
  }

  // ── Multi-turn chat ────────────────────────────────────────────────────────
  chat(messages: ChatMessage[]): Observable<string> {
    return new Observable((observer) => {
      const controller = new AbortController();

      fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this._currentModel(),
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: true,
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) { observer.error(new Error(`Ollama HTTP ${res.status}`)); return; }
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const line of decoder.decode(value, { stream: true }).split('\n')) {
              if (!line.trim()) continue;
              try {
                const j = JSON.parse(line);
                if (j.message?.content) observer.next(j.message.content);
                if (j.done) { observer.complete(); return; }
              } catch { /* skip */ }
            }
          }
          observer.complete();
        })
        .catch(err => err.name !== 'AbortError' ? observer.error(err) : observer.complete());

      return () => controller.abort();
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────
  private _streamGenerate(prompt: string): Observable<string> {
    return new Observable((observer) => {
      const controller = new AbortController();

      fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this._currentModel(), prompt, stream: true }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) { observer.error(new Error(`Ollama HTTP ${res.status}`)); return; }
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const line of decoder.decode(value, { stream: true }).split('\n')) {
              if (!line.trim()) continue;
              try {
                const j = JSON.parse(line);
                if (j.response) observer.next(j.response);
                if (j.done) { observer.complete(); return; }
              } catch { /* skip */ }
            }
          }
          observer.complete();
        })
        .catch(err => err.name !== 'AbortError' ? observer.error(err) : observer.complete());

      return () => controller.abort();
    });
  }

  private _buildPrompt(action: AiAction, text: string): string {
    const map: Record<AiAction, string> = {
      correct:
        `متن فارسی زیر را از نظر دستوری و نگارشی تصحیح کن.\nفقط متن تصحیح‌شده را برگردان.`,
      formalize:
        `متن فارسی زیر را به سبک رسمی و اداری مناسب صورت‌جلسه تبدیل کن.\nفقط متن تبدیل‌شده را برگردان.`,
      summarize:
        `متن فارسی زیر را خلاصه کن.\nفقط خلاصه را برگردان.`,
      complete:
        `متن فارسی زیر را ادامه بده مناسب یک صورت‌جلسه رسمی.\nفقط ادامه متن را برگردان (نه کل متن).`,
    };
    return `${map[action]}\n\nمتن:\n${text}`;
  }
}