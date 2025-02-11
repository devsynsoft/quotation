import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Trash2, Plus, Upload, FileText, Loader2 } from 'lucide-react';
import SupplierSelection from './SupplierSelection';
import { QuotationPartForm, QuotationPart } from './quotations/QuotationPartForm';

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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [inputType, setInputType] = useState<InputType>('manual');
  const [quotationId, setQuotationId] = useState<string | null>(null);
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

  const processBulkText = () => {
    // Dividir o texto em linhas e filtrar linhas vazias
    const lines = bulkText.split('\n').filter(line => line.trim());

    // Remove a primeira linha (cabeçalho)
    const dataLines = lines.slice(1);

    // Processar cada linha
    const newParts = dataLines.map(line => {
      // Divide a linha em partes
      const parts = line.split(/\s+/);
      
      // Se não tiver partes suficientes, ignora a linha
      if (parts.length < 6) return null;

      // Extrai a operação (pode ser "TROCAR" ou "TROCAR /PINTAR")
      let operation = parts[0];
      let currentIndex = 1;
      
      if (parts[1] === '/PINTAR') {
        operation = 'TROCAR/PINTAR';
        currentIndex = 2;
      }

      // Pega o código
      const code = parts[currentIndex];
      currentIndex++;

      // Pega a descrição (tudo entre o código e o tipo da peça)
      let description = '';
      while (currentIndex < parts.length && !['Genuína', 'Nova', 'Usada'].includes(parts[currentIndex])) {
        description += parts[currentIndex] + ' ';
        currentIndex++;
      }

      // Pega o tipo da peça
      const partType = parts[currentIndex];
      currentIndex++;

      // Pega a quantidade
      const quantity = parseInt(parts[currentIndex]) || 1;
      currentIndex++;

      // Avança até encontrar o último número (horas pintura)
      while (currentIndex < parts.length - 1) {
        currentIndex++;
      }

      // Pega as horas de pintura (último número da linha)
      const paintingHours = parseFloat(parts[parts.length - 1]) || 0;
      
      return {
        operation: operation,
        code: code,
        description: description.trim(),
        part_type: partType === 'Genuína' ? 'genuine' : 
                  partType === 'Usada' ? 'used' : 'new',
        quantity: quantity,
        painting_hours: paintingHours,
        labor_hours: 0,
        labor_cost: 0,
        part_cost: 0
      };
    }).filter((part): part is Part => part !== null);
    
    setParts(newParts);
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

      // Upload das imagens primeiro
      const imageUrls = await uploadImages();
      console.log('URLs das imagens:', imageUrls);

      // Inserir veículo
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

      // Criar cotação
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .insert({
          vehicle_id: vehicleData.id,
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

      console.log('Cotação criada:', quotationData);

      setQuotationId(quotationData.id);
      setCurrentStep(3); // Avançar para seleção de fornecedores
    } catch (err: any) {
      console.error('Erro ao enviar:', err);
      setError(err.message || 'Erro ao criar cotação');
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
                <div className="grid grid-cols-2 gap-4">
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
                    <p className="text-sm text-gray-500">Descreva as peças necessárias</p>
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      processBulkText();
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Processar Lista
                  </button>
                  {parts.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-lg font-medium mb-4">Peças Processadas</h4>
                      <div className="space-y-4">
                        {parts.map((part, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 mb-2">
                              <div>
                                <span className="font-medium">Código:</span> {part.code}
                              </div>
                              <div>
                                <span className="font-medium">Operação:</span> {part.operation}
                              </div>
                            </div>
                            <div className="mb-2">
                              <span className="font-medium">Descrição:</span> {part.description}
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <span className="font-medium">Tipo:</span> {part.part_type}
                              </div>
                              <div>
                                <span className="font-medium">Quantidade:</span> {part.quantity}
                              </div>
                              <div>
                                <span className="font-medium">Horas Pintura:</span> {part.painting_hours}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <span className="font-medium">Horas Trabalho:</span> {part.labor_hours}
                              </div>
                              <div>
                                <span className="font-medium">Custo Trabalho:</span> {part.labor_cost}
                              </div>
                              <div>
                                <span className="font-medium">Custo Peça:</span> {part.part_cost}
                              </div>
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
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Voltar
              </button>
            )}
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
          <h2 className="text-xl font-semibold mb-4">Selecione os Fornecedores</h2>
          <SupplierSelection
            quotationId={quotationId}
            vehicleDetails={{
              marca: vehicle.brand,
              modelo: vehicle.model,
              ano: vehicle.year,
              placa: vehicle.plate,
              chassis: vehicle.chassis
            }}
            parts={parts}
            images={vehicle.images}
            onFinish={() => navigate('/quotations')}
          />
        </div>
      ) : null}
    </div>
  );
};

export default VehicleQuotationForm;
