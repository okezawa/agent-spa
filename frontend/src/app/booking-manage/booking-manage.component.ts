import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  Booking,
  BookingStatus,
  Employee,
  EmployeeService,
  Room,
  ServiceItem,
} from '../services/employee.service';

type BookingGuestRow = {
  guestId: number | null;
  guestName: string;
  guestPhone: string;
  startAt: string;
  endAt: string;
  serviceIds: number[];
  employeeIds: number[];
};

type BookingGuestDisplayRow = {
  guestName: string;
  guestPhone: string;
  services: string[];
  employeeIds: number[];
};

@Component({
  selector: 'app-booking-manage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './booking-manage.component.html',
  styleUrl: './booking-manage.component.scss'
})
export class BookingManageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);

  readonly bookingStatuses: BookingStatus[] = ['BOOKED', 'COMPLETED', 'CANCELLED'];
  rooms: Room[] = [];
  services: ServiceItem[] = [];
  bookings: Booking[] = [];
  guestRows: BookingGuestRow[] = [this.createEmptyGuestRow()];
  serviceToAddByRow: Record<number, number | null> = {};
  employeeToAddByRow: Record<number, number | null> = {};
  selectedDay = new Date();
  selectedMonth = new Date();

  loading = false;
  saving = false;
  editingBookingId: number | null = null;
  private editingBulkMeta = '';
  successMessage = '';
  errorMessage = '';

  bookingForm = this.fb.group({
    roomId: [0, [Validators.required, Validators.min(1)]],
    status: ['BOOKED' as BookingStatus, Validators.required],
    notes: [''],
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  private createEmptyGuestRow(): BookingGuestRow {
    return {
      guestId: null,
      guestName: '',
      guestPhone: '',
      startAt: '',
      endAt: '',
      serviceIds: [],
      employeeIds: [],
    };
  }

  loadInitialData(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      rooms: this.employeeService.getRooms('OPEN'),
      services: this.employeeService.getServices(),
    }).subscribe({
      next: ({ rooms, services }) => {
        this.rooms = rooms;
        this.services = services;
        this.bookingForm.patchValue({
          roomId: this.rooms[0]?.id ?? 0,
          status: 'BOOKED',
        });
        this.serviceToAddByRow = { 0: this.services[0]?.id ?? null };
        this.employeeToAddByRow = { 0: this.therapistEmployees[0]?.id ?? null };
        this.loadBookingsForMonth(this.selectedMonth);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to load booking dependencies.';
        this.loading = false;
      }
    });
  }

  get therapistEmployees(): Array<Pick<Employee, 'id' | 'firstName' | 'lastName' | 'position' | 'status'>> {
    const map = new Map<number, Pick<Employee, 'id' | 'firstName' | 'lastName' | 'position' | 'status'>>();
    for (const service of this.services) {
      for (const provider of service.providers) {
        const position = String(provider.position || '').trim().toLowerCase();
        if ((position === 'nurse' || position === 'therapist') && provider.status === 'APPROVED') {
          map.set(provider.id, provider);
        }
      }
    }
    return [...map.values()];
  }

  rowAvailableEmployees(row: BookingGuestRow): Array<Pick<Employee, 'id' | 'firstName' | 'lastName' | 'position' | 'status'>> {
    if (row.serviceIds.length === 0) {
      return this.therapistEmployees;
    }

    return this.therapistEmployees.filter((employee) =>
      row.serviceIds.every((serviceId) => {
        const service = this.services.find((item) => item.id === serviceId);
        return !!service?.providers.some((provider) => provider.id === employee.id);
      }),
    );
  }

  addGuestRow(): void {
    this.guestRows = [...this.guestRows, this.createEmptyGuestRow()];
    const newIndex = this.guestRows.length - 1;
    this.serviceToAddByRow[newIndex] = this.services[0]?.id ?? null;
    this.employeeToAddByRow[newIndex] = this.therapistEmployees[0]?.id ?? null;
  }

  removeGuestRow(index: number): void {
    this.guestRows = this.guestRows.filter((_, rowIndex) => rowIndex !== index);
    if (this.guestRows.length === 0) {
      this.guestRows = [this.createEmptyGuestRow()];
    }
    this.reindexRowSelections();
  }

  updateGuestName(index: number, guestName: string): void {
    this.guestRows[index].guestName = guestName;
  }

  updateGuestPhone(index: number, guestPhone: string): void {
    this.guestRows[index].guestPhone = guestPhone;
  }

  updateGuestStartAt(index: number, startAt: string): void {
    this.guestRows[index].startAt = startAt;
  }

  updateGuestEndAt(index: number, endAt: string): void {
    this.guestRows[index].endAt = endAt;
  }

  addServiceToRow(index: number): void {
    const row = this.guestRows[index];
    const serviceId = this.serviceToAddByRow[index];
    if (!serviceId) return;
    row.serviceIds = [...new Set([...row.serviceIds, serviceId])];

    const allowedIds = new Set(this.rowAvailableEmployees(row).map((employee) => employee.id));
    row.employeeIds = row.employeeIds.filter((employeeId) => allowedIds.has(employeeId));
    if (!allowedIds.has(Number(this.employeeToAddByRow[index] || 0))) {
      this.employeeToAddByRow[index] = this.rowAvailableEmployees(row)[0]?.id ?? null;
    }
  }

  removeServiceFromRow(index: number, serviceId: number): void {
    const row = this.guestRows[index];
    row.serviceIds = row.serviceIds.filter((id) => id !== serviceId);
    const allowedIds = new Set(this.rowAvailableEmployees(row).map((employee) => employee.id));
    row.employeeIds = row.employeeIds.filter((employeeId) => allowedIds.has(employeeId));
    if (!allowedIds.has(Number(this.employeeToAddByRow[index] || 0))) {
      this.employeeToAddByRow[index] = this.rowAvailableEmployees(row)[0]?.id ?? null;
    }
  }

  addEmployeeToRow(index: number): void {
    const row = this.guestRows[index];
    const employeeId = this.employeeToAddByRow[index];
    if (!employeeId) return;
    const allowedIds = new Set(this.rowAvailableEmployees(row).map((employee) => employee.id));
    if (!allowedIds.has(employeeId)) return;
    row.employeeIds = [...new Set([...row.employeeIds, employeeId])];
  }

  removeEmployeeFromRow(index: number, employeeId: number): void {
    const row = this.guestRows[index];
    row.employeeIds = row.employeeIds.filter((id) => id !== employeeId);
  }

  onServiceToAddChange(index: number, rawValue: string): void {
    const parsed = Number(rawValue);
    this.serviceToAddByRow[index] = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  onEmployeeToAddChange(index: number, rawValue: string): void {
    const parsed = Number(rawValue);
    this.employeeToAddByRow[index] = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  serviceNameById(serviceId: number): string {
    return this.services.find((service) => service.id === serviceId)?.name || `Service #${serviceId}`;
  }

  employeeNameById(employeeId: number): string {
    const employee = this.therapistEmployees.find((item) => item.id === employeeId);
    return employee ? `${employee.firstName} ${employee.lastName}` : `Employee #${employeeId}`;
  }

  rowEmployeeOptions(row: BookingGuestRow) {
    return this.rowAvailableEmployees(row);
  }

  private reindexRowSelections(): void {
    const nextServiceToAdd: Record<number, number | null> = {};
    const nextEmployeeToAdd: Record<number, number | null> = {};
    this.guestRows.forEach((row, index) => {
      nextServiceToAdd[index] = this.serviceToAddByRow[index] ?? this.services[0]?.id ?? null;
      nextEmployeeToAdd[index] = this.employeeToAddByRow[index] ?? this.rowAvailableEmployees(row)[0]?.id ?? null;
    });
    this.serviceToAddByRow = nextServiceToAdd;
    this.employeeToAddByRow = nextEmployeeToAdd;
  }

  toApiDate(localValue: string): string {
    return new Date(localValue).toISOString();
  }

  submit(): void {
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      this.errorMessage = 'กรุณากรอกห้องให้ครบ';
      return;
    }

    const invalidRow = this.guestRows.find(
      (row) =>
        !row.guestName.trim() ||
        !row.guestPhone.trim() ||
        !row.startAt ||
        !row.endAt ||
        row.serviceIds.length === 0 ||
        row.employeeIds.length === 0,
    );
    if (invalidRow) {
      this.errorMessage = 'กรุณากรอกชื่อแขก, เบอร์โทร, เวลาเริ่ม/จบ, Service และพนักงานให้ครบทุกแถว';
      return;
    }

    const raw = this.bookingForm.getRawValue();

    if (this.editingBookingId) {
      if (this.guestRows.length !== 1) {
        this.errorMessage = 'โหมดแก้ไขรองรับแขกได้ครั้งละ 1 รายการ';
        return;
      }
      const row = this.guestRows[0];
      if (row.serviceIds.length !== 1) {
        this.errorMessage = 'โหมดแก้ไขต้องเลือก Service ได้ 1 รายการ';
        return;
      }

      const payload = {
        guestId: row.guestId,
        guestName: row.guestName.trim(),
        guestPhone: row.guestPhone.trim(),
        roomId: Number(raw.roomId),
        serviceId: row.serviceIds[0],
        employeeIds: row.employeeIds,
        startAt: this.toApiDate(row.startAt),
        endAt: this.toApiDate(row.endAt),
        status: raw.status ?? 'BOOKED',
        notes: this.composeNotesWithBulkMeta(String(raw.notes ?? '').trim()),
      };

      this.saving = true;
      this.successMessage = '';
      this.errorMessage = '';

      this.employeeService.updateBooking(this.editingBookingId, payload).subscribe({
        next: (updatedBooking) => {
          this.successMessage = 'Booking updated.';
          this.bookings = this.bookings.map((item) => (item.id === updatedBooking.id ? updatedBooking : item));
          this.bookings.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
          this.resetCreateForm();
          this.saving = false;
        },
        error: (error) => {
          this.errorMessage = this.mapBookingError(error?.error?.message);
          this.saving = false;
        },
      });
      return;
    }

    const payload = {
      guestBookings: this.guestRows.map((row) => ({
        guestId: row.guestId,
        guestName: row.guestName.trim(),
        guestPhone: row.guestPhone.trim(),
        startAt: this.toApiDate(row.startAt),
        endAt: this.toApiDate(row.endAt),
        serviceIds: row.serviceIds,
        employeeIds: row.employeeIds,
      })),
      roomId: Number(raw.roomId),
      status: raw.status ?? 'BOOKED',
      notes: String(raw.notes ?? '').trim(),
    };

    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.employeeService.createBulkBookings(payload).subscribe({
      next: (createdBookings) => {
        this.successMessage = `Created ${createdBookings.length} booking(s).`;
        this.bookings = [...this.bookings, ...createdBookings];
        this.bookings.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
        this.resetCreateForm();
        this.saving = false;
      },
      error: (error) => {
        this.errorMessage = this.mapBookingError(error?.error?.message);
        this.saving = false;
      },
    });
  }

  loadBookingsForMonth(monthDate: Date): void {
    this.loading = true;
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

    this.employeeService
      .getBookings({ from: monthStart.toISOString(), to: monthEnd.toISOString() })
      .subscribe({
        next: (bookings) => {
          this.bookings = bookings;
          this.loading = false;
        },
        error: (error) => {
          this.errorMessage = error?.error?.message || 'Failed to load bookings.';
          this.loading = false;
        },
      });
  }

  previousMonth(): void {
    this.selectedMonth = new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth() - 1, 1);
    this.loadBookingsForMonth(this.selectedMonth);
  }

  nextMonth(): void {
    this.selectedMonth = new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth() + 1, 1);
    this.loadBookingsForMonth(this.selectedMonth);
  }

  selectCalendarDay(day: Date): void {
    this.selectedDay = day;
  }

  get calendarDays(): Array<Date | null> {
    const year = this.selectedMonth.getFullYear();
    const month = this.selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startWeekDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const result: Array<Date | null> = [];

    for (let i = 0; i < startWeekDay; i += 1) {
      result.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(new Date(year, month, day));
    }

    while (result.length % 7 !== 0) {
      result.push(null);
    }

    return result;
  }

  countBookingsByDay(day: Date | null): number {
    if (!day) return 0;
    const dayKey = this.dayKey(day);
    return this.bookings.filter((booking) => this.dayKey(new Date(booking.startAt)) === dayKey).length;
  }

  get selectedDayBookings(): Booking[] {
    const dayKey = this.dayKey(this.selectedDay);
    return this.bookings.filter((booking) => this.dayKey(new Date(booking.startAt)) === dayKey);
  }

  dayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  isSelectedDay(day: Date | null): boolean {
    if (!day) return false;
    return this.dayKey(day) === this.dayKey(this.selectedDay);
  }

  monthTitle(): string {
    return this.selectedMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  bookingEmployeeNames(booking: Booking): string {
    const employees = booking.assignedEmployees?.map((item) => item.employee) || [];
    if (!employees.length) {
      return `${booking.employee.firstName} ${booking.employee.lastName}`;
    }
    return employees.map((employee) => `${employee.firstName} ${employee.lastName}`).join(', ');
  }

  private parseBulkDisplayRows(notes: string | null | undefined): BookingGuestDisplayRow[] {
    const rawNotes = String(notes || '');
    const startIndex = this.findBulkStartIndex(rawNotes);
    if (startIndex < 0) return [];

    const bulkText = rawNotes.slice(startIndex).replace(/^\s*bulk\s*:/i, '').trim();
    if (!bulkText) return [];

    return bulkText
      .split('|')
      .map((part) => part.trim())
      .map((part) => {
        const match = part.match(
          /^(.+?)\s*\((.*?)\)\s*(?:time:\[(.*?)\|(.*?)\]\s*)?services:\[(.*?)\]\s*employees:\[(.*?)\]$/i,
        );
        if (!match) return null;

        const [, guestNameRaw, guestPhoneRaw, _startAtRaw, _endAtRaw, servicesRaw, employeesRaw] = match;
        const services = servicesRaw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        const employeeIds = employeesRaw
          .split(',')
          .map((item) => Number(item.trim()))
          .filter((id) => Number.isInteger(id) && id > 0);

        return {
          guestName: guestNameRaw.trim(),
          guestPhone: guestPhoneRaw.trim(),
          services,
          employeeIds,
        } as BookingGuestDisplayRow;
      })
      .filter((row): row is BookingGuestDisplayRow => !!row && !!row.guestName);
  }

  bookingGuestRowsForDisplay(booking: Booking): BookingGuestDisplayRow[] {
    const parsed = this.parseBulkDisplayRows(booking.notes);
    if (parsed.length) return parsed;

    return [
      {
        guestName: booking.guest
          ? `${booking.guest.firstName} ${booking.guest.lastName}`
          : booking.guestName,
        guestPhone: booking.guestPhone || booking.guest?.phone || '-',
        services: [booking.service.name],
        employeeIds: booking.assignedEmployees?.map((item) => item.employeeId) ?? [booking.employeeId],
      },
    ];
  }

  private employeeNameByAnyId(employeeId: number, booking?: Booking): string {
    const fromBooking = booking?.assignedEmployees?.find((item) => item.employeeId === employeeId)?.employee;
    if (fromBooking) return `${fromBooking.firstName} ${fromBooking.lastName}`;
    return this.employeeNameById(employeeId);
  }

  bookingServiceEmployeePairs(row: BookingGuestDisplayRow, booking: Booking): Array<{ service: string; employee: string }> {
    const employeeNames = row.employeeIds.map((id) => this.employeeNameByAnyId(id, booking));
    return row.services.map((service, index) => ({
      service,
      employee: employeeNames[index] ?? employeeNames.join(', ') ?? '-',
    }));
  }

  private findBulkStartIndex(rawNotes: string): number {
    const match = rawNotes.match(/\bbulk\s*:/i);
    return match?.index ?? -1;
  }

  private parseBulkRowsFromNotes(notes: string | null | undefined): BookingGuestRow[] {
    const rawNotes = String(notes || '');
    const startIndex = this.findBulkStartIndex(rawNotes);
    if (startIndex < 0) return [];

    const bulkText = rawNotes.slice(startIndex).replace(/^\s*bulk\s*:/i, '').trim();
    if (!bulkText) return [];

    return bulkText
      .split('|')
      .map((part) => part.trim())
      .map((part) => {
        const match = part.match(
          /^(.+?)\s*\((.*?)\)\s*(?:time:\[(.*?)\|(.*?)\]\s*)?services:\[(.*?)\]\s*employees:\[(.*?)\]$/i,
        );
        if (!match) return null;

        const [, guestNameRaw, guestPhoneRaw, startAtRaw, endAtRaw, servicesRaw, employeesRaw] = match;
        const serviceNames = servicesRaw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        const serviceIds = serviceNames
          .map((serviceName) => this.services.find((service) => service.name.toLowerCase() === serviceName.toLowerCase())?.id)
          .filter((id): id is number => typeof id === 'number');

        const employeeIds = employeesRaw
          .split(',')
          .map((item) => Number(item.trim()))
          .filter((id) => Number.isInteger(id) && id > 0);

        return {
          guestId: null,
          guestName: guestNameRaw.trim(),
          guestPhone: guestPhoneRaw.trim(),
          startAt: startAtRaw ? this.toLocalDateTimeInput(startAtRaw) : '',
          endAt: endAtRaw ? this.toLocalDateTimeInput(endAtRaw) : '',
          serviceIds,
          employeeIds,
        } as BookingGuestRow;
      })
      .filter((row): row is BookingGuestRow => !!row && !!row.guestName && !!row.guestPhone);
  }

  private splitNotes(notes: string | null | undefined): { userNotes: string; bulkMeta: string } {
    const rawNotes = String(notes || '');
    const startIndex = this.findBulkStartIndex(rawNotes);
    if (startIndex < 0) {
      return { userNotes: rawNotes.trim(), bulkMeta: '' };
    }
    const userNotes = rawNotes.slice(0, startIndex).trim();
    const bulkMeta = rawNotes.slice(startIndex).trim();
    return { userNotes, bulkMeta };
  }

  private sanitizeNotesForForm(notes: string | null | undefined): string {
    return this.splitNotes(notes).userNotes;
  }

  private composeNotesWithBulkMeta(userNotes: string): string {
    return [userNotes.trim(), this.editingBulkMeta].filter(Boolean).join('\n');
  }

  editBooking(booking: Booking): void {
    this.editingBookingId = booking.id;
    this.successMessage = '';
    this.errorMessage = '';
    const noteParts = this.splitNotes(booking.notes);
    this.editingBulkMeta = noteParts.bulkMeta;

    const parsedBulkRows = this.parseBulkRowsFromNotes(booking.notes);
    const fallbackRow: BookingGuestRow = {
      guestId: booking.guestId ?? null,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone || booking.guest?.phone || '',
      startAt: this.toLocalDateTimeInput(booking.startAt),
      endAt: this.toLocalDateTimeInput(booking.endAt),
      serviceIds: [booking.serviceId],
      employeeIds: booking.assignedEmployees?.map((item) => item.employeeId) ?? [booking.employeeId],
    };
    this.guestRows = parsedBulkRows.length > 0
      ? parsedBulkRows.map((row) => ({
          ...row,
          startAt: row.startAt || this.toLocalDateTimeInput(booking.startAt),
          endAt: row.endAt || this.toLocalDateTimeInput(booking.endAt),
        }))
      : [{ ...fallbackRow }];
    this.reindexRowSelections();

    this.bookingForm.patchValue({
      roomId: booking.roomId,
      status: booking.status,
      notes: this.sanitizeNotesForForm(booking.notes),
    });
  }

  cancelEdit(): void {
    this.resetCreateForm();
  }

  private toLocalDateTimeInput(value: string): string {
    const date = new Date(value);
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  private resetCreateForm(): void {
    this.editingBookingId = null;
    this.editingBulkMeta = '';
    this.guestRows = [this.createEmptyGuestRow()];
    this.serviceToAddByRow = { 0: this.services[0]?.id ?? null };
    this.employeeToAddByRow = { 0: this.therapistEmployees[0]?.id ?? null };
    this.bookingForm.patchValue({
      roomId: this.rooms[0]?.id ?? 0,
      status: 'BOOKED',
      notes: '',
    });
  }

  cancelBooking(booking: Booking): void {
    if (booking.status === 'CANCELLED') {
      return;
    }

    const confirmed = confirm('ยืนยันยกเลิก booking นี้?');
    if (!confirmed) return;

    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.employeeService.cancelBooking(booking.id).subscribe({
      next: (updatedBooking) => {
        this.bookings = this.bookings.map((item) => (item.id === updatedBooking.id ? updatedBooking : item));
        this.successMessage = 'Booking cancelled.';
        this.saving = false;
      },
      error: (error) => {
        this.errorMessage = this.mapBookingError(error?.error?.message);
        this.saving = false;
      }
    });
  }

  private mapBookingError(message: string | undefined): string {
    const raw = String(message || '');
    if (raw.includes('room is already booked')) {
      return 'เวลาทับกัน: ห้องนี้ถูกจองแล้วในช่วงเวลานี้';
    }
    if (raw.includes('one or more selected employees are already booked')) {
      return 'จองไม่ได้: มีพนักงานอย่างน้อย 1 คนติดคิวในช่วงเวลานี้';
    }
    if (raw.includes('guestBookings is required')) {
      return 'กรุณาเพิ่มข้อมูลแขกอย่างน้อย 1 แถว';
    }
    if (raw.includes('endAt must be after startAt')) {
      return 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม';
    }
    if (raw.includes('booking not found')) {
      return 'ไม่พบ booking ที่ต้องการยกเลิก';
    }
    if (raw.includes('selected room is under maintenance')) {
      return 'ห้องที่เลือกอยู่ในสถานะปิดปรับปรุง';
    }
    return raw || 'Failed to save booking.';
  }
}
