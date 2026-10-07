
import { Component } from "@angular/core";
import { ICellRendererAngularComp } from "ag-grid-angular";
declare var $: any;

@Component({
    selector: 'is-canceled-cell-renderer',
    standalone: true,
    imports: [],
    template: `
    @if (isCanceled == 'باطل شده') {
      <span>
        <span class="bg-soft-danger text-danger" style="padding: 3px">باطل شده</span>
      </span>
    }`,
})
export class IsCanceledCellRenderer implements ICellRendererAngularComp {
    params: any;
    isCanceled!: null;

    refresh(params: any): boolean {
        return true;
    }

    agInit(params: any): void {
        this.params = params;

        if (params.data) {
            if (params.data.isCanceled != null) {
                this.isCanceled = params.data.isCanceled;
            }
        }
    }
}