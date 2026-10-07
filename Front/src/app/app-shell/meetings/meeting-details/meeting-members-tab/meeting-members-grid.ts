import { MemberActionsCellComponent } from './member-actions-cell.component';
import { MemberPhotoCellComponent } from './member-photo-cell.component';
import { MemberPresenceCellComponent } from './member-presence-cell.component';
import { MemberListItem, MembersGridHandlers } from './meeting-members.models';

// ═══════════════════════════════════════════════════════════════
// Cell Renderers (HTML string)
// ═══════════════════════════════════════════════════════════════

export function nameCellRenderer(params: any): string {
  const data = params.data;
  if (!data) return '';

  let html = `<div class="member-name-cell">`;
  html += `<span class="member-name">${data.name}</span>`;

  if (data.isExternal) {
    html += `<span class="badge bg-info ms-2">مهمان</span>`;
  }

  if (data.replacementUserGuid) {
    html += `<i class="fas fa-user-friends ms-2 text-warning" title="دارای جانشین"></i>`;
  }

  html += `</div>`;
  return html;
}

export function roleCellRenderer(params: any): string {
  const data = params.data;
  if (!data) return '';

  const color = data.roleColor || '#6c757d';
  return `<span class="role-badge" style="color: ${color};">${data.role || ''}</span>`;
}

export function attendanceCellRenderer(params: any): string {
  const value = params.value;
  if (value === true) {
    return `<i class="fas fa-check-circle text-success fs-5" title="اعلام حضور کرده"></i>`;
  } else if (value === false) {
    return `<i class="fas fa-times-circle text-danger fs-5" title="اعلام عدم حضور کرده"></i>`;
  }
  return `<i class="fas fa-question-circle text-muted fs-5" title="اعلام نکرده"></i>`;
}

export function signCellRenderer(params: any): string {
  const value = params.value;
  if (value === true) {
    return `<i class="fas fa-signature text-success fs-5" title="امضا کرده"></i>`;
  }
  return `<i class="fas fa-signature text-muted fs-5" title="امضا نکرده"></i>`;
}

// ═══════════════════════════════════════════════════════════════
// Column Definitions
// ═══════════════════════════════════════════════════════════════

export function buildMembersColumnDefs(handlers: MembersGridHandlers): any[] {
  return [
    {
      field: 'actions',
      headerName: 'عملیات',
      filter: false,
      sortable: false,
      width: 180,
      minWidth: 180,
      maxWidth: 200,
      pinned: 'right',
      cellRenderer: MemberActionsCellComponent,
      cellRendererParams: {
        onDelete: (member: MemberListItem) => handlers.onDelete(member),
        onSubstitute: (member: MemberListItem) => handlers.onSubstitute(member),
        onSign: (member: MemberListItem) => handlers.onSign(member),
        canSign: (member: MemberListItem) => handlers.canSign(member),
        onRemoveSubstitute: (member: MemberListItem) => handlers.onRemoveSubstitute(member)
      },
      cellStyle: { textAlign: 'center', overflow: 'visible' }
    },
    {
      field: 'image',
      headerName: '',
      filter: false,
      sortable: false,
      width: 60,
      minWidth: 60,
      maxWidth: 60,
      cellRenderer: MemberPhotoCellComponent,
      cellStyle: { padding: '4px' }
    },
    {
      field: 'name',
      headerName: 'نام',
      filter: 'agTextColumnFilter',
      minWidth: 150,
      flex: 1,
      cellRenderer: (params: any) => nameCellRenderer(params),
      cellStyle: { fontFamily: 'Sahel' }
    },
    {
      field: 'role',
      headerName: 'نقش',
      filter: 'agSetColumnFilter',
      width: 120,
      cellRenderer: (params: any) => roleCellRenderer(params),
      cellStyle: { textAlign: 'center' }
    },
    // {
    //   field: 'position',
    //   headerName: 'سمت',
    //   filter: 'agTextColumnFilter',
    //   minWidth: 150,
    //   flex: 1,
    //   cellStyle: { fontFamily: 'Sahel' }
    // },
    {
      field: 'isAttendance',
      headerName: 'اعلام حضور',
      filter: 'agSetColumnFilter',
      width: 120,
      cellRenderer: (params: any) => attendanceCellRenderer(params),
      cellStyle: { textAlign: 'center' }
    },
    {
      field: 'isPresent',
      headerName: 'حضور',
      filter: 'agSetColumnFilter',
      width: 140,
      cellRenderer: MemberPresenceCellComponent,
      cellRendererParams: {
        onPresenceChange: (member: MemberListItem, isPresent: boolean) =>
          handlers.onPresenceChange(member, isPresent)
      },
      cellStyle: { textAlign: 'center', overflow: 'visible' }
    },
    {
      field: 'isSign',
      headerName: 'امضا',
      filter: 'agSetColumnFilter',
      width: 80,
      cellRenderer: (params: any) => signCellRenderer(params),
      cellStyle: { textAlign: 'center' }
    },
    {
      field: 'replacementName',
      headerName: 'جانشین',
      filter: 'agTextColumnFilter',
      width: 150,
      cellStyle: { fontFamily: 'Sahel' },
      valueGetter: (params: any) => params.data?.replacementName || '-'
    },
    {
      field: 'comment',
      headerName: 'نظر',
      filter: 'agTextColumnFilter',
      minWidth: 200,
      flex: 1,
      cellStyle: { fontFamily: 'Sahel' }
    }
  ];
}

/** اعمال ستون‌ها، کلاس‌های ردیف و صفحه‌بندی روی gridOptions */
export function configureMembersGrid(options: any, handlers: MembersGridHandlers): void {
  options.columnDefs = buildMembersColumnDefs(handlers);

  options.rowClassRules = {
    'member-row-external': (params: any) => params.data?.isExternal,
    'member-row-signed': (params: any) => params.data?.isSign,
    'member-row-absent': (params: any) => params.data?.isPresent === false,
    'member-row-has-substitute': (params: any) => !!params.data?.replacementUserGuid
  };

  options.pagination = true;
  options.paginationPageSize = 20;
  options.getRowId = (params: any) => params.data.id.toString();
}
