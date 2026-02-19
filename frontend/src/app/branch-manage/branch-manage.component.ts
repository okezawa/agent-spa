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
  editingBranchId: number | null = null;
  deletingBranchId: number | null = null;
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

    const payload = {
      code: code ?? '',
      name: name ?? '',
      address: address ?? '',
      phone: phone ?? '',
      status: status ?? 'ACTIVE',
    };

    const request$ = this.editingBranchId
      ? this.employeeService.updateBranch(this.editingBranchId, payload)
      : this.employeeService.createBranch(payload);

    request$.subscribe({
      next: (branch) => {
        this.successMessage = this.editingBranchId
          ? `Branch "${branch.name}" updated`
          : `Branch "${branch.name}" created`;
        if (this.editingBranchId) {
          this.branches = this.branches
            .map((item) => (item.id === branch.id ? branch : item))
            .sort((a, b) => a.name.localeCompare(b.name));
        } else {
          this.branches = [...this.branches, branch].sort((a, b) => a.name.localeCompare(b.name));
        }
        this.resetForm();
        this.creating = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to save branch.';
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

  editBranch(branch: Branch): void {
    this.editingBranchId = branch.id;
    this.successMessage = '';
    this.errorMessage = '';
    this.branchForm.patchValue({
      code: branch.code,
      name: branch.name,
      address: branch.address ?? '',
      phone: branch.phone ?? '',
      status: branch.status,
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  removeBranch(branch: Branch): void {
    if (!confirm(`Delete branch "${branch.name}"?`)) {
      return;
    }

    this.deletingBranchId = branch.id;
    this.successMessage = '';
    this.errorMessage = '';

    this.employeeService.deleteBranch(branch.id).subscribe({
      next: () => {
        this.branches = this.branches.filter((item) => item.id !== branch.id);
        this.successMessage = `Branch "${branch.name}" deleted`;
        if (this.editingBranchId === branch.id) {
          this.resetForm();
        }
        this.deletingBranchId = null;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to delete branch.';
        this.deletingBranchId = null;
      }
    });
  }

  private resetForm(): void {
    this.editingBranchId = null;
    this.branchForm.reset();
    this.branchForm.patchValue({ status: 'ACTIVE' });
  }
}
