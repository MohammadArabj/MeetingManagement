import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

interface MemberListItem {
    id: number;
    name: string;
    isPresent?: boolean | null;
}

interface PresenceCellParams extends ICellRendererParams {
    onPresenceChange: (member: MemberListItem, isPresent: boolean) => void;
}

@Component({
    selector: 'app-member-presence-cell',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="presence-toggle">
      <button class="presence-btn absent" 
              [class.active]="isPresent === false"
              (click)="setPresence(false)"
              title="غایب">
        <i class="fas fa-times"></i>
      </button>
      
      <button class="presence-btn unknown" 
              [class.active]="isPresent === null || isPresent === undefined"
              disabled
              title="نامشخص">
        <i class="fas fa-question"></i>
      </button>
      
      <button class="presence-btn present" 
              [class.active]="isPresent === true"
              (click)="setPresence(true)"
              title="حاضر">
        <i class="fas fa-check"></i>
      </button>
    </div>
  `,
    styles: [`
    .presence-toggle {
      display: flex;
      gap: 2px;
      justify-content: center;
      align-items: center;
      height: 100%;
    }
    
    .presence-btn {
      width: 28px;
      height: 28px;
      border: 1px solid #dee2e6;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 0.75rem;
    }
    
    .presence-btn:first-child {
      border-radius: 0 6px 6px 0 ;
    }
    
    .presence-btn:last-child {
      border-radius: 6px 0 0 6px;
    }
    
    .presence-btn:hover:not(:disabled) {
      z-index: 1;
    }
    
    .presence-btn.absent {
      color: #dc3545;
    }
    .presence-btn.absent:hover:not(:disabled) {
      background: rgba(220, 53, 69, 0.1);
      border-color: #dc3545;
    }
    .presence-btn.absent.active {
      background: #dc3545;
      border-color: #dc3545;
      color: white;
    }
    
    .presence-btn.unknown {
      color: #6c757d;
    }
    .presence-btn.unknown.active {
      background: #6c757d;
      border-color: #6c757d;
      color: white;
    }
    
    .presence-btn.present {
      color: #198754;
    }
    .presence-btn.present:hover:not(:disabled) {
      background: rgba(25, 135, 84, 0.1);
      border-color: #198754;
    }
    .presence-btn.present.active {
      background: #198754;
      border-color: #198754;
      color: white;
    }
  `]
})
export class MemberPresenceCellComponent implements ICellRendererAngularComp {
    private params!: PresenceCellParams;
    private data!: MemberListItem;

    isPresent: boolean | null | undefined = null;

    agInit(params: PresenceCellParams): void {
        this.params = params;
        this.data = params.data;
        this.isPresent = this.data?.isPresent;
    }

    refresh(params: PresenceCellParams): boolean {
        this.params = params;
        this.data = params.data;
        this.isPresent = this.data?.isPresent;
        return true;
    }

    setPresence(isPresent: boolean): void {
        if (this.params.onPresenceChange) {
            this.params.onPresenceChange(this.data, isPresent);
            this.isPresent = isPresent;
        }
    }
}