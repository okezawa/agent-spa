import { Routes } from '@angular/router';
import { EmployeeRegisterComponent } from './employee-register/employee-register.component';
import { EmployeeApproveComponent } from './employee-approve/employee-approve.component';
import { EmployeeLoginComponent } from './employee-login/employee-login.component';
import { BranchManageComponent } from './branch-manage/branch-manage.component';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: EmployeeLoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: EmployeeRegisterComponent, canActivate: [guestGuard] },
  { path: 'branches', component: BranchManageComponent, canActivate: [authGuard] },
  { path: 'employees/approve', component: EmployeeApproveComponent, canActivate: [authGuard] },
];
