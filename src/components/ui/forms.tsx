export const FormStyles = {
  container: "bg-white p-8 rounded-xl shadow-lg border border-gray-100",
  title: "text-2xl font-bold text-gray-800 mb-8",
  error: "mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-sm",
  formGroup: "mb-6",
  label: "block text-sm font-semibold text-gray-700 mb-2",
  input: "block w-full h-12 px-4 py-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white",
  select: "block w-full h-12 px-4 py-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white",
  button: {
    primary: "h-12 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 flex items-center justify-center space-x-2 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "h-12 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:ring-4 focus:ring-gray-500 focus:ring-opacity-50 transition-all duration-200 flex items-center justify-center space-x-2 font-semibold shadow-sm"
  },
  buttonGroup: "flex justify-end space-x-4 mt-8",
  grid: {
    cols2: "grid grid-cols-1 md:grid-cols-2 gap-6",
    cols3: "grid grid-cols-1 md:grid-cols-3 gap-6"
  }
};

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> {
  label: string;
  error?: string;
}

export function FormField({ label, error, className = "", ...props }: FormFieldProps) {
  console.log('FormField props:', props);
  return (
    <div className={FormStyles.formGroup}>
      <label className={FormStyles.label}>
        {label}
      </label>
      <input
        {...props}
        className={`${FormStyles.input} ${className}`}
        onChange={(e) => {
          console.log('Input changed:', e.target.value);
          props.onChange?.(e);
        }}
      />
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

export function FormSelect({ label, error, className = "", children, ...props }: FormFieldProps & { children: React.ReactNode }) {
  return (
    <div className={FormStyles.formGroup}>
      <label className={FormStyles.label}>
        {label}
      </label>
      <select
        {...props}
        className={`${FormStyles.select} ${className}`}
      >
        {children}
      </select>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
