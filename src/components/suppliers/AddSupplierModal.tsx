import React from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { FormField, FormSelect, FormStyles } from '../ui/forms';

// Mapeamento para exibição amigável
const SPECIALIZATION_LABELS: Record<string, string> = {
  bodywork: 'Lataria',
  mechanical: 'Mecânica',
  lights: 'Elétrica',
  finishing: 'Acabamento',
  others: 'Outros',
  all: 'Todas',
};

type Specialization = {
  id: string;
  name: string;
};
import { useAuth } from '../../hooks/useAuth';
import { useIBGE } from '../../hooks/useIBGE';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (supplier: Supplier) => void;
  initialData?: Supplier;
}

export function AddSupplierModal({ isOpen, onClose, onSuccess, initialData }: AddSupplierModalProps) {
  const { user } = useAuth();
  const { states, cities, loading: loadingLocations, error: locationError, fetchCities } = useIBGE();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selectedStateId, setSelectedStateId] = React.useState(0);
  const [selectedCityId, setSelectedCityId] = React.useState(0);
  const [supplier, setSupplier] = React.useState({
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    area_code: initialData?.area_code || '',
    state: initialData?.state || '',
    city: initialData?.city || '',
    street: initialData?.street || '',
    number: initialData?.number || '',
    complement: initialData?.complement || '',
    neighborhood: initialData?.neighborhood || '',
    zip_code: initialData?.zip_code || '',
    parts_type: initialData?.parts_type || 'new',
    specialization_id: initialData?.specialization_id || '', // novo campo
  });

  const [specializations, setSpecializations] = React.useState<Specialization[]>([]);
  const [loadingSpecializations, setLoadingSpecializations] = React.useState(false);

  // Atualiza os dados do fornecedor quando o modal abrir
  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setSupplier({
          name: initialData.name || '',
          phone: initialData.phone || '',
          area_code: initialData.area_code || '',
          state: initialData.state || '',
          city: initialData.city || '',
          street: initialData.street || '',
          number: initialData.number || '',
          complement: initialData.complement || '',
          neighborhood: initialData.neighborhood || '',
          zip_code: initialData.zip_code || '',
          parts_type: initialData.parts_type || 'new',
          specialization_id: initialData.specialization_id || '',
        });
      } else {
        setSupplier({
          name: '',
          phone: '',
          area_code: '',
          state: '',
          city: '',
          street: '',
          number: '',
          complement: '',
          neighborhood: '',
          zip_code: '',
          parts_type: 'all',
          specialization_id: '',
        });
      }
    }
  }, [isOpen, initialData]);

  // Buscar especializações dinâmicas
  React.useEffect(() => {
    setLoadingSpecializations(true);
    supabase
      .from('specializations')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) {
          setSpecializations(data);
        }
        setLoadingSpecializations(false);
      });
  }, [isOpen]);

  // Busca cidades quando o estado muda
  React.useEffect(() => {
    if (selectedStateId) {
      fetchCities(selectedStateId);
    }
  }, [selectedStateId]);

  // Atualiza estado e cidade quando carregados do IBGE
  React.useEffect(() => {
    if (states.length > 0 && initialData?.state) {
      const state = states.find(s => s.sigla === initialData.state);
      if (state) {
        setSelectedStateId(state.id);
      }
    }
  }, [states, initialData]);

  React.useEffect(() => {
    if (cities.length > 0 && initialData?.city) {
      const city = cities.find(c => c.nome === initialData.city);
      if (city) {
        setSelectedCityId(city.id);
      }
    }
  }, [cities, initialData]);

  if (!isOpen) return null;

  // Verifica se o telefone contém apenas números
  function isNumeric(value: string): boolean {
    return /^\d+$/.test(value);
  }

  // Verifica se já existe um fornecedor com o mesmo telefone
  async function checkPhoneExists(): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('area_code', supplier.area_code)
        .eq('phone', supplier.phone);

      if (error) throw error;

      // Se estiver editando um fornecedor, ignora o próprio fornecedor
      if (data && data.length > 0) {
        const existingSupplier = data.find(s => !initialData || s.id !== initialData.id);
        if (existingSupplier) {
          return `Telefone já cadastrado para o fornecedor "${existingSupplier.name}"`;
        }
      }

      return null;
    } catch (err) {
      console.error('Erro ao verificar telefone:', err);
      return 'Erro ao verificar telefone. Por favor, tente novamente.';
    }
  }

  async function validateForm(): Promise<string> {
    if (!supplier.name.trim()) {
      return 'Nome é obrigatório';
    }
    if (!supplier.phone.trim()) {
      return 'Telefone é obrigatório';
    }
    // Validação de formato do telefone
    if (!isNumeric(supplier.phone)) {
      return 'Telefone deve conter apenas números';
    }
    if (supplier.phone.length > 9) {
      return 'Telefone deve ter no máximo 9 dígitos';
    }
    if (!supplier.area_code.trim()) {
      return 'DDD é obrigatório';
    }
    if (!isNumeric(supplier.area_code)) {
      return 'DDD deve conter apenas números';
    }
    if (supplier.area_code.length > 3) {
      return 'DDD deve ter no máximo 3 dígitos';
    }
    
    // Verifica se o telefone já existe
    const phoneError = await checkPhoneExists();
    if (phoneError) {
      return phoneError;
    }
    
    if (!selectedStateId) {
      return 'Estado é obrigatório';
    }
    if (!selectedCityId) {
      return 'Cidade é obrigatória';
    }
    if (supplier.zip_code && supplier.zip_code.length !== 8) {
      return 'CEP deve ter 8 dígitos';
    }
    if (!supplier.parts_type) {
      return 'Tipo de peças é obrigatório';
    }
    if (!supplier.specialization_id) {
      return 'Especialização é obrigatória';
    }
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    const validationError = await validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    if (!user) {
      setError('Usuário não autenticado');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const selectedState = states.find(s => s.id === selectedStateId);
      const selectedCity = cities.find(c => c.id === selectedCityId);

      if (!selectedState || !selectedCity) {
        throw new Error('Estado ou cidade inválidos');
      }

      const supplierData = {
        ...supplier,
        state: selectedState.sigla,
        city: selectedCity.nome,
        specialization_id: supplier.specialization_id,
      };

      const { data, error: dbError } = initialData
        ? await supabase
            .from('suppliers')
            .update(supplierData)
            .eq('id', initialData.id)
            .select()
            .single()
        : await supabase
            .from('suppliers')
            .insert([supplierData])
            .select()
            .single();

      if (dbError) {
        console.error('Erro Supabase:', dbError);
        throw dbError;
      }

      if (data) {
        onSuccess(data);
        onClose();
      }
    } catch (err) {
      console.error('Erro ao salvar fornecedor:', err);
      setError('Erro ao salvar fornecedor. Por favor, verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stateId = parseInt(e.target.value);
    setSelectedStateId(stateId);
    setSelectedCityId(0);
    setSupplier(prev => ({
      ...prev,
      state: '',
      city: ''
    }));
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityId = parseInt(e.target.value);
    setSelectedCityId(cityId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {initialData ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <FormField
            label="Nome"
            type="text"
            value={supplier.name}
            onChange={(e) => setSupplier(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="DDD"
              type="text"
              value={supplier.area_code}
              onChange={(e) => {
                // Permite apenas números e limita a 3 dígitos
                const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                setSupplier(prev => ({ ...prev, area_code: value }));
              }}
              required
              maxLength={3}
              placeholder="Apenas números"
            />

            <FormField
              label="Telefone"
              type="text"
              value={supplier.phone}
              onChange={(e) => {
                // Permite apenas números e limita a 9 dígitos
                const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                setSupplier(prev => ({ ...prev, phone: value }));
              }}
              required
              maxLength={9}
              placeholder="Apenas números - máx. 9 dígitos"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Estado"
              value={selectedStateId}
              onChange={handleStateChange}
              required
            >
              <option value="">Selecione um estado</option>
              {states.map(state => (
                <option key={state.id} value={state.id}>
                  {state.nome}
                </option>
              ))}
            </FormSelect>

            <FormSelect
              label="Cidade"
              value={selectedCityId}
              onChange={handleCityChange}
              required
              disabled={!selectedStateId || cities.length === 0}
            >
              <option value="">Selecione uma cidade</option>
              {cities.map(city => (
                <option key={city.id} value={city.id}>
                  {city.nome}
                </option>
              ))}
            </FormSelect>
          </div>

          <FormField
            label="CEP"
            type="text"
            value={supplier.zip_code}
            onChange={(e) => setSupplier(prev => ({ ...prev, zip_code: e.target.value }))}
            maxLength={8}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Rua"
              type="text"
              value={supplier.street}
              onChange={(e) => setSupplier(prev => ({ ...prev, street: e.target.value }))}
            />

            <FormField
              label="Número"
              type="text"
              value={supplier.number}
              onChange={(e) => setSupplier(prev => ({ ...prev, number: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Bairro"
              type="text"
              value={supplier.neighborhood}
              onChange={(e) => setSupplier(prev => ({ ...prev, neighborhood: e.target.value }))}
            />

            <FormField
              label="Complemento"
              type="text"
              value={supplier.complement}
              onChange={(e) => setSupplier(prev => ({ ...prev, complement: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Tipo de Peças"
              value={supplier.parts_type}
              onChange={(e) => setSupplier(prev => ({ ...prev, parts_type: e.target.value }))}
              required
            >
              <option value="new">Apenas peças novas</option>
              <option value="used">Apenas peças usadas</option>
              <option value="all">Todas</option>
            </FormSelect>

            <FormSelect
              label="Especialização"
              value={supplier.specialization_id}
              onChange={e => setSupplier(prev => ({ ...prev, specialization_id: e.target.value }))}
              required
              disabled={loadingSpecializations}
            >
              <option value="">Selecione uma especialização</option>
              {specializations.map(spec => (
                <option key={spec.id} value={spec.id}>
                  {SPECIALIZATION_LABELS[spec.name] || spec.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </FormSelect>
          </div>

          {error && (
            <div className="text-red-500 text-sm">
              {error}
            </div>
          )}

          {locationError && (
            <div className="text-red-500 text-sm">
              Erro ao carregar localidades: {locationError}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className={FormStyles.secondaryButton}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={FormStyles.primaryButton}
              disabled={loading || loadingLocations}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Salvar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
