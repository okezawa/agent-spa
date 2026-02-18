import { Routes } from '@angular/router';
import { EmployeeRegisterComponent } from './employee-register/employee-register.component';
import { EmployeeApproveComponent } from './employee-approve/employee-approve.component';
import { EmployeeLoginComponent } from './employee-login/employee-login.component';

export const routes: Routes = [
  { path: '', component: EmployeeRegisterComponent },
  { path: 'login', component: EmployeeLoginComponent },
  { path: 'employees/approve', component: EmployeeApproveComponent },
];
