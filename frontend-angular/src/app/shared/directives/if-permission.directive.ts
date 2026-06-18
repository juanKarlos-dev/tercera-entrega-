import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';

@Directive({
  selector: '[ifPermission]',
  standalone: true
})
export class IfPermissionDirective {
  private readonly permissionService = inject(PermissionService);
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);

  @Input('ifPermission') permission!: string; // Format: "METHOD:URL"

  constructor() {
    effect(() => {
      // Re-evaluate when permissions change
      this.updateView();
    });
  }

  private updateView(): void {
    if (!this.permission) return;
    
    const [method, url] = this.permission.split(':');
    const hasAccess = this.permissionService.hasPermission(method, url);

    if (hasAccess) {
      if (this.viewContainer.length === 0) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    } else {
      this.viewContainer.clear();
    }
  }
}
