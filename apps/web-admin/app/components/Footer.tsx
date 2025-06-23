import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full py-6">
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        © 2025 ModularIoT –{' '}
        <Link href="https://github.com/modulariot/modulariot" className="hover:underline">
          GitHub
        </Link>{' '}
        •{' '}
        <Link href="/docs" className="hover:underline">
          Docs
        </Link>{' '}
        •{' '}
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
      </p>
    </footer>
  )
} 