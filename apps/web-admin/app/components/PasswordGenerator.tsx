"use client";

import { Button } from "flowbite-react";
import { RefreshCw } from "lucide-react";

interface PasswordGeneratorProps {
  onGenerate: (password: string) => void;
  disabled?: boolean;
}

function generateSecurePassword(length: number = 32): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  // Ensure at least one character from each category
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export function PasswordGenerator({ onGenerate, disabled = false }: PasswordGeneratorProps) {
  const handleGenerate = () => {
    const newPassword = generateSecurePassword(32);
    onGenerate(newPassword);
  };

  return (
    <Button
      type="button"
      color="gray"
      outline
      size="sm"
      onClick={handleGenerate}
      disabled={disabled}
      className="shrink-0"
    >
      <RefreshCw className="w-4 h-4 mr-2" />
      Generate
    </Button>
  );
}