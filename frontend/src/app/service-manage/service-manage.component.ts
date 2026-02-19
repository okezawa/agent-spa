import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Employee, EmployeeService, ServiceItem } from '../services/employee.service';

@Component({
  selector: 'app-service-manage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './service-manage.component.html',
  styleUrl: './service-manage.component.scss'
})
export class ServiceManageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);

  services: ServiceItem[] = [];
  approvedEmployees: Employee[] = [];
  loading = false;
  creating = false;
  editingServiceId: number | null = null;
  deletingServiceId: number | null = null;
  successMessage = '';
  errorMessage = '';

  serviceForm = this.fb.group({
    name: ['', Validators.required],
    durationMinutes: [60, [Validators.required, Validators.min(1)]],
    pricePerUnit: [0, [Validators.required, Validators.min(0)]],
    providerIds: this.fb.control<number[]>([]),
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.loading = true;
    this.errorMessage = '';

    this.employeeService.getEmployees('APPROVED').subscribe({
      next: (employees) => {
        this.approvedEmployees = employees.filter((employee) => {
          const position = String(employee.position || '').trim().toLowerCase();
          return position === 'nurse' || position === 'therapist';
        });
        this.loadServices();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load employees.';
        this.loading = false;
      }
    });
  }

  loadServices(): void {
    this.employeeService.getServices().subscribe({
      next: (services) => {
        this.services = services;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load services.';
        this.loading = false;
      }
    });
  }

  onToggleProvider(employeeId: number, checked: boolean): void {
    const current = this.serviceForm.controls.providerIds.value ?? [];
    const next = checked
      ? [...new Set([...current, employeeId])]
      : current.filter((id) => id !== employeeId);

    this.serviceForm.controls.providerIds.setValue(next);
    this.serviceForm.controls.providerIds.markAsDirty();
  }

  isProviderSelected(employeeId: number): boolean {
    return (this.serviceForm.controls.providerIds.value ?? []).includes(employeeId);
  }

  providerNames(service: ServiceItem): string {
    return service.providers
      .map((provider) => `${provider.firstName} ${provider.lastName}`)
      .join(', ');
  }

  submit(): void {
    const allowedProviderIds = new Set(this.approvedEmployees.map((employee) => employee.id));
    const selectedProviderIds = (this.serviceForm.controls.providerIds.value ?? [])
      .filter((providerId) => allowedProviderIds.has(providerId));

    this.serviceForm.controls.providerIds.setValue(selectedProviderIds);

    if (this.serviceForm.invalid || selectedProviderIds.length === 0) {
      this.serviceForm.markAllAsTouched();
      if (selectedProviderIds.length === 0) {
        this.errorMessage = 'Please select at least one employee for this service.';
      }
      return;
    }

    const raw = this.serviceForm.getRawValue();

    this.creating = true;
    this.successMessage = '';
    this.errorMessage = '';

    const payload = {
      name: (raw.name ?? '').trim(),
      durationMinutes: Number(raw.durationMinutes),
      pricePerUnit: Number(raw.pricePerUnit),
      providerIds: selectedProviderIds,
    };

    const request$ = this.editingServiceId
      ? this.employeeService.updateService(this.editingServiceId, payload)
      : this.employeeService.createService(payload);

    request$.subscribe({
      next: (saved) => {
        this.successMessage = this.editingServiceId
          ? `Service "${saved.name}" updated.`
          : `Service "${saved.name}" created.`;

        if (this.editingServiceId) {
          this.services = this.services
            .map((item) => (item.id === saved.id ? saved : item))
            .sort((a, b) => a.name.localeCompare(b.name));
        } else {
          this.services = [saved, ...this.services].sort((a, b) => a.name.localeCompare(b.name));
        }

        this.resetForm();
        this.creating = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to save service.';
        this.creating = false;
      },
    });
  }

  editService(service: ServiceItem): void {
    this.editingServiceId = service.id;
    this.errorMessage = '';
    this.successMessage = '';
    const allowedProviderIds = new Set(this.approvedEmployees.map((employee) => employee.id));
    this.serviceForm.patchValue({
      name: service.name,
      durationMinutes: service.durationMinutes,
      pricePerUnit: service.pricePerUnit,
      providerIds: service.providers
        .map((provider) => provider.id)
        .filter((providerId) => allowedProviderIds.has(providerId)),
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  removeService(service: ServiceItem): void {
    const confirmed = confirm(`Delete service "${service.name}"?`);
    if (!confirmed) return;

    this.deletingServiceId = service.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.employeeService.deleteService(service.id).subscribe({
      next: () => {
        this.services = this.services.filter((item) => item.id !== service.id);
        this.successMessage = `Service "${service.name}" deleted.`;
        if (this.editingServiceId === service.id) {
          this.resetForm();
        }
        this.deletingServiceId = null;
      },
      error: (error) => {
        const raw = String(error?.error?.message || '');
        this.errorMessage = raw.includes('booking')
          ? 'ลบไม่ได้: มี booking ใช้ service นี้อยู่'
          : (raw || 'Failed to delete service.');
        this.deletingServiceId = null;
      },
    });
  }

  private resetForm(): void {
    this.editingServiceId = null;
    this.serviceForm.reset();
    this.serviceForm.patchValue({
      durationMinutes: 60,
      pricePerUnit: 0,
      providerIds: [],
    });
  }
}
