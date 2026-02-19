import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmployeeService, Guest } from '../services/employee.service';

@Component({
  selector: 'app-guest-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './guest-register.component.html',
  styleUrl: './guest-register.component.scss'
})
export class GuestRegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);

  guests: Guest[] = [];
  loading = false;
  saving = false;
  successMessage = '';
  errorMessage = '';

  guestForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    citizenId: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
    dateOfBirth: ['', Validators.required],
    address: [''],
    phone: ['', Validators.required],
    country: ['', Validators.required],
    lineId: [''],
    otherNotes: [''],
  });

  ngOnInit(): void {
    this.loadGuests();
  }

  loadGuests(): void {
    this.loading = true;
    this.employeeService.getGuests().subscribe({
      next: (guests) => {
        this.guests = guests;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load guests.';
        this.loading = false;
      }
    });
  }

  submit(): void {
    if (this.guestForm.invalid) {
      this.guestForm.markAllAsTouched();
      this.errorMessage = 'Please fill all required fields.';
      return;
    }

    const raw = this.guestForm.getRawValue();
    const payload = {
      firstName: String(raw.firstName ?? '').trim(),
      lastName: String(raw.lastName ?? '').trim(),
      citizenId: String(raw.citizenId ?? '').trim(),
      dateOfBirth: String(raw.dateOfBirth ?? '').trim(),
      address: String(raw.address ?? '').trim(),
      phone: String(raw.phone ?? '').trim(),
      country: String(raw.country ?? '').trim(),
      lineId: String(raw.lineId ?? '').trim(),
      otherNotes: String(raw.otherNotes ?? '').trim(),
    };

    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.employeeService.createGuest(payload).subscribe({
      next: (created) => {
        this.successMessage = `Guest "${created.firstName} ${created.lastName}" registered. Member code: ${created.memberCode}`;
        this.guests = [created, ...this.guests];
        this.guestForm.reset();
        this.saving = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to register guest.';
        this.saving = false;
      }
    });
  }

  currentFormAge(): number | null {
    const dateValue = this.guestForm.controls.dateOfBirth.value;
    if (!dateValue) return null;

    const dob = new Date(dateValue);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  }
}
