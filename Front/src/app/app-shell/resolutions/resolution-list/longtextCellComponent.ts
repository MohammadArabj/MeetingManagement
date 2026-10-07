import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

import { ICellRendererAngularComp } from 'ag-grid-angular';
import { FlyTooltipService } from '../../../services/framework-services/tooltip.service';

@Component({
    selector: 'app-long-text-cell',
    standalone: true,
    imports: [],
    template: `
    <div class="ltc"
      (mouseenter)="onEnter()"
      (mouseleave)="onLeave()"
      (click)="onClick()">
      <span #txt class="ltc__text">{{ display }}</span>
      @if (hasMore) {
        <i class="fa fa-expand ltc__icon"></i>
      }
    </div>
    `,
    styles: [`
    .ltc{
      display:flex; align-items:center; gap:6px;
      width:100%;
      direction:rtl;
    }
    .ltc__text{
      display:block;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      width:100%;
      cursor:help;
    }
    .ltc__icon{ opacity:.7; font-size:12px; }
  `]
})
export class LongTextCellComponent implements ICellRendererAngularComp, AfterViewInit, OnDestroy {
    @ViewChild('txt', { static: true }) txtRef!: ElementRef<HTMLElement>;

    private params: any;
    value = '';
    display = '';
    max = 30;
    hasMore = false;

    constructor(private tooltip: FlyTooltipService) { }

    agInit(params: any): void {
        this.params = params;
        this.value = (params.value ?? '').toString();
        this.max = params?.cellRendererParams?.max ?? 30;
        this.display = this.value.length > this.max ? (this.value.substring(0, this.max) + '...') : this.value;
        this.hasMore = this.value.length > this.max;
    }

    refresh(params: any): boolean {
        this.agInit(params);
        setTimeout(() => this.computeTruncation(), 0);
        return true;
    }

    ngAfterViewInit(): void {
        this.computeTruncation();
    }

    // ✅ اضافه شده: پاکسازی tooltip هنگام destroy
    ngOnDestroy(): void {
        this.tooltip.hide(true);
    }

    private computeTruncation() {
        const el = this.txtRef?.nativeElement;
        if (!el) return;
        this.hasMore = (el.scrollWidth > el.clientWidth) || (this.value.length > this.max);
    }

    onEnter() {
        if (!this.hasMore) return;

        const cellEl = this.params?.eGridCell as HTMLElement | undefined;
        const anchor = cellEl ?? this.txtRef.nativeElement;

        this.tooltip.show({
            target: anchor,
            title: this.params?.colDef?.headerName ?? 'محتوا',
            content: this.value
        });

        this.tooltip.targetEnter();
    }

    onLeave() {
        this.tooltip.targetLeave();
    }

    // ✅ اضافه شده: مخفی کردن tooltip هنگام کلیک
    onClick() {
        this.tooltip.hide(true);
    }
}