import { useEffect, useState } from "react";

export default function usePersistentState(storageKey, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const savedValue = localStorage.getItem(storageKey);
      return savedValue ? JSON.parse(savedValue) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey, value]);

  return [value, setValue];
}
