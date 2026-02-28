import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

const ALL_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager', 'maintenance_engineer', 'technician', 'data_scientist', 'quality_inspector', 'viewer'];
const OPS_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager', 'maintenance_engineer', 'technician', 'quality_inspector', 'viewer'];
const MAINT_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager', 'maintenance_engineer', 'technician'];
const WO_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager', 'maintenance_engineer', 'technician', 'quality_inspector'];
const REPORT_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager', 'data_scientist', 'quality_inspector', 'viewer'];
const AI_ROLES = ['super_admin', 'data_scientist'];
const ADMIN_ROLES = ['super_admin'];

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./modules/auth/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./modules/dashboard/dashboard.component').then(m => m.DashboardComponent), data: { roles: ALL_ROLES } },
      { path: 'equipment', loadComponent: () => import('./modules/equipment/equipment.component').then(m => m.EquipmentComponent), canActivate: [RoleGuard], data: { roles: OPS_ROLES } },
      { path: 'equipment/:id', loadComponent: () => import('./modules/equipment/equipment-detail.component').then(m => m.EquipmentDetailComponent), canActivate: [RoleGuard], data: { roles: OPS_ROLES } },
      { path: 'sensors', loadComponent: () => import('./modules/sensors/sensors.component').then(m => m.SensorsComponent), data: { roles: ALL_ROLES } },
      { path: 'alerts', loadComponent: () => import('./modules/alerts/alerts.component').then(m => m.AlertsComponent), canActivate: [RoleGuard], data: { roles: OPS_ROLES } },
      { path: 'alerts/:id', loadComponent: () => import('./modules/alerts/alert-detail.component').then(m => m.AlertDetailComponent), canActivate: [RoleGuard], data: { roles: OPS_ROLES } },
      { path: 'maintenance', loadComponent: () => import('./modules/maintenance/maintenance.component').then(m => m.MaintenanceComponent), canActivate: [RoleGuard], data: { roles: MAINT_ROLES } },
      { path: 'work-orders', loadComponent: () => import('./modules/work-orders/work-orders.component').then(m => m.WorkOrdersComponent), canActivate: [RoleGuard], data: { roles: WO_ROLES } },
      { path: 'work-orders/:id', loadComponent: () => import('./modules/work-orders/work-order-detail.component').then(m => m.WorkOrderDetailComponent), canActivate: [RoleGuard], data: { roles: WO_ROLES } },
      { path: 'spare-parts', loadComponent: () => import('./modules/spare-parts/spare-parts.component').then(m => m.SparePartsComponent), canActivate: [RoleGuard], data: { roles: MAINT_ROLES } },
      { path: 'ai-models', loadComponent: () => import('./modules/ai-models/ai-models.component').then(m => m.AIModelsComponent), canActivate: [RoleGuard], data: { roles: AI_ROLES } },
      { path: 'reports', loadComponent: () => import('./modules/reports/reports.component').then(m => m.ReportsComponent), canActivate: [RoleGuard], data: { roles: REPORT_ROLES } },
      { path: 'users', loadComponent: () => import('./modules/users/users.component').then(m => m.UsersComponent), canActivate: [RoleGuard], data: { roles: ADMIN_ROLES } },
      { path: 'settings', loadComponent: () => import('./modules/settings/settings.component').then(m => m.SettingsComponent), canActivate: [RoleGuard], data: { roles: ADMIN_ROLES } },
      { path: 'profile', loadComponent: () => import('./modules/profile/profile.component').then(m => m.ProfileComponent), data: { roles: ALL_ROLES } },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
