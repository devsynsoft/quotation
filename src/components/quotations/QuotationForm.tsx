import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { QuotationItemForm } from './QuotationItemForm';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  manufacturing_year: number;
  model_year: number;
  chassis: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface Part {
  id: string;
  vehicle_id: string;
  code: string | null;
  description: string;
  part_type: string;
  quantity: number;
  unit_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  vehicle: {
    brand: string;
    model: string;
  };
}

export function QuotationForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = React.useState('');
  const [selectedSuppliers, setSelectedSuppliers] = React.useState<string[]>([]);
  const [quotationItems, setQuotationItems] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetchUserCompany();
    fetchVehicles();
    fetchSuppliers();
  }, []);

  async function fetchUserCompany() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (companyUser) {
      setCompanyId(companyUser.company_id);
    }
  }

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('brand');

    if (error) {
      console.error('Error fetching vehicles:', error);
      return;
    }

    setVehicles(data || []);
  }

  async function fetchSuppliers() {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching suppliers:', error);
      return;
    }

    setSuppliers(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) {
      setError('Company not found');
      return;
    }

    if (!selectedVehicle) {
      setError('Please select a vehicle');
      return;
    }

    if (selectedSuppliers.length === 0) {
      setError('Please select at least one supplier');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create quotations for each supplier
      for (const supplierId of selectedSuppliers) {
        // Create quotation
        const { data: quotation, error: quotationError } = await supabase
          .from('quotations')
          .insert([{
            supplier_id: supplierId,
            vehicle_id: selectedVehicle,
            company_id: companyId,
            user_id: user.id,
            status: 'pending'
          }])
          .select()
          .single();

        if (quotationError) throw quotationError;

        // Create quotation items
        const quotationItemsData = quotationItems.map(item => ({
          quotation_id: quotation.id,
          part_id: item.part_id,
          company_id: companyId,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }));

        const { error: itemsError } = await supabase
          .from('quotation_items')
          .insert(quotationItemsData);

        if (itemsError) throw itemsError;
      }

      navigate('/quotations');
    } catch (err: any) {
      console.error('Error creating quotation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Nova Cotação</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vehicle Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Veículo
          </label>
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            required
          >
            <option value="">Selecione um veículo</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.brand} {vehicle.model} ({vehicle.manufacturing_year}/{vehicle.model_year}) - {vehicle.chassis}
              </option>
            ))}
          </select>
        </div>

        {/* Suppliers Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fornecedores
          </label>
          <div className="mt-2 space-y-2">
            {suppliers.map((supplier) => (
              <label key={supplier.id} className="inline-flex items-center mr-4">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                  value={supplier.id}
                  checked={selectedSuppliers.includes(supplier.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSuppliers([...selectedSuppliers, supplier.id]);
                    } else {
                      setSelectedSuppliers(selectedSuppliers.filter(id => id !== supplier.id));
                    }
                  }}
                />
                <span className="ml-2">{supplier.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Quotation Items */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Peças
          </label>
          <QuotationItemForm
            items={quotationItems}
            onChange={setQuotationItems}
          />
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/quotations')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Cotação'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}