import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Employee, EmployeeService } from '../services/employee.service';

@Component({
  selector: 'app-employee-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './employee-login.component.html',
  styleUrl: './employee-login.component.scss'
})
export class EmployeeLoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);

  showPassword = false;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';
  loggedInEmployee: Employee | null = null;

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  ngOnInit(): void {
    this.checkCurrentSession();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  checkCurrentSession(): void {
    this.employeeService.getCurrentEmployee().subscribe({
      next: (response) => {
        this.loggedInEmployee = response.employee;
        this.successMessage = 'already logged in';
      },
      error: () => {
        this.loggedInEmployee = null;
      }
    });
  }

  submit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'Please enter valid email and password.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.loggedInEmployee = null;

    const payload = this.loginForm.getRawValue() as { email: string; password: string };
    this.employeeService.loginEmployee(payload).subscribe({
      next: (response) => {
        this.successMessage = response.message;
        this.loggedInEmployee = response.employee;
        this.isSubmitting = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Login failed.';
        this.isSubmitting = false;
      }
    });
  }

  logout(): void {
    this.employeeService.logoutEmployee().subscribe({
      next: (response) => {
        this.successMessage = response.message;
        this.errorMessage = '';
        this.loggedInEmployee = null;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Logout failed.';
      }
    });
  }
}
