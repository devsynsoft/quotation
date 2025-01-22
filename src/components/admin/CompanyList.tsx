import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function CompanyList() {
  const [companies, setCompanies] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    fetchCompanies();
  }, []);

  async function fetchCompanies() {
    const { data, error } = await supabase
      .from('companies')
      .select(`
        *,
        company_users (
          user_id,
          role
        )
      `)
      .order('created_at', { ascending: false });

    setLoading(false);
    
    if (error) {
      setError(error.message);
      return;
    }

    setCompanies(data || []);
  }

  async function toggleCompanyStatus(companyId: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('companies')
      .update({ active: !currentStatus })
      .eq('id', companyId);

    if (error) {
      setError(error.message);
      return;
    }

    await fetchCompanies();
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gerenciar Empresas</h1>
        <Link
          to="/admin/companies/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Empresa
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CNPJ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuários</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {companies.map((company) => (
              <tr key={company.id}>
                <td className="px-6 py-4">{company.name}</td>
                <td className="px-6 py-4">{company.document}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full
                    ${company.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {company.active ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {company.company_users?.length || 0} usuários
                </td>
                <td className="px-6 py-4">
                  {company.whatsapp_config ? (
                    <span className="text-green-600">Configurado</span>
                  ) : (
                    <span className="text-red-600">Não configurado</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleCompanyStatus(company.id, company.active)}
                    className={`px-3 py-1 rounded-md text-sm font-medium
                      ${company.active 
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                  >
                    {company.active ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}