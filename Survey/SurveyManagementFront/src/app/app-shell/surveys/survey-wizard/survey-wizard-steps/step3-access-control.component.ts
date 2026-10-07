import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, Subject } from 'rxjs';

import { UserService } from '../../../../services/user.service';
import { ToastService } from '../../../../services/framework-services/toast.service';
import {
  WizardAccessItem,
  WizardTargetType,
  createDefaultAccessItem,
} from '../../../../core/models/survey-wizard.model';
import UnitService from '../../../../services/unit.service';

interface UserItem {
  guid: string;
  name: string;
  position?: string;
  unit?: string;
  positions?: { positionGuid: string; positionTitle: string }[];
}

interface UnitItem {
  guid: string;
  title: string;
}

type TableFilter = 'all' | 'direct' | 'viaUnit';

@Component({
  selector: 'app-survey-wizard-step3-access',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="accessContainer">

      <!-- Header -->
      <div class="card pad-lg">
        <div class="headerRow">
          <div>
            <h3>مدیریت دسترسی‌ها</h3>
            <p class="help">مشخص کنید چه افرادی به این نظرسنجی دسترسی داشته باشند</p>
          </div>
          @if (accessItems().length > 0) {
            <div class="stats">
              <div class="stat">
                <i class="fa fa-users"></i>
                <span>{{ accessItems().length }} نفر</span>
              </div>
              <div class="stat">
                <i class="fa fa-building"></i>
                <span>{{ unitCount() }} واحد</span>
              </div>
            </div>
          }
        </div>

        <div class="sp-12"></div>

        <!-- ✅ اقدامات سریع -->
        <div class="quickActions">
          <button type="button" class="btn sm outline primary" (click)="addAllUsers()">
            <i class="fa fa-user-check"></i>
            افزودن همه کاربران سازمان
            @if (allUsers().length > 0) {
              <span class="quickActions__count">{{ allUsers().length }}</span>
            }
          </button>
          <button type="button" class="btn sm outline warning" (click)="addAllUnits()">
            <i class="fa fa-sitemap"></i>
            افزودن همه واحدها (همه کارکنان)
            @if (allUnits().length > 0) {
              <span class="quickActions__count">{{ allUnits().length }}</span>
            }
          </button>
        </div>
      </div>

      <div class="sp-16"></div>

      <!-- ============ بخش افزودن ============ -->
      <div class="card pad-lg">
        <div class="tabs">
          <button type="button" class="tab"
            [class.active]="activeTab() === 'user'"
            (click)="activeTab.set('user')">
            <i class="fa fa-user"></i> افزودن فرد
          </button>
          <button type="button" class="tab"
            [class.active]="activeTab() === 'unit'"
            (click)="activeTab.set('unit')">
            <i class="fa fa-building"></i> افزودن واحد سازمانی
          </button>
        </div>

        <div class="sp-16"></div>

        <!-- Tab: User -->
        @if (activeTab() === 'user') {
          <div class="searchBox">
            <i class="fa fa-search searchBox__icon"></i>
            <input type="search" class="in" placeholder="جستجوی نام کاربر..."
              [ngModel]="userSearchTerm()" (ngModelChange)="onUserSearchChange($event)">
            @if (isLoadingUsers()) {
              <i class="fa fa-spinner fa-spin searchBox__spinner"></i>
            }
          </div>

          @if (filteredUsers().length > 0) {

            <!-- ✅ نوار انتخاب دسته‌جمعی نتایج جستجو -->
            <div class="resultsListHeader">
              <label class="selectAllCheck">
                <input type="checkbox" [checked]="allFilteredSelected()"
                  (change)="toggleSelectAllFiltered()">
                <span class="selectAllCheck__box"></span>
                <span>انتخاب همه نتایج ({{ filteredUsers().length }})</span>
              </label>
              @if (selectedUserGuids().size > 0) {
                <div class="resultsListHeader__actions">
                  <span class="selectedCount">{{ selectedUserGuids().size }} نفر انتخاب شده</span>
                  <button type="button" class="btn xs ghost" (click)="clearUserSelection()">
                    انصراف
                  </button>
                  <button type="button" class="btn sm primary" (click)="addSelectedUsers()">
                    <i class="fa fa-plus"></i> افزودن انتخاب‌شده‌ها
                  </button>
                </div>
              }
            </div>

            <div class="resultsList">
              @for (user of filteredUsers(); track user.guid) {
                <div class="resultItem" [class.disabled]="isUserAlreadyAdded(user.guid)">
                  <div class="resultItem__check" (click)="$event.stopPropagation()">
                    <label class="miniCheck">
                      <input type="checkbox" [checked]="isUserSelected(user.guid)"
                        [disabled]="isUserAlreadyAdded(user.guid)"
                        (change)="toggleUserSelection(user.guid)">
                      <span class="miniCheck__box"></span>
                    </label>
                  </div>
                  <div class="resultItem__body" (click)="addUser(user)">
                    <div class="resultItem__avatar"><i class="fa fa-user"></i></div>
                    <div class="resultItem__info">
                      <div class="resultItem__name">{{ user.name }}</div>
                      @if (getPositionTitle(user)) {
                        <div class="resultItem__meta">{{ getPositionTitle(user) }}</div>
                      }
                    </div>
                    @if (isUserAlreadyAdded(user.guid)) {
                      <span class="badge added">اضافه شده</span>
                    } @else {
                      <button type="button" class="btn sm primary" (click)="addUser(user); $event.stopPropagation()">
                        <i class="fa fa-plus"></i>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          } @else if (userSearchTerm().length >= 2 && !isLoadingUsers()) {
            <div class="noResults"><i class="fa fa-search"></i><span>کاربری یافت نشد</span></div>
          }
        }

        <!-- Tab: Unit -->
        @if (activeTab() === 'unit') {
          <div class="searchBox">
            <i class="fa fa-search searchBox__icon"></i>
            <input type="search" class="in" placeholder="جستجوی واحد سازمانی..."
              [ngModel]="unitSearchTerm()" (ngModelChange)="onUnitSearchChange($event)">
            @if (isLoadingUnits()) {
              <i class="fa fa-spinner fa-spin searchBox__spinner"></i>
            }
          </div>
          @if (filteredUnits().length > 0) {
            <div class="resultsList">
              @for (unit of filteredUnits(); track unit.guid) {
                <div class="resultItem" (click)="addUnit(unit)">
                  <div class="resultItem__avatar unit"><i class="fa fa-building"></i></div>
                  <div class="resultItem__info">
                    <div class="resultItem__name">{{ unit.title }}</div>
                    <div class="resultItem__meta">واحد سازمانی</div>
                  </div>
                  @if (isLoadingUnitMembers() && loadingUnitGuid() === unit.guid) {
                    <i class="fa fa-spinner fa-spin"></i>
                  } @else {
                    <button type="button" class="btn sm primary">
                      <i class="fa fa-users"></i> افزودن اعضا
                    </button>
                  }
                </div>
              }
            </div>
          } @else if (unitSearchTerm().length >= 2 && !isLoadingUnits()) {
            <div class="noResults"><i class="fa fa-search"></i><span>واحدی یافت نشد</span></div>
          }
        }
      </div>

      <div class="sp-16"></div>

      <!-- ============ جدول دسترسی‌ها ============ -->
      @if (accessItems().length === 0) {
        <div class="emptyState">
          <div class="emptyState__icon"><i class="fa fa-shield-alt"></i></div>
          <h3>هنوز دسترسی‌ای تعریف نشده!</h3>
          <p>از بخش بالا افراد یا واحدهای مورد نظر را اضافه کنید، یا با یک کلیک همه کاربران سازمان را اضافه کنید</p>
          <button type="button" class="btn primary" (click)="addAllUsers()">
            <i class="fa fa-user-check"></i> افزودن همه کاربران سازمان
          </button>
        </div>
      } @else {
        <div class="card pad-lg">

          <!-- ✅ Toolbar -->
          <div class="tableToolbar">
            <div class="tableToolbar__right">
              <h4>لیست دسترسی‌ها</h4>
              <span class="countBadge">{{ tableFilteredItems().length }} نفر</span>
            </div>
            <div class="tableActions">
              <button type="button" class="btn sm icon" (click)="selectAllPermission('canView')" title="تغییر مشاهده همه">
                <i class="fa fa-eye"></i>
              </button>
              <button type="button" class="btn sm icon" (click)="selectAllPermission('canRespond')" title="تغییر پاسخ همه">
                <i class="fa fa-pen"></i>
              </button>
              <button type="button" class="btn sm icon danger" (click)="removeAll()" title="حذف همه">
                <i class="fa fa-trash"></i>
              </button>
            </div>
          </div>

          <div class="sp-12"></div>

          <!-- ✅ جستجو + فیلتر -->
          <div class="tableControls">
            <div class="tableSearch">
              <i class="fa fa-search tableSearch__icon"></i>
              <input type="search" class="in"
                placeholder="جستجو در لیست (نام، سمت، واحد)..."
                [ngModel]="tableSearchTerm()"
                (ngModelChange)="onTableSearchChange($event)">
            </div>
            <div class="tableFilters">
              <button type="button" class="filterChip" [class.active]="tableFilter() === 'all'"
                (click)="setTableFilter('all')">
                همه <span class="filterChip__count">{{ accessItems().length }}</span>
              </button>
              <button type="button" class="filterChip" [class.active]="tableFilter() === 'direct'"
                (click)="setTableFilter('direct')">
                <i class="fa fa-user"></i> مستقیم
                <span class="filterChip__count">{{ directCount() }}</span>
              </button>
              <button type="button" class="filterChip" [class.active]="tableFilter() === 'viaUnit'"
                (click)="setTableFilter('viaUnit')">
                <i class="fa fa-building"></i> از واحد
                <span class="filterChip__count">{{ viaUnitCount() }}</span>
              </button>
            </div>
          </div>

          <div class="sp-12"></div>

          @if (tableFilteredItems().length === 0) {
            <div class="noTableResults">
              <i class="fa fa-search"></i>
              <span>نتیجه‌ای یافت نشد</span>
            </div>
          } @else {
            <div class="accessTable">
              <div class="accessTable__head">
                <div class="col-name">کاربر</div>
                <div class="col-perm">مشاهده</div>
                <div class="col-perm">پاسخ</div>
                <div class="col-perm">نتایج</div>
                <div class="col-perm">ویرایش</div>
                <div class="col-perm">حذف</div>
                <div class="col-action">عملیات</div>
              </div>

              @for (item of paginatedItems(); track item.tempId) {
                <div class="accessTable__row" [class.viaUnit]="item.addedViaUnit">
                  <div class="col-name">
                    <div class="userCell">
                      <div class="userCell__avatar" [class.unit]="item.addedViaUnit">
                        <i class="fa" [class.fa-user]="!item.addedViaUnit" [class.fa-users]="item.addedViaUnit"></i>
                      </div>
                      <div class="userCell__info">
                        <div class="userCell__name">{{ item.targetName }}</div>
                        @if (item.targetPosition) {
                          <div class="userCell__meta">{{ item.targetPosition }}</div>
                        }
                        @if (item.addedViaUnit && item.sourceUnitName) {
                          <div class="userCell__unit">
                            <i class="fa fa-building"></i> {{ item.sourceUnitName }}
                          </div>
                        }
                      </div>
                    </div>
                  </div>

                  <div class="col-perm">
                    <label class="permCheck">
                      <input type="checkbox" [checked]="item.canView" (change)="togglePermission(item.tempId, 'canView')">
                      <span class="permCheck__box"></span>
                    </label>
                  </div>
                  <div class="col-perm">
                    <label class="permCheck">
                      <input type="checkbox" [checked]="item.canRespond" (change)="togglePermission(item.tempId, 'canRespond')">
                      <span class="permCheck__box"></span>
                    </label>
                  </div>
                  <div class="col-perm">
                    <label class="permCheck">
                      <input type="checkbox" [checked]="item.canViewResults" (change)="togglePermission(item.tempId, 'canViewResults')">
                      <span class="permCheck__box"></span>
                    </label>
                  </div>
                  <div class="col-perm">
                    <label class="permCheck">
                      <input type="checkbox" [checked]="item.canEdit" (change)="togglePermission(item.tempId, 'canEdit')">
                      <span class="permCheck__box"></span>
                    </label>
                  </div>
                  <div class="col-perm">
                    <label class="permCheck">
                      <input type="checkbox" [checked]="item.canDelete" (change)="togglePermission(item.tempId, 'canDelete')">
                      <span class="permCheck__box"></span>
                    </label>
                  </div>

                  <div class="col-action">
                    <button type="button" class="btn xs danger" (click)="removeAccess(item.tempId)" title="حذف">
                      <i class="fa fa-trash"></i>
                    </button>
                  </div>
                </div>
              }
            </div>

            <!-- ✅ Pagination -->
            @if (totalPages() > 1) {
              <div class="pagination">
                <div class="pagination__info">
                  نمایش {{ paginationStart() }}–{{ paginationEnd() }} از {{ tableFilteredItems().length }}
                </div>

                <div class="pagination__controls">
                  <button type="button" class="pageBtn" [disabled]="currentPage() === 1"
                    (click)="goToPage(1)" title="صفحه اول">
                    <i class="fa fa-angle-double-right"></i>
                  </button>
                  <button type="button" class="pageBtn" [disabled]="currentPage() === 1"
                    (click)="goToPage(currentPage() - 1)" title="صفحه قبل">
                    <i class="fa fa-angle-right"></i>
                  </button>

                  @for (page of visiblePages(); track $index) {
                    @if (page === -1) {
                      <span class="pageDots">…</span>
                    } @else {
                      <button type="button" class="pageBtn" [class.active]="page === currentPage()"
                        (click)="goToPage(page)">{{ page }}</button>
                    }
                  }

                  <button type="button" class="pageBtn" [disabled]="currentPage() === totalPages()"
                    (click)="goToPage(currentPage() + 1)" title="صفحه بعد">
                    <i class="fa fa-angle-left"></i>
                  </button>
                  <button type="button" class="pageBtn" [disabled]="currentPage() === totalPages()"
                    (click)="goToPage(totalPages())" title="صفحه آخر">
                    <i class="fa fa-angle-double-left"></i>
                  </button>
                </div>

                <div class="pagination__size">
                  <select class="pageSizeSelect" [ngModel]="pageSize()" (ngModelChange)="onPageSizeChange($event)">
                    <option [value]="10">10</option>
                    <option [value]="20">20</option>
                    <option [value]="50">50</option>
                    <option [value]="100">100</option>
                  </select>
                  <span>در صفحه</span>
                </div>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .accessContainer { max-width: 1100px; margin: 0 auto; }

    .headerRow { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .headerRow h3 { margin: 0 0 8px 0; font-weight: 950; font-size: 1.5rem; }
    .headerRow .help { margin: 0; color: var(--muted); font-size: 0.95rem; }
    .stats { display: flex; gap: 24px; }
    .stat { display: flex; align-items: center; gap: 8px; font-weight: 800; color: var(--ink); }
    .stat i { color: var(--primary); font-size: 1.2rem; }

    /* ✅ Quick Actions */
    .quickActions { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn.outline {
      background: white; border: 2px solid var(--line); color: var(--ink);
    }
    .btn.outline.primary { border-color: var(--primary); color: var(--primary); }
    .btn.outline.primary:hover { background: rgba(29,78,216,0.06); }
    .btn.outline.warning { border-color: #d97706; color: #d97706; }
    .btn.outline.warning:hover { background: rgba(217,119,6,0.06); }
    .quickActions__count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 20px; padding: 0 6px; margin-right: 4px;
      border-radius: 999px; font-size: 0.72rem; font-weight: 900;
      background: rgba(0,0,0,0.08);
    }

    /* Tabs */
    .tabs { display: flex; gap: 8px; border-bottom: 2px solid var(--line); }
    .tab {
      display: flex; align-items: center; gap: 8px; padding: 12px 24px;
      border: none; background: none; font-weight: 800; font-size: 1rem;
      color: var(--muted); cursor: pointer; border-bottom: 3px solid transparent;
      margin-bottom: -2px; transition: all 0.2s; font-family: inherit;
    }
    .tab:hover { color: var(--ink); }
    .tab.active { color: var(--primary); border-bottom-color: var(--primary); }

    /* Search */
    .searchBox { position: relative; margin-top: 8px; }
    .searchBox .in {
      width: 100%; padding: 12px 16px 12px 44px; border: 2px solid var(--line);
      border-radius: 14px; font-size: 1rem; outline: none; transition: all 0.15s;
      font-family: inherit; background: white; color: var(--ink);
    }
    .searchBox .in:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(29,78,216,0.1); }
    .searchBox__icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); }
    .searchBox__spinner { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--primary); }

    /* ✅ Results list header (bulk select bar) */
    .resultsListHeader {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 10px; margin-top: 14px; padding: 10px 14px;
      background: rgba(29,78,216,0.04); border: 2px solid rgba(29,78,216,0.12);
      border-radius: 12px;
    }
    .selectAllCheck { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 800; color: var(--ink); }
    .selectAllCheck input { display: none; }
    .selectAllCheck__box {
      width: 20px; height: 20px; border: 2px solid var(--line); border-radius: 6px;
      display: inline-flex; align-items: center; justify-content: center;
      background: white; transition: all 0.2s; flex-shrink: 0;
    }
    .selectAllCheck__box::after {
      content: '\\f00c'; font-family: 'Font Awesome 6 Free', 'Font Awesome 5 Free';
      font-weight: 900; font-size: 0.7rem; color: transparent; transition: color 0.2s;
    }
    .selectAllCheck input:checked + .selectAllCheck__box {
      background: linear-gradient(135deg, var(--primary), #3b82f6); border-color: var(--primary);
    }
    .selectAllCheck input:checked + .selectAllCheck__box::after { color: white; }

    .resultsListHeader__actions { display: flex; align-items: center; gap: 10px; }
    .selectedCount { font-size: 0.82rem; font-weight: 800; color: var(--primary); white-space: nowrap; }

    /* Results */
    .resultsList { max-height: 320px; overflow-y: auto; margin-top: 10px; border: 2px solid var(--line); border-radius: 14px; }
    .resultItem {
      display: flex; align-items: center; gap: 4px;
      border-bottom: 1px solid var(--line); transition: all 0.15s;
    }
    .resultItem:last-child { border-bottom: none; }
    .resultItem.disabled { opacity: 0.6; }
    .resultItem__check { display: flex; align-items: center; padding: 0 4px 0 12px; }
    .miniCheck { display: flex; cursor: pointer; }
    .miniCheck input { display: none; }
    .miniCheck__box {
      width: 20px; height: 20px; border: 2px solid var(--line); border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; background: white;
    }
    .miniCheck__box::after {
      content: '\\f00c'; font-family: 'Font Awesome 6 Free', 'Font Awesome 5 Free';
      font-weight: 900; font-size: 0.7rem; color: transparent; transition: color 0.2s;
    }
    .miniCheck input:checked + .miniCheck__box {
      background: linear-gradient(135deg, var(--primary), #3b82f6); border-color: var(--primary);
    }
    .miniCheck input:checked + .miniCheck__box::after { color: white; }
    .miniCheck input:disabled + .miniCheck__box { opacity: 0.4; cursor: not-allowed; }

    .resultItem__body {
      flex: 1; display: flex; align-items: center; gap: 14px; padding: 14px 18px 14px 8px;
      cursor: pointer; transition: all 0.15s; border-radius: 8px;
    }
    .resultItem:not(.disabled) .resultItem__body:hover { background: rgba(29,78,216,0.04); }
    .resultItem.disabled .resultItem__body { cursor: not-allowed; pointer-events: none; }
    .resultItem__avatar {
      width: 40px; height: 40px; background: linear-gradient(135deg, var(--primary), #3b82f6);
      color: white; border-radius: 12px; display: flex; align-items: center;
      justify-content: center; font-size: 1.1rem; flex-shrink: 0;
    }
    .resultItem__avatar.unit { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .resultItem__info { flex: 1; min-width: 0; }
    .resultItem__name { font-weight: 800; color: var(--ink); }
    .resultItem__meta { font-size: 0.85rem; color: var(--muted); margin-top: 2px; }
    .badge.added {
      padding: 6px 12px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);
      border-radius: 999px; font-size: 0.8rem; font-weight: 800; color: var(--ok);
    }
    .noResults { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--muted); font-weight: 800; }

    /* Empty State */
    .emptyState { text-align: center; padding: 80px 40px; background: white; border: 2px dashed var(--line); border-radius: 24px; }
    .emptyState__icon { font-size: 5rem; color: var(--muted); margin-bottom: 24px; opacity: 0.5; }
    .emptyState h3 { margin: 0 0 12px 0; font-weight: 950; font-size: 1.5rem; }
    .emptyState p { margin: 0 0 20px 0; color: var(--muted); font-size: 1.05rem; }

    /* ✅ Table Toolbar */
    .tableToolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .tableToolbar__right { display: flex; align-items: center; gap: 12px; }
    .tableToolbar__right h4 { margin: 0; font-weight: 950; font-size: 1.2rem; }
    .countBadge {
      padding: 4px 14px; background: linear-gradient(135deg, var(--primary), #3b82f6);
      color: white; border-radius: 999px; font-size: 0.8rem; font-weight: 900;
    }
    .tableActions { display: flex; gap: 6px; }
    .tableActions .btn.icon {
      width: 36px; height: 36px; padding: 0;
      display: flex; align-items: center; justify-content: center; border-radius: 10px;
    }

    /* ✅ Table Controls */
    .tableControls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .tableSearch { position: relative; flex: 1; min-width: 220px; }
    .tableSearch .in {
      width: 100%; padding: 10px 14px 10px 38px; border: 2px solid var(--line);
      border-radius: 12px; font-size: 0.9rem; outline: none; transition: all 0.15s;
      font-family: inherit; background: rgba(249,250,251,0.6); color: var(--ink);
    }
    .tableSearch .in:focus { border-color: var(--primary); background: white; box-shadow: 0 0 0 3px rgba(29,78,216,0.08); }
    .tableSearch__icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.85rem; }

    .tableFilters { display: flex; gap: 6px; flex-wrap: wrap; }
    .filterChip {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
      border: 2px solid var(--line); border-radius: 999px; background: white;
      font-size: 0.82rem; font-weight: 800; color: var(--muted);
      cursor: pointer; transition: all 0.2s; font-family: inherit; white-space: nowrap;
    }
    .filterChip:hover { border-color: var(--primary); color: var(--primary); }
    .filterChip.active {
      background: linear-gradient(135deg, var(--primary), #3b82f6);
      border-color: var(--primary); color: white;
    }
    .filterChip__count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px;
      font-size: 0.75rem; font-weight: 900; background: rgba(0,0,0,0.08); color: inherit;
    }
    .filterChip.active .filterChip__count { background: rgba(255,255,255,0.25); }

    .noTableResults {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 48px; color: var(--muted); font-weight: 800;
      border: 2px dashed var(--line); border-radius: 16px;
    }

    /* Table */
    .accessTable { border: 2px solid var(--line); border-radius: 16px; overflow: hidden; }
    .accessTable__head {
      display: grid; grid-template-columns: 1fr 70px 70px 70px 70px 70px 60px;
      gap: 4px; padding: 14px 18px; background: rgba(249,250,251,0.9);
      border-bottom: 2px solid var(--line); font-weight: 900; font-size: 0.85rem;
      color: var(--muted); text-align: center;
    }
    .accessTable__head .col-name { text-align: right; }
    .accessTable__row {
      display: grid; grid-template-columns: 1fr 70px 70px 70px 70px 70px 60px;
      gap: 4px; padding: 14px 18px; align-items: center;
      border-bottom: 1px solid var(--line); transition: background 0.15s;
    }
    .accessTable__row:last-child { border-bottom: none; }
    .accessTable__row:hover { background: rgba(29,78,216,0.03); }
    .accessTable__row.viaUnit { background: rgba(245,158,11,0.04); }
    .accessTable__row.viaUnit:hover { background: rgba(245,158,11,0.08); }
    .col-perm { text-align: center; }
    .col-action { text-align: center; }

    .userCell { display: flex; align-items: center; gap: 12px; }
    .userCell__avatar {
      width: 36px; height: 36px; background: linear-gradient(135deg, var(--primary), #3b82f6);
      color: white; border-radius: 10px; display: flex; align-items: center;
      justify-content: center; font-size: 0.9rem; flex-shrink: 0;
    }
    .userCell__avatar.unit { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .userCell__name { font-weight: 800; font-size: 0.95rem; color: var(--ink); }
    .userCell__meta { font-size: 0.8rem; color: var(--muted); }
    .userCell__unit {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 0.75rem; color: #d97706; background: rgba(245,158,11,0.1);
      padding: 2px 8px; border-radius: 6px; margin-top: 2px;
    }

    .permCheck { display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .permCheck input { display: none; }
    .permCheck__box {
      width: 28px; height: 28px; border: 2px solid var(--line); border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; background: white;
    }
    .permCheck__box::after {
      content: '\\f00c'; font-family: 'Font Awesome 6 Free', 'Font Awesome 5 Free';
      font-weight: 900; font-size: 0.8rem; color: transparent; transition: color 0.2s;
    }
    .permCheck input:checked + .permCheck__box {
      background: linear-gradient(135deg, var(--primary), #3b82f6); border-color: var(--primary);
    }
    .permCheck input:checked + .permCheck__box::after { color: white; }
    .permCheck__box:hover { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(29,78,216,0.08); }

    /* ✅ Pagination */
    .pagination {
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 16px; margin-top: 20px; padding-top: 20px;
      border-top: 2px solid var(--line);
    }
    .pagination__info { font-size: 0.85rem; font-weight: 800; color: var(--muted); white-space: nowrap; }
    .pagination__controls { display: flex; align-items: center; gap: 4px; }
    .pageBtn {
      width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--line); border-radius: 10px; background: white;
      color: var(--ink); font-weight: 800; font-size: 0.9rem;
      cursor: pointer; transition: all 0.2s; font-family: inherit;
    }
    .pageBtn:hover:not(:disabled):not(.active) {
      border-color: var(--primary); color: var(--primary); background: rgba(29,78,216,0.04);
    }
    .pageBtn:disabled { opacity: 0.35; cursor: not-allowed; }
    .pageBtn.active {
      background: linear-gradient(135deg, var(--primary), #3b82f6);
      border-color: var(--primary); color: white; box-shadow: 0 2px 8px rgba(29,78,216,0.3);
    }
    .pageDots {
      width: 32px; display: flex; align-items: center; justify-content: center;
      color: var(--muted); font-weight: 900; letter-spacing: 1px;
    }
    .pagination__size { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 800; color: var(--muted); }
    .pageSizeSelect {
      padding: 6px 10px; border: 2px solid var(--line); border-radius: 10px;
      background: white; font-family: inherit; font-weight: 800; font-size: 0.85rem;
      color: var(--ink); cursor: pointer; outline: none;
    }
    .pageSizeSelect:focus { border-color: var(--primary); }

    /* Responsive */
    @media (max-width: 900px) {
      .accessTable__head, .accessTable__row {
        grid-template-columns: 1fr 50px 50px 50px 50px 50px 40px;
        font-size: 0.75rem; padding: 10px 12px;
      }
      .tableControls { flex-direction: column; }
      .tableSearch { min-width: 100%; }
      .pagination { flex-direction: column; align-items: stretch; text-align: center; }
      .pagination__controls { justify-content: center; }
      .pagination__size { justify-content: center; }
      .quickActions { flex-direction: column; }
      .quickActions .btn { width: 100%; justify-content: center; }
      .resultsListHeader { flex-direction: column; align-items: stretch; }
      .resultsListHeader__actions { justify-content: space-between; }
    }
  `],
})
export class SurveyWizardStep3AccessComponent implements OnInit {
  @Input() accessItems = signal<WizardAccessItem[]>([]);
  @Output() accessItemsChange = new EventEmitter<WizardAccessItem[]>();

  private readonly userService = inject(UserService);
  private readonly unitService = inject(UnitService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly activeTab = signal<'user' | 'unit'>('user');
  readonly userSearchTerm = signal('');
  readonly unitSearchTerm = signal('');
  readonly isLoadingUsers = signal(false);
  readonly isLoadingUnits = signal(false);
  readonly isLoadingUnitMembers = signal(false);
  readonly loadingUnitGuid = signal<string | null>(null);

  // ✅ bulk add state
  readonly isAddingAllUsers = signal(false);
  readonly isAddingAllUnits = signal(false);

  // Data
  readonly allUsers = signal<UserItem[]>([]);
  readonly allUnits = signal<UnitItem[]>([]);
  readonly filteredUsers = signal<UserItem[]>([]);
  readonly filteredUnits = signal<UnitItem[]>([]);

  // ✅ انتخاب دسته‌جمعی از نتایج جستجوی کاربر
  readonly selectedUserGuids = signal<Set<string>>(new Set());

  // ✅ Table state
  readonly tableSearchTerm = signal('');
  readonly tableFilter = signal<TableFilter>('all');
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);

  // Search subjects
  private userSearch$ = new Subject<string>();
  private unitSearch$ = new Subject<string>();
  private tableSearch$ = new Subject<string>();

  // ✅ Computed
  readonly directCount = computed(() => this.accessItems().filter(i => !i.addedViaUnit).length);
  readonly viaUnitCount = computed(() => this.accessItems().filter(i => i.addedViaUnit).length);
  readonly unitCount = computed(() => {
    const s = new Set(this.accessItems().filter(i => i.addedViaUnit && i.sourceUnitGuid).map(i => i.sourceUnitGuid));
    return s.size;
  });

  readonly allFilteredSelected = computed(() => {
    const selectable = this.filteredUsers().filter(u => !this.isUserAlreadyAdded(u.guid));
    if (selectable.length === 0) return false;
    const selected = this.selectedUserGuids();
    return selectable.every(u => selected.has(u.guid));
  });

  readonly tableFilteredItems = computed(() => {
    let items = this.accessItems().filter(i => !i.isRemoved); // ✅
    const filter = this.tableFilter();
    if (filter === 'direct') items = items.filter(i => !i.addedViaUnit);
    else if (filter === 'viaUnit') items = items.filter(i => i.addedViaUnit);

    const term = this.tableSearchTerm().toLowerCase().trim();
    if (term.length >= 2) {
      items = items.filter(i =>
        i.targetName?.toLowerCase().includes(term) ||
        i.targetPosition?.toLowerCase().includes(term) ||
        i.sourceUnitName?.toLowerCase().includes(term)
      );
    }
    return items;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.tableFilteredItems().length / this.pageSize())));

  readonly paginatedItems = computed(() => {
    const items = this.tableFilteredItems();
    const start = (this.currentPage() - 1) * this.pageSize();
    return items.slice(start, start + this.pageSize());
  });

  readonly paginationStart = computed(() => Math.min((this.currentPage() - 1) * this.pageSize() + 1, this.tableFilteredItems().length));
  readonly paginationEnd = computed(() => Math.min(this.currentPage() * this.pageSize(), this.tableFilteredItems().length));

  readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    if (total <= 7) { for (let i = 1; i <= total; i++) pages.push(i); return pages; }
    pages.push(1);
    if (current > 3) pages.push(-1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  });

  ngOnInit(): void {
    this.loadInitialData();
    this.setupSearch();
  }

  private loadInitialData(): void {
    this.isLoadingUsers.set(true);
    this.userService.getAll<UserItem[]>()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => { this.allUsers.set(users); this.isLoadingUsers.set(false); },
        error: () => this.isLoadingUsers.set(false),
      });

    this.isLoadingUnits.set(true);
    this.unitService.getForCombo<UnitItem[]>()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (units) => { this.allUnits.set(units); this.isLoadingUnits.set(false); },
        error: () => this.isLoadingUnits.set(false),
      });
  }

  private setupSearch(): void {
    this.userSearch$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        if (term.length < 2) { this.filteredUsers.set([]); return; }
        const lower = term.toLowerCase();
        this.filteredUsers.set(
          this.allUsers().filter(u =>
            u.name?.toLowerCase().includes(lower) ||
            u.position?.toLowerCase().includes(lower) ||
            u.positions?.some(p => p.positionTitle?.toLowerCase().includes(lower))
          ).slice(0, 20)
        );
      });

    this.unitSearch$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        if (term.length < 2) { this.filteredUnits.set([]); return; }
        const lower = term.toLowerCase();
        this.filteredUnits.set(this.allUnits().filter(u => u.title?.toLowerCase().includes(lower)).slice(0, 20));
      });

    this.tableSearch$.pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => { this.tableSearchTerm.set(term); this.currentPage.set(1); });
  }

  onUserSearchChange(term: string): void { this.userSearchTerm.set(term); this.userSearch$.next(term); }
  onUnitSearchChange(term: string): void { this.unitSearchTerm.set(term); this.unitSearch$.next(term); }
  onTableSearchChange(term: string): void { this.tableSearch$.next(term); }

  setTableFilter(filter: TableFilter): void {
    this.tableFilter.set(filter);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) this.currentPage.set(page);
  }

  onPageSizeChange(size: number): void { this.pageSize.set(+size); this.currentPage.set(1); }

  getPositionTitle(user: UserItem): string {
    return user.position || '';
  }

  addUser(user: UserItem): void {
    if (this.isUserAlreadyAdded(user.guid)) return;
    const item = createDefaultAccessItem(
      { guid: user.guid, name: user.name, position: this.getPositionTitle(user), unit: user.unit }
    );
    const updated = [...this.accessItems(), item];
    this.accessItems.set(updated);
    this.accessItemsChange.emit(updated);
  }

  // ==================== ✅ انتخاب دسته‌جمعی از نتایج جستجو ====================

  isUserSelected(guid: string): boolean {
    return this.selectedUserGuids().has(guid);
  }

  toggleUserSelection(guid: string): void {
    const updated = new Set(this.selectedUserGuids());
    if (updated.has(guid)) updated.delete(guid);
    else updated.add(guid);
    this.selectedUserGuids.set(updated);
  }

  toggleSelectAllFiltered(): void {
    const selectable = this.filteredUsers().filter(u => !this.isUserAlreadyAdded(u.guid));
    const updated = new Set(this.selectedUserGuids());
    if (this.allFilteredSelected()) {
      selectable.forEach(u => updated.delete(u.guid));
    } else {
      selectable.forEach(u => updated.add(u.guid));
    }
    this.selectedUserGuids.set(updated);
  }

  clearUserSelection(): void {
    this.selectedUserGuids.set(new Set());
  }

  addSelectedUsers(): void {
    const guids = this.selectedUserGuids();
    if (guids.size === 0) return;

    const usersToAdd = this.allUsers().filter(
      u => guids.has(u.guid) && !this.isUserAlreadyAdded(u.guid)
    );

    if (usersToAdd.length === 0) {
      this.toastService.warning('کاربران انتخاب‌شده قبلاً اضافه شده‌اند');
      this.selectedUserGuids.set(new Set());
      return;
    }

    const newItems = usersToAdd.map(u => createDefaultAccessItem(
      { guid: u.guid, name: u.name, position: this.getPositionTitle(u), unit: u.unit }
    ));
    const updated = [...this.accessItems(), ...newItems];
    this.accessItems.set(updated);
    this.accessItemsChange.emit(updated);
    this.toastService.success(`${usersToAdd.length} کاربر اضافه شد`);
    this.selectedUserGuids.set(new Set());
  }

  // ==================== ✅ افزودن همه کاربران سازمان ====================

  addAllUsers(): void {
    if (this.isAddingAllUsers()) return;

    const notAdded = this.allUsers().filter(u => !this.isUserAlreadyAdded(u.guid));

    if (this.allUsers().length === 0) {
      this.toastService.warning('لیست کاربران هنوز بارگذاری نشده است');
      return;
    }
    if (notAdded.length === 0) {
      this.toastService.warning('همه کاربران قبلاً اضافه شده‌اند');
      return;
    }

    const confirmed = window.confirm(
      `آیا می‌خواهید همه ${notAdded.length} کاربر سازمان را به لیست دسترسی این نظرسنجی اضافه کنید؟`
    );
    if (!confirmed) return;

    this.isAddingAllUsers.set(true);

    const newItems = notAdded.map(u => createDefaultAccessItem(
      { guid: u.guid, name: u.name, position: this.getPositionTitle(u), unit: u.unit }
    ));
    const updated = [...this.accessItems(), ...newItems];
    this.accessItems.set(updated);
    this.accessItemsChange.emit(updated);

    this.toastService.success(`${notAdded.length} کاربر به لیست دسترسی اضافه شد`);
    this.isAddingAllUsers.set(false);
  }

  // ==================== ✅ افزودن همه واحدها (همه کارکنان همه واحدها) ====================

  addAllUnits(): void {
    if (this.isAddingAllUnits()) return;

    const units = this.allUnits();
    if (units.length === 0) {
      this.toastService.warning('لیست واحدها هنوز بارگذاری نشده است');
      return;
    }

    const confirmed = window.confirm(
      `آیا می‌خواهید اعضای همه ${units.length} واحد سازمانی را به لیست دسترسی اضافه کنید؟ این عملیات ممکن است کمی زمان ببرد.`
    );
    if (!confirmed) return;

    this.isAddingAllUnits.set(true);
    this.fetchAndAddUnitsSequentially(units, 0, 0);
  }

  private fetchAndAddUnitsSequentially(units: UnitItem[], index: number, totalAdded: number): void {
    if (index >= units.length) {
      this.isAddingAllUnits.set(false);
      this.toastService.success(`${totalAdded} کاربر از ${units.length} واحد اضافه شد`);
      return;
    }

    const unit = units[index];
    this.userService.getUsersByUnit(unit.guid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => {
          const currentItems = [...this.accessItems()];
          let addedCount = 0;
          for (const member of members) {
            if (!this.isUserAlreadyAdded(member.guid)) {
              currentItems.push(createDefaultAccessItem(
                { guid: member.guid, name: member.name, position: member.position },
                { unitGuid: unit.guid, unitName: unit.title }
              ));
              addedCount++;
            }
          }
          if (addedCount > 0) {
            this.accessItems.set(currentItems);
            this.accessItemsChange.emit(currentItems);
          }
          this.fetchAndAddUnitsSequentially(units, index + 1, totalAdded + addedCount);
        },
        error: () => {
          // اگه یک واحد خطا داد، از بقیه ادامه بده
          this.fetchAndAddUnitsSequentially(units, index + 1, totalAdded);
        },
      });
  }

  // ==================== افزودن واحد تکی ====================

  addUnit(unit: UnitItem): void {
    this.isLoadingUnitMembers.set(true);
    this.loadingUnitGuid.set(unit.guid);

    this.userService.getUsersByUnit(unit.guid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => {
          const currentItems = [...this.accessItems()];
          let addedCount = 0;
          for (const member of members) {
            if (!this.isUserAlreadyAdded(member.guid)) {
              const positionTitle = member.position;
              currentItems.push(createDefaultAccessItem(
                { guid: member.guid, name: member.name, position: positionTitle },
                { unitGuid: unit.guid, unitName: unit.title }
              ));
              addedCount++;
            }
          }
          this.accessItems.set(currentItems);
          this.accessItemsChange.emit(currentItems);
          this.isLoadingUnitMembers.set(false);
          this.loadingUnitGuid.set(null);

          if (addedCount > 0) this.toastService.success(`${addedCount} کاربر از واحد "${unit.title}" اضافه شد`);
          else if (members.length === 0) this.toastService.warning('هیچ کاربری در این واحد یافت نشد');
          else this.toastService.warning('تمام کاربران این واحد قبلاً اضافه شده‌اند');
        },
        error: () => {
          this.toastService.error('خطا در بارگذاری اعضای واحد');
          this.isLoadingUnitMembers.set(false);
          this.loadingUnitGuid.set(null);
        },
      });
  }

  togglePermission(tempId: string, perm: 'canView' | 'canRespond' | 'canViewResults' | 'canEdit' | 'canDelete'): void {
    const updated = this.accessItems().map(item =>
      item.tempId === tempId ? { ...item, [perm]: !item[perm] } : item
    );
    this.accessItems.set(updated);
    this.accessItemsChange.emit(updated);
  }

  selectAllPermission(perm: 'canView' | 'canRespond' | 'canViewResults' | 'canEdit' | 'canDelete'): void {
    const filteredIds = new Set(this.tableFilteredItems().map(i => i.tempId));
    const allChecked = this.tableFilteredItems().every(i => i[perm]);
    const updated = this.accessItems().map(item =>
      filteredIds.has(item.tempId) ? { ...item, [perm]: !allChecked } : item
    );
    this.accessItems.set(updated);
    this.accessItemsChange.emit(updated);
  }

  removeAccess(tempId: string): void {
    const target = this.accessItems().find(i => i.tempId === tempId);
    if (!target) return;

    const updated = target.guid
      ? this.accessItems().map(i => i.tempId === tempId ? { ...i, isRemoved: true } : i)
      : this.accessItems().filter(i => i.tempId !== tempId);

    this.accessItems.set(updated);
    this.accessItemsChange.emit(updated);
    if (this.currentPage() > this.totalPages()) this.currentPage.set(Math.max(1, this.totalPages()));
  }

  removeAll(): void {
    const updated = this.accessItems()
      .filter(i => i.guid) // فقط موارد موجود در دیتابیس نگه داشته می‌شوند تا حذفشان به بک‌اند اطلاع داده شود
      .map(i => ({ ...i, isRemoved: true }));

    this.accessItems.set(updated);
    this.accessItemsChange.emit(updated);
    this.currentPage.set(1);
  }

  isUserAlreadyAdded(guid: string): boolean {
    return this.accessItems().some(i => i.targetGuid === guid && !i.isRemoved); // ✅
  }
}