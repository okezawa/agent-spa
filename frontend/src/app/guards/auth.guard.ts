import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { EmployeeService } from '../services/employee.service';

export const authGuard: CanActivateFn = () => {
  const employeeService = inject(EmployeeService);
  const router = inject(Router);

  return employeeService.getAuthStatus().pipe(
    map((response) => (response.authenticated ? true : router.createUrlTree(['/login']))),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};
