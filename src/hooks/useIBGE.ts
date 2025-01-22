import { useState, useEffect } from 'react';

interface IBGEState {
  id: number;
  sigla: string;
  nome: string;
}

interface IBGECity {
  id: number;
  nome: string;
}

export function useIBGE() {
  const [states, setStates] = useState<IBGEState[]>([]);
  const [cities, setCities] = useState<IBGECity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStates() {
      setLoading(true);
      setError('');
      
      try {
        const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
        if (!response.ok) throw new Error('Erro ao buscar estados');
        
        const data = await response.json();
        setStates(data);
      } catch (err) {
        console.error('Erro ao buscar estados:', err);
        setError('Erro ao carregar estados');
      } finally {
        setLoading(false);
      }
    }

    fetchStates();
  }, []);

  async function fetchCities(stateId: number) {
    setLoading(true);
    setError('');
    setCities([]); // Limpa cidades ao trocar de estado
    
    try {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateId}/municipios?orderBy=nome`);
      if (!response.ok) throw new Error('Erro ao buscar cidades');
      
      const data = await response.json();
      setCities(data);
    } catch (err) {
      console.error('Erro ao buscar cidades:', err);
      setError('Erro ao carregar cidades');
    } finally {
      setLoading(false);
    }
  }

  return {
    states,
    cities,
    loading,
    error,
    fetchCities
  };
}
