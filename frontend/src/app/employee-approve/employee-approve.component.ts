import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Employee, EmployeeService } from '../services/employee.service';

@Component({
  selector: 'app-employee-approve',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './employee-approve.component.html',
  styleUrl: './employee-approve.component.scss'
})
export class EmployeeApproveComponent {
  private readonly employeeService = inject(EmployeeService);

  employees: Employee[] = [];
  loading = false;
  message = '';
  errorMessage = '';

  ngOnInit(): void {
    this.loadPendingEmployees();
  }

  loadPendingEmployees(): void {
    this.loading = true;
    this.message = '';
    this.errorMessage = '';

    this.employeeService.getPendingEmployees().subscribe({
      next: (employees) => {
        this.employees = employees;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load pending employees.';
        this.loading = false;
      }
    });
  }

  approve(employeeId: number): void {
    this.message = '';
    this.errorMessage = '';

    this.employeeService.approveEmployee(employeeId).subscribe({
      next: () => {
        this.message = 'Employee approved successfully.';
        this.employees = this.employees.filter((employee) => employee.id !== employeeId);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to approve employee.';
      }
    });
  }
}
