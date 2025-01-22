import React from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { maskCNPJ } from '../../utils/masks';

interface CompanyType {
  id: string;
  name: string;
  document: string;
}

export function CompanyConfig() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [company, setCompany] = React.useState<CompanyType>({
    id: '',
    name: '',
    document: ''
  });

  React.useEffect(() => {
    fetchCompany();
  }, []);

  async function fetchCompany() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Primeiro buscar o company_id do usuário
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (companyUser?.company_id) {
        // Depois buscar a empresa
        const { data: company } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyUser.company_id)
          .single();

        if (company) {
          setCompany(company);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar empresa:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Remove máscara do CNPJ
      const document = company.document.replace(/\D/g, '');

      // Inserir/atualizar empresa
      const { data: savedCompany, error: companyError } = await supabase
        .from('companies')
        .upsert({
          id: company.id || undefined,
          name: company.name,
          document
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Se não existir um usuário admin, criar
      if (!company.id && savedCompany) {
        const { error: userError } = await supabase
          .from('company_users')
          .insert({
            company_id: savedCompany.id,
            user_id: user.id,
            role: 'admin'
          });

        if (userError) throw userError;

        // Atualizar o estado com a nova empresa
        setCompany(savedCompany);
      }
    } catch (err) {
      console.error('Erro ao salvar empresa:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleDocumentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = maskCNPJ(e.target.value);
    setCompany(prev => ({ ...prev, document: value }));
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuração da Empresa</h1>

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
            placeholder="Nome da sua empresa"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">CNPJ</label>
          <input
            type="text"
            required
            maxLength={18}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={company.document}
            onChange={handleDocumentChange}
            placeholder="00.000.000/0000-00"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
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
