import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, Send, Edit, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendBulkWhatsAppMessages } from '../../services/evolutionApi';
import { customToast } from '../../lib/toast';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';

interface Vehicle {
  brand: string;
  model: string;
  year: string;
  chassis?: string;
}

interface Part {
  description: string;
  quantity: number;
  notes?: string;
  operation?: string;
  code?: string;
  part_type?: string;
  painting_hours?: number;
  unit_price?: number;
  total_price?: number;
  discount_percentage?: number;
  part_cost?: number;
  purchase_date?: string;
  purchase_price?: number;
  purchased?: boolean;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
  area_code: string;
  city: string;
  state: string;
}

interface Quotation {
  id: string;
  created_at: string;
  status: string;
  parts: Part[];
  vehicle_id: string;
  vehicle?: Vehicle;
  description?: string;
  images?: string[];
}

interface QuotationRequest {
  id: string;
  quotation_id: string;
  supplier_id: string;
  status: string;
  sent_at: string | null;
  supplier: {
    id: string;
    name: string;
    area_code: string;
    phone: string;
  };
  response_data?: {
    supplier_name: string;
    supplier_phone: string;
    parts: {
      description: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      notes?: string;
      available: boolean;
      condition?: 'new' | 'used';
    }[];
    total_price: number;
    delivery_time?: string;
    notes?: string;
  };
  responded_at?: string;
}

interface SelectedPart {
  requestId: string;
  partIndex: number;
}

interface BestPrice {
  description: string;
  quantity: number;
  supplier: {
    id: string;
    name: string;
  };
  unit_price: number;
  total_price: number;
  available: boolean;
  purchased?: boolean;
  regulation_price?: number;
  condition?: 'new' | 'used';
}

export function QuotationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [requests, setRequests] = useState<QuotationRequest[]>([]);
  const [quotationRequests, setQuotationRequests] = useState<QuotationRequest[]>([]);
  const [sendingMessages, setSendingMessages] = useState<{ [key: string]: boolean }>({});
  const [selectedParts, setSelectedParts] = useState<Record<string, SelectedPart>>({});
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [bestPrices, setBestPrices] = useState<BestPrice[]>([]);
  const [selectedBestPrices, setSelectedBestPrices] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [apiLog, setApiLog] = useState<string>('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [company, setCompany] = useState<{
    id: string;
    name: string;
    state: string;
  } | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [suppliersListCollapsed, setSuppliersListCollapsed] = useState(true);
  const [showImages, setShowImages] = useState(false);

  useEffect(() => {
    // Carrega o usuário atual
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    if (id) {
      loadQuotationDetails();
      loadMessageTemplate();
      loadQuotationRequests();
      loadPurchaseOrders();
      loadCompanyInfo();
    }
  }, [id]);

  const loadQuotationDetails = async () => {
    if (!id) return;

    try {
      // Carrega a cotação com o veículo
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select(`
          *,
          vehicle:vehicles(*)
        `)
        .eq('id', id)
        .single();

      if (quotationError) throw quotationError;

      // Se tiver veículo mas não tiver imagens, busca as imagens do veículo
      if (quotationData.vehicle && quotationData.vehicle_id && (!quotationData.images || quotationData.images.length === 0)) {
        try {
          const { data: vehicleData, error: vehicleError } = await supabase
            .from('vehicles')
            .select('*')
            .eq('id', quotationData.vehicle_id)
            .single();
            
          if (!vehicleError && vehicleData) {
            // Usar any para acessar o campo images
            const vehicle = vehicleData as any;
            if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
              quotationData.images = vehicle.images;
            }
          }
        } catch (error) {
          console.error('Erro ao buscar imagens do veículo:', error);
        }
      }

      // Carrega as ordens de compra para esta cotação
      const { data: purchaseOrdersData, error: purchaseOrdersError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          created_at,
          items:purchase_order_items(
            id,
            quotation_part_index,
            unit_price,
            quantity
          )
        `)
        .eq('quotation_id', id);

      if (purchaseOrdersError) throw purchaseOrdersError;

      // Atualiza as informações de compra nas peças
      const quotationWithPurchaseInfo = {
        ...quotationData,
        parts: quotationData.parts.map((part: Part, index: number) => {
          const purchaseOrder = purchaseOrdersData?.find(order => 
            order.items?.some(item => item.quotation_part_index === index)
          );
          const purchaseItem = purchaseOrder?.items?.find(item => 
            item.quotation_part_index === index
          );

          if (purchaseItem) {
            return {
              ...part,
              purchased: true,
              purchase_date: purchaseOrder.created_at,
              purchase_price: purchaseItem.unit_price
            };
          }
          return part;
        })
      };

      setQuotation(quotationWithPurchaseInfo);

      // Carrega as solicitações de cotação com dados dos fornecedores
      const { data: requestsData, error: requestsError } = await supabase
        .from('quotation_requests')
        .select(`
          *,
          supplier:suppliers(*)
        `)
        .eq('quotation_id', id);

      if (requestsError) {
        console.error('Erro ao carregar solicitações:', requestsError);
        throw requestsError;
      }

      setRequests(requestsData || []);
    } catch (err: any) {
      console.error('Erro ao carregar detalhes da cotação:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMessageTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('content')
        .order('sequence', { ascending: true })
        .limit(1);

      if (error) throw error;
      if (data) {
        setMessageTemplate(data[0]?.content || '');
      }
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    }
  };

  const loadQuotationRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('quotation_requests')
        .select(`
          *,
          supplier:suppliers(*)
        `)
        .eq('quotation_id', id)
        .eq('status', 'responded');

      if (error) throw error;

      setQuotationRequests(data || []);
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
      customToast.error('Erro ao carregar respostas dos fornecedores');
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      setLoadingOrders(true);
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(*),
          items:purchase_order_items(*)
        `)
        .eq('quotation_id', id);

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (err) {
      console.error('Erro ao carregar ordens de compra:', err);
      customToast.error('Erro ao carregar ordens de compra');
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadCompanyInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Primeiro busca o company_id do usuário
      const { data: companyUser, error: companyUserError } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (companyUserError) {
        console.error('Erro ao buscar empresa do usuário:', companyUserError);
        return;
      }

      // Depois busca os dados da empresa
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name, state')
        .eq('id', companyUser.company_id)
        .single();

      if (companyError) {
        console.error('Erro ao carregar informações da empresa:', companyError);
        return;
      }

      setCompany(company);
    } catch (err) {
      console.error('Erro ao carregar informações da empresa:', err);
    }
  };

  const formatMessage = (template: string) => {
    if (!quotation) return '';

    let message = '';
    
    // Adiciona as variáveis do veículo
    if (quotation.vehicle) {
      message += `{vehicle_brand}${quotation.vehicle.brand || ''}\n`;
      message += `{vehicle_model}${quotation.vehicle.model || ''}\n`;
      message += `{vehicle_year}${quotation.vehicle.year || ''}\n`;
      message += `{vehicle_chassis}${quotation.vehicle.chassis || ''}\n\n`;
    }

    // Formata a lista de peças
    if (quotation.parts && quotation.parts.length > 0) {
      const partsText = quotation.parts
        .map(part => `⭕ ${part.description}
Cod. Peça: ${part.code || '-'}
Quantidade: ${part.quantity}`)
        .join('\n\n');
      message += `{parts_list}${partsText}\n\n`;
    }

    return message;
  };

  const handleImageSelect = (image: string) => {
    setSelectedImageUrl(selectedImageUrl === image ? null : image);
  };

  const resendToSupplier = async (request: QuotationRequest) => {
    if (!quotation) {
      customToast.error('Dados da cotação não encontrados');
      return;
    }

    try {
      setSendingMessages(prev => ({ ...prev, [request.supplier_id]: true }));

      if (!request.supplier.area_code || !request.supplier.phone) {
        throw new Error(`Fornecedor ${request.supplier.name} não tem DDD ou telefone cadastrado`);
      }

      let message = formatMessage(messageTemplate);
      message += `{quotation_link}${window.location.origin}/quotation-response/${quotation.id}/${request.id}`;

      const logMessage = `Enviando mensagem para ${request.supplier.name}:
Telefone: ${request.supplier.area_code}${request.supplier.phone}
Mensagem:
${message}`;
      setApiLog(prev => prev + '\n\n' + logMessage);

      // Envia a mensagem usando os templates
      await sendBulkWhatsAppMessages([{
        areaCode: request.supplier.area_code,
        phone: request.supplier.phone,
        message,
        useTemplates: true
      }], user.id);

      // Se houver imagem selecionada, envia por último
      if (selectedImageUrl) {
        await sendBulkWhatsAppMessages([{
          areaCode: request.supplier.area_code,
          phone: request.supplier.phone,
          message: '',
          imageUrl: selectedImageUrl
        }], user.id);
      }

      setApiLog(prev => prev + '\n✅ Mensagem enviada com sucesso!');

      await supabase
        .from('quotation_requests')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', request.id);

      customToast.success(`Mensagem reenviada para ${request.supplier.name}`);
      await loadQuotationDetails();
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      customToast.error(`Erro ao enviar mensagem: ${err.message}`);
      setApiLog(prev => prev + '\n❌ Erro: ' + err.message);
    } finally {
      setSendingMessages(prev => ({ ...prev, [request.supplier_id]: false }));
    }
  };

  const resendToAll = async () => {
    if (!quotation || !user) {
      customToast.error('Dados da cotação não encontrados');
      return;
    }

    try {
      setSendingMessages({ ...sendingMessages, all: true });
      const validRequests = requests.filter(request => 
        request.supplier.area_code && 
        request.supplier.phone
      );

      if (validRequests.length === 0) {
        throw new Error('Nenhum fornecedor tem DDD e telefone cadastrados');
      }

      // Envia a mensagem para todos usando os templates
      const textMessages = validRequests.map(request => {
        let message = formatMessage(messageTemplate);
        message += `{quotation_link}${window.location.origin}/quotation-response/${quotation.id}/${request.id}`;

        const logMessage = `Enviando mensagem para ${request.supplier.name}:
Telefone: ${request.supplier.area_code}${request.supplier.phone}
Mensagem:
${message}`;
        setApiLog(prev => prev + '\n\n' + logMessage);

        return { 
          areaCode: request.supplier.area_code,
          phone: request.supplier.phone,
          message,
          useTemplates: true
        };
      });

      await sendBulkWhatsAppMessages(textMessages, user.id);

      // Se houver imagem selecionada, envia por último para todos
      if (selectedImageUrl) {
        const imageMessages = validRequests.map(request => ({
          areaCode: request.supplier.area_code,
          phone: request.supplier.phone,
          message: '',
          imageUrl: selectedImageUrl
        }));

        await sendBulkWhatsAppMessages(imageMessages, user.id);
      }
      setApiLog(prev => prev + '\n✅ Mensagens enviadas com sucesso!');

      // Atualiza o status de todas as solicitações
      const updates = validRequests.map(request => ({
        id: request.id,
        status: 'sent',
        sent_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('quotation_requests')
        .upsert(updates);

      if (error) throw error;

      customToast.success('Mensagens enviadas com sucesso');
      await loadQuotationDetails();
    } catch (err: any) {
      console.error('Erro ao enviar mensagens:', err);
      customToast.error(`Erro ao enviar mensagens: ${err.message}`);
      setApiLog(prev => prev + '\n❌ Erro: ' + err.message);
    } finally {
      setSendingMessages(prev => ({ ...prev, all: false }));
    }
  };

  const handlePartSelect = (description: string, requestId: string, partIndex: number) => {
    setSelectedParts(prev => {
      // Se já está selecionado o mesmo item, desseleciona
      if (prev[description]?.requestId === requestId) {
        const { [description]: removed, ...rest } = prev;
        return rest;
      }
      
      // Caso contrário, seleciona o novo item
      return {
        ...prev,
        [description]: { requestId, partIndex }
      };
    });
  };

  const handleCreatePurchaseOrder = async () => {
    if (!quotation || !company) return;

    setCreatingOrder(true);

    try {
      // Agrupa as peças selecionadas por fornecedor
      const partsBySupplier = Object.entries(selectedParts).reduce((acc: Record<string, any[]>, [partId, part]) => {
        if (!acc[part.requestId]) {
          acc[part.requestId] = [];
        }
        acc[part.requestId].push({ ...part, id: partId });
        return acc;
      }, {});

      // Cria uma ordem de compra para cada fornecedor
      for (const [requestId, parts] of Object.entries(partsBySupplier)) {
        const request = requests.find(r => r.id === requestId);
        if (!request?.response_data) continue;

        // Cria a ordem de compra
        const { data: orderData, error: orderError } = await supabase
          .from('purchase_orders')
          .insert({
            quotation_id: quotation.id,
            supplier_id: request.supplier_id,
            status: 'pending',
            total_amount: parts.reduce((total, part) => {
              const responsePart = request.response_data!.parts[part.partIndex];
              return total + (responsePart.total_price || 0);
            }, 0)
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Cria os itens da ordem de compra
        const orderItems = parts.map(part => {
          const responsePart = request.response_data!.parts[part.partIndex];
          return {
            purchase_order_id: orderData.id,
            part_description: responsePart.description,
            quantity: responsePart.quantity,
            unit_price: responsePart.unit_price,
            total_price: responsePart.total_price,
            quotation_part_index: part.partIndex
          };
        });

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      customToast.success('Ordem de compra criada com sucesso!');
      
      // Recarrega os dados
      await loadQuotationDetails();
      await loadPurchaseOrders();
      
      // Limpa as seleções
      setSelectedParts({});
    } catch (error: any) {
      console.error('Erro ao criar ordem de compra:', error);
      customToast.error('Erro ao criar ordem de compra');
    } finally {
      setCreatingOrder(false);
    }
  };

  const calculateBestPrices = () => {
    if (!quotation || !quotationRequests.length) return;

    const bestPrices: BestPrice[] = [];
    const allParts = new Set(quotation.parts.map(p => p.description));

    allParts.forEach(description => {
      const quotationPart = quotation.parts.find(p => p.description === description);
      if (!quotationPart) return;

      let bestPrice: BestPrice | null = null;

      quotationRequests.forEach(request => {
        const part = request.response_data?.parts.find(p => p.description === description);
        if (!part || !part.available) return;

        if (!bestPrice || part.unit_price < bestPrice.unit_price) {
          bestPrice = {
            description,
            quantity: part.quantity,
            supplier: {
              id: request.supplier.id,
              name: request.response_data?.supplier_name || request.supplier.name
            },
            unit_price: part.unit_price,
            total_price: part.total_price,
            available: true,
            purchased: quotationPart.purchased,
            regulation_price: quotationPart.part_cost,
            condition: part.condition
          };
        }
      });

      if (bestPrice) {
        bestPrices.push(bestPrice);
      }
    });

    setBestPrices(bestPrices);
  };

  useEffect(() => {
    if (quotationRequests.length > 0 && quotation) {
      calculateBestPrices();
    }
  }, [quotationRequests, quotation]);

  const handleCreateBestPriceOrders = async () => {
    if (!quotation || !selectedBestPrices.length) return;

    setCreatingOrder(true);

    try {
      // Agrupa as peças por fornecedor
      const ordersBySupplier = selectedBestPrices.reduce((acc: Record<string, BestPrice[]>, description) => {
        const bestPrice = bestPrices.find(p => p.description === description);
        if (!bestPrice) return acc;

        const supplierId = bestPrice.supplier.id;
        if (!acc[supplierId]) {
          acc[supplierId] = [];
        }
        acc[supplierId].push(bestPrice);
        return acc;
      }, {});

      // Cria uma ordem de compra para cada fornecedor
      for (const [supplierId, parts] of Object.entries(ordersBySupplier)) {
        const total_amount = parts.reduce((total, part) => total + part.total_price, 0);

        const { data: order, error: orderError } = await supabase
          .from('purchase_orders')
          .insert({
            quotation_id: quotation.id,
            supplier_id: supplierId,
            status: 'pending',
            total_amount
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const orderItems = parts.map(part => ({
          purchase_order_id: order.id,
          part_description: part.description,
          quantity: part.quantity,
          unit_price: part.unit_price,
          total_price: part.total_price
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      customToast.success('Ordens de compra criadas com sucesso');
      await loadPurchaseOrders();
      setSelectedBestPrices([]);
    } catch (err: any) {
      console.error('Erro ao criar ordens de compra:', err);
      customToast.error('Erro ao criar ordens de compra');
    } finally {
      setCreatingOrder(false);
    }
  };

  // Função para calcular a diferença percentual entre dois valores
  const calculateDifference = (currentPrice: number, originalPrice: number) => {
    const difference = ((currentPrice - originalPrice) / originalPrice) * 100;
    if (difference > 0) {
      return `+${difference.toFixed(0)}% acima`;
    } else if (difference < 0) {
      return `${difference.toFixed(0)}% abaixo`;
    } else {
      return 'Mesmo preço';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-red-500">Cotação não encontrada</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate('/quotations')}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mr-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Cotações
        </button>

        <button
          onClick={() => navigate(`/quotation/new?edit=${id}`)}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
        >
          <Edit className="w-4 h-4 mr-2" />
          Editar Cotação
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">Detalhes da Cotação</h1>

        {/* Imagens do Veículo */}
        {quotation.images && quotation.images.length > 0 && (
          <div className="mb-6">
            <button 
              onClick={() => setShowImages(!showImages)} 
              className="flex items-center text-lg font-medium mb-2 text-left w-full"
            >
              <span className="mr-2">{showImages ? '▼' : '►'}</span>
              Imagens ({quotation.images.length})
            </button>
            
            {showImages && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                {quotation.images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={image}
                      alt={`Imagem ${index + 1}`}
                      className={`w-full h-32 object-cover rounded-lg cursor-pointer ${
                        selectedImageUrl === image ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => handleImageSelect(image)}
                      onError={(e) => {
                        console.error('Erro ao carregar imagem:', e);
                        e.currentTarget.src = '/placeholder-image.jpg';
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detalhes do Veículo */}
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-2">Veículo</h2>
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            {/* Informações do veículo */}
            <div className="flex-1">
              <p>
                {quotation.vehicle?.brand} {quotation.vehicle?.model} {quotation.vehicle?.year}
                {quotation.vehicle?.chassis && ` - Chassi: ${quotation.vehicle.chassis}`}
              </p>
            </div>
            
            {/* Imagem principal do veículo */}
            {quotation.images && quotation.images.length > 0 && (
              <div className="flex-shrink-0">
                <img
                  src={quotation.images[0]}
                  alt={`${quotation.vehicle?.brand} ${quotation.vehicle?.model}`}
                  className="w-full max-w-xs h-auto rounded-lg shadow-md"
                  onError={(e) => {
                    console.error('Erro ao carregar imagem:', e);
                    e.currentTarget.src = '/placeholder-image.jpg';
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Lista de Peças */}
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-2">Peças Solicitadas</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CÓD. PEÇA
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qtde
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preço Un.
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quotation.parts.map((part, index) => (
                  <tr key={index} className={part.purchased ? 'bg-green-50' : ''}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {part.code}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {part.description}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                      {part.quantity}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {part.part_cost ? (
                        part.part_cost.toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {part.part_cost ? (
                        (part.part_cost * part.quantity).toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                      {part.purchased ? 'Comprado' : 'Pendente'}
                    </td>
                  </tr>
                ))}
                {/* Linha totalizadora */}
                <tr className="bg-gray-50 font-medium">
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900" colSpan={4}>
                    Total Geral
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                    {quotation.parts.reduce((total, part) => {
                      return total + (part.part_cost ? part.part_cost * part.quantity : 0);
                    }, 0).toLocaleString('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL' 
                    })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                    -
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Respostas dos Fornecedores */}
        {quotationRequests.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium mb-4">Respostas dos Fornecedores</h2>
            <div className="space-y-4">
              {quotationRequests.map((request) => (
                <div key={request.id} className="border rounded-lg overflow-hidden">
                  <div
                    className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      const elem = document.getElementById(`supplier-${request.id}`);
                      if (elem) {
                        elem.style.display = elem.style.display === 'none' ? 'block' : 'none';
                      }
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          {/* Botão do WhatsApp */}
                          {request.supplier.phone && (
                            <a
                              href={`https://wa.me/55${(request.supplier.area_code + request.supplier.phone).replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mr-2 inline-flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full p-1"
                              title="Conversar no WhatsApp"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          <p className="font-medium">{request.supplier.name}</p>
                        </div>
                        <p className="text-sm text-gray-600">
                          ({request.supplier.area_code}) {request.supplier.phone}
                        </p>
                        <p className="text-sm text-gray-600">
                          Respondido em: {new Date(request.responded_at || '').toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <p className="text-lg font-medium">
                          Total: R$ {request.response_data?.total_price.toFixed(2)}
                        </p>
                        {request.response_data?.parts && (
                          <div className="text-sm mt-1">
                            <div className="flex gap-2">
                              <span className="text-green-600 font-medium">
                                {request.response_data.parts.filter(part => part.available).length} disponíveis
                              </span>
                              <span className="text-gray-400">|</span>
                              <span className="text-red-600 font-medium">
                                {request.response_data.parts.filter(part => !part.available).length} faltantes
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center mt-1">
                          {request.status === 'responded' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/quotation-responses/${quotation.id}?open_counter_offer=${request.id}`);
                              }}
                              className="text-green-600 hover:text-green-800 focus:outline-none"
                              title="Fazer contraproposta"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div id={`supplier-${request.id}`} className="p-4" style={{ display: 'none' }}>
                    {request.response_data?.parts
                      .slice()
                      .sort((a, b) => {
                        // Primeiro as peças normais, depois já compradas, por último indisponíveis
                        const aQuotationPart = quotation?.parts.find(p => p.description === a.description);
                        const bQuotationPart = quotation?.parts.find(p => p.description === b.description);
                        
                        // 0: normal, 1: comprada, 2: indisponível
                        const getStatus = (part: any, quotationPart: any) => {
                          if (!part.available) return 2;
                          if (quotationPart?.purchased) return 1;
                          return 0;
                        }
                        
                        return getStatus(a, aQuotationPart) - getStatus(b, bQuotationPart);
                      })
                      .map((part, index) => {
                        const quotationPart = quotation?.parts.find(p => p.description === part.description);
                        const isSelected = selectedParts[part.description]?.requestId === request.id;
                        const isPurchased = quotationPart?.purchased;

                        return (
                          <div key={index} className="mb-4 last:mb-0">
                            <div className="flex items-start">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!part.available || isPurchased}
                                onChange={() => handlePartSelect(quotationPart?.description || '', request.id, index)}
                                className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                              />
                              <div className="ml-3 flex-grow">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-medium">{part.description}</p>
                                    <p className="text-sm text-gray-500">Quantidade: {part.quantity}</p>
                                    {!part.available && (
                                      <p className="text-sm text-red-500 mt-1">Peça não disponível</p>
                                    )}
                                    {isPurchased && (
                                      <p className="text-sm text-green-600 mt-1">Peça já comprada</p>
                                    )}
                                    {part.notes && (
                                      <p className="text-sm text-gray-500 mt-1">{part.notes}</p>
                                    )}
                                    {part.condition && part.available && (
                                      <p className={`text-sm mt-1 ${part.condition === 'new' ? 'text-blue-600' : 'text-amber-600'}`}>
                                        Condição: {part.condition === 'new' ? 'Nova' : 'Usada'}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium">
                                      {part.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} /unidade
                                    </p>
                                    {part.available && quotationPart?.unit_price && (
                                      <p className="text-xs text-gray-500">
                                        {calculateDifference(part.unit_price, quotationPart.unit_price)}
                                      </p>
                                    )}
                                    <p className="text-sm text-gray-500">
                                      Total: {part.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Link
                to={`/quotations/${id}/compare`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 mr-4"
              >
                Comparar Cotações
              </Link>
              <button
                onClick={handleCreatePurchaseOrder}
                disabled={creatingOrder || !Object.keys(selectedParts).length}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  'Gerar Ordem de Compra'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Pacote Ideal de Compra */}
        {bestPrices.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Pacote Ideal de Compra</h2>
              <button
                onClick={handleCreateBestPriceOrders}
                disabled={creatingOrder || selectedBestPrices.length === 0}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {creatingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando Ordens...
                  </>
                ) : (
                  'Gerar Ordens de Compra'
                )}
              </button>
            </div>

            {/* Total do pacote ideal */}
            {(() => {
              const totalPacoteIdeal = Object.values(
                bestPrices.reduce((acc, part) => {
                  const supplierId = part.supplier.id;
                  if (!acc[supplierId]) {
                    acc[supplierId] = {
                      total: 0
                    };
                  }
                  acc[supplierId].total += part.total_price;
                  return acc;
                }, {} as Record<string, { total: number }>)
              ).reduce((sum, item) => sum + item.total, 0);

              // Verificar se há peças faltantes
              const pecasFaltantes = quotation?.parts?.filter(part => {
                // Verifica se a peça não está em nenhum fornecedor do pacote ideal
                return !bestPrices.some(bestPrice => 
                  bestPrice.description === part.description
                );
              }) || [];

              return (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total: </span>
                    <span className="font-bold text-lg">
                      {totalPacoteIdeal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  
                  {pecasFaltantes.length > 0 && (
                    <div className="mt-2 text-red-600 text-sm">
                      {pecasFaltantes.length} peça{pecasFaltantes.length > 1 ? 's' : ''} faltante{pecasFaltantes.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="space-y-6">
              {Object.entries(
                bestPrices.reduce((acc, part) => {
                  const supplierId = part.supplier.id;
                  if (!acc[supplierId]) {
                    acc[supplierId] = {
                      supplier: part.supplier,
                      parts: [],
                      total: 0
                    };
                  }
                  acc[supplierId].parts.push(part);
                  acc[supplierId].total += part.total_price;
                  return acc;
                }, {} as Record<string, { supplier: BestPrice['supplier'], parts: BestPrice[], total: number }>)
              )
                .sort((a, b) => b[1].total - a[1].total) // Ordena por valor total
                .map(([supplierId, group]) => (
                  <div key={supplierId} className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h3 className="font-medium text-gray-900">{group.supplier.name}</h3>
                      <p className="text-sm text-gray-500">
                        Total: {group.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      {group.parts
                        .sort((a, b) => {
                          // Primeiro as não compradas
                          if (a.purchased !== b.purchased) {
                            return a.purchased ? 1 : -1;
                          }
                          // Depois por valor total
                          return b.total_price - a.total_price;
                        })
                        .map((part) => (
                          <div 
                            key={part.description} 
                            className={`border rounded-lg p-4 ${part.purchased ? 'bg-gray-50' : ''}`}
                          >
                            <div className="flex items-start">
                              <input
                                type="checkbox"
                                checked={selectedBestPrices.includes(part.description)}
                                disabled={part.purchased}
                                onChange={(e) => {
                                  setSelectedBestPrices(prev => 
                                    e.target.checked 
                                      ? [...prev, part.description]
                                      : prev.filter(d => d !== part.description)
                                  );
                                }}
                                className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                              />
                              <div className="ml-3 flex-grow">
                                <div className="flex justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium">{part.description}</p>
                                      {part.purchased && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                          Comprada
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-500">Quantidade: {part.quantity}</p>
                                    {part.regulation_price && (
                                      <p className="text-sm text-gray-500">
                                        Regulagem: {part.regulation_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        {part.unit_price > part.regulation_price && (
                                          <span className="text-red-500 ml-2">
                                            (+{((part.unit_price - part.regulation_price) / part.regulation_price * 100).toFixed(0)}%)
                                          </span>
                                        )}
                                        {part.unit_price < part.regulation_price && (
                                          <span className="text-green-500 ml-2">
                                            (-{((part.regulation_price - part.unit_price) / part.regulation_price * 100).toFixed(0)}%)
                                          </span>
                                        )}
                                      </p>
                                    )}
                                    {part.condition && (
                                      <p className={`text-sm mt-1 ${part.condition === 'new' ? 'text-blue-600' : 'text-amber-600'}`}>
                                        Condição: {part.condition === 'new' ? 'Nova' : 'Usada'}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium">
                                      {part.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} /un
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      Total: {part.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Ordens de Compra */}
        {purchaseOrders.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium mb-4">Ordens de Compra</h2>
            <div className="space-y-4">
              {purchaseOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-medium">
                        {order.supplier?.name || 'Fornecedor não encontrado'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Criada em: {new Date(order.created_at).toLocaleString()}
                      </p>
                      {order.delivery_time && (
                        <p className="text-sm text-gray-500">
                          Prazo de entrega: {order.delivery_time}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-medium">
                        Total: R$ {order.total_amount.toFixed(2)}
                      </p>
                      <div className="mt-2 space-x-2">
                        <Link
                          to={`/purchase-orders/${order.id}`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Ver Detalhes
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Itens:</h4>
                    <div className="space-y-2">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <div>
                            <span className="font-medium">{item.part_description}</span>
                            <span className="text-gray-500 ml-2">
                              ({item.quantity} un x R$ {item.unit_price.toFixed(2)})
                            </span>
                          </div>
                          <span className="font-medium">
                            R$ {item.total_price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log da API */}
        {apiLog && (
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-2">Log de Envio</h2>
            <pre className="bg-gray-100 p-4 rounded-lg text-sm whitespace-pre-wrap">
              {apiLog}
            </pre>
          </div>
        )}

        {/* Lista de Fornecedores */}
        <div className="mb-6">
          <div 
            className={`flex justify-between items-center p-3 cursor-pointer rounded-lg transition-colors duration-200 ${suppliersListCollapsed ? 'bg-gray-100 hover:bg-gray-200' : 'mb-4'}`}
            onClick={() => setSuppliersListCollapsed(!suppliersListCollapsed)}
          >
            <div className="flex items-center">
              {suppliersListCollapsed ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
              <h2 className="text-lg font-medium">Fornecedores</h2>
              <span className="ml-2 text-sm text-gray-500">({requests.length})</span>
            </div>
            <div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resendToAll();
                }}
                disabled={Object.values(sendingMessages).some(Boolean)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reenviar para Todos
              </button>
            </div>
          </div>

          {!suppliersListCollapsed && (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center">
                        {/* Botão do WhatsApp */}
                        {request.supplier.phone && (
                          <a
                            href={`https://wa.me/55${(request.supplier.area_code + request.supplier.phone).replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mr-2 inline-flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full p-1"
                            title="Conversar no WhatsApp"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                        <p className="font-medium">{request.supplier.name}</p>
                      </div>
                      <p className="text-sm text-gray-600">
                        ({request.supplier.area_code}) {request.supplier.phone}
                      </p>
                      <p className="text-sm text-gray-600">
                        Status: {request.status}
                        {request.sent_at && ` - Enviado em: ${new Date(request.sent_at).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <button
                        onClick={() => resendToSupplier(request)}
                        disabled={sendingMessages[request.supplier_id]}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingMessages[request.supplier_id] ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <MessageCircle className="w-4 h-4 mr-2" />
                        )}
                        Reenviar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuotationDetails;
