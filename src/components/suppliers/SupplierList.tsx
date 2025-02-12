import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { AddSupplierModal } from './AddSupplierModal';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

type Filter = {
  area_code: string;
  parts_type: string;
  state: string;
  city: string;
  specialization: string;
};

export function SupplierList() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | undefined>();
  const [filters, setFilters] = React.useState<Filter>({
    area_code: '',
    parts_type: '',
    state: '',
    city: '',
    specialization: ''
  });
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const partsTypeLabels = {
    new: 'Apenas peças novas',
    used: 'Apenas peças usadas',
    all: 'Todas'
  };

  const specializationLabels = {
    bodywork: 'Lataria',
    mechanical: 'Mecânica',
    lights: 'Faróis, Lanternas e Retrovisores',
    tires: 'Pneus',
    finishing: 'Acabamento',
    others: 'Outros',
    all: 'Todos'
  };

  async function fetchSuppliers() {
    if (!user) {
      setError('Usuário não autenticado');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let query = supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (filters.area_code) {
        query = query.eq('area_code', filters.area_code);
      }
      if (filters.parts_type) {
        query = query.eq('parts_type', filters.parts_type);
      }
      if (filters.state) {
        query = query.eq('state', filters.state);
      }
      if (filters.city) {
        query = query.eq('city', filters.city);
      }
      if (filters.specialization) {
        query = query.eq('specialization', filters.specialization);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro Supabase:', error);
        throw error;
      }
      
      setSuppliers(data || []);
    } catch (err) {
      console.error('Erro ao buscar fornecedores:', err);
      setError('Erro ao carregar fornecedores. Por favor, verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (user) {
      fetchSuppliers();
    }
  }, [user, filters]);

  function handleFilterChange(field: keyof Filter, value: string) {
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value };
      // Limpa cidade se estado for alterado
      if (field === 'state' && value !== prev.state) {
        newFilters.city = '';
      }
      return newFilters;
    });
  }

  function clearFilters() {
    setFilters({
      area_code: '',
      parts_type: '',
      state: '',
      city: '',
      specialization: ''
    });
  }

  function handleEdit(supplier: Supplier) {
    setSelectedSupplier(supplier);
    setIsModalOpen(true);
  }

  function handleSupplierSaved(supplier: Supplier) {
    if (selectedSupplier) {
      // Atualiza o fornecedor na lista
      setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s));
    } else {
      // Adiciona novo fornecedor à lista
      setSuppliers(prev => [...prev, supplier]);
    }
    setSelectedSupplier(undefined);
  }

  async function handleDelete(e: React.MouseEvent, supplierId: string) {
    e.stopPropagation(); // Previne a abertura do modal de edição

    if (!window.confirm('Tem certeza que deseja excluir este fornecedor?')) {
      return;
    }

    try {
      // Primeiro verifica se há cotações relacionadas
      const { data: quotationRequests } = await supabase
        .from('quotation_requests')
        .select('id')
        .eq('supplier_id', supplierId);

      if (quotationRequests && quotationRequests.length > 0) {
        toast.error('Não é possível excluir este fornecedor pois existem cotações associadas a ele');
        return;
      }

      // Se não houver cotações, pode excluir o fornecedor
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierId);

      if (error) throw error;

      toast.success('Fornecedor excluído com sucesso');
      fetchSuppliers(); // Recarrega a lista
    } catch (err) {
      console.error('Erro ao excluir fornecedor:', err);
      toast.error('Erro ao excluir fornecedor');
    }
  }

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        // Divide por quebras de linha e remove linhas vazias
        const rows = text.split(/\r?\n/).filter(line => line.trim());
        // Remove caracteres especiais dos headers e converte para lowercase
        const headers = rows[0].toLowerCase().split(',').map(h => h.trim().replace(/[\r\n]/g, ''));

        const suppliers = rows.slice(1).map((row) => {
          const values = row.split(',');
          const supplier: any = {};

          headers.forEach((header, index) => {
            let value = values[index]?.trim() || '';
            
            // Remove aspas se existirem
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            }

            // Mapeia os headers do CSV para os campos do banco
            const fieldMap: { [key: string]: string } = {
              'nome': 'name',
              'telefone': 'phone',
              'ddd': 'area_code',
              'estado': 'state',
              'cidade': 'city',
              'rua': 'street',
              'numero': 'number',
              'complemento': 'complement',
              'bairro': 'neighborhood',
              'cep': 'zip_code',
              'tipo_pecas': 'parts_type',
              'especializacao': 'specialization'
            };

            const field = fieldMap[header] || header;
            if (field === 'specialization' && !value) {
              value = 'all'; // valor padrão
            }
            if (field === 'parts_type' && !value) {
              value = 'all'; // valor padrão
            }
            supplier[field] = value;
          });

          return supplier;
        }).filter(s => s.name && s.phone); // Filtra apenas fornecedores com nome e telefone

        // Insere os fornecedores no banco
        const { error } = await supabase
          .from('suppliers')
          .insert(suppliers);

        if (error) throw error;

        toast.success(`${suppliers.length} fornecedores importados com sucesso!`);
        fetchSuppliers(); // Recarrega a lista
      } catch (error: any) {
        console.error('Erro ao importar CSV:', error);
        toast.error(error.message || 'Erro ao importar fornecedores. Verifique o formato do arquivo.');
      } finally {
        setImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Limpa o input
        }
      }
    };

    reader.readAsText(file);
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    if (filters.area_code && supplier.area_code !== filters.area_code) {
      return false;
    }
    if (filters.parts_type && supplier.parts_type !== filters.parts_type) {
      return false;
    }
    if (filters.state && supplier.state !== filters.state) {
      return false;
    }
    if (filters.city && supplier.city !== filters.city) {
      return false;
    }
    if (filters.specialization && supplier.specialization !== filters.specialization) {
      return false;
    }
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Fornecedores</h1>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            ref={fileInputRef}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className={`inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {importing ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-gray-500" />
                Importando...
              </>
            ) : (
              <>
                <Plus className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
                Importar CSV
              </>
            )}
          </label>
          <button
            onClick={() => {
              setSelectedSupplier(undefined);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Novo Fornecedor
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DDD
            </label>
            <select
              value={filters.area_code}
              onChange={e => handleFilterChange('area_code', e.target.value)}
              className="w-full pl-4 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos</option>
              {Array.from(new Set(suppliers.map(s => s.area_code))).sort().map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Peça
            </label>
            <select
              value={filters.parts_type}
              onChange={e => handleFilterChange('parts_type', e.target.value)}
              className="w-full pl-4 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos</option>
              <option value="new">Apenas peças novas</option>
              <option value="used">Apenas peças usadas</option>
              <option value="all">Todas</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              UF
            </label>
            <select
              value={filters.state}
              onChange={e => handleFilterChange('state', e.target.value)}
              className="w-full pl-4 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos</option>
              {Array.from(new Set(suppliers.map(s => s.state))).sort().map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cidade
            </label>
            <select
              value={filters.city}
              onChange={e => handleFilterChange('city', e.target.value)}
              className="w-full pl-4 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={!filters.state}
            >
              <option value="">Todas</option>
              {Array.from(new Set(suppliers
                .filter(s => s.state === filters.state)
                .map(s => s.city)))
                .sort()
                .map(city => (
                  <option key={city} value={city}>{city}</option>
                ))
              }
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Especialização
            </label>
            <select
              value={filters.specialization}
              onChange={e => handleFilterChange('specialization', e.target.value)}
              className="w-full pl-4 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todas</option>
              <option value="bodywork">Lataria</option>
              <option value="mechanical">Mecânica</option>
              <option value="lights">Faróis, Lanternas e Retrovisores</option>
              <option value="tires">Pneus</option>
              <option value="finishing">Acabamento</option>
              <option value="others">Outros</option>
              <option value="all">Todos</option>
            </select>
          </div>

          {(filters.area_code || filters.parts_type || filters.state || filters.city || filters.specialization) && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhum fornecedor encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map(supplier => (
            <div
              key={supplier.id}
              className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleEdit(supplier)}
            >
              <h3 className="font-semibold text-lg mb-2">{supplier.name}</h3>
              <p className="text-gray-600 text-sm mb-1">
                {supplier.area_code} {supplier.phone}
              </p>
              <p className="text-gray-600 text-sm">
                {supplier.city} - {supplier.state}
              </p>
              {(supplier.street || supplier.number || supplier.neighborhood || supplier.zip_code) && (
                <>
                  {supplier.street && supplier.number && (
                    <p className="text-gray-600 text-sm mt-2">
                      {supplier.street}, {supplier.number}
                      {supplier.complement && `, ${supplier.complement}`}
                    </p>
                  )}
                  {(supplier.neighborhood || supplier.zip_code) && (
                    <p className="text-gray-600 text-sm">
                      {[
                        supplier.neighborhood,
                        supplier.zip_code && `CEP ${supplier.zip_code}`
                      ].filter(Boolean).join(' - ')}
                    </p>
                  )}
                </>
              )}
              <div className="mt-3 flex flex-wrap gap-2 justify-between items-center">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {partsTypeLabels[supplier.parts_type as keyof typeof partsTypeLabels]}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {specializationLabels[supplier.specialization as keyof typeof specializationLabels]}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, supplier.id)}
                  className="p-1 hover:bg-red-100 rounded-full transition-colors"
                  title="Excluir fornecedor"
                >
                  <Trash2 className="h-5 w-5 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Adicionar/Editar */}
      <AddSupplierModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSupplier(undefined);
        }}
        onSuccess={handleSupplierSaved}
        initialData={selectedSupplier ? { ...selectedSupplier } : undefined}
      />
    </div>
  );
}