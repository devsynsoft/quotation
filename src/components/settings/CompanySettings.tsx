import React from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Company {
  name: string;
  document: string;
}

export function CompanySettings() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [company, setCompany] = React.useState<Company>({
    name: '',
    document: ''
  });

  React.useEffect(() => {
    fetchCompany();
  }, []);

  async function fetchCompany() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: companyUser } = await supabase
      .from('company_users')
      .select('companies (*)')
      .eq('user_id', user.id)
      .single();

    if (companyUser?.companies) {
      setCompany(companyUser.companies);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: existingCompany } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (existingCompany) {
        // Update existing company
        const { error: updateError } = await supabase
          .from('companies')
          .update(company)
          .eq('id', existingCompany.company_id);

        if (updateError) throw updateError;
      } else {
        // Create new company and link user
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert([company])
          .select()
          .single();

        if (createError) throw createError;

        const { error: linkError } = await supabase
          .from('company_users')
          .insert([{
            company_id: newCompany.id,
            user_id: user.id,
            role: 'admin'
          }]);

        if (linkError) throw linkError;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configurações da Empresa</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome da Empresa</label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={company.name}
            onChange={e => setCompany(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">CNPJ</label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={company.document}
            onChange={e => setCompany(prev => ({ ...prev, document: e.target.value }))}
            placeholder="00.000.000/0000-00"
          />
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
              'Salvar Empresa'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}