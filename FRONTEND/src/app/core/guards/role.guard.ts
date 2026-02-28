import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
    private auth = inject(AuthService);
    private router = inject(Router);

    canActivate(route: ActivatedRouteSnapshot): boolean {
        const allowedRoles = route.data['roles'] as string[] | undefined;
        if (!allowedRoles || allowedRoles.length === 0) return true;
        if (this.auth.hasRole(allowedRoles)) return true;
        this.router.navigate(['/dashboard']);
        return false;
    }
}
