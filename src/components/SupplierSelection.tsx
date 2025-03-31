import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Search, Send } from 'lucide-react';
import { sendBulkWhatsAppMessages } from '../services/evolutionApi';
import { customToast, hotToast } from '../lib/toast';

interface Supplier {
  id: string;
  name: string;
  phone: string;
  area_code: string;
  city: string;
  state: string;
  categories?: string[];
  vehicle_type?: string;
}

interface SupplierSelectionProps {
  quotationId: string;
  onFinish?: () => void;
  vehicleDetails: {
    marca: string;
    modelo: string;
    ano: string;
    placa?: string;
    chassis?: string;
  };
  parts: any[];
  images?: string[];
}

const SupplierSelection: React.FC<SupplierSelectionProps> = ({ 
  quotationId, 
  onFinish,
  vehicleDetails,
  parts,
  images = []
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    ddd: '',
    city: '',
    state: '',
    part_type: '',
    specialization: '',
    name: ''
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadSuppliers();
    loadMessageTemplate();
  }, []);

  const loadMessageTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('content')
        .eq('is_default', true)
        .single();

      if (error) throw error;
      if (data) {
        // Monta a mensagem com as variáveis
        let message = '';
        
        // Adiciona as variáveis do veículo
        message += `{vehicle_brand}${vehicleDetails.marca || ''}\n`;
        message += `{vehicle_model}${vehicleDetails.modelo || ''}\n`;
        message += `{vehicle_year}${vehicleDetails.ano || ''}\n`;
        message += `{vehicle_chassis}${vehicleDetails.chassis || ''}\n\n`;

        // Formata a lista de peças
        const partsText = parts.map(part => 
          `⭕ ${part.description}
Cod. Peça: ${part.code || '-'}
Quantidade: ${part.quantity}`
        ).join('\n\n');

        // Adiciona a lista de peças
        message += `{parts_list}${partsText}\n\n`;

        setMessageTemplate(message);
      }
    } catch (err) {
      console.error('Erro ao carregar template:', err);
    }
  };

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      // Construir a consulta com os filtros
      let query = supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      // Aplicar filtros
      if (filters.ddd) {
        query = query.eq('area_code', filters.ddd);
      }
      if (filters.city) {
        query = query.eq('city', filters.city);
      }
      if (filters.state) {
        query = query.eq('state', filters.state);
      }
      if (filters.part_type && filters.part_type !== '') {
        query = query.eq('parts_type', filters.part_type);
      }
      if (filters.specialization && filters.specialization !== '') {
        query = query.eq('specialization', filters.specialization);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      console.log('Fornecedores filtrados:', data);
      
      // Aplicar filtro de nome se existir
      let filteredData = data || [];
      if (filters.name && filters.name.trim() !== '') {
        const searchTerm = filters.name.toLowerCase();
        filteredData = filteredData.filter(supplier => 
          supplier.name?.toLowerCase().includes(searchTerm)
        );
      }
      
      setSuppliers(filteredData);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
      customToast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  // Atualiza os fornecedores quando os filtros mudam
  useEffect(() => {
    loadSuppliers();
  }, [filters]);

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const sendQuotationRequests = async () => {
    if (!quotationId) {
      customToast.error('ID da cotação não encontrado');
      return;
    }

    if (!messageTemplate.trim()) {
      customToast.error('Por favor, defina a mensagem que será enviada');
      return;
    }

    if (images.length > 0 && !coverImage) {
      customToast.error('Por favor, selecione uma foto de capa');
      return;
    }

    try {
      setSending(true);
      const toastId = customToast.loading('Enviando solicitações...');

      // Verifica se todos os fornecedores têm telefone
      const validSuppliers = suppliers.filter(supplier => 
        selectedSuppliers.includes(supplier.id) && 
        supplier.area_code && 
        supplier.phone && 
        supplier.phone.trim() !== ''
      );

      if (validSuppliers.length === 0) {
        throw new Error('Nenhuma mensagem válida para enviar. Verifique se os fornecedores têm DDD e telefone cadastrados.');
      }

      // Prepara os dados das solicitações
      const requests = validSuppliers.map(supplier => ({
        quotation_id: quotationId,
        supplier_id: supplier.id,
        status: 'pending',
        cover_image: coverImage
      }));

      // Insere as solicitações e obtém os IDs
      const { data: insertedRequests, error: requestError } = await supabase
        .from('quotation_requests')
        .insert(requests)
        .select('id, supplier_id');

      if (requestError) throw requestError;

      // Prepara e envia as mensagens WhatsApp
      const messages = validSuppliers.map(supplier => {
        const request = insertedRequests?.find(r => r.supplier_id === supplier.id);
        
        let message = messageTemplate;
        // Adiciona o link no formato correto
        message += `{quotation_link}${window.location.origin}/quotation-response/${quotationId}/${request?.id}`;

        return { 
          areaCode: supplier.area_code,
          phone: supplier.phone,
          message,
          imageUrl: coverImage || undefined,
          documentUrl: undefined,
          useTemplates: true
        };
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      await sendBulkWhatsAppMessages(messages, user.id);

      hotToast.dismiss(toastId);
      customToast.success('Solicitações enviadas com sucesso!');
      
      if (onFinish) {
        onFinish();
      }

      // Redireciona para a página de detalhes da cotação
      navigate(`/quotations/${quotationId}`);
    } catch (err: any) {
      console.error('Erro ao enviar solicitações:', err);
      customToast.error(err.message || 'Erro ao enviar solicitações');
    } finally {
      setSending(false);
    }
  };

  const handleSelectAll = () => {
    const allSelected = suppliers.every(supplier => 
      selectedSuppliers.includes(supplier.id)
    );
    
    if (allSelected) {
      // Se todos já estão selecionados, desmarca apenas os fornecedores atualmente filtrados
      const newSelectedSuppliers = selectedSuppliers.filter(
        id => !suppliers.some(supplier => supplier.id === id)
      );
      setSelectedSuppliers(newSelectedSuppliers);
    } else {
      // Senão, adiciona os fornecedores filtrados aos já selecionados
      const supplierIdsToAdd = suppliers
        .filter(supplier => !selectedSuppliers.includes(supplier.id))
        .map(supplier => supplier.id);
      
      setSelectedSuppliers([...selectedSuppliers, ...supplierIdsToAdd]);
    }
  };

  const handleClearSelection = () => {
    setSelectedSuppliers([]);
  };

  return (
    <div className="space-y-6">
      {/* Seleção da Foto de Capa */}
      {images && images.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">Selecione a Foto de Capa</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <div 
                key={index} 
                className={`relative cursor-pointer rounded-lg overflow-hidden ${
                  coverImage === image ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setCoverImage(image)}
              >
                <img 
                  src={image} 
                  alt={`Foto ${index + 1}`} 
                  className="w-full h-32 object-cover" 
                  onError={(e) => {
                    console.error('Erro ao carregar imagem:', e);
                    e.currentTarget.src = '/placeholder-image.jpg'; // Imagem de fallback
                  }}
                />
                {coverImage === image && (
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                    <div className="bg-white text-blue-500 px-2 py-1 rounded text-sm font-medium">
                      Selecionada
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template da Mensagem */}
      <div className="bg-white shadow rounded-lg p-6">
        <p className="mb-6">{messageTemplate}</p>
      </div>

      {/* Seleção de Fornecedores */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Selecionar Fornecedores</h2>
        
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DDD</label>
            <select
              value={filters.ddd}
              onChange={e => setFilters(prev => ({ ...prev, ddd: e.target.value }))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">Todos</option>
              {Array.from(new Set(suppliers.map(s => s.area_code))).sort().map(ddd => (
                <option key={ddd} value={ddd}>{ddd}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
            <select
              value={filters.city}
              onChange={e => setFilters(prev => ({ ...prev, city: e.target.value }))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">Todas</option>
              {Array.from(new Set(suppliers.map(s => s.city))).sort().map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={filters.state}
              onChange={e => setFilters(prev => ({ ...prev, state: e.target.value }))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">Todos</option>
              {Array.from(new Set(suppliers.map(s => s.state))).sort().map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Peças</label>
            <select
              value={filters.part_type}
              onChange={e => setFilters(prev => ({ ...prev, part_type: e.target.value }))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">Todos</option>
              <option value="new">Apenas peças novas</option>
              <option value="used">Apenas peças usadas</option>
              <option value="all">Todas</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Especialização</label>
            <select
              value={filters.specialization}
              onChange={e => setFilters(prev => ({ ...prev, specialization: e.target.value }))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              data-component-name="SupplierSelection"
            >
              <option value="">Todos</option>
              <option value="bodywork">Lataria</option>
              <option value="mechanical">Mecânica</option>
              <option value="lights">Faróis, Lanternas e Retrovisores</option>
              <option value="tires">Pneus</option>
              <option value="finishing">Acabamento</option>
              <option value="others">Outros</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>

        {/* Lista de Fornecedores */}
        <div className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Fornecedores</h3>
              <p className="text-sm text-gray-500">
                {suppliers.length} fornecedor{suppliers.length !== 1 ? 'es' : ''} filtrado{suppliers.length !== 1 ? 's' : ''} |  
                {selectedSuppliers.length} selecionado{selectedSuppliers.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="Buscar fornecedor..."
                  value={filters.name}
                  onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
                  className="pl-10 pr-4 py-2 h-9 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2" />
              </div>
              <button
                onClick={handleSelectAll}
                type="button"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {suppliers.every(supplier => selectedSuppliers.includes(supplier.id))
                  ? "Desmarcar Todos"
                  : "Selecionar Todos"}
              </button>
              <button
                onClick={handleClearSelection}
                type="button"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Limpar Seleção
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : suppliers.length > 0 ? (
            <div className="space-y-4">
              {suppliers.map(supplier => (
                <div
                  key={supplier.id}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSuppliers.includes(supplier.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => toggleSupplier(supplier.id)}
                >
                  <div>
                    <p className="font-medium">{supplier.name}</p>
                    <p className="text-sm text-gray-500">
                      {supplier.city}, {supplier.state} ({supplier.area_code}) {supplier.phone}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.includes(supplier.id)}
                      onChange={() => toggleSupplier(supplier.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              Nenhum fornecedor encontrado com os filtros selecionados
            </p>
          )}

          {/* Botão de Enviar */}
          <div className="flex justify-end mt-6">
            <button
              onClick={sendQuotationRequests}
              disabled={selectedSuppliers.length === 0 || sending}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 mr-2" />
              {sending ? 'Enviando...' : `Enviar para ${selectedSuppliers.length} fornecedor${selectedSuppliers.length !== 1 ? 'es' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierSelection;
