import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function PartsList() {
  const [parts, setParts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    fetchParts();
  }, []);

  async function fetchParts() {
    setLoading(true);
    setError('');
    
    try {
      console.log('Fetching parts...');
      const { data, error } = await supabase
        .from('parts')
        .select(`
          *,
          vehicle:vehicles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching parts:', error);
        throw error;
      }

      console.log('Parts data:', data);
      setParts(data || []);
    } catch (err: any) {
      console.error('Error in fetchParts:', err);
      setError('Erro ao carregar peças: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Tem certeza que deseja excluir esta peça?')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('parts')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      
      setParts(parts.filter(part => part.id !== id));
    } catch (err: any) {
      console.error('Error in handleDelete:', err);
      setError('Erro ao excluir peça: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Peças</h1>
        <Link
          to="/parts/new"
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Nova Peça
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : parts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhuma peça cadastrada
        </div>
      ) : (
        <div className="grid gap-4">
          {parts.map((part) => (
            <div
              key={part.id}
              className="bg-white p-4 rounded-lg shadow flex justify-between items-center"
            >
              <div>
                <h3 className="font-medium">{part.name}</h3>
                <p className="text-sm text-gray-600">
                  {part.vehicle?.brand} {part.vehicle?.model} ({part.vehicle?.manufacturing_year}/{part.vehicle?.model_year})
                </p>
                {part.description && (
                  <p className="text-sm text-gray-500 mt-1">{part.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(part.id)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}