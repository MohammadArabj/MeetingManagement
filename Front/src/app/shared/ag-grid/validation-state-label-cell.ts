
import { Component } from "@angular/core";
import { ICellRendererAngularComp } from "ag-grid-angular";
declare var $: any;

@Component({
    selector: 'validation-state-cell-renderer',
    imports: [],
    standalone: true,
    template: `
    @if (state == 'عدم تاييد') {
      <span>
        <span class="bg-soft-danger text-danger" style="padding: 3px">عدم تاييد</span>
      </span>
    }
    @if (state == 'تاييد شده') {
      <span>
        <span class="bg-soft-success text-success" style="padding: 3px">تایید شده</span>
      </span>
    }
    @if (state == 'بدون وضعيت') {
      <span>
        <span class="bg-soft-primary text-primary" style="padding: 3px">بدون وضعيت</span>
      </span>
    }`,
})
export class ValidateionStateCellRenderer implements ICellRendererAngularComp {
    params: any;
    state!: null;

    refresh(params: any): boolean {
        return true;
    }

    agInit(params: any): void {
        this.params = params;

        if (params.data) {
            if (params.data.validationState != null) {
                this.state = params.data.validationState;
            }
        }
    }
}