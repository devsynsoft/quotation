import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { checkEvolutionConnection } from '../../services/evolutionApi';

interface WhatsAppConfigType {
  id?: string;
  instance_name: string;
  evolution_api_key: string;
  evolution_api_url: string;
  user_id?: string;
  created_at?: string;
}

interface ConnectionStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'LOADING' | null;
  qrcode?: string;
  error?: string;
}

export function WhatsAppSettings() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [connectionStatus, setConnectionStatus] = React.useState<ConnectionStatus>({ status: null });
  const [config, setConfig] = React.useState<WhatsAppConfigType>({
    evolution_api_url: '',
    evolution_api_key: '',
    instance_name: ''
  });

  React.useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_configs')
        .select('instance_name, evolution_api_key, evolution_api_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setConfig({
          evolution_api_url: data.evolution_api_url || '',
          evolution_api_key: data.evolution_api_key || '',
          instance_name: data.instance_name || ''
        });
      }
    } catch (err) {
      console.error('Error fetching config:', err);
      setError('Erro ao buscar configuração');
    }
  }

  async function checkConnection() {
    setConnectionStatus({ status: 'LOADING' });
    setError('');
    
    try {
      if (!config.evolution_api_url || !config.evolution_api_key || !config.instance_name) {
        throw new Error('Por favor, preencha todos os campos antes de verificar a conexão');
      }

      const response = await checkEvolutionConnection(
        config.instance_name,
        config.evolution_api_key,
        config.evolution_api_url
      );

      if (response.error) {
        throw new Error(response.error);
      }

      setConnectionStatus({
        status: response.instance?.state === 'open' ? 'CONNECTED' : 'DISCONNECTED',
        qrcode: response.qrcode
      });

      if (response.instance?.state === 'open') {
        setError('');
      }
    } catch (err) {
      console.error('Connection error:', err);
      setConnectionStatus({ 
        status: 'DISCONNECTED',
        error: err instanceof Error ? err.message : 'Erro desconhecido'
      });
      setError(err instanceof Error ? err.message : 'Erro ao verificar conexão com o WhatsApp');
    }
  }

  async function saveConfig() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!config.evolution_api_url || !config.evolution_api_key || !config.instance_name) {
        throw new Error('Por favor, preencha todos os campos');
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('whatsapp_configs')
        .upsert({
          user_id: user.id,
          evolution_api_url: config.evolution_api_url.trim(),
          evolution_api_key: config.evolution_api_key.trim(),
          instance_name: config.instance_name.trim()
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Atualiza o estado local com os dados salvos
      if (data) {
        setConfig({
          evolution_api_url: data.evolution_api_url,
          evolution_api_key: data.evolution_api_key,
          instance_name: data.instance_name
        });
      }

      setSuccess('Configuração salva com sucesso!');
      
      // Verifica a conexão com os novos dados
      await checkConnection();
    } catch (err) {
      console.error('Error saving config:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-6">Configuração do WhatsApp</h2>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      <div className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">URL da API</label>
            <input
              type="text"
              value={config.evolution_api_url}
              onChange={e => setConfig(prev => ({ ...prev, evolution_api_url: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="https://evolution.synsoft.com.br"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Chave da API</label>
            <input
              type="password"
              value={config.evolution_api_key}
              onChange={e => setConfig(prev => ({ ...prev, evolution_api_key: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Sua chave da API"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nome da Instância</label>
            <input
              type="text"
              value={config.instance_name}
              onChange={e => setConfig(prev => ({ ...prev, instance_name: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Nome único para sua instância"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            disabled={loading}
            onClick={saveConfig}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configuração'
            )}
          </button>

          <button
            type="button"
            onClick={checkConnection}
            disabled={loading || !config.evolution_api_url || !config.evolution_api_key || !config.instance_name}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Verificar Conexão
          </button>
        </div>

        {connectionStatus.status === 'LOADING' && (
          <div className="mt-4 flex items-center justify-center text-gray-500">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verificando conexão...
          </div>
        )}

        {connectionStatus.status === 'CONNECTED' && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            WhatsApp conectado com sucesso!
          </div>
        )}

        {connectionStatus.status === 'DISCONNECTED' && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg">
            {connectionStatus.error || 'WhatsApp desconectado. Por favor, escaneie o QR Code no aplicativo Evolution API.'}
          </div>
        )}
      </div>
    </div>
  );
}
