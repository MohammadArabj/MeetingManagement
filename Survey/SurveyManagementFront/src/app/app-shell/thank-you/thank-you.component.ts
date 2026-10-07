import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-thank-you',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="thank-you-container">
      <div class="thank-you-card">
        <div class="success-icon">
          <i class="fa fa-check-circle"></i>
        </div>
        
        <h1 class="thank-you-title">متشکریم!</h1>
        
        <p class="thank-you-message">
          پاسخ شما با موفقیت ثبت شد.
        </p>
        
        <p class="thank-you-description">
          از وقتی که برای تکمیل این نظرسنجی گذاشتید، سپاسگزاریم.
          نظرات شما برای ما بسیار ارزشمند است.
        </p>

        <div class="action-buttons mt-4">
          <a routerLink="/" class="btn btn-primary btn-lg">
            <i class="fa fa-home me-2"></i>
            بازگشت به صفحه اصلی
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .thank-you-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }

    .thank-you-card {
      background: white;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      padding: 3rem;
      max-width: 600px;
      text-align: center;
      animation: fadeInUp 0.6s ease;
    }

    .success-icon {
      font-size: 5rem;
      color: #28a745;
      margin-bottom: 1.5rem;
      animation: scaleIn 0.5s ease;
    }

    .thank-you-title {
      font-size: 2.5rem;
      font-weight: 700;
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .thank-you-message {
      font-size: 1.25rem;
      color: #495057;
      margin-bottom: 1rem;
    }

    .thank-you-description {
      font-size: 1rem;
      color: #6c757d;
      line-height: 1.6;
    }

    .action-buttons {
      display: flex;
      justify-content: center;
      gap: 1rem;
    }

    .btn-lg {
      padding: 0.75rem 2rem;
      font-size: 1.1rem;
      border-radius: 10px;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes scaleIn {
      from {
        transform: scale(0);
      }
      to {
        transform: scale(1);
      }
    }

    @media (max-width: 768px) {
      .thank-you-card {
        padding: 2rem 1.5rem;
      }

      .thank-you-title {
        font-size: 2rem;
      }

      .success-icon {
        font-size: 4rem;
      }
    }
  `]
})
export class ThankYouComponent {}
