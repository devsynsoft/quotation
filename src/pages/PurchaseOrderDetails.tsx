import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { customToast, hotToast } from '../lib/toast';
import { sendWhatsAppMessage } from '../services/evolutionApi';
import jsPDF from 'jspdf';

interface PurchaseOrder {
  id: string;
  created_at: string;
  quotation_id: string;
  supplier_id: string;
  status: string;
  total_amount: number;
  notes?: string;
  delivery_time?: string;
  workshop_id?: string;
  billing_company_id?: string;
  supplier?: {
    name: string;
    phone: string;
    area_code: string;
  };
  workshop?: {
    id: string;
    name: string;
    city: string;
    state: string;
    address?: string;
  };
  billing_company?: {
    id: string;
    company_name: string;
    trading_name: string;
    cnpj: string;
  };
  items: {
    id: string;
    part_description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes?: string;
  }[];
  vehicle?: {
    brand: string;
    model: string;
    year: string;
  };
}

export function PurchaseOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  // Estado para armazenar a URL da imagem do veículo
  const [vehicleImage, setVehicleImage] = useState<string | null>(null);
  // Estados para oficinas e empresas de faturamento
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [billingCompanies, setBillingCompanies] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      loadPurchaseOrder();
      loadWorkshopsAndBillingCompanies();
    }
  }, [id]);

  // Efeito para carregar a imagem do veículo quando o pedido for carregado
  useEffect(() => {
    if (order?.quotation_id) {
      loadVehicleImage();
    }
  }, [order]);

  const loadPurchaseOrder = async () => {
    try {
      // Buscamos a ordem de compra
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id!)
        .single();

      if (orderError) throw orderError;
      
      if (!orderData) {
        throw new Error('Ordem de compra não encontrada');
      }

      // Buscamos o fornecedor
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('name, phone, area_code')
        .eq('id', orderData.supplier_id)
        .single();

      if (supplierError) {
        console.error('Erro ao buscar fornecedor:', supplierError);
      }

      // Buscamos os itens da ordem
      const { data: itemsData, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', orderData.id);
      
      if (itemsError) {
        console.error('Erro ao buscar itens da ordem:', itemsError);
      }

      // Usar os itens como estão, sem correção
      const items = itemsData || [];
      
      // Calcular o valor total da ordem
      let totalAmount = 0;
      items.forEach(item => {
        totalAmount += item.total_price;
      });

      // Atualizar o total da ordem se necessário
      if (orderData.total_amount !== totalAmount) {
        await supabase
          .from('purchase_orders')
          .update({ total_amount: totalAmount })
          .eq('id', orderData.id);
      }

      // Buscamos a oficina se houver
      let workshopData = null;
      if (orderData.workshop_id) {
        const { data, error } = await supabase
          .from('workshops')
          .select('id, name, city, state, street, number')
          .eq('id', orderData.workshop_id)
          .single();
          
        if (error) {
          console.error('Erro ao buscar oficina:', error);
        } else {
          workshopData = {
            ...data,
            address: `${data.street}, ${data.number}, ${data.city} - ${data.state}`
          };
        }
      }

      // Buscamos a empresa de faturamento se houver
      let billingCompanyData = null;
      if (orderData.billing_company_id) {
        const { data, error } = await supabase
          .from('billing_companies')
          .select('id, company_name, trading_name, cnpj')
          .eq('id', orderData.billing_company_id)
          .single();
          
        if (error) {
          console.error('Erro ao buscar empresa de faturamento:', error);
        } else {
          billingCompanyData = data;
        }
      }

      // Fetch vehicle information from the quotation if available
      let vehicleData = null;
      if (orderData.quotation_id) {
        try {
          // Busca a cotação
          const { data: quotationData, error: quotationError } = await supabase
            .from('quotations')
            .select('vehicle_id')
            .eq('id', orderData.quotation_id)
            .single();
            
          if (quotationError) {
            console.error('Erro ao buscar cotação:', quotationError);
          } else if (quotationData && quotationData.vehicle_id) {
            // Busca os dados do veículo
            const { data: vehicle, error: vehicleError } = await supabase
              .from('vehicles')
              .select('brand, model, year')
              .eq('id', quotationData.vehicle_id)
              .single();
              
            if (vehicleError) {
              console.error('Erro ao buscar veículo:', vehicleError);
            } else if (vehicle) {
              vehicleData = vehicle;
            }
          }
        } catch (quotationError) {
          console.error('Erro ao buscar informações do veículo:', quotationError);
        }
      }
      
      // Criamos um objeto que corresponde à nossa interface PurchaseOrder
      const purchaseOrder: PurchaseOrder = {
        id: orderData.id,
        created_at: orderData.created_at,
        quotation_id: orderData.quotation_id,
        supplier_id: orderData.supplier_id,
        status: orderData.status,
        total_amount: orderData.total_amount,
        notes: orderData.notes,
        delivery_time: orderData.delivery_time,
        workshop_id: orderData.workshop_id,
        billing_company_id: orderData.billing_company_id,
        supplier: supplierData || undefined,
        workshop: workshopData || undefined,
        billing_company: billingCompanyData || undefined,
        items: items || [],
        vehicle: vehicleData || undefined
      };
      
      setOrder(purchaseOrder);
    } catch (err) {
      console.error('Erro ao carregar ordem de compra:', err);
      customToast.error('Erro ao carregar ordem de compra');
    } finally {
      setLoading(false);
    }
  };

  // Função para carregar a imagem do veículo
  const loadVehicleImage = async () => {
    if (!order?.quotation_id) return;
    
    try {
      // Busca a cotação para obter o ID do veículo
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select('vehicle_id')
        .eq('id', order.quotation_id)
        .single();
        
      if (quotationError || !quotationData?.vehicle_id) {
        console.error('Erro ao buscar ID do veículo:', quotationError);
        return;
      }
      
      // Busca os dados do veículo, incluindo as imagens
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', quotationData.vehicle_id)
        .single();
        
      if (vehicleError) {
        console.error('Erro ao buscar veículo:', vehicleError);
        return;
      }
      
      // Usa any para acessar o campo images
      const vehicle = vehicleData as any;
      if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
        setVehicleImage(vehicle.images[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar imagem do veículo:', error);
    }
  };

  // Função para carregar oficinas e empresas de faturamento
  const loadWorkshopsAndBillingCompanies = async () => {
    setLoadingOptions(true);
    try {
      // Buscar oficinas ativas
      const { data: workshopsData, error: workshopsError } = await supabase
        .from('workshops')
        .select('id, name, city, state')
        .eq('is_active', true)
        .order('name');
        
      if (workshopsError) {
        console.error('Erro ao buscar oficinas:', workshopsError);
      } else {
        setWorkshops(workshopsData || []);
      }
      
      // Buscar empresas de faturamento ativas
      const { data: companiesData, error: companiesError } = await supabase
        .from('billing_companies')
        .select('id, company_name, trading_name, cnpj')
        .eq('is_active', true)
        .order('company_name');
        
      if (companiesError) {
        console.error('Erro ao buscar empresas de faturamento:', companiesError);
      } else {
        setBillingCompanies(companiesData || []);
      }
    } catch (error) {
      console.error('Erro ao carregar opções:', error);
    } finally {
      setLoadingOptions(false);
    }
  };

  // Função para atualizar oficina ou empresa de faturamento
  const updateOrderDestination = async (field: 'workshop_id' | 'billing_company_id', value: string | null) => {
    if (!order) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ [field]: value })
        .eq('id', order.id);
        
      if (error) {
        throw error;
      }
      
      // Atualiza o estado local
      setOrder({
        ...order,
        [field]: value
      });
      
      customToast.success('Ordem de compra atualizada com sucesso');
      
      // Recarregar a ordem para obter os dados atualizados
      loadPurchaseOrder();
    } catch (error) {
      console.error('Erro ao atualizar ordem de compra:', error);
      customToast.error('Erro ao atualizar ordem de compra');
    } finally {
      setSaving(false);
    }
  };

  const generatePdf = () => {
    if (!order) return null;

    const doc = new jsPDF();
    const margin = 20;
    let y = margin;

    // Título
    doc.setFontSize(18);
    doc.text('ORDEM DE COMPRA', doc.internal.pageSize.width / 2, y, { align: 'center' });
    y += 15;

    // Informações da ordem
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Ordem #${order.id.substring(0, 8)}`, margin, y);
    y += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${new Date(order.created_at).toLocaleDateString('pt-BR')}`, margin, y);
    y += 8;
    
    doc.text(`Fornecedor: ${order.supplier?.name || 'Não informado'}`, margin, y);
    y += 8;
    
    // Adicionar informações do veículo
    if (order.vehicle) {
      doc.text(`Veículo: ${order.vehicle.brand} ${order.vehicle.model} (${order.vehicle.year})`, margin, y);
      y += 8;
    }
    
    // Adicionar informações da oficina (endereço de entrega)
    if (order.workshop) {
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('ENDEREÇO DE ENTREGA:', margin, y);
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${order.workshop.name}`, margin, y);
      y += 6;
      
      if (order.workshop.address) {
        doc.text(`${order.workshop.address}`, margin, y);
        y += 6;
      }
      
      doc.text(`${order.workshop.city} - ${order.workshop.state}`, margin, y);
      y += 10;
    }
    
    // Adicionar informações da empresa de faturamento
    if (order.billing_company) {
      doc.setFont('helvetica', 'bold');
      doc.text('DADOS DE FATURAMENTO:', margin, y);
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Razão Social: ${order.billing_company.company_name}`, margin, y);
      y += 6;
      
      doc.text(`Nome Fantasia: ${order.billing_company.trading_name}`, margin, y);
      y += 6;
      
      doc.text(`CNPJ: ${order.billing_company.cnpj}`, margin, y);
      y += 10;
    }

    // Adicionar prazo de entrega e observações
    if (order.delivery_time) {
      doc.text(`Prazo de entrega: ${order.delivery_time}`, margin, y);
      y += 8;
    }
    
    if (order.notes) {
      doc.text(`Observações: ${order.notes}`, margin, y);
      y += 8;
    }

    // Adicionar tabela de itens
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('ITENS', margin, y);
    y += 8;
    
    // Cabeçalho da tabela
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, doc.internal.pageSize.width - (margin * 2), 8, 'F');
    
    doc.text('Descrição', margin + 2, y + 6);
    doc.text('Qtd', 110, y + 6);
    doc.text('Valor Unit.', 130, y + 6);
    doc.text('Total', 170, y + 6);
    y += 12;

    // Itens
    doc.setFont('helvetica', 'normal');
    let calculatedTotal = 0;
    
    order.items.forEach(item => {
      // Verificar se precisa quebrar a página
      if (y > doc.internal.pageSize.height - 40) {
        doc.addPage();
        y = margin;
      }
      
      doc.text(item.part_description, margin + 2, y, { maxWidth: 80 });
      doc.text(`${item.quantity}`, 110, y);
      doc.text(`R$ ${item.unit_price.toFixed(2)}`, 130, y);
      doc.text(`R$ ${item.total_price.toFixed(2)}`, 170, y);
      
      y += 10;
      calculatedTotal += item.total_price;
    });
    
    // Usar o valor calculado se o total da ordem estiver zerado
    const totalAmount = order.total_amount > 0 ? order.total_amount : calculatedTotal;
    
    // Linha para o total
    doc.setLineWidth(0.5);
    doc.line(margin, y, doc.internal.pageSize.width - margin, y);
    y += 8;
    
    // Total
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: R$ ${totalAmount.toFixed(2)}`, 160, y, { align: 'right' });

    // Adicionar rodapé com informações adicionais
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('Documento gerado automaticamente pelo sistema de cotações.', doc.internal.pageSize.width / 2, pageHeight - 10, { align: 'center' });

    // Salva o PDF em arquivo local para download
    doc.save(`ordem_compra_${order.id}.pdf`);
    customToast.success('PDF gerado com sucesso!');
    
    // Retorna o PDF como base64 para envio via WhatsApp
    // Formato: data:application/pdf;base64,CONTEÚDO_BASE64
    const pdfBase64 = doc.output('datauristring');
    return pdfBase64;
  };

  const sendToSupplier = async () => {
    if (!order?.supplier) {
      customToast.error('Fornecedor não encontrado');
      return;
    }

    try {
      setSending(true);
      
      // Mostra notificação de "Enviando solicitações..." que será removida automaticamente
      const toastId = customToast.loading('Enviando solicitações...');
      
      // Atualiza o status para "enviando"
      const { error: updateSendingError } = await supabase
        .from('purchase_orders')
        .update({ status: 'sending' })
        .eq('id', id!);
        
      if (updateSendingError) {
        console.error('Erro ao atualizar status para enviando:', updateSendingError);
      } else {
        // Atualiza o estado local para refletir a mudança
        setOrder(prev => prev ? {...prev, status: 'sending'} : null);
      }

      // Gerar o PDF apenas para download local
      generatePdf();

      const items = order.items
        .map(item => `⭕ ${item.part_description}: ${item.quantity} un x R$ ${item.unit_price.toFixed(2)} = R$ ${item.total_price.toFixed(2)}`)
        .join('\n');

      // Preparar informações de entrega (oficina)
      let deliveryInfo = '';
      if (order.workshop) {
        deliveryInfo = `*ENDEREÇO DE ENTREGA:*\n` +
          `${order.workshop.name}\n` +
          `${order.workshop.address || ''}\n` +
          `${order.workshop.city} - ${order.workshop.state}\n\n`;
      }

      // Preparar informações de faturamento
      let billingInfo = '';
      if (order.billing_company) {
        billingInfo = `*DADOS DE FATURAMENTO:*\n` +
          `Razão Social: ${order.billing_company.company_name}\n` +
          `Nome Fantasia: ${order.billing_company.trading_name}\n` +
          `CNPJ: ${order.billing_company.cnpj}\n\n`;
      }

      const message = `*ORDEM DE COMPRA*\n\n` +
        `Prezado fornecedor,\n\n` +
        `Segue ordem de compra:\n\n` +
        `${items}\n\n` +
        `*Total: R$ ${order.total_amount.toFixed(2)}*\n\n` +
        `${deliveryInfo}` +
        `${billingInfo}` +
        (order.delivery_time ? `Prazo de entrega: ${order.delivery_time}\n\n` : '') +
        (order.notes ? `Observações: ${order.notes}\n\n` : '') +
        `Por favor, confirme o recebimento.`;

      let imageUrl: string | undefined = undefined;
      let vehicleCaption: string | undefined = undefined;
      
      if (order.vehicle) {
        // Buscar a imagem real do veículo
        try {
          // Extrair o ID do veículo da cotação associada
          let vehicleId = '';
          
          if (order.quotation_id) {
            const { data: quotationData, error: quotationError } = await supabase
              .from('quotations')
              .select('vehicle_id')
              .eq('id', order.quotation_id)
              .single();
              
            if (!quotationError && quotationData) {
              vehicleId = quotationData.vehicle_id;
            }
          }
          
          if (vehicleId) {
            const { data: vehicleData, error: vehicleError } = await supabase
              .from('vehicles')
              .select('*')
              .eq('id', vehicleId)
              .single();
              
            if (!vehicleError && vehicleData) {
              // Usar any para acessar o campo images
              const vehicle = vehicleData as any;
              if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
                imageUrl = vehicle.images[0];
              } else {
                // Fallback para imagem fictícia se não encontrar
                imageUrl = "https://via.placeholder.com/500x300?text=Veiculo+Imagem";
              }
            } else {
              imageUrl = "https://via.placeholder.com/500x300?text=Veiculo+Imagem";
            }
          } else {
            imageUrl = "https://via.placeholder.com/500x300?text=Veiculo+Imagem";
          }
        } catch (error) {
          console.error('Erro ao buscar imagem do veículo:', error);
          imageUrl = "https://via.placeholder.com/500x300?text=Veiculo+Imagem";
        }
        
        // Cria a legenda do veículo
        vehicleCaption = `*${order.vehicle.brand} ${order.vehicle.model} ano ${order.vehicle.year}*`;
        console.log(`Veículo: ${vehicleCaption}`);
      }

      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;

      // Envia a mensagem com ou sem imagem, mas sem o PDF
      const { error } = await sendWhatsAppMessage({
        areaCode: order.supplier.area_code,
        phone: order.supplier.phone,
        message,
        imageUrl,
        userId
      });

      if (error) throw error;

      // Atualiza o status da ordem
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ status: 'sent' })
        .eq('id', id!);

      if (updateError) throw updateError;

      // Remove a notificação de "Enviando solicitações..."
      hotToast.dismiss(toastId);
      
      customToast.success('Ordem de compra enviada com sucesso!');
      loadPurchaseOrder();
    } catch (err) {
      console.error('Erro ao enviar ordem de compra:', err);
      customToast.error('Erro ao enviar ordem de compra');
    } finally {
      setSending(false);
    }
  };

  const deleteOrder = async () => {
    if (!id || !order) return;
    
    try {
      setDeleting(true);
      
      // Primeiro, excluir os itens da ordem
      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', id);
        
      if (itemsError) {
        throw new Error(`Erro ao excluir itens: ${itemsError.message}`);
      }
      
      // Em seguida, excluir a ordem de compra
      const { error: orderError } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id);
        
      if (orderError) {
        throw new Error(`Erro ao excluir ordem: ${orderError.message}`);
      }
      
      customToast.success('Ordem de compra excluída com sucesso');
      
      // Redirecionar para a página da cotação específica
      if (order.quotation_id) {
        navigate(`/quotations/${order.quotation_id}`);
      } else {
        // Fallback para a lista de cotações se não houver quotation_id
        navigate('/quotations');
      }
    } catch (error) {
      console.error('Erro ao excluir ordem de compra:', error);
      customToast.error('Erro ao excluir ordem de compra');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="mr-2" size={16} />
          Voltar
        </button>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Ordem de compra não encontrada.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Detalhes da Ordem de Compra</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : order ? (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Ordem #{order.id.substring(0, 8)}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Criada em {new Date(order.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
                <button
                  onClick={generatePdf}
                  className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Baixar PDF
                </button>
                <button
                  onClick={sendToSupplier}
                  disabled={sending}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-5 w-5 mr-2" />
                      Enviar por WhatsApp
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  Excluir
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Informações do Fornecedor */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Fornecedor</h3>
              {order.supplier ? (
                <div>
                  <p className="text-gray-700 font-medium">{order.supplier.name}</p>
                  <p className="text-gray-600">
                    Telefone: ({order.supplier.area_code}) {order.supplier.phone}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 italic">Informações do fornecedor não disponíveis</p>
              )}
            </div>

            {/* Informações do Veículo */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Veículo</h3>
              {order.vehicle ? (
                <div className="flex items-center">
                  {vehicleImage && (
                    <img 
                      src={vehicleImage} 
                      alt="Veículo" 
                      className="w-16 h-16 object-cover rounded-md mr-4"
                    />
                  )}
                  <div>
                    <p className="text-gray-700 font-medium">
                      {order.vehicle.brand} {order.vehicle.model}
                    </p>
                    <p className="text-gray-600">Ano: {order.vehicle.year}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 italic">Informações do veículo não disponíveis</p>
              )}
            </div>

            {/* Oficina para Entrega */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Local de Entrega</h3>
                <button
                  onClick={() => {
                    const dialog = document.getElementById('workshop-dialog') as HTMLDialogElement;
                    if (dialog) dialog.showModal();
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {order.workshop ? 'Alterar' : 'Selecionar'} Oficina
                </button>
              </div>
              {order.workshop ? (
                <div>
                  <p className="text-gray-700 font-medium">{order.workshop.name}</p>
                  <p className="text-gray-600">{order.workshop.address}</p>
                </div>
              ) : (
                <p className="text-gray-500 italic">Nenhuma oficina selecionada para entrega</p>
              )}

              {/* Dialog para selecionar oficina */}
              <dialog id="workshop-dialog" className="modal p-0 rounded-lg shadow-xl">
                <div className="w-full max-w-md">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Selecionar Oficina para Entrega</h3>
                    
                    {loadingOptions ? (
                      <div className="flex justify-center my-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto">
                        {workshops.length === 0 ? (
                          <p className="text-gray-500 italic">Nenhuma oficina cadastrada</p>
                        ) : (
                          <div className="space-y-2">
                            {workshops.map(workshop => (
                              <div 
                                key={workshop.id}
                                onClick={() => {
                                  updateOrderDestination('workshop_id', workshop.id);
                                  const dialog = document.getElementById('workshop-dialog') as HTMLDialogElement;
                                  if (dialog) dialog.close();
                                }}
                                className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                                  order.workshop_id === workshop.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                }`}
                              >
                                <p className="font-medium">{workshop.name}</p>
                                <p className="text-sm text-gray-600">{workshop.city} - {workshop.state}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-6 flex justify-end gap-2">
                      {order.workshop_id && (
                        <button
                          onClick={() => {
                            updateOrderDestination('workshop_id', null);
                            const dialog = document.getElementById('workshop-dialog') as HTMLDialogElement;
                            if (dialog) dialog.close();
                          }}
                          className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50"
                          disabled={saving}
                        >
                          Remover Seleção
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const dialog = document.getElementById('workshop-dialog') as HTMLDialogElement;
                          if (dialog) dialog.close();
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </dialog>
            </div>

            {/* Empresa para Faturamento */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Empresa para Faturamento</h3>
                <button
                  onClick={() => {
                    const dialog = document.getElementById('billing-dialog') as HTMLDialogElement;
                    if (dialog) dialog.showModal();
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {order.billing_company ? 'Alterar' : 'Selecionar'} Empresa
                </button>
              </div>
              {order.billing_company ? (
                <div>
                  <p className="text-gray-700 font-medium">{order.billing_company.company_name}</p>
                  <p className="text-gray-600">CNPJ: {order.billing_company.cnpj}</p>
                  <p className="text-gray-600">Nome Fantasia: {order.billing_company.trading_name}</p>
                </div>
              ) : (
                <p className="text-gray-500 italic">Nenhuma empresa selecionada para faturamento</p>
              )}

              {/* Dialog para selecionar empresa */}
              <dialog id="billing-dialog" className="modal p-0 rounded-lg shadow-xl">
                <div className="w-full max-w-md">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Selecionar Empresa para Faturamento</h3>
                    
                    {loadingOptions ? (
                      <div className="flex justify-center my-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto">
                        {billingCompanies.length === 0 ? (
                          <p className="text-gray-500 italic">Nenhuma empresa cadastrada</p>
                        ) : (
                          <div className="space-y-2">
                            {billingCompanies.map(company => (
                              <div 
                                key={company.id}
                                onClick={() => {
                                  updateOrderDestination('billing_company_id', company.id);
                                  const dialog = document.getElementById('billing-dialog') as HTMLDialogElement;
                                  if (dialog) dialog.close();
                                }}
                                className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                                  order.billing_company_id === company.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                }`}
                              >
                                <p className="font-medium">{company.company_name}</p>
                                <p className="text-sm text-gray-600">CNPJ: {company.cnpj}</p>
                                <p className="text-sm text-gray-600">Nome Fantasia: {company.trading_name}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-6 flex justify-end gap-2">
                      {order.billing_company_id && (
                        <button
                          onClick={() => {
                            updateOrderDestination('billing_company_id', null);
                            const dialog = document.getElementById('billing-dialog') as HTMLDialogElement;
                            if (dialog) dialog.close();
                          }}
                          className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50"
                          disabled={saving}
                        >
                          Remover Seleção
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const dialog = document.getElementById('billing-dialog') as HTMLDialogElement;
                          if (dialog) dialog.close();
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </dialog>
            </div>
          </div>

          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Itens</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Unitário</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.part_description}
                          </div>
                          {item.notes && (
                            <div className="text-sm text-gray-500">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.quantity}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">R$ {item.unit_price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">R$ {item.total_price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-6 py-4 text-right font-medium">Total:</td>
                    <td className="px-6 py-4 text-sm font-bold">R$ {order.total_amount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirmar exclusão</h3>
            <p className="text-gray-700 mb-6">
              Tem certeza que deseja excluir esta ordem de compra? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={deleteOrder}
                disabled={deleting}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
