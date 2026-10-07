import Swal, { SweetAlertIcon } from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

/**
 * Paleta y configuración base UCS para SweetAlert2
 */
const getSwalThemeColors = () => {
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    background: isDark ? '#0b2247' : '#ffffff',
    color: isDark ? '#ffffff' : '#06152d',
    backdrop: isDark ? 'rgba(6, 21, 45, 0.75)' : 'rgba(15, 23, 42, 0.55)',
  };
};

export interface ConfirmModalOptions {
  title: string;
  text?: string;
  html?: string;
  icon?: SweetAlertIcon;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

/**
 * Modal de confirmación estilizado según la identidad UCS
 * Retorna true si el usuario confirmó, false si canceló o cerró el modal.
 */
export async function confirmModal({
  title,
  text,
  html,
  icon = 'warning',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDanger = false,
}: ConfirmModalOptions): Promise<boolean> {
  const theme = getSwalThemeColors();

  const result = await Swal.fire({
    title,
    text,
    html,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    background: theme.background,
    color: theme.color,
    backdrop: theme.backdrop,
    focusCancel: true,
    customClass: {
      popup: 'ucs-swal-popup',
      title: 'ucs-swal-title',
      htmlContainer: 'ucs-swal-html',
      confirmButton: isDanger ? 'ucs-swal-btn-danger' : 'ucs-swal-btn-confirm',
      cancelButton: 'ucs-swal-btn-cancel',
      actions: 'ucs-swal-actions',
    },
    buttonsStyling: false,
  });

  return result.isConfirmed;
}

/**
 * Confirmación de eliminación permanente (Acción Crítica / Peligrosa)
 */
export async function confirmDelete(
  itemName: string,
  extraNote: string = 'Esta acción no se puede deshacer.'
): Promise<boolean> {
  return confirmModal({
    title: '¿Eliminar permanentemente?',
    html: `
      <div style="font-size: 0.95rem; line-height: 1.5;">
        <p style="margin-bottom: 0.6rem;">¿Deseas eliminar permanentemente a <strong>${itemName}</strong>?</p>
        <p style="font-size: 0.82rem; color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 0.45rem 0.75rem; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.25);">
          ⚠️ ${extraNote}
        </p>
      </div>
    `,
    icon: 'warning',
    confirmText: 'Sí, eliminar',
    cancelText: 'Cancelar',
    isDanger: true,
  });
}

/**
 * Confirmación para cambiar el estado activo/inactivo de un recurso
 */
export async function confirmToggleActive(
  itemName: string,
  willBeActive: boolean,
  entityType: string = 'usuario'
): Promise<boolean> {
  if (willBeActive) {
    return confirmModal({
      title: `¿Reactivar ${entityType}?`,
      html: `
        <div style="font-size: 0.95rem; line-height: 1.5;">
          <p style="margin-bottom: 0.5rem;">¿Deseas reactivar a <strong>${itemName}</strong>?</p>
          <p style="font-size: 0.83rem; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 0.45rem 0.75rem; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.25);">
            ✅ Volverá a estar habilitado para registrar turnos y acceder al sistema.
          </p>
        </div>
      `,
      icon: 'question',
      confirmText: 'Sí, reactivar',
      cancelText: 'Cancelar',
      isDanger: false,
    });
  } else {
    return confirmModal({
      title: `¿Inactivar ${entityType}?`,
      html: `
        <div style="font-size: 0.95rem; line-height: 1.5;">
          <p style="margin-bottom: 0.5rem;">¿Deseas inactivar a <strong>${itemName}</strong>?</p>
          <p style="font-size: 0.83rem; color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 0.45rem 0.75rem; border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.25);">
            ⏸️ Al inactivarlo, no podrá marcar asistencia en el Kiosco ni ingresar al sistema web. Su historial se preservará intacto.
          </p>
        </div>
      `,
      icon: 'warning',
      confirmText: 'Sí, inactivar',
      cancelText: 'Cancelar',
      isDanger: true,
    });
  }
}

/**
 * Notificación Toast flotante no invasiva
 */
export function showToast(title: string, icon: SweetAlertIcon = 'success') {
  const theme = getSwalThemeColors();
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
    background: theme.background,
    color: theme.color,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
    customClass: {
      popup: 'ucs-swal-toast',
    },
  });

  Toast.fire({
    icon,
    title,
  });
}

/**
 * Modal de Alerta informativa o de error
 */
export async function showAlert(
  title: string,
  text?: string,
  icon: SweetAlertIcon = 'info'
): Promise<void> {
  const theme = getSwalThemeColors();
  await Swal.fire({
    title,
    text,
    icon,
    background: theme.background,
    color: theme.color,
    backdrop: theme.backdrop,
    confirmButtonText: 'Entendido',
    customClass: {
      popup: 'ucs-swal-popup',
      title: 'ucs-swal-title',
      htmlContainer: 'ucs-swal-html',
      confirmButton: 'ucs-swal-btn-confirm',
    },
    buttonsStyling: false,
  });
}

export function showError(title: string, text?: string) {
  return showAlert(title, text, 'error');
}

export function showSuccess(title: string, text?: string) {
  return showAlert(title, text, 'success');
}
