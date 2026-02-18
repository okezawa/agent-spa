import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CreateEmployeePayload,
  EmployeeService
} from '../services/employee.service';

@Component({
  selector: 'app-employee-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './employee-register.component.html',
  styleUrl: './employee-register.component.scss'
})
export class EmployeeRegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  imagePreview = '';
  showPassword = false;
  showConfirmPassword = false;
  readonly positionOptions = [
    'Therapist',
    'sale',
    'reception',
    'nurse',
    'admin',
    'ceo'
  ];

  employeeForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    branch: ['', Validators.required],
    position: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    profileImage: ['']
  });

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  get isPasswordMismatch(): boolean {
    const password = this.employeeForm.get('password')?.value ?? '';
    const confirmPassword = this.employeeForm.get('confirmPassword')?.value ?? '';
    return !!password && !!confirmPassword && password !== confirmPassword;
  }

  onImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.imagePreview = '';
      this.employeeForm.patchValue({ profileImage: '' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      this.imagePreview = result;
      this.employeeForm.patchValue({ profileImage: result });
    };
    reader.readAsDataURL(file);
  }

  submit(): void {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      this.errorMessage = 'กรุณากรอกข้อมูลให้ครบถ้วน (Password อย่างน้อย 8 ตัวอักษร)';
      return;
    }

    const { password, confirmPassword } = this.employeeForm.getRawValue();
    if (password !== confirmPassword) {
      this.errorMessage = 'Password and Confirm Password do not match.';
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';

    const payload = this.employeeForm.getRawValue() as CreateEmployeePayload;
    this.employeeService.createEmployee(payload).subscribe({
      next: () => {
        this.successMessage = 'Employee registered successfully.';
        this.employeeForm.reset();
        this.imagePreview = '';
        this.isSubmitting = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to register employee.';
        this.isSubmitting = false;
      }
    });
  }
}
