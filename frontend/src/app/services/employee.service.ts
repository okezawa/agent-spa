import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  branch: string;
  position: string;
  password: string;
  confirmPassword: string;
  profileImage?: string | null;
}

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  branch: string;
  position: string;
  profileImage?: string | null;
  status: ApprovalStatus;
  approvedAt?: string | null;
  approvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeLoginPayload {
  email: string;
  password: string;
}

export interface EmployeeLoginResponse {
  message: string;
  employee: Employee;
}

export interface EmployeeAuthStatusResponse {
  authenticated: boolean;
  employee: Employee | null;
}

export interface Branch {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface ServiceItem {
  id: number;
  name: string;
  durationMinutes: number;
  pricePerUnit: number;
  providers: Array<Pick<Employee, 'id' | 'firstName' | 'lastName' | 'email' | 'position' | 'status'>>;
  createdAt: string;
  updatedAt: string;
}

export type RoomStatus = 'OPEN' | 'MAINTENANCE';
export type BookingStatus = 'BOOKED' | 'COMPLETED' | 'CANCELLED';

export interface Room {
  id: number;
  name: string;
  roomType: string;
  color: string;
  status: RoomStatus;
  branchId: number;
  branch: Pick<Branch, 'id' | 'code' | 'name' | 'status'>;
  createdAt: string;
  updatedAt: string;
}

export interface Guest {
  id: number;
  memberCode: string;
  firstName: string;
  lastName: string;
  citizenId: string;
  dateOfBirth?: string | null;
  age?: number | null;
  address?: string | null;
  phone: string;
  country: string;
  lineId?: string | null;
  otherNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: number;
  guestId?: number | null;
  guestName: string;
  guestPhone?: string | null;
  roomId: number;
  serviceId: number;
  employeeId: number;
  employeeIds?: number[];
  startAt: string;
  endAt: string;
  status: BookingStatus;
  notes?: string | null;
  guest?: Pick<Guest, 'id' | 'memberCode' | 'firstName' | 'lastName' | 'phone'> | null;
  room: Room;
  service: Pick<ServiceItem, 'id' | 'name' | 'durationMinutes' | 'pricePerUnit'>;
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'email' | 'position' | 'status'>;
  assignedEmployees?: Array<{
    bookingId: number;
    employeeId: number;
    employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'email' | 'position' | 'status'>;
  }>;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:4000';

  createEmployee(payload: CreateEmployeePayload) {
    return this.http.post<Employee>(`${this.apiBaseUrl}/api/employees`, payload);
  }

  getPendingEmployees() {
    return this.http.get<Employee[]>(`${this.apiBaseUrl}/api/employees/pending`);
  }

  getEmployees(status?: ApprovalStatus) {
    const query = status ? `?status=${status}` : '';
    return this.http.get<Employee[]>(`${this.apiBaseUrl}/api/employees${query}`);
  }

  approveEmployee(employeeId: number, approvedBy = 'admin') {
    return this.http.patch<Employee>(
      `${this.apiBaseUrl}/api/employees/${employeeId}/approve`,
      { approvedBy }
    );
  }

  loginEmployee(payload: EmployeeLoginPayload) {
    return this.http.post<EmployeeLoginResponse>(
      `${this.apiBaseUrl}/api/employees/login`,
      payload,
      { withCredentials: true }
    );
  }

  getCurrentEmployee() {
    return this.http.get<{ employee: Employee }>(
      `${this.apiBaseUrl}/api/employees/me`,
      { withCredentials: true }
    );
  }

  getAuthStatus() {
    return this.http.get<EmployeeAuthStatusResponse>(
      `${this.apiBaseUrl}/api/employees/auth-status`,
      { withCredentials: true }
    );
  }

  logoutEmployee() {
    return this.http.post<{ message: string }>(
      `${this.apiBaseUrl}/api/employees/logout`,
      {},
      { withCredentials: true }
    );
  }

  getBranches(status?: 'ACTIVE' | 'INACTIVE') {
    const query = status ? `?status=${status}` : '';
    return this.http.get<Branch[]>(`${this.apiBaseUrl}/api/branches${query}`);
  }

  createBranch(payload: {
    code: string;
    name: string;
    address: string;
    phone: string;
    status: 'ACTIVE' | 'INACTIVE';
  }) {
    return this.http.post<Branch>(`${this.apiBaseUrl}/api/branches`, payload);
  }

  updateBranchStatus(branchId: number, status: 'ACTIVE' | 'INACTIVE') {
    return this.http.patch<Branch>(`${this.apiBaseUrl}/api/branches/${branchId}/status`, { status });
  }

  updateBranch(
    branchId: number,
    payload: {
      code: string;
      name: string;
      address: string;
      phone: string;
      status: 'ACTIVE' | 'INACTIVE';
    }
  ) {
    return this.http.patch<Branch>(`${this.apiBaseUrl}/api/branches/${branchId}`, payload);
  }

  deleteBranch(branchId: number) {
    return this.http.delete<{ message: string }>(`${this.apiBaseUrl}/api/branches/${branchId}`);
  }

  getServices() {
    return this.http.get<ServiceItem[]>(`${this.apiBaseUrl}/api/services`);
  }

  createService(payload: {
    name: string;
    durationMinutes: number;
    pricePerUnit: number;
    providerIds: number[];
  }) {
    return this.http.post<ServiceItem>(`${this.apiBaseUrl}/api/services`, payload);
  }

  updateService(
    serviceId: number,
    payload: {
      name: string;
      durationMinutes: number;
      pricePerUnit: number;
      providerIds: number[];
    }
  ) {
    return this.http.patch<ServiceItem>(`${this.apiBaseUrl}/api/services/${serviceId}`, payload);
  }

  deleteService(serviceId: number) {
    return this.http.delete<{ message: string }>(`${this.apiBaseUrl}/api/services/${serviceId}`);
  }

  getRooms(status?: RoomStatus) {
    const query = status ? `?status=${status}` : '';
    return this.http.get<Room[]>(`${this.apiBaseUrl}/api/rooms${query}`);
  }

  createRoom(payload: {
    name: string;
    roomType: string;
    color: string;
    branchId: number;
    status?: RoomStatus;
  }) {
    return this.http.post<Room>(`${this.apiBaseUrl}/api/rooms`, payload);
  }

  updateRoom(
    roomId: number,
    payload: {
      name: string;
      roomType: string;
      color: string;
      branchId: number;
      status?: RoomStatus;
    }
  ) {
    return this.http.patch<Room>(`${this.apiBaseUrl}/api/rooms/${roomId}`, payload);
  }

  updateRoomStatus(roomId: number, status: RoomStatus) {
    return this.http.patch<Room>(`${this.apiBaseUrl}/api/rooms/${roomId}/status`, { status });
  }

  deleteRoom(roomId: number) {
    return this.http.delete<{ message: string }>(`${this.apiBaseUrl}/api/rooms/${roomId}`);
  }

  getGuests() {
    return this.http.get<Guest[]>(`${this.apiBaseUrl}/api/guests`);
  }

  searchGuests(query: string) {
    const q = encodeURIComponent(query);
    return this.http.get<Guest[]>(`${this.apiBaseUrl}/api/guests/search?q=${q}`);
  }

  createGuest(payload: {
    firstName: string;
    lastName: string;
    citizenId: string;
    dateOfBirth: string;
    address?: string;
    phone: string;
    country: string;
    lineId?: string;
    otherNotes?: string;
  }) {
    return this.http.post<Guest>(`${this.apiBaseUrl}/api/guests`, payload);
  }

  getBookings(params?: { from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.http.get<Booking[]>(`${this.apiBaseUrl}/api/bookings${suffix}`);
  }

  createBooking(payload: {
    guestId?: number | null;
    guestName: string;
    guestPhone: string;
    roomId: number;
    serviceId: number;
    employeeIds: number[];
    startAt: string;
    notes?: string;
    status?: BookingStatus;
  }) {
    return this.http.post<Booking>(`${this.apiBaseUrl}/api/bookings`, payload);
  }

  createBulkBookings(payload: {
    guestBookings: Array<{
      guestId?: number | null;
      guestName: string;
      guestPhone: string;
      startAt: string;
      endAt: string;
      serviceIds: number[];
      employeeIds: number[];
    }>;
    roomId: number;
    notes?: string;
    status?: BookingStatus;
  }) {
    return this.http.post<Booking[]>(`${this.apiBaseUrl}/api/bookings/bulk`, payload);
  }

  updateBooking(
    bookingId: number,
    payload: {
      guestId?: number | null;
      guestName: string;
      guestPhone: string;
      roomId: number;
      serviceId: number;
      employeeIds: number[];
      startAt: string;
      endAt?: string;
      notes?: string;
      status?: BookingStatus;
    }
  ) {
    return this.http.patch<Booking>(`${this.apiBaseUrl}/api/bookings/${bookingId}`, payload);
  }

  cancelBooking(bookingId: number) {
    return this.http.patch<Booking>(`${this.apiBaseUrl}/api/bookings/${bookingId}/cancel`, {});
  }
}
