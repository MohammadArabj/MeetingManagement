import { Injectable } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";

@Injectable({ providedIn: 'root' })
export class NavigationService {
    private previousUrl: string | null = null;
    private currentUrl: string | null = null;

    constructor(private router: Router) {
        this.currentUrl = this.router.url;

        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                this.previousUrl = this.currentUrl;
                this.currentUrl = event.urlAfterRedirects;
            }
        });
    }

    getPreviousUrl(): string | null {
        return this.previousUrl;
    }
}