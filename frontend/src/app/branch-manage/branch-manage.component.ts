import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Branch, EmployeeService } from '../services/employee.service';

@Component({
  selector: 'app-branch-manage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './branch-manage.component.html',
  styleUrl: './branch-manage.component.scss'
})
export class BranchManageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);

  branches: Branch[] = [];
  loading = false;
  creating = false;
  successMessage = '';
  errorMessage = '';

  branchForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    name: ['', Validators.required],
    address: ['', Validators.required],
    phone: ['', Validators.required],
    status: ['ACTIVE' as 'ACTIVE' | 'INACTIVE', Validators.required]
  });

  ngOnInit(): void {
    this.loadBranches();
  }

  loadBranches(): void {
    this.loading = true;
    this.employeeService.getBranches().subscribe({
      next: (branches) => {
        this.branches = branches;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load branches.';
        this.loading = false;
      }
    });
  }

  createBranch(): void {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }

    const { code, name, address, phone, status } = this.branchForm.getRawValue();
    this.creating = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.employeeService.createBranch({
      code: code ?? '',
      name: name ?? '',
      address: address ?? '',
      phone: phone ?? '',
      status: status ?? 'ACTIVE',
    }).subscribe({
      next: (branch) => {
        this.successMessage = `Branch "${branch.name}" created`;
        this.branchForm.reset();
        this.branchForm.patchValue({ status: 'ACTIVE' });
        this.branches = [...this.branches, branch].sort((a, b) => a.name.localeCompare(b.name));
        this.creating = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to create branch.';
        this.creating = false;
      }
    });
  }

  setStatus(branch: Branch, status: 'ACTIVE' | 'INACTIVE'): void {
    this.employeeService.updateBranchStatus(branch.id, status).subscribe({
      next: (updated) => {
        this.branches = this.branches.map((item) =>
          item.id === updated.id ? updated : item
        );
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to update branch status.';
      }
    });
  }
}
