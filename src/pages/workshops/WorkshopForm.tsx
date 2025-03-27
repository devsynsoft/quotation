import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { customToast } from '../../lib/toast';

type Workshop = Database['public']['Tables']['workshops']['Row'];
type WorkshopInsert = Database['public']['Tables']['workshops']['Insert'];

// Interface para a resposta da API do Brasil API
interface CNPJResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  telefone: string;
  email: string;
}

export default function WorkshopForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = id !== undefined;
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchingCNPJ, setSearchingCNPJ] = useState(false);
  const [cnpjInput, setCnpjInput] = useState('');
  
  const [formData, setFormData] = useState<WorkshopInsert>({
    name: '',
    phone: '',
    email: '',
    state: '',
    city: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    zip_code: '',
    contact_person: '',
    is_active: true
  });

  useEffect(() => {
    if (isEditMode) {
      fetchWorkshop();
    }
  }, [id]);

  async function fetchWorkshop() {
    if (!id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setFormData(data);
        // Se a oficina tiver um CNPJ no futuro, podemos definir aqui
        // setCnpjInput(data.cnpj);
      }
    } catch (error) {
      console.error('Error fetching workshop:', error);
      customToast.error('Erro ao carregar dados da oficina. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Atualiza o campo de entrada CNPJ
    setCnpjInput(e.target.value);
  };

  const searchCNPJ = async () => {
    // Limpa o CNPJ para ter apenas números
    const cleanCNPJ = cnpjInput.replace(/\D/g, '');
    
    if (cleanCNPJ.length !== 14) {
      customToast.error('CNPJ inválido. Por favor, digite um CNPJ válido com 14 dígitos.');
      return;
    }
    
    try {
      setSearchingCNPJ(true);
      
      // Faz a requisição para a API do Brasil API
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar CNPJ: ${response.statusText}`);
      }
      
      const data: CNPJResponse = await response.json();
      
      // Preenche o formulário com os dados retornados
      setFormData({
        ...formData,
        name: data.nome_fantasia || data.razao_social,
        street: data.logradouro || '',
        number: data.numero || '',
        complement: data.complemento || '',
        neighborhood: data.bairro || '',
        city: data.municipio || '',
        state: data.uf || '',
        zip_code: data.cep ? data.cep.replace(/\D/g, '') : '',
        phone: data.telefone ? data.telefone.split('/')[0].trim() : '',
        email: data.email || ''
      });
      
      customToast.success('Dados do CNPJ carregados com sucesso!');
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
      customToast.error('Erro ao buscar dados do CNPJ. Verifique se o CNPJ é válido.');
    } finally {
      setSearchingCNPJ(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      // Adiciona timestamps
      const now = new Date().toISOString();
      const dataToSave = {
        ...formData,
        updated_at: now,
        ...(isEditMode ? {} : { created_at: now })
      };
      
      if (isEditMode) {
        // Atualiza oficina existente
        const { error } = await supabase
          .from('workshops')
          .update(dataToSave)
          .eq('id', id);
          
        if (error) throw error;
      } else {
        // Cria nova oficina
        const { error } = await supabase
          .from('workshops')
          .insert([dataToSave]);
          
        if (error) throw error;
      }
      
      navigate('/workshops');
    } catch (error) {
      console.error('Error saving workshop:', error);
      customToast.error('Erro ao salvar oficina. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/workshops')}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditMode ? 'Editar Oficina' : 'Nova Oficina'}
        </h1>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CNPJ para busca automática
            </label>
            <div className="flex">
              <input
                type="text"
                value={cnpjInput}
                onChange={handleCNPJChange}
                placeholder="Digite o CNPJ para buscar os dados"
                className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={searchCNPJ}
                disabled={searchingCNPJ}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {searchingCNPJ ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Digite o CNPJ e clique no botão de busca para preencher automaticamente os dados da oficina.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Oficina*
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone*
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail*
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado*
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cidade*
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rua*
              </label>
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número*
              </label>
              <input
                type="text"
                name="number"
                value={formData.number}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Complemento
              </label>
              <input
                type="text"
                name="complement"
                value={formData.complement || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bairro*
              </label>
              <input
                type="text"
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CEP*
              </label>
              <input
                type="text"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pessoa de Contato*
              </label>
              <input
                type="text"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                Ativo
              </label>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/workshops')}
              className="mr-4 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
