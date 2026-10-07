import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../../services/framework-services/toast.service';
import { SurveyService } from '../../../../services/survey.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-share-link-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="modal-header">
          <h2>
            <i class="fas fa-share-alt"></i>
            اشتراک‌گذاری نظرسنجی
          </h2>
          <button class="close-btn" (click)="close()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- Body -->
        <div class="modal-body">
          @if (loading()) {
            <div class="loading">
              <div class="spinner"></div>
              <p>در حال بارگذاری...</p>
            </div>
          }
          @else if (linkData()!==null) {
            <!-- عنوان نظرسنجی -->
            <div class="survey-title">
              <i class="fas fa-poll"></i>
              <h3>{{ linkData()?.title }}</h3>
            </div>
            
            <!-- وضعیت -->
            <div class="status-box" [class.active]="linkData()?.isActive">
              <i class="fas" [class.fa-check-circle]="linkData()?.isActive" 
                 [class.fa-exclamation-circle]="!linkData()?.isActive"></i>
              <div>
                <strong>وضعیت:</strong>
                <span>{{ linkData()?.status }}</span>
              </div>
            </div>
            
            <!-- بازه زمانی -->
            <div class="date-range">
              <div class="date-item">
                <i class="fas fa-calendar-alt"></i>
                <span>از: {{ linkData()?.startDate }}</span>
              </div>
              <div class="date-item">
                <i class="fas fa-calendar-check"></i>
                <span>تا: {{ linkData()?.endDate }}</span>
              </div>
            </div>
            
            <!-- لینک -->
            <div class="link-section">
              <label>لینک عمومی نظرسنجی:</label>
              <div class="link-box">
                <input
                  type="text"
                  [value]="linkData()?.publicUrl"
                  readonly
                  #linkInput>
                <button class="copy-btn" (click)="copyLink(linkInput)">
                  <i class="fas" [class.fa-copy]="!copied()" 
                     [class.fa-check]="copied()"></i>
                  {{ copied() ? 'کپی شد!' : 'کپی' }}
                </button>
              </div>
            </div>
            
            <!-- QR Code -->
            @if (linkData()?.qrCodeBase64) {
              <div class="qr-section">
                <label>QR Code:</label>
                <div class="qr-box">
                  <img
                    [src]="'data:image/png;base64,' + linkData()?.qrCodeBase64"
                    alt="QR Code">
                  <button class="download-btn" (click)="downloadQR()">
                    <i class="fas fa-download"></i>
                    دانلود QR Code
                  </button>
                </div>
              </div>
            }
            
            <!-- راهنما -->
            <div class="help-box">
              <i class="fas fa-info-circle"></i>
              <div>
                <p><strong>نحوه استفاده:</strong></p>
                <ul>
                  <li>لینک را کپی کرده و در شبکه‌های اجتماعی، ایمیل یا پیامک به اشتراک بگذارید</li>
                  <li>QR Code را دانلود کرده و روی پوستر یا بنر چاپ کنید</li>
                  <li>کاربران با اسکن QR Code یا کلیک روی لینک به نظرسنجی دسترسی پیدا می‌کنند</li>
                </ul>
              </div>
            </div>
            
          } @else {
            <div class="error">
              <i class="fas fa-exclamation-triangle"></i>
              <p>خطا در بارگذاری اطلاعات</p>
            </div>
          }
        </div>
        
        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn" (click)="close()">
            بستن
          </button>
        </div>
        
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
      animation: fadeIn 0.2s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .modal-content {
      background: white;
      border-radius: 24px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.3);
      animation: slideUp 0.3s ease;
    }
    
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 32px;
      border-bottom: 2px solid var(--line);
    }
    
    .modal-header h2 {
      margin: 0;
      font-weight: 900;
      font-size: 1.4rem;
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--ink);
    }
    
    .close-btn {
      width: 40px;
      height: 40px;
      border: none;
      background: rgba(100, 116, 139, 0.1);
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      font-size: 1.2rem;
      transition: all 0.2s;
    }
    
    .close-btn:hover {
      background: rgba(255, 77, 109, 0.1);
      color: var(--accent);
    }
    
    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 32px;
    }
    
    .modal-body::-webkit-scrollbar {
      width: 8px;
    }
    
    .modal-body::-webkit-scrollbar-track {
      background: #f1f5f9;
    }
    
    .modal-body::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    
    .loading, .error {
      text-align: center;
      padding: 40px 20px;
      color: var(--muted);
    }
    
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid var(--line);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .survey-title {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: linear-gradient(135deg, rgba(29, 78, 216, 0.08), rgba(255, 77, 109, 0.06));
      border-radius: 14px;
      margin-bottom: 20px;
    }
    
    .survey-title i {
      font-size: 1.5rem;
      color: var(--primary);
    }
    
    .survey-title h3 {
      margin: 0;
      font-weight: 800;
      font-size: 1.1rem;
    }
    
    .status-box {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: rgba(251, 146, 60, 0.1);
      border: 1px solid rgba(251, 146, 60, 0.3);
      border-radius: 12px;
      margin-bottom: 16px;
      color: var(--warn);
    }
    
    .status-box.active {
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.3);
      color: var(--ok);
    }
    
    .status-box i {
      font-size: 1.3rem;
    }
    
    .date-range {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .date-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px;
      background: rgba(249, 250, 251, 0.8);
      border: 1px solid var(--line);
      border-radius: 10px;
      font-size: 0.9rem;
    }
    
    .date-item i {
      color: var(--primary);
    }
    
    .link-section, .qr-section {
      margin-bottom: 24px;
    }
    
    label {
      display: block;
      font-weight: 800;
      margin-bottom: 8px;
      color: var(--ink);
    }
    
    .link-box {
      display: flex;
      gap: 8px;
    }
    
    .link-box input {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid var(--line);
      border-radius: 12px;
      background: rgba(249, 250, 251, 0.5);
      font-family: monospace;
      font-size: 0.9rem;
      color: var(--ink);
    }
    
    .copy-btn {
      padding: 12px 20px;
      border: none;
      background: var(--primary);
      color: white;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      white-space: nowrap;
    }
    
    .copy-btn:hover {
      background: #1d4ed8;
      transform: scale(1.02);
    }
    
    .qr-box {
      padding: 24px;
      background: white;
      border: 2px solid var(--line);
      border-radius: 14px;
      text-align: center;
    }
    
    .qr-box img {
      width: 200px;
      height: 200px;
      margin-bottom: 16px;
      border: 2px solid var(--line);
      border-radius: 12px;
      padding: 8px;
      background: white;
    }
    
    .download-btn {
      padding: 10px 20px;
      border: 2px solid var(--primary);
      background: rgba(29, 78, 216, 0.1);
      color: var(--primary);
      border-radius: 10px;
      cursor: pointer;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    
    .download-btn:hover {
      background: var(--primary);
      color: white;
    }
    
    .help-box {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: rgba(14, 165, 233, 0.08);
      border: 1px solid rgba(14, 165, 233, 0.2);
      border-radius: 12px;
    }
    
    .help-box i {
      font-size: 1.3rem;
      color: #0ea5e9;
      flex-shrink: 0;
    }
    
    .help-box p {
      margin: 0 0 8px 0;
      font-weight: 800;
    }
    
    .help-box ul {
      margin: 0;
      padding-right: 20px;
      font-size: 0.9rem;
      color: var(--muted);
    }
    
    .help-box li {
      margin-bottom: 4px;
    }
    
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      padding: 24px 32px;
      border-top: 2px solid var(--line);
    }
  `]
})
export class ShareLinkModalComponent implements OnInit {
  @Input() surveyGuid!: string;
  @Output() closed = new EventEmitter<void>();

  private readonly surveyService = inject(SurveyService);
  private readonly toastService = inject(ToastService);

  loading = signal(true);
  linkData = signal<any>(null);
  copied = signal(false);

  ngOnInit(): void {
    this.loadLinkData();
  }

  private loadLinkData(): void {
    this.surveyService.getPublicLink(this.surveyGuid)
      .subscribe({
        next: (response: any) => {
          this.linkData.set(response);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error loading link:', error);
          this.toastService.error('خطا در بارگذاری لینک');
          this.loading.set(false);
        }
      });
  }

  copyLink(input: HTMLInputElement): void {
    input.select();
    document.execCommand('copy');
    this.copied.set(true);
    this.toastService.success('لینک کپی شد');

    setTimeout(() => {
      this.copied.set(false);
    }, 2000);
  }

  downloadQR(): void {
    const link = document.createElement('a');
    link.download = `survey-qr-${this.surveyGuid}.png`;
    link.href = `data:image/png;base64,${this.linkData()?.qrCodeBase64}`;
    link.click();
    this.toastService.success('QR Code دانلود شد');
  }

  close(): void {
    this.closed.emit();
  }
}
