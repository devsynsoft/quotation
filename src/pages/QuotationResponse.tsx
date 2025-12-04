import React, { useEffect, useState } from 'react';
import { maskPhone } from '../utils/masks';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { customToast } from '../lib/toast';
import { Loader2, Send, Printer, Check, X } from 'lucide-react';

interface Part {
  description: string;
  quantity: number;
  notes?: string;
}

interface PartResponse {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  delivery_time?: string;
  available: boolean;
  condition: 'new' | 'used';
  negotiated?: boolean;
}

interface Quotation {
  id: string;
  vehicle_id?: string;
  vehicle?: any;
  parts: Part[];
  status: 'pending' | 'responded';
  images?: string[];
}

interface QuotationResponse {
  quotation_id: string;
  supplier_name: string;
  supplier_phone: string;
  parts: PartResponse[];
  total_price: number;
  delivery_time?: string;
  delivery_time_unit?: string;
  notes?: string;
  payment_method?: string;
}

interface QuotationRequest {
  id: string;
  quotation_id: string;
  supplier_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  response_data?: any;
  responded_at?: string;
}

interface CounterOffer {
  id: string;
  quotation_id: string;
  request_id: string;
  supplier_id: string;
  counter_offer_data: {
    supplier_name: string;
    supplier_phone: string;
    parts: {
      description: string;
      quantity: number;
      original_price: number;
      original_total: number;
      counter_price: number;
      counter_total: number;
      discount_percentage: number;
      available: boolean;
      condition?: 'new' | 'used';
      notes?: string;
      accepted?: boolean;
    }[];
    total_price: number;
    delivery_time?: string;
    notes?: string;
  };
  status: string;
  response_data?: any;
  created_at: string;
  updated_at: string;
}

const QuotationResponse = () => {
  const { id, requestId } = useParams<{ id: string; requestId: string }>();
  const [searchParams] = useSearchParams();
  const counterOfferId = searchParams.get('counter_offer_id');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [request, setRequest] = useState<QuotationRequest | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  const [response, setResponse] = useState<QuotationResponse>({
    quotation_id: id || '',
    supplier_name: '',
    supplier_phone: '',
    parts: [],
    total_price: 0,
    delivery_time: '',
    notes: ''
  });
  const [counterOffer, setCounterOffer] = useState<CounterOffer | null>(null);
  const [isCounterOffer, setIsCounterOffer] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (id && requestId) {
      console.log('Iniciando carregamento da cotação com ID:', id, 'e requestId:', requestId);
      
      if (counterOfferId) {
        console.log('Carregando contraproposta com ID:', counterOfferId);
        setIsCounterOffer(true);
        loadCounterOffer(counterOfferId);
      } else {
        loadQuotation(id, requestId);
      }
    }
  }, [id, requestId, counterOfferId]);

  useEffect(() => {
    console.log('Estado response atualizado:', response);
    console.log('Número de itens em response.parts:', response.parts ? response.parts.length : 0);
  }, [response]);
  
  // Adicionando um useEffect para monitorar mudanças no estado quotation
  useEffect(() => {
    if (quotation) {
      console.log('Estado quotation atualizado:', quotation);
      console.log('quotation.vehicle:', quotation.vehicle);
      if (quotation.vehicle && quotation.vehicle.images) {
        console.log('quotation.vehicle.images:', quotation.vehicle.images);
        console.log('Tipo de quotation.vehicle.images:', typeof quotation.vehicle.images);
        console.log('quotation.vehicle.images é array?', Array.isArray(quotation.vehicle.images));
        console.log('Número de imagens em quotation:', quotation.vehicle.images.length);
      }
    }
  }, [quotation]);

  const loadCounterOffer = async (counterOfferId: string) => {
    setLoading(true);
    try {
      // Carrega os dados da contraproposta
      const { data: counterOfferData, error: counterOfferError } = await supabase
        .from('counter_offers')
        .select('*')
        .eq('id', counterOfferId)
        .single();

      if (counterOfferError) {
        console.error('Erro ao buscar contraproposta:', counterOfferError);
        throw counterOfferError;
      }

      console.log('Dados da contraproposta carregados:', counterOfferData);
      setCounterOffer(counterOfferData);

      // Carrega os dados da cotação original
      await loadQuotation(id!, requestId!, true);

      // Inicializa a resposta com os dados da contraproposta
      if (counterOfferData.counter_offer_data && typeof counterOfferData.counter_offer_data === 'object' && 'parts' in counterOfferData.counter_offer_data) {
        // Filtra apenas as peças disponíveis
        const counterOfferParts = (counterOfferData.counter_offer_data.parts as any[])
          .filter((part: any) => part.available !== false) // Inclui apenas peças disponíveis
          .map((part: any) => ({
            description: part.description,
            quantity: part.quantity,
            unit_price: part.counter_price || part.unit_price,
            total_price: part.counter_total || part.total_price,
            condition: part.condition,
            available: true,
            delivery_time: part.delivery_time,
            notes: part.notes,
            accepted: part.accepted !== undefined ? part.accepted : true,
            original_price: part.original_price || part.unit_price,
            original_total: part.original_total || part.total_price,
            counter_price: part.counter_price || part.unit_price,
            counter_total: part.counter_total || part.total_price,
            discount_percentage: part.discount_percentage || 0,
            negotiated: true
          }));

        setResponse({
          quotation_id: id || '',
          supplier_name: counterOfferData.counter_offer_data.supplier_name,
          supplier_phone: counterOfferData.counter_offer_data.supplier_phone,
          parts: counterOfferParts,
          total_price: calculateAcceptedTotal(counterOfferParts),
          delivery_time: counterOfferData.counter_offer_data.delivery_time || '',
          notes: counterOfferData.counter_offer_data.notes || ''
        });

        if (counterOfferData.status === 'responded') {
          setSubmitted(true);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar contraproposta:', err);
      customToast.error(err.message || 'Erro ao carregar contraproposta');
    } finally {
      setLoading(false);
    }
  };

  const calculateAcceptedTotal = (parts: any[]) => {
    return parts.reduce((sum, part) => 
      sum + (part.available && (part.accepted !== false) ? (part.counter_total || 0) : 0), 0);
  };

  // Modificação da função loadQuotation para suportar contrapropostas
  const loadQuotation = async (quotationId: string, quotationRequestId: string, isForCounterOffer = false) => {
    setLoading(true);
    try {
      console.log('Iniciando carregamento da cotação:', quotationId, 'request:', quotationRequestId);
      
      // 1. Primeiro carrega os dados da solicitação de cotação
      const { data: requestData, error: requestError } = await supabase
        .from('quotation_requests')
        .select('*')
        .eq('id', quotationRequestId)
        .single();

      if (requestError) {
        console.error('Erro ao buscar solicitação de cotação:', requestError);
        throw requestError;
      }

      console.log('Dados da solicitação de cotação carregados:', requestData);
      setRequest(requestData);

      // Busca dados do fornecedor (nome e telefone) usando supplier_id
      if (requestData.supplier_id) {
        try {
          console.log('Buscando dados do fornecedor com ID:', requestData.supplier_id);
          
          // Definir valores padrão para o fornecedor
          let supplierName = '';
          let supplierPhone = '';
          
          // Verificar se há dados de fornecedor na contraproposta
          if (requestData.response_data) {
            let responseData = requestData.response_data;
            
            // Converter de string para objeto se necessário
            if (typeof responseData === 'string') {
              try {
                responseData = JSON.parse(responseData);
              } catch (e) {
                console.error('Erro ao fazer parse de response_data:', e);
              }
            }
            
            // Extrair dados do fornecedor da resposta
            if (responseData && typeof responseData === 'object') {
              supplierName = responseData.supplier_name || '';
              supplierPhone = responseData.supplier_phone || '';
              console.log('Dados do fornecedor encontrados na resposta:', { supplierName, supplierPhone });
            }
          }
          
          // Se não encontrou na resposta, tentar buscar diretamente
          if (!supplierName || !supplierPhone) {
            console.log('Tentando buscar dados do fornecedor diretamente da tabela suppliers');
            
            console.log('Buscando todos os fornecedores para encontrar o ID correto');
            
            // Buscar todos os fornecedores e filtrar manualmente
            const { data: allSuppliers, error: suppliersError } = await supabase
              .from('suppliers')
              .select('id, name, phone, area_code');
              
            if (suppliersError) {
              console.error('Erro ao buscar todos os fornecedores:', suppliersError);
            } else if (allSuppliers && allSuppliers.length > 0) {
              console.log(`Encontrados ${allSuppliers.length} fornecedores, procurando por ID: ${requestData.supplier_id}`);
              
              // Imprimir todos os IDs para debug
              allSuppliers.forEach((s, index) => {
                console.log(`Fornecedor ${index}: ID=${s.id}, Nome=${s.name}`);
              });
              
              // Filtrar manualmente pelo ID
              const supplier = allSuppliers.find(s => s.id === requestData.supplier_id);
              
              if (supplier) {
                console.log('Fornecedor encontrado via busca manual:', supplier);
                supplierName = supplier.name || '';
                
                // Formatar telefone
                if (supplier.area_code && supplier.phone) {
                  supplierPhone = `(${supplier.area_code}) ${supplier.phone}`;
                } else if (supplier.phone) {
                  supplierPhone = supplier.phone;
                }
                
                console.log('Dados do fornecedor encontrados via busca manual:', { supplierName, supplierPhone });
              } else {
                // Se não encontrou pelo ID exato, tenta uma comparação parcial
                console.log('Tentando encontrar fornecedor por comparação parcial de ID');
                const partialMatch = allSuppliers.find(s => 
                  s.id.includes(requestData.supplier_id) || 
                  requestData.supplier_id.includes(s.id)
                );
                
                if (partialMatch) {
                  console.log('Fornecedor encontrado via comparação parcial:', partialMatch);
                  supplierName = partialMatch.name || '';
                  
                  // Formatar telefone
                  if (partialMatch.area_code && partialMatch.phone) {
                    supplierPhone = `(${partialMatch.area_code}) ${partialMatch.phone}`;
                  } else if (partialMatch.phone) {
                    supplierPhone = partialMatch.phone;
                  }
                  
                  console.log('Dados do fornecedor encontrados via comparação parcial:', { supplierName, supplierPhone });
                } else {
                  // Se ainda não encontrou, usa o primeiro fornecedor da lista como fallback
                  console.log('Não foi possível encontrar o fornecedor, usando o primeiro da lista como fallback');
                  const firstSupplier = allSuppliers[0];
                  supplierName = firstSupplier.name || '';
                  
                  // Formatar telefone
                  if (firstSupplier.area_code && firstSupplier.phone) {
                    supplierPhone = `(${firstSupplier.area_code}) ${firstSupplier.phone}`;
                  } else if (firstSupplier.phone) {
                    supplierPhone = firstSupplier.phone;
                  }
                  
                  console.log('Usando dados do primeiro fornecedor como fallback:', { supplierName, supplierPhone });
                }
              }
            }
          }
          
          // Definir os dados do fornecedor no estado
          if (supplierName || supplierPhone) {
            console.log('Definindo dados do fornecedor:', { supplierName, supplierPhone });
            setResponse(prev => ({
              ...prev,
              supplier_name: supplierName,
              supplier_phone: supplierPhone
            }));
          } else {
            console.log('Não foi possível encontrar dados do fornecedor');
            // Deixar campos vazios
            setResponse(prev => ({
              ...prev,
              supplier_name: '',
              supplier_phone: ''
            }));
          }
        } catch (err) {
          console.error('Erro ao buscar dados do fornecedor:', err);
          // Deixar campos vazios em caso de erro
          setResponse(prev => ({
            ...prev,
            supplier_name: '',
            supplier_phone: ''
          }));
        }
      } else {
        console.log('Nenhum supplier_id encontrado na solicitação');
        // Deixar campos vazios quando não há supplier_id
        setResponse(prev => ({
          ...prev,
          supplier_name: '',
          supplier_phone: ''
        }));
      }

      // 2. Verifica se a cotação já foi respondida
      if (requestData.status === 'responded') {
        console.log('Cotação já respondida, carregando dados da resposta');
        setSubmitted(true);
        
        // Verifica se há dados de resposta no objeto requestData
        if (requestData.response_data) {
          console.log('Tipo de requestData.response_data:', typeof requestData.response_data);
          
          // Tenta converter response_data para objeto se for string
          let responseData = requestData.response_data;
          
          if (typeof responseData === 'string') {
            console.log('Convertendo response_data de string para objeto');
            try {
              responseData = JSON.parse(responseData);
            } catch (parseError) {
              console.error('Erro ao fazer parse do JSON:', parseError);
              console.log('String original:', responseData);
            }
          }
            
          console.log('Estrutura de responseData após processamento:', responseData);
          
          if (responseData && responseData.parts && Array.isArray(responseData.parts)) {
            console.log('Usando partes de requestData.response_data:', responseData.parts);
            // Filtra apenas as peças disponíveis
            const responseParts = (responseData.parts as any[])
              .filter((part: any) => part.available !== false) // Inclui apenas peças disponíveis
              .map((part: any) => ({
                description: part.description,
                quantity: part.quantity,
                unit_price: part.unit_price,
                total_price: part.quantity * part.unit_price,
                condition: part.condition,
                available: part.available !== false,
                delivery_time: part.delivery_time,
                notes: part.notes,
                negotiated: part.negotiated || false
              }));

            const formattedResponse = {
              quotation_id: responseData.quotation_id || quotationId,
              supplier_name: responseData.supplier_name || '',
              supplier_phone: responseData.supplier_phone || '',
              parts: responseParts,
              total_price: responseParts.reduce((sum, part) => sum + part.total_price, 0),
              delivery_time: responseData.delivery_time || '',
              notes: responseData.notes || ''
            };
            
            console.log('Dados da resposta formatados:', formattedResponse);
            setResponse(formattedResponse);
          } else {
            console.error('responseData não contém um array parts válido:', responseData);
          }
        } else {
          console.log('Cotação marcada como respondida, mas não há dados de resposta');
        }
      }
      
      // 3. Carrega os dados básicos da cotação
      // Busca a cotação normalmente
const { data: quotationData, error: quotationError } = await supabase
  .from('quotations')
  .select('*')
  .eq('id', quotationId)
  .single();

if (quotationError || !quotationData) {
  console.error('Erro ao carregar dados da cotação:', quotationError);
  setLoading(false);
  return;
}

console.log('Dados da cotação carregados:', quotationData);

// Busca o veículo pelo vehicle_id da cotação
let vehicle = null;
if (quotationData.vehicle_id) {
  console.log('Buscando veículo com ID:', quotationData.vehicle_id);
  const { data: vehicleData, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, brand, model, year, chassis, images')
    .eq('id', quotationData.vehicle_id)
    .single();
  if (vehicleError) {
    console.error('Erro ao buscar veículo:', vehicleError);
  } else {
    console.log('Dados do veículo carregados:', vehicleData);
    console.log('Tipo de vehicleData.images:', typeof vehicleData.images);
    console.log('vehicleData.images é array?', Array.isArray(vehicleData.images));
    if (vehicleData.images) {
      console.log('Conteúdo de vehicleData.images:', vehicleData.images);
      if (typeof vehicleData.images === 'string') {
        try {
          const parsedImages = JSON.parse(vehicleData.images);
          console.log('Images após parse JSON:', parsedImages);
          vehicleData.images = parsedImages;
        } catch (e) {
          console.error('Erro ao fazer parse das imagens:', e);
        }
      }
    } else {
      console.log('vehicleData.images está vazio ou undefined');
    }
    vehicle = vehicleData;
  }
}

// 4. Cria uma cópia dos dados da cotação para adicionar informações adicionais
let finalQuotationData = {
  ...quotationData,
  vehicle: vehicle || {},
  parts: [],
  status: quotationData.status || 'pending',
};

console.log('finalQuotationData após adicionar vehicle:', finalQuotationData);
console.log('finalQuotationData.vehicle definido?', !!finalQuotationData.vehicle);
console.log('finalQuotationData.vehicle.images definido?', !!finalQuotationData.vehicle.images);
if (finalQuotationData.vehicle && finalQuotationData.vehicle.images) {
  console.log('Tipo de finalQuotationData.vehicle.images:', typeof finalQuotationData.vehicle.images);
  console.log('finalQuotationData.vehicle.images é array?', Array.isArray(finalQuotationData.vehicle.images));
  console.log('Número de imagens:', Array.isArray(finalQuotationData.vehicle.images) ? finalQuotationData.vehicle.images.length : 0);
}
      
      // 5. Busca os itens da cotação
      console.log('Buscando itens da cotação para ID:', quotationId);
      
      // Se a cotação já foi respondida, usa os dados de response_data
      if (requestData.status === 'responded' && requestData.response_data) {
        try {
          console.log('Tipo de requestData.response_data:', typeof requestData.response_data);
          
          // Tenta converter response_data para objeto se for string
          let responseData = requestData.response_data;
          
          if (typeof responseData === 'string') {
            console.log('Convertendo response_data de string para objeto');
            try {
              responseData = JSON.parse(responseData);
            } catch (parseError) {
              console.error('Erro ao fazer parse do JSON:', parseError);
              console.log('String original:', responseData);
            }
          }
            
          console.log('Estrutura de responseData após processamento:', responseData);
          
          if (responseData && responseData.parts && Array.isArray(responseData.parts)) {
            console.log('Usando partes de requestData.response_data:', responseData.parts);
            // Filtra apenas as peças disponíveis
            const responseParts = (responseData.parts as any[])
              .filter((part: any) => part.available !== false) // Inclui apenas peças disponíveis
              .map((part: any) => ({
                description: part.description,
                quantity: part.quantity,
                unit_price: part.unit_price,
                total_price: part.quantity * part.unit_price,
                condition: part.condition,
                available: part.available !== false,
                delivery_time: part.delivery_time,
                notes: part.notes,
                negotiated: part.negotiated || false
              }));

            finalQuotationData.parts = responseParts;
          } else {
            console.error('responseData não contém um array parts válido:', responseData);
          }
        } catch (error) {
          console.error('Erro ao processar response_data:', error);
        }
      } else {
        // Se a cotação não foi respondida, busca os itens da coluna parts da tabela quotations
        console.log('Cotação não respondida, buscando parts da tabela quotations');
        
        // Verifica se quotationData já tem a propriedade parts
        if (quotationData.parts && Array.isArray(quotationData.parts)) {
          console.log('Usando parts já carregados de quotationData:', quotationData.parts);
          // Filtra apenas as peças disponíveis (se houver informação de disponibilidade)
          const quotationParts = quotationData.parts
            .filter((part: any) => part.available !== false) // Inclui apenas peças disponíveis
            .map((part: any) => ({
              description: part.description,
              quantity: part.quantity,
              unit_price: 0,
              total_price: 0,
              condition: '',
              available: true,
              delivery_time: '',
              notes: part.notes || '',
              negotiated: false
            }));

          finalQuotationData.parts = quotationParts;
        }
      }
      
      // 6. Se não encontrou itens, exibe um erro
      if (!finalQuotationData.parts || finalQuotationData.parts.length === 0) {
        console.error('Nenhum item encontrado para a cotação');
      }
      
      // 7. Inicializa o estado response com os itens da cotação se ainda não foi inicializado e não for para contraproposta
      if (!isForCounterOffer) {
        // Se a cotação já foi respondida e temos os dados de resposta
        if (requestData.status === 'responded' && requestData.response_data) {
          try {
            console.log('Usando dados de resposta para inicializar o estado');
            
            // Tenta converter response_data para objeto se for string
            let responseData = requestData.response_data;
            
            if (typeof responseData === 'string') {
              responseData = JSON.parse(responseData);
            }
            
            if (responseData && responseData.parts && Array.isArray(responseData.parts)) {
              console.log('Usando partes de requestData.response_data para o estado:', responseData.parts);
              
              // Garante que todos os campos necessários estejam presentes
              const formattedResponse = {
                quotation_id: responseData.quotation_id || quotationId,
                supplier_name: responseData.supplier_name || '',
                supplier_phone: responseData.supplier_phone || '',
                parts: (responseData.parts as any[])
                  .filter((part: any) => part.available !== false) // Inclui apenas peças disponíveis
                  .map((part: any) => ({
                    description: part.description,
                    quantity: part.quantity,
                    unit_price: part.unit_price || 0,
                    total_price: part.total_price || 0,
                    available: part.available !== undefined ? part.available : true,
                    condition: part.condition || 'new',
                    notes: part.notes || '',
                    negotiated: part.negotiated || false
                  })),
                total_price: responseData.total_price || 0,
                delivery_time: responseData.delivery_time || '',
                notes: responseData.notes || ''
              };
              
              console.log('Estado formatado com dados de resposta:', formattedResponse);
              setResponse(formattedResponse);
              setSubmitted(true);
            }
          } catch (error) {
            console.error('Erro ao processar response_data para o estado:', error);
          }
        } 
        // Se a cotação não foi respondida ou não temos dados de resposta, inicializa com os itens originais
        else if ((!response.parts || response.parts.length === 0) && finalQuotationData.parts.length > 0) {
          const initialParts = finalQuotationData.parts.map(part => ({
            description: part.description,
            quantity: part.quantity,
            unit_price: 0,
            total_price: 0,
            available: true,
            condition: 'new' as 'new' | 'used',
            notes: part.notes || '',
            negotiated: false
          }));
          
          console.log('Inicializando response com os itens originais da cotação:', initialParts);
          
          setResponse(prev => ({
            ...prev,
            quotation_id: quotationId,
            parts: initialParts,
            total_price: 0
          }));
        }
      }
      
      // 8. Atualiza o estado da cotação
      console.log('Atualizando estado quotation com:', finalQuotationData);
      console.log('quotation.vehicle antes de atualizar:', quotation?.vehicle);
      
      // Garantindo que vehicle.images seja um array
      if (finalQuotationData.vehicle && finalQuotationData.vehicle.images) {
        // Fazendo uma cópia profunda para garantir que não haja problemas de referência
        const vehicleImagesCopy = [...finalQuotationData.vehicle.images];
        console.log('Cópia do array de imagens criada:', vehicleImagesCopy);
        console.log('Tipo da cópia:', typeof vehicleImagesCopy);
        console.log('A cópia é um array?', Array.isArray(vehicleImagesCopy));
        console.log('Número de imagens na cópia:', vehicleImagesCopy.length);
        
        // Atualiza o objeto vehicle com a cópia do array de imagens
        finalQuotationData.vehicle = {
          ...finalQuotationData.vehicle,
          images: vehicleImagesCopy
        };
        
        console.log('Vehicle após atualização com cópia:', finalQuotationData.vehicle);
      }
      
      setQuotation(finalQuotationData);
      
    } catch (error) {
      console.error('Erro ao carregar cotação:', error);
      customToast.error('Erro ao carregar cotação. Por favor, tente novamente.');
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  };

  const handlePartChange = (index: number, field: string, value: any) => {
    setResponse(prev => {
      const newParts = [...prev.parts];
      const updatedPart = { ...newParts[index] };

      if (field === 'condition') {
        updatedPart.condition = value as 'new' | 'used';
      } else if (field === 'unit_price') {
        const numericValue = Math.max(0, value || 0);
        updatedPart.unit_price = numericValue;

        if (numericValue > 0) {
          updatedPart.available = true;
          updatedPart.total_price = numericValue * updatedPart.quantity;
        } else {
          updatedPart.available = false;
          updatedPart.total_price = 0;
        }
      } else if (field === 'available') {
        updatedPart.available = value;
        if (!value) {
          updatedPart.unit_price = 0;
          updatedPart.total_price = 0;
        }
      } else {
        (updatedPart as any)[field] = value;
      }

      newParts[index] = updatedPart;

      const totalPrice = newParts.reduce((sum, part) => 
        sum + (part.available ? (part.total_price || 0) : 0), 0);

      return {
        ...prev,
        parts: newParts,
        total_price: totalPrice,
      };
    });
  };

  const handlePartAcceptance = (index: number, accepted: boolean) => {
    if (!counterOffer) return;

    setResponse(prev => {
      const newParts = [...prev.parts];
      newParts[index] = {
        ...newParts[index],
        accepted
      };

      // Recalcula o total apenas com as peças aceitas
      const totalPrice = calculateAcceptedTotal(newParts);

      return {
        ...prev,
        parts: newParts,
        total_price: totalPrice
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    if (!response.supplier_name.trim() || !response.supplier_phone.trim()) {
      customToast.error('Por favor, preencha seu nome e telefone');
      return;
    }

    const sanitizedParts = response.parts.map(part => {
      const hasPrice = !!part.unit_price && part.unit_price > 0;
      return {
        ...part,
        available: hasPrice,
        total_price: hasPrice ? part.quantity * part.unit_price : 0,
      };
    });

    const availableParts = sanitizedParts.filter(part => part.available);

    if (availableParts.some(part => !part.unit_price)) {
      customToast.error('Por favor, preencha o preço de todas as peças disponíveis');
      return;
    }

    if (availableParts.some(part => !part.condition)) {
      customToast.error('Por favor, selecione a condição (nova ou usada) para todas as peças disponíveis');
      return;
    }

    const updatedTotalPrice = sanitizedParts.reduce((sum, part) => 
      sum + (part.available ? (part.total_price || 0) : 0), 0);

    const responsePayload = {
      ...response,
      parts: sanitizedParts,
      total_price: updatedTotalPrice,
    };

    try {
      setSubmitting(true);

      const { error: updateError } = await supabase
        .from('quotation_requests')
        .update({
          status: 'responded',
          response_data: responsePayload,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      setResponse(responsePayload);
      customToast.success('Cotação enviada com sucesso!');
      setSubmitted(true);
    } catch (err: any) {
      console.error('Erro ao enviar cotação:', err);
      customToast.error(err.message || 'Erro ao enviar cotação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitCounterOfferResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !counterOffer) return;

    try {
      setSubmitting(true);

      // Prepara os dados da resposta
      const responseData = {
        parts: response.parts.map(part => ({
          description: part.description,
          quantity: part.quantity,
          original_price: part.original_price,
          counter_price: part.counter_price,
          counter_total: part.counter_total,
          discount_percentage: part.discount_percentage,
          available: part.available,
          condition: part.condition,
          accepted: part.accepted !== undefined ? part.accepted : true,
          notes: part.notes,
          negotiated: part.negotiated || false
        })),
        total_price: response.total_price,
        delivery_time: response.delivery_time,
        notes: response.notes,
        supplier_name: response.supplier_name,
        supplier_phone: response.supplier_phone
      };

      // Atualiza o status da contraproposta
      const allAccepted = response.parts.every(part => part.accepted !== false);
      const status = allAccepted ? 'accepted' : 'partially_accepted';

      const { error: updateError } = await supabase
        .from('counter_offers')
        .update({
          status: status,
          response_data: responseData,
          updated_at: new Date().toISOString()
        })
        .eq('id', counterOffer.id);

      if (updateError) throw updateError;

      // Atualiza a cotação original com os novos valores
      const { error: quotationUpdateError } = await supabase
        .from('quotation_requests')
        .update({
          response_data: {
            ...response,
            renegotiated: true
          }
        })
        .eq('id', requestId);

      if (quotationUpdateError) throw quotationUpdateError;

      customToast.success('Resposta à contraproposta enviada com sucesso!');
      setSubmitted(true);
    } catch (err: any) {
      console.error('Erro ao enviar resposta à contraproposta:', err);
      customToast.error(err.message || 'Erro ao enviar resposta');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6 print-container">
            <div className="mb-6 text-center print-header">
              <div className="mb-4 no-print">
                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Cotação Enviada com Sucesso!
              </h2>
              <p className="text-gray-600 mb-6 no-print">
                Esta cotação já foi enviada e não pode ser alterada.
              </p>
              <p className="text-gray-900 font-bold print-only" style={{ display: 'none' }}>
                Cotação de Peças - {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-medium mb-2">Detalhes do Veículo</h2>
              <p>
                {quotation?.vehicle?.brand || 'N/A'} {quotation?.vehicle?.model || ''} {quotation?.vehicle?.year || ''}
                {quotation?.vehicle?.chassis && ` - Chassi: ${quotation.vehicle.chassis}`}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  Nome do Fornecedor
                </label>
                <p className="text-gray-900">{response.supplier_name}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  Telefone do Fornecedor
                </label>
                <p className="text-gray-900">{response.supplier_phone}</p>
              </div>
            </div>

            <div className="overflow-x-auto mb-6">
              <h2 className="text-lg font-medium mb-4">Peças Cotadas</h2>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Peça
                    </th>
                    <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qtde
                    </th>
                    <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Condição
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Un.
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {response.parts.length > 0 ? (
                    response.parts.map((part, index) => (
                      <tr key={index} className={part.available ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.description}
                          {part.negotiated && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Negociado
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.quantity}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                          {part.available ? (
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                              part.condition === 'new'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {part.condition === 'new' ? 'Nova' : 'Usada'}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
                              Não disponível
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.available ? `R$ ${part.unit_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.available ? `R$ ${part.total_price.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500">
                        Nenhuma peça encontrada na cotação.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                      Valor Total:
                    </td>
                    <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                      R$ {response.total_price.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
              {response.delivery_time && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Prazo de Entrega</h3>
                  <p className="mt-1 text-sm text-gray-900">{response.delivery_time}</p>
                </div>
              )}
              {response.notes && (
                <div className="sm:col-span-2">
                  <h3 className="text-sm font-medium text-gray-700">Observações</h3>
                  <p className="mt-1 text-sm text-gray-900">{response.notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 text-center text-gray-500 text-sm no-print">
              <p>Esta cotação já foi enviada e não pode ser alterada.</p>
              <p className="mt-2">Se precisar de ajuda, entre em contato com o solicitante.</p>
            </div>
            <div className="mt-6 flex justify-center no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir Cotação
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!quotation || !dataLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-red-500">Cotação não encontrada</p>
      </div>
    );
  }

  if (isCounterOffer && counterOffer) {
    if (loading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (submitted) {
      return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white shadow rounded-lg p-6 print-container">
              <div className="mb-6 text-center print-header">
                <div className="mb-4 no-print">
                  <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Resposta à Contraproposta Enviada!
                </h2>
                <p className="text-gray-600 mb-6 no-print">
                  Sua resposta à contraproposta foi enviada com sucesso.
                </p>
              </div>

              <div className="mb-6">
  <h2 className="text-lg font-medium mb-2">Detalhes do Veículo</h2>
  <p>
    {quotation?.vehicle?.brand || 'N/A'} {quotation?.vehicle?.model || ''} {quotation?.vehicle?.year || ''}
    {quotation?.vehicle?.chassis && (
      <span className="ml-2 text-gray-600">Chassi: {quotation.vehicle.chassis}</span>
    )}
  </p>
  {/* Imagens do veículo - exibição principal */}
  {quotation?.vehicle?.images && Array.isArray(quotation.vehicle.images) && quotation.vehicle.images.length > 0 ? (
    <div className="mt-4">
      {/* Exibição da imagem principal */}
      <div className="mb-4 flex justify-center">
        <img
          src={quotation.vehicle.images[selectedImageIdx]}
          alt={`Foto veículo ${selectedImageIdx + 1}`}
          className="max-h-[300px] rounded shadow border border-gray-300"
          onError={(e) => {
            console.error(`Erro ao carregar imagem principal ${selectedImageIdx}:`, e);
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Erro+ao+carregar';
          }}
          onLoad={() => console.log(`Imagem principal ${selectedImageIdx} carregada com sucesso`)}
        />
      </div>
      
      {/* Controles de navegação */}
      <div className="flex justify-center items-center gap-4 mb-4">
        <button 
          onClick={() => setSelectedImageIdx(prev => prev > 0 ? prev - 1 : quotation.vehicle.images.length - 1)}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Anterior
        </button>
        <span className="text-sm text-gray-600">
          {selectedImageIdx + 1} / {quotation.vehicle.images.length}
        </span>
        <button 
          onClick={() => setSelectedImageIdx(prev => prev < quotation.vehicle.images.length - 1 ? prev + 1 : 0)}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Próxima
        </button>
      </div>
      
      {/* Miniaturas */}
      <div className="flex flex-wrap gap-2 justify-center">
        {quotation.vehicle.images.map((imgUrl: string, idx: number) => (
          <img
            key={idx}
            src={imgUrl}
            alt={`Foto veículo ${idx + 1}`}
            className={`w-16 h-16 object-cover rounded shadow cursor-pointer border ${selectedImageIdx === idx ? 'border-blue-500 ring-2 ring-blue-400' : 'border-gray-200'}`}
            onClick={() => {
              console.log(`Clicou na imagem ${idx}, URL:`, imgUrl);
              setSelectedImageIdx(idx);
            }}
            onError={(e) => {
              console.error(`Erro ao carregar miniatura ${idx}:`, e);
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64?text=Erro';
            }}
            onLoad={() => console.log(`Miniatura ${idx} carregada com sucesso`)}
          />
        ))}
      </div>
    </div>
  ) : request?.cover_image ? (
    <div className="mt-4 flex justify-center">
      <img
        src={request.cover_image}
        alt="Foto do veículo"
        className="max-h-[300px] rounded shadow border border-gray-300"
        onError={(e) => {
          console.error('Erro ao carregar imagem de capa:', e);
          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Erro+ao+carregar';
        }}
      />
    </div>
  ) : (
    <div className="mt-4 p-4 bg-gray-100 rounded text-center text-gray-500">
      Nenhuma imagem disponível para este veículo
    </div>
  )}
  {/* Modal de imagem/carrossel removido daqui, pois foi movido para dentro da seção de detalhes do veículo */}
</div>

              <div className="overflow-x-auto mb-6">
                <h2 className="text-lg font-medium mb-4">Itens da Contraproposta</h2>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Peça
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qtde
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Preço Original
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contraproposta
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {response.parts.map((part, index) => (
                      <tr key={index} className={!part.available ? 'bg-gray-100' : part.accepted ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.description}
                          {part.negotiated && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Negociado
                            </span>
                          )}
                          {!part.available && <span className="ml-2 text-red-500">(Não disponível)</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.quantity}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.available ? `R$ ${part.original_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.available ? `R$ ${part.counter_price.toFixed(2)}` : '-'}
                          {part.available && part.condition && (
                            <div className="text-xs mt-1">
                              <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                part.condition === 'new'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {part.condition === 'new' ? 'Nova' : 'Usada'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                          {part.available ? (
                            part.accepted ? (
                              <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                                Aceito
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
                                Recusado
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                              N/A
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        Valor Total Original:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        R$ {counterOffer.counter_offer_data.parts.reduce((sum, part) => 
                          sum + (part.available ? part.original_total : 0), 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                        Valor Total Contraproposta:
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                        R$ {response.total_price.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-6 text-center text-gray-500 text-sm no-print">
                <p>Esta resposta já foi enviada e não pode ser alterada.</p>
                <p className="mt-2">Aguarde o contato do solicitante para finalizar a negociação.</p>
              </div>
              <div className="mt-6 flex justify-center no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>CONTRAPROPOSTA:</strong> O cliente fez uma contraproposta para os itens abaixo. 
                    Você pode aceitar ou recusar cada item individualmente.
                  </p>
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-6">Responder Contraproposta</h1>

            <div className="mb-6">
              <h2 className="text-lg font-medium mb-2">Detalhes do Veículo</h2>
              <p>
                {quotation?.vehicle?.brand || 'N/A'} {quotation?.vehicle?.model || ''} {quotation?.vehicle?.year || ''}
                {quotation?.vehicle?.chassis && ` - Chassi: ${quotation.vehicle.chassis}`}
              </p>
            </div>

            <form onSubmit={handleSubmitCounterOfferResponse} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-2">
                    Nome do Fornecedor
                  </label>
                  <p className="text-gray-900">{response.supplier_name}</p>
                </div>
                <div>
  <label className="block text-sm font-semibold text-blue-900 mb-2">
    Telefone do Fornecedor
  </label>
  <input
    type="text"
    value={response.supplier_phone}
    onChange={e => {
      const masked = maskPhone(e.target.value);
      setResponse(prev => ({ ...prev, supplier_phone: masked }));
    }}
    className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-2"
    placeholder="(99) 99999-9999"
    maxLength={15}
  />
</div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Peça
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qtde
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Preço Original
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contraproposta
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Desconto
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {response.parts.map((part, index) => (
                      <tr key={index} className={!part.available ? 'bg-gray-100' : part.accepted ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.description}
                          {part.negotiated && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Negociado
                            </span>
                          )}
                          {!part.available && <span className="ml-2 text-red-500">(Não disponível)</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.quantity}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.available ? `R$ ${part.original_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.available ? (
                            <div className="flex items-center gap-2">
                              <div>
                                R$ {part.counter_price.toFixed(2)} /un
                                <br />
                                <span className="text-xs text-green-500">
                                  -R$ {(part.original_price - part.counter_price).toFixed(2)} ({-part.discount_percentage}%)
                                </span>
                                <br />
                                <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                                  part.condition === 'new'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {part.condition === 'new' ? 'Nova' : 'Usada'}
                                </span>
                              </div>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.available ? `${part.discount_percentage}%` : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                          {part.available && (
                            <div className="flex justify-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handlePartAcceptance(index, true)}
                                className={`p-1 rounded-full ${part.accepted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                                title="Aceitar"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePartAcceptance(index, false)}
                                className={`p-1 rounded-full ${part.accepted === false ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}
                                title="Recusar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        Valor Total Original:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        R$ {counterOffer.counter_offer_data.parts.reduce((sum, part) => 
                          sum + (part.available ? part.original_total : 0), 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                        Valor Total Contraproposta:
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                        R$ {response.total_price.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div>
                <h2 className="text-lg font-medium mb-4">Informações Gerais</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Prazo de Entrega
                    </label>
                    <input
                      type="text"
                      value={response.delivery_time}
                      onChange={e => setResponse(prev => ({ ...prev, delivery_time: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-2"
                      placeholder="Ex: 5 dias úteis"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Observações Gerais
                  </label>
                  <textarea
                    value={response.notes}
                    onChange={e => setResponse(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-2"
                    placeholder="Adicione observações relevantes sobre a contraproposta..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Resposta
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Responder Cotação</h1>

          <div className="mb-6">
            <h2 className="text-lg font-medium mb-2">Detalhes do Veículo</h2>
            <p>
              {quotation?.vehicle?.brand || 'N/A'} {quotation?.vehicle?.model || ''} {quotation?.vehicle?.year || ''}
              {quotation?.vehicle?.chassis && ` - Chassi: ${quotation.vehicle.chassis}`}
            </p>
            
            {/* Exibição das imagens do veículo - apenas miniaturas */}
            {quotation?.vehicle?.images && Array.isArray(quotation.vehicle.images) && quotation.vehicle.images.length > 0 ? (
              <div className="mt-4">
                {/* Miniaturas */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {quotation.vehicle.images.map((imgUrl: string, idx: number) => (
                    <img
                      key={idx}
                      src={imgUrl}
                      alt={`Foto veículo ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded shadow cursor-pointer border border-gray-200 hover:border-blue-500 hover:ring-2 hover:ring-blue-400"
                      onClick={() => {
                        console.log(`Clicou na imagem ${idx}, URL:`, imgUrl);
                        setSelectedImageIdx(idx);
                        setShowImageModal(true);
                      }}
                      onError={(e) => {
                        console.error(`Erro ao carregar miniatura ${idx}:`, e);
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64?text=Erro';
                      }}
                      onLoad={() => console.log(`Miniatura ${idx} carregada com sucesso`)}
                    />
                  ))}
                </div>
                
                {/* Modal para exibição da imagem grande */}
                {showImageModal && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
                    onClick={e => { if (e.target === e.currentTarget) setShowImageModal(false); }}
                  >
                    <button
                      className="absolute top-4 right-4 text-white text-3xl font-bold z-60"
                      onClick={() => setShowImageModal(false)}
                      aria-label="Fechar"
                      type="button"
                    >
                      &times;
                    </button>
                    <div className="relative flex flex-col items-center">
                      <button
                        className="absolute left-0 top-1/2 -translate-y-1/2 text-white text-3xl font-bold px-2 py-1 z-60"
                        onClick={e => { e.stopPropagation(); setSelectedImageIdx((prev) => (prev > 0 ? prev - 1 : quotation.vehicle.images.length - 1)); }}
                        aria-label="Anterior"
                        type="button"
                      >
                        &#8592;
                      </button>
                      <img
                        src={quotation.vehicle.images[selectedImageIdx]}
                        alt={`Foto veículo ${selectedImageIdx + 1}`}
                        className="max-w-[90vw] max-h-[80vh] rounded-lg shadow-lg border-4 border-white"
                        onError={(e) => {
                          console.error(`Erro ao carregar imagem principal ${selectedImageIdx}:`, e);
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Erro+ao+carregar';
                        }}
                        onLoad={() => console.log(`Imagem principal ${selectedImageIdx} carregada com sucesso`)}
                      />
                      <button
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-white text-3xl font-bold px-2 py-1 z-60"
                        onClick={e => { e.stopPropagation(); setSelectedImageIdx((prev) => (prev < quotation.vehicle.images.length - 1 ? prev + 1 : 0)); }}
                        aria-label="Próxima"
                        type="button"
                      >
                        &#8594;
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white bg-black bg-opacity-50 px-3 py-1 rounded text-xs">
                        {selectedImageIdx + 1} / {quotation.vehicle.images.length}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : request?.cover_image ? (
              <div className="mt-4 flex justify-center">
                <img
                  src={request.cover_image}
                  alt="Foto do veículo"
                  className="w-20 h-20 object-cover rounded shadow cursor-pointer border border-gray-200 hover:ring-2 hover:ring-blue-400"
                  onClick={() => {
                    setSelectedImageIdx(0);
                    setShowImageModal(true);
                  }}
                  onError={(e) => {
                    console.error('Erro ao carregar imagem de capa:', e);
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64?text=Erro';
                  }}
                />
              </div>
            ) : (
              <div className="mt-4 p-4 bg-gray-100 rounded text-center text-gray-500">
                Nenhuma imagem disponível para este veículo
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Versão para desktop - tabela normal */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Situação
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Peça
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qtde
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Un.
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {response.parts.length > 0 ? (
                    response.parts.map((part, index) => (
                      <tr key={index} className={part.unit_price > 0 ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          <div className="flex justify-start space-x-2">
                            <button
                              type="button"
                              onClick={() => handlePartChange(index, 'condition', 'new')}
                              className={`px-3 py-1 rounded-md text-xs font-medium ${
                                part.condition === 'new'
                                  ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                                  : 'bg-gray-100 text-gray-800 border border-gray-300'
                              }`}
                            >
                              Nova
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePartChange(index, 'condition', 'used')}
                              className={`px-3 py-1 rounded-md text-xs font-medium ${
                                part.condition === 'used'
                                  ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
                                  : 'bg-gray-100 text-gray-800 border border-gray-300'
                              }`}
                            >
                              Usada
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.description}
                          {part.negotiated && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Negociado
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.quantity}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={part.unit_price}
                            onChange={e => handlePartChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-2"
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left">
                          {part.unit_price > 0 ? `R$ ${(part.unit_price * part.quantity).toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                        Nenhum item encontrado para esta cotação.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                      Valor Total:
                    </td>
                    <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                      R$ {response.total_price.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            {/* Versão para mobile - cartões empilhados */}
            <div className="md:hidden">
              {response.parts.length > 0 ? (
                <div className="space-y-4">
                  {response.parts.map((part, index) => (
                    <div key={index} className={`p-4 rounded-lg shadow ${part.unit_price > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="mb-3">
                        <h3 className="font-bold text-gray-900">{part.description}</h3>
                        {part.negotiated && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                            Negociado
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Quantidade</p>
                          <p className="text-sm">{part.quantity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Situação</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => handlePartChange(index, 'condition', 'new')}
                              className={`px-3 py-1 rounded-md text-xs font-medium ${
                                part.condition === 'new'
                                  ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                                  : 'bg-gray-100 text-gray-800 border border-gray-300'
                              }`}
                            >
                              Nova
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePartChange(index, 'condition', 'used')}
                              className={`px-3 py-1 rounded-md text-xs font-medium ${
                                part.condition === 'used'
                                  ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
                                  : 'bg-gray-100 text-gray-800 border border-gray-300'
                              }`}
                            >
                              Usada
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 font-medium">Preço Unitário</p>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={part.unit_price}
                          onChange={e => handlePartChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-2 py-2 text-lg"
                        />
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Total</p>
                        <p className="text-lg font-bold">
                          {part.unit_price > 0 ? `R$ ${(part.unit_price * part.quantity).toFixed(2)}` : '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="p-4 bg-white rounded-lg shadow-md mt-4">
                    <div className="flex justify-between items-center">
                      <p className="font-bold">Valor Total:</p>
                      <p className="text-lg font-bold">R$ {response.total_price.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 bg-white rounded-lg shadow">
                  Nenhum item encontrado para esta cotação.
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-medium mb-4">Informações Gerais</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Prazo de Entrega
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      min="0"
                      value={response.delivery_time || ''}
                      onChange={e => setResponse(prev => ({ ...prev, delivery_time: e.target.value }))}
                      className="block w-2/3 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-2"
                      placeholder="Quantidade"
                    />
                    <select
                      value={response.delivery_time_unit || 'Dias'}
                      onChange={e => setResponse(prev => ({ ...prev, delivery_time_unit: e.target.value }))}
                      className="block w-1/3 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-2"
                    >
                      <option value="Dias">Dias</option>
                      <option value="Dias úteis">Dias úteis</option>
                      <option value="Meses">Meses</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Forma de pagamento
                  </label>
                  <input
                    type="text"
                    value={response.payment_method || ''}
                    onChange={e => setResponse(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-2"
                    placeholder="Ex: Pix, boleto, cartão, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Valor Total
                  </label>
                  <p className="mt-2 text-lg font-medium">
                    R$ {response.total_price.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  Observações Gerais
                </label>
                <textarea
                  value={response.notes}
                  onChange={e => setResponse(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-2"
                  placeholder="Adicione observações relevantes sobre a cotação..."
                />
              </div>
            </div>

            {/* Bloco de informações do fornecedor movido para o final */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  Nome do Fornecedor *
                </label>
                <input
                  type="text"
                  value={response.supplier_name}
                  onChange={e => setResponse(prev => ({ ...prev, supplier_name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-2 border-blue-200 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 px-2"
                  required
                  placeholder="Digite seu nome completo"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  Telefone do Fornecedor *
                </label>
                <input
                  type="tel"
                  value={response.supplier_phone}
                  onChange={e => setResponse(prev => ({ ...prev, supplier_phone: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-2 border-blue-200 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 px-2"
                  required
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Cotação
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default QuotationResponse;
