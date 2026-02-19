import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { EmployeeService } from './services/employee.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);
  private readonly router = inject(Router);

  isAuthenticated = false;
  isSidebarOpen = true;

  ngOnInit(): void {
    this.refreshAuthState();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.refreshAuthState());
  }

  private refreshAuthState(): void {
    this.employeeService.getAuthStatus().subscribe({
      next: (response) => {
        this.isAuthenticated = response.authenticated;
      },
      error: () => {
        this.isAuthenticated = false;
      },
    });
  }

  logout(): void {
    this.employeeService.logoutEmployee().subscribe({
      next: () => {
        this.isAuthenticated = false;
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.isAuthenticated = false;
        this.router.navigateByUrl('/login');
      }
    });
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }
}
