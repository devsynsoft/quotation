import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function VehicleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = React.useState(false);
  const [vehicle, setVehicle] = React.useState({
    brand: '',
    model: '',
    manufacturing_year: new Date().getFullYear(),
    model_year: new Date().getFullYear(),
    license_plate: '',
    chassis: '',
    images: [] as string[]
  });

  React.useEffect(() => {
    if (id) {
      async function fetchVehicle() {
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Erro ao buscar veículo:', error);
          return;
        }

        if (data) {
          setVehicle(data);
        }
      }

      fetchVehicle();
    }
  }, [id]);

  const onDrop = React.useCallback(async (acceptedFiles: File[]) => {
    const newImages = [...vehicle.images];
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Usuário não autenticado');
      return;
    }
    
    for (const file of acceptedFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('vehicle-images')
        .upload(`${user.id}/${fileName}`, file);

      if (uploadError) {
        console.error('Erro ao enviar imagem:', uploadError);
        continue;
      }

      if (data) {
        const { data: { publicUrl } } = supabase.storage
          .from('vehicle-images')
          .getPublicUrl(`${user.id}/${fileName}`);
        newImages.push(publicUrl);
      }
    }

    setVehicle(prev => ({ ...prev, images: newImages }));
  }, [vehicle.images]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png']
    }
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Usuário não autenticado');
      setLoading(false);
      return;
    }

    const vehicleData = {
      ...vehicle,
      user_id: user.id
    };

    const { error } = id
      ? await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', id)
      : await supabase
          .from('vehicles')
          .insert([vehicleData]);

    setLoading(false);

    if (error) {
      console.error('Erro ao salvar veículo:', error);
      return;
    }

    navigate('/');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {id ? 'Editar Veículo' : 'Adicionar Veículo'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Marca</label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={vehicle.brand}
            onChange={e => setVehicle(prev => ({ ...prev, brand: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Modelo</label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={vehicle.model}
            onChange={e => setVehicle(prev => ({ ...prev, model: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Ano Fabricação</label>
            <input
              type="number"
              required
              min="1900"
              max={new Date().getFullYear() + 1}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={vehicle.manufacturing_year}
              onChange={e => setVehicle(prev => ({ ...prev, manufacturing_year: parseInt(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Ano Modelo</label>
            <input
              type="number"
              required
              min="1900"
              max={new Date().getFullYear() + 1}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={vehicle.model_year}
              onChange={e => setVehicle(prev => ({ ...prev, model_year: parseInt(e.target.value) }))}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Placa</label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={vehicle.license_plate}
            onChange={e => setVehicle(prev => ({ ...prev, license_plate: e.target.value.toUpperCase() }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Chassi</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={vehicle.chassis}
            onChange={e => setVehicle(prev => ({ ...prev, chassis: e.target.value.toUpperCase() }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Imagens</label>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Arraste e solte as imagens aqui, ou clique para selecionar
            </p>
          </div>

          {vehicle.images.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              {vehicle.images.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Vehicle ${index + 1}`}
                  className="h-24 w-full object-cover rounded-lg"
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Salvar Veículo'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}