import React from 'react';
import { Loader2, QrCode, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface WhatsAppConfigType {
  instance_name: string;
  evolution_api_key: string;
  evolution_api_url: string;
}

interface ConnectionStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'LOADING' | null;
  qrcode?: string;
}

export function WhatsAppConfig() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [connectionStatus, setConnectionStatus] = React.useState<ConnectionStatus>({ status: null });
  const [config, setConfig] = React.useState<WhatsAppConfigType>({
    instance_name: '',
    evolution_api_url: '',
    evolution_api_key: ''
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
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig({
          instance_name: data.instance_name || '',
          evolution_api_url: data.evolution_api_url || '',
          evolution_api_key: data.evolution_api_key || ''
        });
      }
    } catch (err) {
      console.error('Erro ao buscar configuração:', err);
      setError('Erro ao buscar configuração');
    }
  }

  async function handleSubmit() {
    console.log('Button clicked!');
    console.log('Current config:', config);
    
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);
      
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('whatsapp_configs')
        .upsert({
          user_id: user.id,
          instance_name: config.instance_name.trim(),
          evolution_api_url: config.evolution_api_url.trim(),
          evolution_api_key: config.evolution_api_key.trim()
        });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Config saved successfully!');
      
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  }

  async function checkConnection() {
    console.log('Verificando conexão...');
    setConnectionStatus({ status: 'LOADING' });
    
    try {
      console.log('Config atual:', config);
      // Remove espaços e barras extras
      const baseUrl = config.evolution_api_url.trim().replace(/\/+$/, '');
      console.log('URL normalizada:', baseUrl);
      
      const url = `${baseUrl}/instance/connectionState/${config.instance_name}`;
      console.log('URL completa:', url);

      const response = await fetch(url, {
        headers: {
          'apikey': config.evolution_api_key.trim()
        }
      });

      console.log('Resposta da API:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro da API:', errorText);
        throw new Error('Erro ao verificar conexão');
      }

      const data = await response.json();
      console.log('Dados da conexão:', data);
      
      setConnectionStatus({
        status: data.state === 'open' ? 'CONNECTED' : 'DISCONNECTED',
        qrcode: data.qrcode
      });
    } catch (err) {
      console.error('Erro ao verificar conexão:', err);
      setConnectionStatus({ status: 'DISCONNECTED' });
      setError('Erro ao verificar conexão com o WhatsApp. Verifique se a URL e a chave da API estão corretas.');
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

      <form className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome da Instância</label>
            <input
              type="text"
              value={config.instance_name}
              onChange={e => {
                console.log('Instance name changed:', e.target.value);
                setConfig(prev => ({ ...prev, instance_name: e.target.value }));
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Nome único para sua instância"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">URL da API</label>
            <input
              type="url"
              value={config.evolution_api_url}
              onChange={e => {
                console.log('API URL changed:', e.target.value);
                setConfig(prev => ({ ...prev, evolution_api_url: e.target.value }));
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="https://evolution.synsoft.com.br"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Chave da API</label>
            <input
              type="password"
              value={config.evolution_api_key}
              onChange={e => {
                console.log('API Key changed:', e.target.value);
                setConfig(prev => ({ ...prev, evolution_api_key: e.target.value }));
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Sua chave da API"
              required
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </button>
        </div>

        {connectionStatus.status !== null && (
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={checkConnection}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Verificar Conexão
            </button>
            <div className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  connectionStatus.status === 'CONNECTED'
                    ? 'bg-green-500'
                    : connectionStatus.status === 'LOADING'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-sm">
                {connectionStatus.status === 'CONNECTED'
                  ? 'Conectado'
                  : connectionStatus.status === 'LOADING'
                  ? 'Verificando...'
                  : 'Desconectado'}
              </span>
            </div>
          </div>
        )}
      </form>

      {connectionStatus.qrcode && (
        <div className="mt-8">
          <div className="flex items-center space-x-2 mb-4">
            <QrCode className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-medium">QR Code para Conexão</h3>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <img
              src={connectionStatus.qrcode}
              alt="QR Code para conectar o WhatsApp"
              className="mx-auto"
            />
            <p className="text-sm text-gray-500 text-center mt-4">
              Escaneie o QR Code com seu WhatsApp para conectar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}