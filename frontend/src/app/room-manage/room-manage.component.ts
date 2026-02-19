import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Branch, EmployeeService, Room, RoomStatus } from '../services/employee.service';

@Component({
  selector: 'app-room-manage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './room-manage.component.html',
  styleUrl: './room-manage.component.scss'
})
export class RoomManageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);

  branches: Branch[] = [];
  rooms: Room[] = [];
  loading = false;
  saving = false;
  editingRoomId: number | null = null;
  deletingRoomId: number | null = null;
  successMessage = '';
  errorMessage = '';

  readonly roomColorOptions = [
    { value: '#2563EB', label: 'Blue' },
    { value: '#16A34A', label: 'Green' },
    { value: '#EA580C', label: 'Orange' },
    { value: '#DC2626', label: 'Red' },
    { value: '#7C3AED', label: 'Purple' },
    { value: '#DB2777', label: 'Pink' },
    { value: '#0891B2', label: 'Cyan' },
    { value: '#4F46E5', label: 'Indigo' },
    { value: '#0F766E', label: 'Teal' },
  ];

  roomForm = this.fb.group({
    name: ['', Validators.required],
    roomType: ['', Validators.required],
    color: ['#2563EB', Validators.required],
    branchId: [0, [Validators.required, Validators.min(1)]],
    status: ['OPEN' as RoomStatus, Validators.required],
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.loading = true;
    this.errorMessage = '';

    this.employeeService.getBranches('ACTIVE').subscribe({
      next: (branches) => {
        this.branches = branches;
        if (this.branches.length && !this.editingRoomId) {
          this.roomForm.patchValue({ branchId: this.branches[0].id });
        }
        this.loadRooms();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load branches.';
        this.loading = false;
      }
    });
  }

  loadRooms(): void {
    this.employeeService.getRooms().subscribe({
      next: (rooms) => {
        this.rooms = rooms;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load rooms.';
        this.loading = false;
      }
    });
  }

  submit(): void {
    if (this.roomForm.invalid) {
      this.roomForm.markAllAsTouched();
      return;
    }

    const raw = this.roomForm.getRawValue();
    const payload = {
      name: String(raw.name ?? '').trim(),
      roomType: String(raw.roomType ?? '').trim(),
      color: String(raw.color ?? '#2563EB'),
      branchId: Number(raw.branchId),
      status: raw.status ?? 'OPEN',
    };

    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    const request$ = this.editingRoomId
      ? this.employeeService.updateRoom(this.editingRoomId, payload)
      : this.employeeService.createRoom(payload);

    request$.subscribe({
      next: (room) => {
        this.successMessage = this.editingRoomId
          ? `Room "${room.name}" updated`
          : `Room "${room.name}" created`;

        if (this.editingRoomId) {
          this.rooms = this.rooms.map((item) => (item.id === room.id ? room : item));
        } else {
          this.rooms = [room, ...this.rooms];
        }

        this.rooms = this.sortRooms(this.rooms);
        this.resetForm();
        this.saving = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to save room.';
        this.saving = false;
      }
    });
  }

  editRoom(room: Room): void {
    this.editingRoomId = room.id;
    this.successMessage = '';
    this.errorMessage = '';
    this.roomForm.patchValue({
      name: room.name,
      roomType: room.roomType,
      color: room.color,
      branchId: room.branchId,
      status: room.status,
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  setRoomStatus(room: Room, status: RoomStatus): void {
    this.employeeService.updateRoomStatus(room.id, status).subscribe({
      next: (updated) => {
        this.rooms = this.sortRooms(this.rooms.map((item) => (item.id === updated.id ? updated : item)));
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to update room status.';
      }
    });
  }

  removeRoom(room: Room): void {
    if (!confirm(`Delete room "${room.name}"?`)) return;

    this.deletingRoomId = room.id;
    this.successMessage = '';
    this.errorMessage = '';

    this.employeeService.deleteRoom(room.id).subscribe({
      next: () => {
        this.rooms = this.rooms.filter((item) => item.id !== room.id);
        this.successMessage = `Room "${room.name}" deleted`;
        if (this.editingRoomId === room.id) {
          this.resetForm();
        }
        this.deletingRoomId = null;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to delete room.';
        this.deletingRoomId = null;
      }
    });
  }

  private resetForm(): void {
    this.editingRoomId = null;
    this.roomForm.reset();
    this.roomForm.patchValue({
      branchId: this.branches[0]?.id ?? 0,
      color: '#2563EB',
      status: 'OPEN',
    });
  }

  private sortRooms(rooms: Room[]): Room[] {
    return [...rooms].sort((a, b) => {
      const branchCompare = a.branch.name.localeCompare(b.branch.name);
      if (branchCompare !== 0) return branchCompare;
      return a.name.localeCompare(b.name);
    });
  }
}
