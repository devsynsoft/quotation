import toast, { Toaster } from 'react-hot-toast';

export const hotToast = toast;

export { Toaster };

// Wrapper para facilitar o uso do toast
export const customToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 4000,
      position: 'top-right',
    });
  },
  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-right',
    });
  },
  loading: (message: string): string => {
    return toast.loading(message, {
      position: 'top-right',
    });
  },
  warning: (message: string) => {
    toast(message, {
      duration: 4000,
      position: 'top-right',
      icon: '⚠️',
      style: {
        background: '#FFF8E1',
        color: '#F57C00',
        border: '1px solid #FFE082',
      },
    });
  }
};

// Exportação padrão para compatibilidade com código existente
export default customToast;
