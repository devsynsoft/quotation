import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendBulkWhatsAppMessages } from '../../services/evolutionApi';
import { toast } from '../../lib/toast';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { MarketplaceSearch } from './MarketplaceSearch';

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
  const [user, setUser] = useState<any>(null);
  const [apiLog, setApiLog] = useState<string>('');
  const [messageTemplate, setMessageTemplate] = useState<string>('');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [company, setCompany] = useState<{
    id: string;
    name: string;
    state: string;
  } | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

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
        .eq('is_default', true)
        .single();

      if (error) throw error;
      if (data) {
        setMessageTemplate(data.content);
      }
    } catch (err) {
      console.error('Erro ao carregar template:', err);
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
      toast.error('Erro ao carregar respostas dos fornecedores');
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
      toast.error('Erro ao carregar ordens de compra');
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

  const formatMessage = () => {
    if (!quotation || !messageTemplate) return '';

    let message = messageTemplate;

    // Substitui as variáveis do veículo
    if (quotation.vehicle) {
      message = message
        .replace(/{marca}/g, quotation.vehicle.brand)
        .replace(/{modelo}/g, quotation.vehicle.model)
        .replace(/{ano}/g, quotation.vehicle.year)
        .replace(/{chassi}/g, quotation.vehicle.chassis || '');
    }

    // Substitui a lista de peças
    if (quotation.parts && quotation.parts.length > 0) {
      const partsText = quotation.parts
        .map(part => `- ${part.description} (${part.quantity} unidades)`)
        .join('\n');
      message = message.replace(/{pecas}/g, partsText);
    }

    return message;
  };

  const handleImageSelect = (image: string) => {
    setSelectedImageUrl(selectedImageUrl === image ? null : image);
  };

  const resendToSupplier = async (request: QuotationRequest) => {
    if (!quotation) {
      toast.error('Dados da cotação não encontrados');
      return;
    }

    try {
      setSendingMessages(prev => ({ ...prev, [request.supplier_id]: true }));

      let message = formatMessage();
      
      message = message.replace(
        /{quotation_link}/g, 
        `${window.location.origin}/quotation-response/${quotation.id}/${request.id}`
      );

      if (!request.supplier.area_code || !request.supplier.phone) {
        throw new Error(`Fornecedor ${request.supplier.name} não tem DDD ou telefone cadastrado`);
      }

      const logMessage = `Enviando mensagem para ${request.supplier.name}:
Telefone: ${request.supplier.area_code}${request.supplier.phone}
Mensagem:
${message}
${selectedImageUrl ? `\nImagem: ${selectedImageUrl}` : ''}`;
      setApiLog(prev => prev + '\n\n' + logMessage);

      // Envia a mensagem de texto primeiro
      await sendBulkWhatsAppMessages([{
        areaCode: request.supplier.area_code,
        phone: request.supplier.phone,
        message
      }], user.id);

      // Se houver imagem selecionada, envia em seguida
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

      toast.success(`Mensagem reenviada para ${request.supplier.name}`);
      await loadQuotationDetails();
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      toast.error(`Erro ao enviar mensagem: ${err.message}`);
      setApiLog(prev => prev + '\n❌ Erro: ' + err.message);
    } finally {
      setSendingMessages(prev => ({ ...prev, [request.supplier_id]: false }));
    }
  };

  const resendToAll = async () => {
    if (!quotation || !user) {
      toast.error('Dados da cotação não encontrados');
      return;
    }

    try {
      let message = formatMessage();
      const validRequests = requests.filter(request => 
        request.supplier.area_code && 
        request.supplier.phone
      );

      if (validRequests.length === 0) {
        throw new Error('Nenhum fornecedor tem DDD e telefone cadastrados');
      }

      // Envia a mensagem de texto primeiro para todos
      const textMessages = validRequests.map(request => {
        const messageWithLink = message.replace(
          /{quotation_link}/g, 
          `${window.location.origin}/quotation-response/${quotation.id}/${request.id}`
        );

        const logMessage = `Enviando mensagem para ${request.supplier.name}:
Telefone: ${request.supplier.area_code}${request.supplier.phone}
Mensagem:
${messageWithLink}`;
        setApiLog(prev => prev + '\n\n' + logMessage);

        return { 
          areaCode: request.supplier.area_code,
          phone: request.supplier.phone,
          message: messageWithLink
        };
      });

      await sendBulkWhatsAppMessages(textMessages, user.id);

      // Se houver imagem selecionada, envia para todos em seguida
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

      await supabase
        .from('quotation_requests')
        .upsert(updates);

      toast.success(`Mensagens reenviadas para ${validRequests.length} fornecedores`);

      // Recarrega os detalhes
      await loadQuotationDetails();
    } catch (err: any) {
      console.error('Erro ao reenviar mensagens:', err);
      toast.error(`Erro ao reenviar mensagens: ${err.message}`);
      setApiLog(prev => prev + '\n❌ Erro: ' + err.message);
    } finally {
      setSendingMessages({});
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

      toast.success('Ordem de compra criada com sucesso!');
      
      // Recarrega os dados
      await loadQuotationDetails();
      await loadPurchaseOrders();
      
      // Limpa as seleções
      setSelectedParts({});
    } catch (error: any) {
      console.error('Erro ao criar ordem de compra:', error);
      toast.error('Erro ao criar ordem de compra');
    } finally {
      setCreatingOrder(false);
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
      <button
        onClick={() => navigate('/quotations')}
        className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar para Cotações
      </button>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">Detalhes da Cotação</h1>

        {/* Imagens do Veículo */}
        {quotation.images && quotation.images.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-2">Imagens</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          </div>
        )}

        {/* Detalhes do Veículo */}
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-2">Veículo</h2>
          <p>
            {quotation.vehicle?.brand} {quotation.vehicle?.model} {quotation.vehicle?.year}
            {quotation.vehicle?.chassis && ` - Chassi: ${quotation.vehicle.chassis}`}
          </p>
        </div>

        {/* Lista de Peças */}
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-2">Peças Solicitadas</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operação
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
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
                    Desc(%)
                  </th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Horas Pintura
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
                      {part.operation || 'TROCAR'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {part.code}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {part.description}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {part.part_type === 'genuine' ? 'Genuína' :
                       part.part_type === 'used' ? 'Usada' : 'Nova'}
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
                      {part.discount_percentage || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                      {part.painting_hours || '0,00'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                      {part.purchased ? (
                        <div className="flex items-center justify-center space-x-1">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <div className="text-xs text-gray-600">
                            <div>Comprada em: {new Date(part.purchase_date).toLocaleDateString('pt-BR')}</div>
                            <div>Valor: {part.purchase_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">Pendente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lista de Fornecedores */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Fornecedores</h2>
            <button
              onClick={resendToAll}
              disabled={Object.values(sendingMessages).some(Boolean)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reenviar para Todos
            </button>
          </div>

          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{request.supplier.name}</p>
                    <p className="text-sm text-gray-600">
                      ({request.supplier.area_code}) {request.supplier.phone}
                    </p>
                    <p className="text-sm text-gray-600">
                      Status: {request.status}
                      {request.sent_at && ` - Enviado em: ${new Date(request.sent_at).toLocaleString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => resendToSupplier(request)}
                    disabled={sendingMessages[request.supplier_id]}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingMessages[request.supplier_id] ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Reenviar
                  </button>
                </div>
              </div>
            ))}
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
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">
                          {request.response_data?.supplier_name || request.supplier?.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Respondido em: {new Date(request.responded_at!).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-lg font-medium">
                        Total: R$ {request.response_data?.total_price.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div id={`supplier-${request.id}`} className="p-4" style={{ display: 'none' }}>
                    {request.response_data?.parts.map((part, index) => {
                      const quotationPart = quotation?.parts[index];
                      const isSelected = selectedParts[quotationPart?.description || '']?.requestId === request.id;
                      const isPurchased = quotationPart?.purchased;
                      
                      // Calcula a diferença de preço com a regulagem
                      const regulationPrice = quotationPart?.part_cost || 0;
                      const priceDifference = part.unit_price - regulationPrice;
                      const percentageDifference = regulationPrice > 0 
                        ? ((priceDifference / regulationPrice) * 100)
                        : 0;

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
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">
                                    {part.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} /unidade
                                  </p>
                                  {regulationPrice > 0 && (
                                    <p className={`text-xs ${priceDifference > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                      {priceDifference > 0 ? '+' : ''}
                                      {priceDifference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      {' '}
                                      ({priceDifference > 0 ? '+' : ''}
                                      {percentageDifference.toFixed(1)}%)
                                    </p>
                                  )}
                                  <p className="text-sm text-gray-500">
                                    Total: {part.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </p>
                                </div>
                              </div>
                              {!part.available && (
                                <p className="text-sm text-red-500 mt-1">Peça não disponível</p>
                              )}
                              {isPurchased && (
                                <p className="text-sm text-green-600 mt-1">Peça já comprada</p>
                              )}
                              {part.notes && (
                                <p className="text-sm text-gray-500 mt-1">{part.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {request.response_data?.delivery_time && (
                      <p className="text-sm text-gray-600 mt-4">
                        Prazo de entrega: {request.response_data.delivery_time}
                      </p>
                    )}

                    {request.response_data?.notes && (
                      <p className="text-sm text-gray-600 mt-2">
                        Observações: {request.response_data.notes}
                      </p>
                    )}
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

        {/* Lista de peças */}
        <div className="space-y-4">
          {quotation.parts.map((part, index) => (
            <div key={index} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-medium">{part.description}</h4>
                  {part.code && (
                    <p className="text-sm text-gray-500">Código: {part.code}</p>
                  )}
                  <p className="text-sm text-gray-500">Quantidade: {part.quantity}</p>
                  {part.notes && (
                    <p className="text-sm text-gray-500">Observações: {part.notes}</p>
                  )}
                </div>
                <div>
                  <input
                    type="checkbox"
                    checked={selectedParts[index] || false}
                    disabled={part.purchased}
                    onChange={(e) => handlePartSelect(part.description, request.id, index)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                </div>
              </div>

              {/* Botões de busca */}
              <MarketplaceSearch
                description={part.description}
                code={part.code}
                vehicle={{
                  brand: quotation.vehicle.brand,
                  model: quotation.vehicle.model,
                  year: quotation.vehicle.year,
                }}
                companyState={company?.state || 'SP'}
              />
            </div>
          ))}
        </div>

      </div>

      {/* Log da API */}
      {apiLog && (
        <div className="mt-6">
          <h2 className="text-lg font-medium mb-2">Log de Envio</h2>
          <pre className="bg-gray-100 p-4 rounded-lg text-sm whitespace-pre-wrap">
            {apiLog}
          </pre>
        </div>
      )}
    </div>
  );
}

export default QuotationDetails;
