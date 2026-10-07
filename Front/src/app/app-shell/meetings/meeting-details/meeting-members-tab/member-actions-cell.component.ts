import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';

interface MemberListItem {
    id: number;
    name: string;
    roleId: number;
    isExternal: boolean;
    replacementUserGuid?: string;
}

interface ActionsCellParams extends ICellRendererParams {
    onDelete: (member: MemberListItem) => void;
    onSubstitute: (member: MemberListItem) => void;
    onSign: (member: MemberListItem) => void;
    onRemoveSubstitute: (member: MemberListItem) => void;
}

@Component({
    selector: 'app-member-actions-cell',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="actions-container">
      <!-- دکمه حذف -->
      <button class="action-btn btn-delete" 
              (click)="onDelete()" 
              title="حذف">
        <i class="fas fa-trash-alt"></i>
      </button>
      
      <!-- دکمه جانشین (فقط برای غیر مهمان) -->
      @if (!isGuest) {
        @if (hasSubstitute) {
          <button class="action-btn btn-remove-substitute" 
                  (click)="onRemoveSubstitute()" 
                  title="حذف جانشین">
            <i class="fas fa-user-minus"></i>
          </button>
        } @else {
          <button class="action-btn btn-substitute" 
                  (click)="onSubstitute()" 
                  title="انتخاب جانشین">
            <i class="fas fa-people-arrows"></i>
          </button>
        }
      }
      
      <!-- دکمه امضا (فقط برای غیر مهمان خارجی) -->
      @if (!isExternal) {
        <button class="action-btn btn-sign" 
                (click)="onSign()" 
                title="ثبت نظر و امضا">
          <i class="fas fa-signature"></i>
        </button>
      }
    </div>
  `,
    styles: [`
    .actions-container {
      display: flex;
      gap: 0.25rem;
      justify-content: center;
      align-items: center;
      height: 100%;
    }
    
    .action-btn {
      width: 30px;
      height: 30px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 0.8rem;
    }
    
    .action-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    .btn-delete {
      background: rgba(220, 53, 69, 0.1);
      color: #dc3545;
    }
    .btn-delete:hover {
      background: #dc3545;
      color: white;
    }
    
    .btn-substitute {
      background: rgba(255, 193, 7, 0.1);
      color: #ffc107;
    }
    .btn-substitute:hover {
      background: #ffc107;
      color: #333;
    }
    
    .btn-remove-substitute {
      background: rgba(253, 126, 20, 0.1);
      color: #fd7e14;
    }
    .btn-remove-substitute:hover {
      background: #fd7e14;
      color: white;
    }
    
    .btn-sign {
      background: rgba(13, 110, 253, 0.1);
      color: #0d6efd;
    }
    .btn-sign:hover {
      background: #0d6efd;
      color: white;
    }
  `]
})
export class MemberActionsCellComponent implements ICellRendererAngularComp {
    private params!: ActionsCellParams;
    private data!: MemberListItem;

    isGuest = false;
    isExternal = false;
    hasSubstitute = false;

    agInit(params: ActionsCellParams): void {
        this.params = params;
        this.data = params.data;
        this.isGuest = MeetingRoles.isGuest(this.data?.roleId);
        this.isExternal = this.data?.isExternal || false;
        this.hasSubstitute = !!this.data?.replacementUserGuid;
    }

    refresh(params: ActionsCellParams): boolean {
        this.params = params;
        this.data = params.data;
        this.isGuest = MeetingRoles.isGuest(this.data?.roleId);
        this.isExternal = this.data?.isExternal || false;
        this.hasSubstitute = !!this.data?.replacementUserGuid;
        return true;
    }

    onDelete(): void {
        if (this.params.onDelete) {
            this.params.onDelete(this.data);
        }
    }

    onSubstitute(): void {
        if (this.params.onSubstitute) {
            this.params.onSubstitute(this.data);
        }
    }

    onRemoveSubstitute(): void {
        if (this.params.onRemoveSubstitute) {
            this.params.onRemoveSubstitute(this.data);
        }
    }

    onSign(): void {
        if (this.params.onSign) {
            this.params.onSign(this.data);
        }
    }
}