import { Routes } from '@angular/router';
import { CategoryComponent } from './category/category';
import { RoomComponent } from './room/room';
import { MeetingListComponent } from './meeting-list/meeting-list';
import { MeetingOpsComponent } from './meeting-ops/meeting-ops';
import { MeetingDetailsComponent } from './meeting-details/meeting-details';
import { SettingComponent } from '../../shared/setting-component/setting';
import { RoleComponent } from './role/role';
import { MeetingStatusComponent } from './meeting-status/meeting-status';
import { CategoryPermissionComponent } from './category/category-permission/category-permission';
import { LabelComponent } from './label/label';
import { permissionGuard } from '../../core/guards/permission.guard';

export const meetingsRoutes: Routes = [
  { path: 'category', component: CategoryComponent, canActivate: [permissionGuard('MT_Categories')] },
  { path: 'categoryPermission', component: CategoryPermissionComponent, canActivate: [permissionGuard('MT_Categories')] },
  { path: 'label', component: LabelComponent, canActivate: [permissionGuard('MT_ResolutionLabels')] },
  { path: 'status', component: MeetingStatusComponent, canActivate: [permissionGuard('MT_Statuses')] },
  { path: 'role', component: RoleComponent, canActivate: [permissionGuard('MT_UserRoles')] },
  { path: 'room', component: RoomComponent, canActivate: [permissionGuard('MT_Locations')] },
  { path: 'setting', component: SettingComponent, canActivate: [permissionGuard('MT_Settings')] },
  { path: 'list', component: MeetingListComponent },
  { path: 'clone/:guid', component: MeetingOpsComponent },
  { path: 'create', component: MeetingOpsComponent },
  { path: 'details/:guid', component: MeetingDetailsComponent },
];
