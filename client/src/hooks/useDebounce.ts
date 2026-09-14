import { useState, useEffect } from 'react';

/**
 * useDebounce — кастомный хук для дебаунса (задержки) быстроменяющихся значений.
 * Предотвращает частые вызовы тяжелых функций (например, фильтрации) при вводе текста.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Устанавливаем таймер для обновления значения после задержки
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Очищаем таймер при изменении значения или размонтировании
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
