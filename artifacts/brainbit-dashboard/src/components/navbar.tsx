import { Link, useLocation } from 'wouter';
import { Brain, Info } from 'lucide-react';

export function Navbar() {
  const [location] = useLocation();
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Brain className="w-6 h-6 text-primary" />
          <span className="font-semibold tracking-tight text-lg">BrainBit Dash</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link 
            href="/" 
            className={`${location === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Dashboard
          </Link>
          <Link 
            href="/about" 
            className={`${location === '/about' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <span className="flex items-center gap-1"><Info className="w-4 h-4"/> About</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
