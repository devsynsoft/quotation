import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function SupplierForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [supplier, setSupplier] = React.useState({
    name: '',
    phone: '',
    area_code: '',
    state: '',
    city: ''
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('suppliers')
      .insert([{
        ...supplier,
        user_id: user.id
      }]);

    setLoading(false);

    if (error) {
      console.error('Error saving supplier:', error);
      return;
    }

    navigate('/suppliers');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add Supplier</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={supplier.name}
            onChange={e => setSupplier(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Area Code</label>
            <input
              type="text"
              required
              maxLength={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={supplier.area_code}
              onChange={e => setSupplier(prev => ({ ...prev, area_code: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="text"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={supplier.phone}
              onChange={e => setSupplier(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">State</label>
            <input
              type="text"
              required
              maxLength={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={supplier.state}
              onChange={e => setSupplier(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">City</label>
            <input
              type="text"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={supplier.city}
              onChange={e => setSupplier(prev => ({ ...prev, city: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Save Supplier'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}