import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function CompanyForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [company, setCompany] = React.useState({
    name: '',
    document: '',
    active: true,
    state: 'SP' // Estado padrão
  });
  const [adminEmail, setAdminEmail] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create company
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert([company])
        .select()
        .single();

      if (companyError) throw companyError;

      // Get or create user
      const { data: { user }, error: userError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: Math.random().toString(36).slice(-8), // Random password
        email_confirm: true
      });

      if (userError) throw userError;

      // Link user to company as admin
      const { error: linkError } = await supabase
        .from('company_users')
        .insert([{
          company_id: newCompany.id,
          user_id: user.id,
          role: 'admin'
        }]);

      if (linkError) throw linkError;

      navigate('/admin/companies');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setCompany(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nova Empresa</h1>

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
            onChange={handleInputChange}
            name="name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">CNPJ</label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={company.document}
            onChange={handleInputChange}
            name="document"
            placeholder="00.000.000/0000-00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Estado (UF)</label>
          <select
            id="state"
            name="state"
            value={company.state}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="AC">Acre</option>
            <option value="AL">Alagoas</option>
            <option value="AP">Amapá</option>
            <option value="AM">Amazonas</option>
            <option value="BA">Bahia</option>
            <option value="CE">Ceará</option>
            <option value="DF">Distrito Federal</option>
            <option value="ES">Espírito Santo</option>
            <option value="GO">Goiás</option>
            <option value="MA">Maranhão</option>
            <option value="MT">Mato Grosso</option>
            <option value="MS">Mato Grosso do Sul</option>
            <option value="MG">Minas Gerais</option>
            <option value="PA">Pará</option>
            <option value="PB">Paraíba</option>
            <option value="PR">Paraná</option>
            <option value="PE">Pernambuco</option>
            <option value="PI">Piauí</option>
            <option value="RJ">Rio de Janeiro</option>
            <option value="RN">Rio Grande do Norte</option>
            <option value="RS">Rio Grande do Sul</option>
            <option value="RO">Rondônia</option>
            <option value="RR">Roraima</option>
            <option value="SC">Santa Catarina</option>
            <option value="SP">São Paulo</option>
            <option value="SE">Sergipe</option>
            <option value="TO">Tocantins</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email do Administrador</label>
          <input
            type="email"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
            placeholder="admin@empresa.com"
          />
          <p className="mt-1 text-sm text-gray-500">
            Uma senha temporária será gerada e enviada para este email
          </p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="active"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            checked={company.active}
            onChange={e => setCompany(prev => ({ ...prev, active: e.target.checked }))}
          />
          <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
            Empresa ativa
          </label>
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
              'Criar Empresa'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}