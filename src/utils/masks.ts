export function maskCNPJ(value: string): string {
  return value
    .replace(/\D/g, '') // Remove tudo o que não é dígito
    .replace(/^(\d{2})(\d)/, '$1.$2') // Coloca ponto após os dois primeiros dígitos
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3') // Coloca ponto após os próximos três dígitos
    .replace(/\.(\d{3})(\d)/, '.$1/$2') // Coloca barra após os próximos três dígitos
    .replace(/(\d{4})(\d)/, '$1-$2') // Coloca hífen após os próximos quatro dígitos
    .slice(0, 18); // Limita o tamanho
}

export function maskPhone(value: string): string {
  return value
    .replace(/\D/g, '') // Remove tudo o que não é dígito
    .replace(/^(\d{2})(\d)/, '($1) $2') // Coloca parênteses em volta dos dois primeiros dígitos
    .replace(/(\d)(\d{4})$/, '$1-$2') // Coloca hífen entre o quarto e o quinto dígitos
    .slice(0, 15); // Limita o tamanho
}

export function maskCPF(value: string): string {
  return value
    .replace(/\D/g, '') // Remove tudo o que não é dígito
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca ponto após os três primeiros dígitos
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca ponto após os próximos três dígitos
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2') // Coloca hífen antes dos dois últimos dígitos
    .slice(0, 14); // Limita o tamanho
}

export function maskCEP(value: string): string {
  return value
    .replace(/\D/g, '') // Remove tudo o que não é dígito
    .replace(/^(\d{5})(\d)/, '$1-$2') // Coloca hífen após os cinco primeiros dígitos
    .slice(0, 9); // Limita o tamanho
}

export function maskNumber(value: string): string {
  return value
    .replace(/\D/g, '') // Remove tudo o que não é dígito
    .slice(0, 11); // Limita o tamanho
}

export function maskWhatsApp(value: string): string {
  // Remove tudo que não é dígito
  const numbers = value.replace(/\D/g, '');
  
  // Se começar com 0, remove
  const withoutLeadingZero = numbers.replace(/^0/, '');
  
  // Se começar com 55, mantém, senão adiciona
  const withCountryCode = withoutLeadingZero.startsWith('55') 
    ? withoutLeadingZero 
    : `55${withoutLeadingZero}`;

  // Garante que tem 13 dígitos (55 + DDD + 9 + número)
  return withCountryCode.slice(0, 13);
}
