"use client";

import { Button } from "flowbite-react";
import { RefreshCw } from "lucide-react";

interface PasswordGeneratorProps {
  onGenerate: (password: string) => void;
  disabled?: boolean;
}

function getSecureRandomIndex(maxExclusive: number): number {
  const maxUint32 = 0x1_0000_0000;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const randomValue = new Uint32Array(1);

  do {
    crypto.getRandomValues(randomValue);
  } while (randomValue[0] >= limit);

  return randomValue[0] % maxExclusive;
}

function shuffleSecurely(characters: string[]): string {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = getSecureRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
}

function generateSecurePassword(length: number = 32): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const password: string[] = [];

  // Ensure at least one character from each category
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";

  password.push(lowercase[getSecureRandomIndex(lowercase.length)]);
  password.push(uppercase[getSecureRandomIndex(uppercase.length)]);
  password.push(numbers[getSecureRandomIndex(numbers.length)]);
  password.push(symbols[getSecureRandomIndex(symbols.length)]);

  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password.push(charset[getSecureRandomIndex(charset.length)]);
  }

  // Shuffle the password to avoid predictable category positions.
  return shuffleSecurely(password);
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
      onClick={handleGenerate}
      disabled={disabled}
      className="shrink-0 h-[42px] px-4"
    >
      <RefreshCw className="w-4 h-4 mr-2" />
      Generate
    </Button>
  );
}
