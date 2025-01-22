import { toast as hotToast } from 'react-hot-toast';

export const toast = {
  success: (message: string) => {
    hotToast.success(message, {
      duration: 4000,
      position: 'top-right',
    });
  },
  error: (message: string) => {
    hotToast.error(message, {
      duration: 4000,
      position: 'top-right',
    });
  },
  loading: (message: string) => {
    return hotToast.loading(message, {
      position: 'top-right',
    });
  },
};
