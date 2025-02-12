import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Search, Send } from 'lucide-react';
import { sendBulkWhatsAppMessages } from '../services/evolutionApi';
import { toast } from '../lib/toast';

interface Supplier {
  id: string;
  name: string;
  phone: string;
  area_code: string;
  city: string;
  state: string;
  categories?: string[];
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
    specialization: ''
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
        // Substitui as variáveis no template
        let template = data.content;
        
        // Substitui as variáveis do veículo
        const veiculoText = `${vehicleDetails.marca} ${vehicleDetails.modelo} ${vehicleDetails.ano}`.trim();
        template = template.replace(/{vehicle_brand}/g, vehicleDetails.marca || '')
                         .replace(/{vehicle_model}/g, vehicleDetails.modelo || '')
                         .replace(/{vehicle_year}/g, vehicleDetails.ano || '')
                         .replace(/{vehicle_chassis}/g, vehicleDetails.chassis || '');

        // Formata a lista de peças
        const partsText = parts.map(part => 
          `- ${part.operation} - ${part.code}
${part.description}
Tipo: ${part.part_type === 'genuine' ? 'Genuína' : part.part_type === 'used' ? 'Usada' : 'Nova'}
Quantidade: ${part.quantity}
${part.painting_hours > 0 ? `Horas Pintura: ${part.painting_hours}` : ''}`
        ).join('\n\n');

        // Substitui a lista de peças
        template = template.replace(/{parts_list}/g, partsText);

        setMessageTemplate(template);
      }
    } catch (err) {
      console.error('Erro ao carregar template:', err);
    }
  };

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const sendQuotationRequests = async () => {
    if (!quotationId) {
      toast.error('ID da cotação não encontrado');
      return;
    }

    if (!messageTemplate.trim()) {
      toast.error('Por favor, defina a mensagem que será enviada');
      return;
    }

    if (images.length > 0 && !coverImage) {
      toast.error('Por favor, selecione uma foto de capa');
      return;
    }

    try {
      setSending(true);
      const toastId = toast.loading('Enviando solicitações...');

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
        message = message.replace(
          /{quotation_link}/g, 
          `${window.location.origin}/quotation-response/${quotationId}/${request?.id}`
        );

        return { 
          areaCode: supplier.area_code,
          phone: supplier.phone,
          message,
          imageUrl: coverImage // Adiciona a imagem de capa selecionada
        };
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      await sendBulkWhatsAppMessages(messages, user.id);

      toast.success('Solicitações enviadas com sucesso!', { id: toastId });
      
      if (onFinish) {
        onFinish();
      }

      // Redireciona para a página de detalhes da cotação
      navigate(`/quotations/${quotationId}`);
    } catch (err: any) {
      console.error('Erro ao enviar solicitações:', err);
      toast.error(err.message || 'Erro ao enviar solicitações');
    } finally {
      setSending(false);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    if (filters.ddd && supplier.area_code !== filters.ddd) return false;
    if (filters.city && !supplier.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.state && supplier.state.toLowerCase() !== filters.state.toLowerCase()) return false;
    if (filters.specialization && !supplier.categories?.includes(filters.specialization)) return false;
    if (filters.part_type && !supplier.categories?.includes(filters.part_type)) return false;
    return true;
  });

  const handleSelectAll = () => {
    const allSelected = filteredSuppliers.every(supplier => 
      selectedSuppliers.includes(supplier.id)
    );
    
    if (allSelected) {
      // Se todos já estão selecionados, desmarca todos
      setSelectedSuppliers([]);
    } else {
      // Senão, seleciona todos os fornecedores filtrados
      setSelectedSuppliers(filteredSuppliers.map(s => s.id));
    }
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
              <option value="genuine">Genuínas</option>
              <option value="new">Novas</option>
              <option value="used">Usadas</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Especialização</label>
            <select
              value={filters.specialization}
              onChange={e => setFilters(prev => ({ ...prev, specialization: e.target.value }))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">Todas</option>
              {Array.from(new Set(suppliers.flatMap(s => s.categories || []))).sort().map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de Fornecedores */}
        <div className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Fornecedores</h3>
            <button
              onClick={handleSelectAll}
              type="button"
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Selecionar Todos
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : filteredSuppliers.length > 0 ? (
            <div className="space-y-4">
              {filteredSuppliers.map(supplier => (
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
                  <input
                    type="checkbox"
                    checked={selectedSuppliers.includes(supplier.id)}
                    onChange={() => toggleSupplier(supplier.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
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
