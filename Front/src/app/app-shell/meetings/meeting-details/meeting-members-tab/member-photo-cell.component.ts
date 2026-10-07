import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
    selector: 'app-member-photo-cell',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="photo-container" (contextmenu)="$event.preventDefault()">
      <div class="photo-wrapper">
        <img [src]="imageUrl" 
             alt="" 
             (error)="onImageError($event)"
             draggable="false">
        <div class="photo-overlay"></div>
      </div>
    </div>
  `,
    styles: [`
    .photo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 4px 0;
    }
    
    .photo-wrapper {
      position: relative;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid #e9ecef;
      background: #f8f9fa;
    }
    
    .photo-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      user-select: none;
      -webkit-user-drag: none;
    }
    
    .photo-overlay {
      position: absolute;
      inset: 0;
      background: transparent;
      pointer-events: none;
    }
  `]
})
export class MemberPhotoCellComponent implements ICellRendererAngularComp {
    imageUrl = 'img/default-avatar.png';

    agInit(params: ICellRendererParams): void {
        this.imageUrl = params.data?.image || 'img/default-avatar.png';
    }

    refresh(params: ICellRendererParams): boolean {
        this.imageUrl = params.data?.image || 'img/default-avatar.png';
        return true;
    }

    onImageError(event: Event): void {
        const img = event.target as HTMLImageElement;
        img.src = 'img/default-avatar.png';
    }
}