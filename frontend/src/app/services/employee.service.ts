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

  logoutEmployee() {
    return this.http.post<{ message: string }>(
      `${this.apiBaseUrl}/api/employees/logout`,
      {},
      { withCredentials: true }
    );
  }
}
