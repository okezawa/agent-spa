import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { EmployeeService } from '../services/employee.service';

export const guestGuard: CanActivateFn = () => {
  const employeeService = inject(EmployeeService);
  const router = inject(Router);

  return employeeService.getAuthStatus().pipe(
    map((response) => (response.authenticated ? router.createUrlTree(['/employees/approve']) : true)),
    catchError(() => of(true))
  );
};
