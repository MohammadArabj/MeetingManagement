import { Injectable } from "@angular/core"
import { Subject } from "rxjs"

/**
 * دسترسی به localStorage.
 * changes: کلید تغییرکرده (یا null برای پاک‌سازی کامل) — SessionStore از آن برای هم‌گامی استفاده می‌کند.
 */
@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  private readonly _changes = new Subject<string | null>()
  readonly changes = this._changes.asObservable()

  getItem(name: string): string {
    return localStorage.getItem(name) || ''
  }

  setItem(name: string, value: string | null | undefined): void {
    const text = value == null ? '' : String(value)
    if (localStorage.getItem(name) === text) return
    localStorage.setItem(name, text)
    this._changes.next(name)
  }

  exists(name: string): boolean {
    return this.getItem(name) !== ''
  }

  removeItem(name: string): void {
    if (localStorage.getItem(name) === null) return
    localStorage.removeItem(name)
    this._changes.next(name)
  }
}
