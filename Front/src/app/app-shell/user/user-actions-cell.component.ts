// users/user-actions-cell.component.ts

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

interface ExpandedUser {
    guid: string;
    positionGuid: string;
    name: string;
    userName: string;
    position: string;
    persNo?: string;
}

interface ActionsCellParams extends ICellRendererParams {
    onImpersonate: (user: ExpandedUser) => void;
    isImpersonating: () => boolean;
    canImpersonate?: () => boolean;
}

@Component({
    selector: 'app-user-actions-cell',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="actions-container">
      @if (allowed) {
      <button class="btn-impersonate" 
              (click)="onImpersonate()"
              [disabled]="isDisabled"
              [title]="isDisabled ? 'ابتدا از حساب فعلی خارج شوید' : 'ورود به عنوان این کاربر'">
        <i class="fas fa-user-secret"></i>
        <span>ورود به عنوان کاربر</span>
      </button>
      }
    </div>
  `,
    styles: [`
    .actions-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 4px;
    }
    
    .btn-impersonate {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      font-size: 0.8rem;
      font-family: 'Sahel', sans-serif;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .btn-impersonate:hover:not(:disabled) {
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }
    
    .btn-impersonate:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      opacity: 0.7;
    }
    
    .btn-impersonate i {
      font-size: 0.9rem;
    }
  `]
})
export class UserActionsCellComponent implements ICellRendererAngularComp {
    private params!: ActionsCellParams;
    private data!: ExpandedUser;
    isDisabled = false;
    allowed = true;

    agInit(params: ActionsCellParams): void {
        this.params = params;
        this.data = params.data;
        this.isDisabled = params.isImpersonating?.() || false;
        this.allowed = params.canImpersonate?.() ?? true;
    }

    refresh(params: ActionsCellParams): boolean {
        this.params = params;
        this.data = params.data;
        this.isDisabled = params.isImpersonating?.() || false;
        this.allowed = params.canImpersonate?.() ?? true;
        return true;
    }

    onImpersonate(): void {
        if (!this.isDisabled && this.params.onImpersonate) {
            this.params.onImpersonate(this.data);
        }
    }
}
