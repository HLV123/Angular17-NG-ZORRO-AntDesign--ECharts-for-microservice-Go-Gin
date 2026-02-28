import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError, delay, tap } from 'rxjs';
import { User, AuthState } from '../models';
import { MOCK_USERS, MOCK_CREDENTIALS } from '../mock/mock-data';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authState = new BehaviorSubject<AuthState>({
    user: null, token: null, refreshToken: null,
    isAuthenticated: false, loading: false, error: null
  });

  authState$ = this.authState.asObservable();

  constructor() {
    const stored = localStorage.getItem('maintenix_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.authState.next({ ...parsed, loading: false, error: null });
      } catch {}
    }
  }

  login(username: string, password: string): Observable<User> {
    // Simulate REST POST /api/auth/login → JWT token response
    const validPassword = MOCK_CREDENTIALS[username];
    if (!validPassword || validPassword !== password) {
      return throwError(() => new Error('Tên đăng nhập hoặc mật khẩu không chính xác'));
    }
    const user = MOCK_USERS.find(u => u.username === username);
    if (!user) return throwError(() => new Error('Không tìm thấy tài khoản'));
    if (user.status === 'locked') return throwError(() => new Error('Tài khoản đã bị khóa'));

    const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.mock.' + btoa(JSON.stringify({ sub: user.id, role: user.role, exp: Date.now() + 86400000 }));
    const refreshToken = 'refresh_' + btoa(user.id + '_' + Date.now());

    const newState: AuthState = { user, token, refreshToken, isAuthenticated: true, loading: false, error: null };
    this.authState.next(newState);
    localStorage.setItem('maintenix_auth', JSON.stringify({ user, token, refreshToken, isAuthenticated: true }));

    return of(user).pipe(delay(800));
  }

  logout(): void {
    this.authState.next({ user: null, token: null, refreshToken: null, isAuthenticated: false, loading: false, error: null });
    localStorage.removeItem('maintenix_auth');
  }

  get currentUser(): User | null {
    return this.authState.value.user;
  }

  get isAuthenticated(): boolean {
    return this.authState.value.isAuthenticated;
  }

  get token(): string | null {
    return this.authState.value.token;
  }

  hasRole(roles: string[]): boolean {
    return this.currentUser ? roles.includes(this.currentUser.role) : false;
  }
}
