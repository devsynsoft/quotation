import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Trash2, Plus, Upload, FileText, Loader2, Book } from 'lucide-react';
import SupplierSelection from './SupplierSelection';
import { QuotationPartForm, QuotationPart } from './quotations/QuotationPartForm';
import { expandAbbreviations } from '../utils/textUtils';
import TextAbbreviationsModal from './TextAbbreviationsModal';
import * as pdfjs from 'pdfjs-dist';
import { customToast, hotToast } from '../lib/toast';
import { extractVehicleInfoFromPDF } from '../services/geminiService';

// Configurar worker do PDF.js
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

interface Part {
  operation: string;
  code: string;
  description: string;
  part_type: string;
  quantity: number;
  painting_hours: number;
  labor_hours: number;
  labor_cost: number;
  part_cost: number;
}

interface Vehicle {
  brand: string;
  model: string;
  year: string;
  plate?: string;
  chassis?: string;
  images?: string[];
}

type InputType = 'manual' | 'bulk' | 'report';

const VehicleQuotationForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [inputType, setInputType] = useState<InputType>('manual');
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle>({
    brand: '',
    model: '',
    year: '',
    plate: '',
    chassis: '',
    images: [],
  });
  const [parts, setParts] = useState<Part[]>([{
    operation: '',
    code: '',
    description: '',
    part_type: '',
    quantity: 1,
    painting_hours: 0,
    labor_hours: 0,
    labor_cost: 0,
    part_cost: 0
  }]);
  const [bulkText, setBulkText] = useState('');
  const [report, setReport] = useState('');
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [isAbbreviationsModalOpen, setIsAbbreviationsModalOpen] = useState(false);
  const [importingPdf, setImportingPdf] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedImages(prev => [...prev, ...acceptedFiles]);
    // Criar URLs temporárias para preview
    const urls = acceptedFiles.map(file => URL.createObjectURL(file));
    setImageUrls(prev => [...prev, ...urls]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png']
    },
    multiple: true
  });

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleVehicleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setVehicle(prev => ({ ...prev, [name]: value }));
  };

  const processBulkText = async () => {
    try {
      // Dividir o texto em linhas e filtrar linhas vazias
      const lines = bulkText.split('\n').filter(line => line.trim());

      // Remove a primeira linha (cabeçalho)
      const dataLines = lines.slice(1);

      // Processar cada linha
      const processedParts = await Promise.all(dataLines.map(async (line) => {
        try {
          // Extrai a operação (pode ser "TROCAR" ou "TROCAR /PINTAR")
          let operation = "TROCAR"; // valor padrão
          if (line.includes("TROCAR /PINTAR") || line.includes("TROCAR/PINTAR")) {
            operation = "TROCAR/PINTAR";
          }

          // Remove a operação da linha para processar o resto
          let processedLine = line.replace(/^TROCAR(\s*\/\s*PINTAR)?/, '').trim();

          // Encontra o índice do (I) que marca o início da descrição
          const descStartIndex = processedLine.indexOf("(I)");
          if (descStartIndex === -1) return null; // Se não encontrar (I), ignora a linha

          // Extrai o código (tudo antes do (I), removendo espaços)
          const code = processedLine.substring(0, descStartIndex).replace(/\s+/g, '');

          // Pega o resto da linha após o (I)
          let restOfLine = processedLine.substring(descStartIndex);

          // Divide o resto da linha em partes
          const parts = restOfLine.split(/\s+/).filter(p => p);

          // Encontra o índice do tipo de peça (Genuína, Nova, Usada)
          const typeIndex = parts.findIndex(part => ['Genuína', 'Nova', 'Usada'].includes(part));
          if (typeIndex === -1) return null;

          // Pega a descrição (tudo entre (I) e o tipo da peça)
          const description = parts.slice(0, typeIndex).join(' ');

          // Expande abreviações na descrição
          const expandedDescription = await expandAbbreviations(description);

          // Pega o tipo da peça
          const partType = parts[typeIndex];

          // Procura números após o tipo da peça
          const numbers = parts.slice(typeIndex + 1)
            .map(part => {
              // Remove pontos de milhar e substitui vírgula por ponto para decimais
              const cleanNumber = part.replace(/\./g, '').replace(',', '.');
              return parseFloat(cleanNumber);
            })
            .filter(num => !isNaN(num));

          // Extrai quantidade, preço unitário e preço total
          const [quantity = 1, unitPrice = 0, totalPrice = 0] = numbers;

          // Pega as horas de pintura (último número da linha, se existir)
          const paintingHours = numbers[numbers.length - 1] || 0;
          
          return {
            operation,
            code,
            description: expandedDescription.trim(),
            part_type: partType === 'Genuína' ? 'genuine' : 
                      partType === 'Usada' ? 'used' : 'new',
            quantity,
            painting_hours: paintingHours,
            labor_hours: 0,
            labor_cost: 0,
            part_cost: totalPrice || (unitPrice * quantity)
          };
        } catch (err) {
          console.error('Erro ao processar linha:', line, err);
          return null;
        }
      }));

      // Filtra partes nulas e garante que todas as propriedades necessárias existem
      const validParts = processedParts.filter((part): part is Part => {
        if (!part) return false;
        return (
          typeof part.operation === 'string' &&
          typeof part.code === 'string' &&
          typeof part.description === 'string' &&
          typeof part.part_type === 'string' &&
          typeof part.quantity === 'number' &&
          typeof part.painting_hours === 'number' &&
          typeof part.labor_hours === 'number' &&
          typeof part.labor_cost === 'number' &&
          typeof part.part_cost === 'number'
        );
      });
      
      setParts(validParts);
    } catch (err) {
      console.error('Erro ao processar texto:', err);
      // hotToast.error('Erro ao processar texto. Verifique o formato e tente novamente.');
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && (!vehicle.brand || !vehicle.model || !vehicle.year)) {
      setError('Por favor, preencha os campos obrigatórios do veículo');
      return;
    }
    setError('');
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const uploadImages = async () => {
    const uploadedUrls = [];
    
    for (const file of uploadedImages) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('vehicle-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Pega a URL pública com o token de autenticação
      const { data: { signedUrl } } = await supabase.storage
        .from('vehicle-images')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 ano de validade

      if (signedUrl) {
        uploadedUrls.push(signedUrl);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      console.log('Enviando dados do veículo:', {
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        plate: vehicle.plate || null,
        chassis: vehicle.chassis || null
      });

      let vehicleId;
      
      // Se estamos editando, não precisamos fazer upload das imagens novamente se não houver novas
      let imageUrls = [];
      
      // Se temos imagens já carregadas do veículo e não temos novas imagens para upload
      if (vehicle.images && vehicle.images.length > 0 && uploadedImages.length === 0) {
        imageUrls = vehicle.images;
      } else {
        // Upload das imagens
        imageUrls = await uploadImages();
        console.log('URLs das imagens:', imageUrls);
      }

      // Se estamos editando, usamos o veículo existente
      if (isEditing && quotationId) {
        // Buscar o ID do veículo da cotação existente
        const { data: quotationData, error: quotationError } = await supabase
          .from('quotations')
          .select('vehicle_id')
          .eq('id', quotationId)
          .single();
          
        if (quotationError) {
          throw quotationError;
        }
        
        vehicleId = quotationData.vehicle_id;
        
        // Atualizar o veículo existente
        const { error: vehicleUpdateError } = await supabase
          .from('vehicles')
          .update({
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            plate: vehicle.plate || null,
            chassis: vehicle.chassis || null,
            images: imageUrls
          })
          .eq('id', vehicleId);
          
        if (vehicleUpdateError) {
          throw vehicleUpdateError;
        }
      } else {
        // Inserir novo veículo
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .insert({
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            plate: vehicle.plate || null,
            chassis: vehicle.chassis || null,
            images: imageUrls,
            user_id: user.id
          })
          .select()
          .single();

        if (vehicleError) {
          console.error('Erro ao criar veículo:', vehicleError);
          throw vehicleError;
        }

        console.log('Veículo criado:', vehicleData);
        vehicleId = vehicleData.id;
      }

      // Atualiza o estado do veículo com as imagens
      setVehicle(prev => ({ ...prev, images: imageUrls }));

      // Preparar dados das peças
      let partsData;
      if (inputType === 'manual') {
        partsData = parts;
      } else if (inputType === 'bulk') {
        partsData = parts;
      } else {
        partsData = [{
          operation: '',
          code: '',
          description: report,
          part_type: '',
          quantity: 1,
          painting_hours: 0,
          labor_hours: 0,
          labor_cost: 0,
          part_cost: 0
        }];
      }

      console.log('Dados das peças:', partsData);

      let quotationResult;
      
      if (isEditing && quotationId) {
        // Atualizar cotação existente
        const { data: updatedQuotation, error: updateError } = await supabase
          .from('quotations')
          .update({
            parts: partsData,
            description: inputType === 'report' ? report : null,
            input_type: inputType,
            status: 'pending' // Reseta o status para pending ao editar
          })
          .eq('id', quotationId)
          .select()
          .single();
          
        if (updateError) {
          throw updateError;
        }
        
        quotationResult = updatedQuotation;
      } else {
        // Criar nova cotação
        const { data: quotationData, error: quotationError } = await supabase
          .from('quotations')
          .insert({
            vehicle_id: vehicleId,
            parts: partsData,
            description: inputType === 'report' ? report : null,
            input_type: inputType,
            status: 'pending',
            user_id: user.id
          })
          .select()
          .single();

        if (quotationError) {
          console.error('Erro ao criar cotação:', quotationError);
          throw quotationError;
        }
        
        quotationResult = quotationData;
      }

      console.log('Cotação ' + (isEditing ? 'atualizada' : 'criada') + ':', quotationResult);

      setQuotationId(quotationResult.id);
      setCurrentStep(3); // Avançar para a etapa 3 (seleção de fornecedores)
    } catch (err: any) {
      console.error('Erro ao enviar:', err);
      setError(err.message || 'Erro ao ' + (isEditing ? 'atualizar' : 'criar') + ' cotação');
    } finally {
      setLoading(false);
    }
  };

  const addPart = () => {
    setParts(prev => [...prev, {
      operation: '',
      code: '',
      description: '',
      part_type: '',
      quantity: 1,
      painting_hours: 0,
      labor_hours: 0,
      labor_cost: 0,
      part_cost: 0
    }]);
  };

  const removePart = (index: number) => {
    const newParts = [...parts];
    newParts.splice(index, 1);
    setParts(newParts);
  };

  const handlePartChange = (index: number, field: keyof Part, value: string | number) => {
    const newParts = [...parts];
    newParts[index][field] = value;
    setParts(newParts);
  };

  // Função para carregar dados de uma cotação existente
  const loadExistingQuotation = async (id: string) => {
    setLoading(true);
    try {
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select('*, vehicle:vehicles(*)')
        .eq('id', id)
        .single();

      if (quotationError) {
        throw quotationError;
      }

      if (quotationData) {
        setQuotationId(quotationData.id);
        setIsEditing(true);
        
        // Preencher dados do veículo
        if (quotationData.vehicle) {
          setVehicle({
            brand: quotationData.vehicle.brand || '',
            model: quotationData.vehicle.model || '',
            year: quotationData.vehicle.year || '',
            plate: quotationData.vehicle.plate || '',
            chassis: quotationData.vehicle.chassis || '',
            images: quotationData.vehicle.images || [],
          });
          
          // Configurar imagens existentes
          if (quotationData.vehicle.images && quotationData.vehicle.images.length > 0) {
            setImageUrls(quotationData.vehicle.images);
          }
        }
        
        // Preencher peças
        if (quotationData.parts && Array.isArray(quotationData.parts)) {
          setParts(quotationData.parts);
        }
        
        // Definir o tipo de entrada
        if (quotationData.input_type) {
          setInputType(quotationData.input_type as InputType);
        }
        
        // Se for do tipo report, preencher o relatório
        if (quotationData.input_type === 'report' && quotationData.description) {
          setReport(quotationData.description);
        }
        
        // Se for do tipo bulk, precisamos reconstruir o texto
        if (quotationData.input_type === 'bulk' && quotationData.parts) {
          // Aqui você pode reconstruir o texto bulk se necessário
        }
        
        // Avançar para a etapa 3 (seleção de fornecedores)
        setCurrentStep(3);
      }
    } catch (err: any) {
      console.error('Erro ao carregar cotação:', err);
      setError('Erro ao carregar dados da cotação: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verificar se estamos editando uma cotação existente
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const editId = searchParams.get('edit');
    
    if (editId) {
      loadExistingQuotation(editId);
    }
  }, [location]);

  // Componente para o botão de upload de PDF
  const PdfUploadButton = () => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleClick = () => {
      inputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handlePdfUpload(file);
      }
      // Limpar o input para permitir selecionar o mesmo arquivo novamente
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    };

    return (
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={handleClick}
          disabled={importingPdf}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {importingPdf ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              <span>Importar dados do PDF</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="text-xs text-gray-500 mt-1 text-center">
          Suporta PDFs da Audatex e similares
        </p>
      </div>
    );
  };

  const handlePdfUpload = async (file: File) => {
    setImportingPdf(true);
    const toastId = hotToast.loading('Processando PDF...');
    
    try {
      console.log('Iniciando processamento do PDF com Gemini:', file.name, 'tamanho:', file.size, 'tipo:', file.type);
      
      // Primeiro, tentar extrair informações usando o Gemini
      const geminiResult = await extractVehicleInfoFromPDF(file);
      
      console.log('Resultado da extração com Gemini:', geminiResult);
      
      if (geminiResult.success && geminiResult.data) {
        const { brand, model, year, plate, chassis } = geminiResult.data;
        
        // Verificar se o Gemini encontrou pelo menos algumas informações
        const fieldsFound = [];
        if (brand) fieldsFound.push('marca');
        if (model) fieldsFound.push('modelo');
        if (year) fieldsFound.push('ano');
        if (plate) fieldsFound.push('placa');
        if (chassis) fieldsFound.push('chassis');
        
        console.log('Campos encontrados pelo Gemini:', fieldsFound);
        
        // Atualizar o estado do veículo com os dados extraídos pelo Gemini
        setVehicle(prev => ({
          ...prev,
          brand: brand || prev.brand,
          model: model || prev.model,
          year: year || prev.year,
          plate: plate || prev.plate,
          chassis: chassis || prev.chassis
        }));
        
        hotToast.dismiss(toastId);
        
        if (fieldsFound.length >= 3) {
          customToast.success(`Dados importados com sucesso via Gemini: ${fieldsFound.join(', ')}!`);
          setImportingPdf(false);
          return;
        } else {
          console.log('Poucos dados encontrados pelo Gemini, tentando método alternativo...');
          // Se o Gemini encontrou poucos dados, continuar com o método tradicional como fallback
        }
      } else {
        console.log('Falha na extração com Gemini, tentando método alternativo...', geminiResult.error);
        // Se o Gemini falhou, continuar com o método tradicional como fallback
      }
      
      console.log('Iniciando extração com método tradicional (fallback)');
      
      // Método tradicional (fallback) usando regex e PDF.js
      const reader = new FileReader();
      
      const readFilePromise = new Promise<string>((resolve, reject) => {
        reader.onload = (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const array = new Uint8Array(arrayBuffer);
            
            // Extrair texto do PDF de forma simples
            let text = '';
            
            // Primeiro método: extrair caracteres ASCII imprimíveis
            for (let i = 0; i < array.length; i++) {
              // Converter apenas caracteres ASCII imprimíveis
              if (array[i] >= 32 && array[i] <= 126) {
                text += String.fromCharCode(array[i]);
              }
            }
            
            // Segundo método: procurar por strings UTF-8 no arquivo
            // Isso pode ajudar a encontrar texto em português com acentos
            let utf8Text = '';
            for (let i = 0; i < array.length - 1; i++) {
              // Procurar por sequências que podem ser texto UTF-8
              if ((array[i] >= 32 && array[i] <= 126) || 
                  (array[i] >= 192 && array[i] <= 255)) { // Possíveis caracteres UTF-8
                utf8Text += String.fromCharCode(array[i]);
              }
            }
            
            // Combinar os dois métodos
            text = text + ' ' + utf8Text;
            
            // Limpar o texto: remover caracteres estranhos e normalizar espaços
            text = text.replace(/[^\x20-\x7E\xC0-\xFF]/g, ' ')  // Manter apenas caracteres ASCII e Latin-1
                       .replace(/\s+/g, ' ')                    // Normalizar espaços
                       .trim();
            
            console.log('Texto extraído (primeiros 500 caracteres):', text.substring(0, 500));
            resolve(text);
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
      });
      
      const text = await readFilePromise;
      
      // Buscar informações do veículo no texto
      let brand = '';
      let model = '';
      let year = '';
      let plate = '';
      let chassis = '';
      
      console.log('Buscando padrões no texto extraído...');
      console.log('Texto completo extraído (para debug):', text);
      
      // Método adicional: buscar por blocos de informações do veículo
      // Muitos PDFs têm blocos onde as informações do veículo estão juntas
      const vehicleInfoBlocks = [
        /ve.culo[\s\S]{0,100}marca[\s\S]{0,100}modelo[\s\S]{0,100}ano/i,
        /dados\s+do\s+ve.culo[\s\S]{0,200}/i,
        /informa..es\s+do\s+ve.culo[\s\S]{0,200}/i,
        /ve.culo[\s\S]{0,200}/i
      ];
      
      let vehicleInfoBlock = '';
      for (const pattern of vehicleInfoBlocks) {
        const match = text.match(pattern);
        if (match && match[0]) {
          vehicleInfoBlock = match[0];
          console.log('Bloco de informações do veículo encontrado:', vehicleInfoBlock);
          break;
        }
      }
      
      // Padrões para diferentes formatos de PDF
      const brandModelPatterns = [
        /Marca\/Modelo:\s*([^,\n]+)/i,
        /MULTIVEICULAR\s+([^\n]+)/i,
        /Veículo:\s*([^,\n]+)/i,
        /Ve.culo:\s*([^,\n]+)/i,
        /Marca:\s*([^\n]+)/i,
        /Fabricante:\s*([^\n]+)/i,
        /MARCA:([^,\n]+)/i,
        /MODELO:([^,\n]+)/i,
        /VEÍCULO:([^,\n]+)/i,
        /VEICULO:([^,\n]+)/i,
        /MARCA\/MODELO:([^,\n]+)/i,
        /MARCA\/MODELO\s+([^,\n]+)/i,
        /MARCA\s+E\s+MODELO\s+([^,\n]+)/i,
        /MARCA\s+E\s+MODELO:([^,\n]+)/i,
        /MARCA\s*\/\s*MODELO\s*:\s*([^,\n]+)/i,
        /MARCA\s*\/\s*MODELO\s*=\s*([^,\n]+)/i,
        /MARCA\s*\/\s*MODELO\s*-\s*([^,\n]+)/i
      ];
      
      // Função para limpar e normalizar os dados extraídos
      const cleanData = (text: string) => {
        if (!text) return '';
        // Remove caracteres especiais e espaços extras
        return text.replace(/\s+/g, ' ').trim();
      };
      
      // Tentar cada padrão até encontrar um match
      for (const pattern of brandModelPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const brandModel = match[1].trim();
          console.log(`Marca/Modelo encontrado com padrão ${pattern}: ${brandModel}`);
          
          // Tentar separar marca e modelo
          const parts = brandModel.split(/[\s\/]+/);
          if (parts.length >= 2) {
            // Se tiver mais de duas palavras, a primeira geralmente é a marca
            // e o resto é o modelo
            brand = parts[0];
            model = parts.slice(1).join(' ');
            
            // Verificar se a marca é conhecida
            const knownBrands = [
              'VOLKSWAGEN', 'VW', 'FIAT', 'CHEVROLET', 'GM', 'FORD', 'TOYOTA', 
              'HONDA', 'HYUNDAI', 'RENAULT', 'NISSAN', 'MITSUBISHI', 'CITROEN', 
              'PEUGEOT', 'BMW', 'MERCEDES', 'AUDI', 'KIA', 'JEEP', 'VOLVO', 
              'LAND', 'SUBARU', 'SUZUKI', 'CHERY', 'JAC', 'TROLLER', 'RAM', 
              'DODGE', 'CHRYSLER', 'MINI', 'PORSCHE', 'FERRARI', 'LAMBORGHINI', 
              'MASERATI', 'JAGUAR', 'LEXUS', 'LIFAN', 'SSANGYONG', 'IVECO',
              'SCANIA', 'YAMAHA', 'HONDA', 'KAWASAKI', 'DUCATI', 'HARLEY'
            ];
            
            // Se a marca não for conhecida, tentar outras combinações
            if (!knownBrands.some(kb => brand.toUpperCase().includes(kb))) {
              // Tentar outras combinações de marca/modelo
              for (let i = 1; i < parts.length; i++) {
                const testBrand = parts.slice(0, i+1).join(' ');
                if (knownBrands.some(kb => testBrand.toUpperCase().includes(kb))) {
                  brand = testBrand;
                  model = parts.slice(i+1).join(' ');
                  break;
                }
              }
            }
          } else if (parts.length === 1) {
            // Se só tiver uma palavra, provavelmente é a marca
            brand = parts[0];
          }
          
          brand = cleanData(brand);
          model = cleanData(model);
          break;
        }
      }
      
      // Se não encontrou marca/modelo juntos, procurar separadamente
      if (!brand || !model) {
        const brandPatterns = [
          /Marca:\s*([^\n,]+)/i,
          /MARCA:([^\n,]+)/i,
          /MARCA\s+([^\n,]+)/i,
          /Fabricante:\s*([^\n,]+)/i,
          /FABRICANTE:([^\n,]+)/i,
          /FABRICANTE\s+([^\n,]+)/i,
          /MARCA\s*:\s*([^\n,]+)/i,
          /MARCA\s*=\s*([^\n,]+)/i,
          /MARCA\s*-\s*([^\n,]+)/i,
          /MARCA\s*DO\s*VEICULO\s*:?\s*([^\n,]+)/i,
          /MARCA\s*DO\s*VEÍCULO\s*:?\s*([^\n,]+)/i,
          /MARCA\s*:\s*([^\/\n,]+)/i
        ];
        
        const modelPatterns = [
          /Modelo:\s*([^\n,]+)/i,
          /MODELO:([^\n,]+)/i,
          /MODELO\s+([^\n,]+)/i,
          /Versão:\s*([^\n,]+)/i,
          /VERSAO:([^\n,]+)/i,
          /VERSÃO:([^\n,]+)/i,
          /MODELO\s*:\s*([^\n,]+)/i,
          /MODELO\s*=\s*([^\n,]+)/i,
          /MODELO\s*-\s*([^\n,]+)/i,
          /VERSAO\s*:\s*([^\n,]+)/i,
          /VERSÃO\s*:\s*([^\n,]+)/i,
          /MODELO\s*DO\s*VEICULO\s*:?\s*([^\n,]+)/i,
          /MODELO\s*DO\s*VEÍCULO\s*:?\s*([^\n,]+)/i,
          /MODELO\s*:\s*([^\/\n,]+)/i
        ];
        
        // Procurar marca
        for (const pattern of brandPatterns) {
          let textToSearch = vehicleInfoBlock || text;
          const match = textToSearch.match(pattern);
          if (match && match[1]) {
            brand = match[1].trim();
            console.log(`Marca encontrada com padrão ${pattern}: ${brand}`);
            break;
          }
        }
        
        // Procurar modelo
        for (const pattern of modelPatterns) {
          let textToSearch = vehicleInfoBlock || text;
          const match = textToSearch.match(pattern);
          if (match && match[1]) {
            model = match[1].trim();
            console.log(`Modelo encontrado com padrão ${pattern}: ${model}`);
            break;
          }
        }
      }
      
      // Procurar por ano do veículo - padrões expandidos
      const yearPatterns = [
        /Ano:\s*(\d{4})/i,
        /(\d{4})\s*\-\s*\d{4}/,
        /Ano Fab\/Mod:\s*(\d{4})/i,
        /Ano\s*(\d{4})/i,
        /Fab\.:\s*(\d{4})/i,
        /ANO:(\d{4})/i,
        /ANO FAB:(\d{4})/i,
        /ANO MODELO:(\d{4})/i,
        /ANO\s+(\d{4})/i,
        /ANO MOD\s+(\d{4})/i,
        /MOD\s+(\d{4})/i,
        /ANO\s*:\s*(\d{4})/i,
        /ANO\s*=\s*(\d{4})/i,
        /ANO\s*-\s*(\d{4})/i,
        /ANO\s*FAB\s*:\s*(\d{4})/i,
        /ANO\s*MOD\s*:\s*(\d{4})/i,
        /ANO\s*DO\s*VEICULO\s*:?\s*(\d{4})/i,
        /ANO\s*DO\s*VEÍCULO\s*:?\s*(\d{4})/i,
        /ANO\s*DE\s*FABRICACAO\s*:?\s*(\d{4})/i,
        /ANO\s*DE\s*FABRICAÇÃO\s*:?\s*(\d{4})/i
      ];
      
      for (const pattern of yearPatterns) {
        let textToSearch = vehicleInfoBlock || text;
        const match = textToSearch.match(pattern);
        if (match && match[1]) {
          year = match[1].trim();
          console.log(`Ano encontrado com padrão ${pattern}: ${year}`);
          break;
        }
      }
      
      // Busca genérica por anos (4 dígitos entre 1980 e ano atual + 1)
      if (!year) {
        const currentYear = new Date().getFullYear() + 1;
        const yearRegex = new RegExp(`\\b(19[8-9][0-9]|20[0-${Math.floor(currentYear / 10) % 10}][0-${currentYear % 10}])\\b`, 'g');
        const allYears = Array.from(text.matchAll(yearRegex), m => m[1]);
        
        if (allYears.length > 0) {
          // Pegar o primeiro ano encontrado como possível ano do veículo
          year = allYears[0];
          console.log(`Ano encontrado com busca genérica: ${year}`);
        }
      }
      
      // Padrões para placa do veículo - expandidos
      const platePatterns = [
        /Placa:\s*([A-Z0-9]{7})/i,
        /PLACA:([A-Z0-9]{7})/i,
        /PLACA\s+([A-Z0-9]{7})/i,
        /PLACA\s*:\s*([A-Z0-9]{7})/i,
        /PLACA\s*=\s*([A-Z0-9]{7})/i,
        /PLACA\s*-\s*([A-Z0-9]{7})/i,
        /PLACA\s*DO\s*VEICULO\s*:?\s*([A-Z0-9]{7})/i,
        /PLACA\s*DO\s*VEÍCULO\s*:?\s*([A-Z0-9]{7})/i,
        // Padrões para placas no formato XXX-YYYY ou XXX0X00
        /Placa:\s*([A-Z]{3}[\s\-]?[0-9][A-Z0-9][0-9]{2})/i,
        /PLACA:([A-Z]{3}[\s\-]?[0-9][A-Z0-9][0-9]{2})/i,
        /PLACA\s+([A-Z]{3}[\s\-]?[0-9][A-Z0-9][0-9]{2})/i,
        /PLACA\s*:\s*([A-Z]{3}[\s\-]?[0-9][A-Z0-9][0-9]{2})/i,
        /PLACA\s*=\s*([A-Z]{3}[\s\-]?[0-9][A-Z0-9][0-9]{2})/i,
        /PLACA\s*-\s*([A-Z]{3}[\s\-]?[0-9][A-Z0-9][0-9]{2})/i,
        // Padrões para placas no formato antigo (AAA-9999)
        /Placa:\s*([A-Z]{3}[\s\-]?[0-9]{4})/i,
        /PLACA:([A-Z]{3}[\s\-]?[0-9]{4})/i,
        /PLACA\s+([A-Z]{3}[\s\-]?[0-9]{4})/i,
        /PLACA\s*:\s*([A-Z]{3}[\s\-]?[0-9]{4})/i,
        /PLACA\s*=\s*([A-Z]{3}[\s\-]?[0-9]{4})/i,
        /PLACA\s*-\s*([A-Z]{3}[\s\-]?[0-9]{4})/i
      ];
      
      for (const pattern of platePatterns) {
        let textToSearch = vehicleInfoBlock || text;
        const match = textToSearch.match(pattern);
        if (match && match[1]) {
          plate = match[1].trim().toUpperCase().replace(/[\s\-]/g, '');
          console.log(`Placa encontrada com padrão ${pattern}: ${plate}`);
          break;
        }
      }
      
      // Busca genérica por padrões de placa
      if (!plate) {
        // Formato antigo: ABC1234 ou ABC-1234
        const oldPlatePattern = /\b([A-Z]{3})[-]?([0-9]{4})\b/gi;
        // Formato Mercosul: ABC1D23 ou ABC-1D23
        const mercosulPlatePattern = /\b([A-Z]{3})[-]?([0-9]{1}[A-Z]{1}[0-9]{2})\b/gi;
        
        let match = oldPlatePattern.exec(text) || mercosulPlatePattern.exec(text);
        if (match) {
          plate = match[0].replace(/[^A-Z0-9]/gi, '').toUpperCase();
          console.log(`Placa encontrada com busca genérica: ${plate}`);
        }
      }
      
      // Padrões para chassis do veículo - expandidos
      const chassisPatterns = [
        /Chassi:\s*([A-Z0-9]{17})/i,
        /CHASSI:([A-Z0-9]{17})/i,
        /CHASSI\s+([A-Z0-9]{17})/i,
        /CHASSI\s*:\s*([A-Z0-9]{17})/i,
        /CHASSI\s*=\s*([A-Z0-9]{17})/i,
        /CHASSI\s*-\s*([A-Z0-9]{17})/i,
        /CHASSI\s*DO\s*VEICULO\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSI\s*DO\s*VEÍCULO\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSI\s*Nº\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSI\s*N\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSI\s*NUM\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSI\s*NÚMERO\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSI\s*NUMERO\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSIS:\s*([A-Z0-9]{17})/i,
        /CHASSIS\s+([A-Z0-9]{17})/i,
        /CHASSIS\s*:\s*([A-Z0-9]{17})/i,
        /CHASSIS\s*=\s*([A-Z0-9]{17})/i,
        /CHASSIS\s*-\s*([A-Z0-9]{17})/i,
        /CHASSIS\s*DO\s*VEICULO\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSIS\s*DO\s*VEÍCULO\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSIS\s*Nº\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSIS\s*N\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSIS\s*NUM\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSIS\s*NÚMERO\s*:?\s*([A-Z0-9]{17})/i,
        /CHASSIS\s*NUMERO\s*:?\s*([A-Z0-9]{17})/i,
        // Buscar por N° do Chassi
        /N°\s*DO\s*CHASSI\s*:?\s*([A-Z0-9]{17})/i,
        /Nº\s*DO\s*CHASSI\s*:?\s*([A-Z0-9]{17})/i,
        /N\s*DO\s*CHASSI\s*:?\s*([A-Z0-9]{17})/i,
        /NUM\s*DO\s*CHASSI\s*:?\s*([A-Z0-9]{17})/i,
        /NUMERO\s*DO\s*CHASSI\s*:?\s*([A-Z0-9]{17})/i,
        /NÚMERO\s*DO\s*CHASSI\s*:?\s*([A-Z0-9]{17})/i
      ];
      
      for (const pattern of chassisPatterns) {
        let textToSearch = vehicleInfoBlock || text;
        const match = textToSearch.match(pattern);
        if (match && match[1]) {
          chassis = match[1].trim().toUpperCase();
          console.log(`Chassis encontrado com padrão ${pattern}: ${chassis}`);
          break;
        }
      }
      
      // Busca genérica por padrões de chassis (17 caracteres alfanuméricos)
      if (!chassis) {
        // Padrão de chassis: 17 caracteres alfanuméricos, sem I, O, Q
        const genericChassisPattern = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
        const match = text.match(genericChassisPattern);
        if (match && match[1]) {
          chassis = match[1].trim().toUpperCase();
          console.log(`Chassis encontrado com padrão genérico: ${chassis}`);
        }
      }
      
      // Verificar se encontramos pelo menos algumas informações
      const fieldsFound = [];
      if (brand) fieldsFound.push('marca');
      if (model) fieldsFound.push('modelo');
      if (year) fieldsFound.push('ano');
      if (plate) fieldsFound.push('placa');
      if (chassis) fieldsFound.push('chassis');
      
      console.log('Informações encontradas no PDF:');
      console.log('Marca:', brand);
      console.log('Modelo:', model);
      console.log('Ano:', year);
      console.log('Placa:', plate);
      console.log('Chassis:', chassis);
      
      if (fieldsFound.length === 0) {
        console.log('Nenhuma informação do veículo foi encontrada no PDF');
        console.log('Texto completo extraído:', text);
        throw new Error('Não foi possível extrair informações do veículo do PDF. Verifique se o arquivo está no formato correto.');
      }
      
      // Limpar e normalizar todos os dados
      brand = cleanData(brand);
      model = cleanData(model);
      year = cleanData(year);
      plate = cleanData(plate);
      chassis = cleanData(chassis);
      
      // Atualizar o estado do veículo com os dados extraídos
      setVehicle(prev => ({
        ...prev,
        brand: brand || prev.brand,
        model: model || prev.model,
        year: year || prev.year,
        plate: plate || prev.plate,
        chassis: chassis || prev.chassis
      }));
      
      hotToast.dismiss(toastId);
      
      if (fieldsFound.length >= 3) {
        customToast.success(`Dados importados com sucesso: ${fieldsFound.join(', ')}!`);
      } else {
        customToast.warning('Importação concluída, mas poucos dados foram encontrados. Verifique e complete manualmente.');
      }
    } catch (err: any) {
      console.error('Erro ao processar PDF:', err);
      
      // Capturar detalhes do erro
      let errorDetails = '';
      if (err instanceof Error) {
        errorDetails = `${err.name}: ${err.message}`;
        console.error('Stack trace:', err.stack);
      } else if (typeof err === 'object') {
        errorDetails = JSON.stringify(err, Object.getOwnPropertyNames(err));
      } else {
        errorDetails = String(err);
      }
      
      let errorMessage = 'Erro ao processar o arquivo PDF';
      if (errorDetails) {
        errorMessage += `: ${errorDetails}`;
      }
      
      console.error('Mensagem de erro completa:', errorMessage);
      
      if (toastId) {
        hotToast.dismiss(toastId);
      }
      customToast.error(errorMessage);
    } finally {
      setImportingPdf(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Nova Cotação</h1>
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${currentStep >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`h-2 w-2 rounded-full ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`h-2 w-2 rounded-full ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`} />
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}
      </div>

      {currentStep < 3 ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">Dados do Veículo</h2>
                
                <div className="mb-6 bg-gray-50 p-4 rounded-md border border-gray-200">
                  <PdfUploadButton />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Marca *
                    </label>
                    <input
                      type="text"
                      name="brand"
                      value={vehicle.brand}
                      onChange={handleVehicleChange}
                      required
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Modelo *
                    </label>
                    <input
                      type="text"
                      name="model"
                      value={vehicle.model}
                      onChange={handleVehicleChange}
                      required
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ano *
                    </label>
                    <input
                      type="text"
                      name="year"
                      value={vehicle.year}
                      onChange={handleVehicleChange}
                      required
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Placa
                    </label>
                    <input
                      type="text"
                      name="plate"
                      value={vehicle.plate}
                      onChange={handleVehicleChange}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chassi
                    </label>
                    <input
                      type="text"
                      name="chassis"
                      value={vehicle.chassis}
                      onChange={handleVehicleChange}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Fotos do Veículo</h2>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'}`}
                >
                  <input {...getInputProps()} />
                  <div className="space-y-2">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="text-gray-600">
                      Arraste e solte as imagens aqui, ou clique para selecionar
                    </p>
                    <p className="text-sm text-gray-500">
                      PNG, JPG, JPEG até 10MB
                    </p>
                  </div>
                </div>

                {imageUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    {imageUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Como deseja adicionar as peças?</h2>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setInputType('manual')}
                    className={`p-4 rounded-lg border-2 text-center transition-colors
                      ${inputType === 'manual' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-blue-500'}`}
                  >
                    <Plus className="mx-auto h-8 w-8 mb-2" />
                    <div className="font-medium">Manual</div>
                    <p className="text-sm text-gray-500">Adicione peças uma a uma</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputType('bulk')}
                    className={`p-4 rounded-lg border-2 text-center transition-colors
                      ${inputType === 'bulk' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-blue-500'}`}
                  >
                    <Upload className="mx-auto h-8 w-8 mb-2" />
                    <div className="font-medium">Lista de Texto</div>
                    <p className="text-sm text-gray-500">Cole uma lista de peças</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputType('report')}
                    className={`p-4 rounded-lg border-2 text-center transition-colors
                      ${inputType === 'report' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-blue-500'}`}
                  >
                    <FileText className="mx-auto h-8 w-8 mb-2" />
                    <div className="font-medium">Relatório</div>
                    <p className="text-sm text-gray-500">
                      Descreva as peças necessárias
                    </p>
                  </button>
                </div>
              </div>

              {inputType === 'manual' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Lista de Peças</h3>
                    <button
                      type="button"
                      onClick={addPart}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Peça
                    </button>
                  </div>

                  {parts.map((part, index) => (
                    <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Operação *
                            </label>
                            <select
                              value={part.operation}
                              onChange={(e) => handlePartChange(index, 'operation', e.target.value)}
                              required
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Selecione...</option>
                              <option value="TROCAR">TROCAR</option>
                              <option value="TROCAR/PINTAR">TROCAR/PINTAR</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Código *
                            </label>
                            <input
                              type="text"
                              value={part.code}
                              onChange={(e) => handlePartChange(index, 'code', e.target.value)}
                              required
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Descrição *
                          </label>
                          <input
                            type="text"
                            value={part.description}
                            onChange={(e) => handlePartChange(index, 'description', e.target.value)}
                            required
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Tipo da Peça *
                            </label>
                            <select
                              value={part.part_type}
                              onChange={(e) => handlePartChange(index, 'part_type', e.target.value)}
                              required
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Selecione...</option>
                              <option value="genuine">Genuína</option>
                              <option value="new">Nova</option>
                              <option value="used">Usada</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Quantidade *
                            </label>
                            <input
                              type="number"
                              value={part.quantity}
                              onChange={(e) => handlePartChange(index, 'quantity', parseInt(e.target.value))}
                              required
                              min="1"
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Horas Pintura
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={part.painting_hours}
                              onChange={(e) => handlePartChange(index, 'painting_hours', parseFloat(e.target.value))}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Horas Trabalho
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={part.labor_hours}
                              onChange={(e) => handlePartChange(index, 'labor_hours', parseFloat(e.target.value))}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Custo Trabalho
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={part.labor_cost}
                              onChange={(e) => handlePartChange(index, 'labor_cost', parseFloat(e.target.value))}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Custo Peça
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={part.part_cost}
                              onChange={(e) => handlePartChange(index, 'part_cost', parseFloat(e.target.value))}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                      {parts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePart(index)}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {inputType === 'bulk' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cole sua lista de peças (uma por linha)
                    </label>
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      rows={10}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex:&#10;71103T5NM50 (I) ACAB DIR FAROL NEBL (f) Genuína 1&#10;74100T5NA10 (I) PARA-BARRO DIA DIR (f) Genuína 1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        await processBulkText();
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Processar Lista
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAbbreviationsModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Book className="h-5 w-5 mr-2" />
                      Abreviações
                    </button>
                  </div>
                  {parts.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-lg font-medium mb-4">Peças Processadas</h4>
                      <div className="space-y-4">
                        {parts.map((part, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 mb-2">
                              <div>
                                <span className="font-medium">CÓD. PEÇA:</span> {part.code}
                              </div>
                              <div>
                                <span className="font-medium">Quantidade:</span> {part.quantity}
                              </div>
                            </div>
                            <div className="mb-2">
                              <span className="font-medium">Descrição:</span>{' '}
                              <input
                                type="text"
                                value={part.description}
                                onChange={(e) => {
                                  const newParts = [...parts];
                                  newParts[index].description = e.target.value;
                                  setParts(newParts);
                                }}
                                className="border-b border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 ml-1 w-3/4"
                              />
                            </div>
                            <div>
                              <span className="font-medium">Custo Peça:</span> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(part.part_cost)}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newParts = [...parts];
                                newParts.splice(index, 1);
                                setParts(newParts);
                              }}
                              className="mt-2 text-red-600 hover:text-red-800 text-sm"
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setParts([])}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Limpar Lista
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {inputType === 'report' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descreva as peças necessárias
                    </label>
                    <textarea
                      value={report}
                      onChange={(e) => setReport(e.target.value)}
                      rows={10}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Descreva aqui as peças necessárias, incluindo detalhes relevantes como quantidade, especificações, etc."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-6">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Voltar
              </button>
            ) : null}
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={nextStep}
                className="ml-auto inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Próximo
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="ml-auto inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Cotação'
                )}
              </button>
            )}
          </div>
        </form>
      ) : quotationId ? (
        <div className="space-y-6">
          <SupplierSelection
            quotationId={quotationId}
            vehicleDetails={{
              marca: vehicle.brand,
              modelo: vehicle.model,
              ano: vehicle.year,
              placa: vehicle.plate
            }}
            parts={parts}
            images={vehicle.images}
            onFinish={() => navigate('/quotations')}
          />
        </div>
      ) : null}

      <TextAbbreviationsModal
        isOpen={isAbbreviationsModalOpen}
        onClose={() => setIsAbbreviationsModalOpen(false)}
        onAbbreviationsUpdated={() => {
          // Reprocessa o texto quando as abreviações são atualizadas
          if (bulkText) {
            processBulkText();
          }
        }}
      />
    </div>
  );
};

export default VehicleQuotationForm;
